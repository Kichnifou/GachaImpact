import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTVerifyGetKey } from 'jose';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { TwitchPilotService, TWITCH_FAVOR_SCOPES } from '../src/application/twitch/twitch-pilot-service.js';
import type { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { TwitchEventSubSubscriptionManager } from '../src/application/twitch/twitch-eventsub-subscription-manager.js';
import { TwitchEventSubClient, type TwitchEventSubSubscription } from '../src/infrastructure/twitch/twitch-eventsub-client.js';
import { TwitchAppAccessTokenProvider } from '../src/infrastructure/twitch/twitch-app-access-token-provider.js';

const fixture = isolatedBatchDatabase(), db = fixture.database;
const callback = 'https://backend.example/api/v1/twitch/eventsub';
let privateKey: Awaited<ReturnType<typeof generateKeyPair>>['privateKey'], keys: JWTVerifyGetKey;
beforeAll(async () => {
  await fixture.setup({ seedPublicCatalog: true });
  const pair = await generateKeyPair('RS256'); privateKey = pair.privateKey;
  keys = createLocalJWKSet({ keys: [{ ...await exportJWK(pair.publicKey), kid: 'private-test', alg: 'RS256', use: 'sig' }] });
}, 60_000);
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  await fixture.cleanup();
  const inspector = new pg.Client({ connectionString: process.env['DATABASE_URL'] });
  try { await inspector.connect(); expect((await inspector.query('SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname = $1', [fixture.schema])).rows).toHaveLength(0); }
  finally { await inspector.end(); }
}, 60_000);
async function setup() {
  const player = await db.player.create({ data: { displayName: `Private lifecycle ${randomUUID().slice(0, 8)}` } });
  const identity = { subject: `private-lifecycle-${randomUUID()}` };
  await db.webIdentity.create({ data: { playerId: player.id, provider: 'supabase', providerSubject: identity.subject } });
  const userId = String(Date.now()) + String(Math.floor(Math.random() * 1_000_000));
  await db.twitchIdentity.create({ data: { playerId: player.id, twitchUserId: userId, login: 'private_pilot' } });
  const config = { host: '127.0.0.1', port: 3001, supabase: {}, twitch: { clientId: 'private-client', clientSecret: 'private-client-secret', redirectUri: 'https://backend.example/api/v1/me/twitch/callback', pilotPlayerIds: [player.id], pilotLogin: 'private_pilot' },
    twitchEventSub: { enabled: true, secret: 'private-webhook-secret', callbackUrl: callback } };
  const network = vi.fn<typeof fetch>(), tokenNetwork = vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify({ access_token: 'private-app-token', token_type: 'bearer', expires_in: 1000 })));
  const manager = new TwitchEventSubSubscriptionManager(db, config, new TwitchEventSubClient('private-client', new TwitchAppAccessTokenProvider('private-client', 'private-client-secret', tokenNetwork), network));
  const service = new TwitchPilotService(db, { execute: async () => ({ id: player.id }) } as unknown as GetCurrentPlayer, config, keys, manager);
  return { player, userId, service, network, manager, identity };
}
async function oauth(userId: string, nonce: string, beforeProfile?: () => Promise<void>) {
  const token = await new SignJWT({ sub: userId, nonce }).setProtectedHeader({ alg: 'RS256', kid: 'private-test' })
    .setIssuer('https://id.twitch.tv/oauth2').setAudience('private-client').setIssuedAt().setExpirationTime('5m').sign(privateKey);
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
    const url = String(input);
    if (url === 'https://id.twitch.tv/oauth2/token') return new Response(JSON.stringify({ access_token: 'private-user-token', id_token: token, refresh_token: 'private-refresh-token' }));
    if (url === 'https://id.twitch.tv/oauth2/validate') return new Response(JSON.stringify({ client_id: 'private-client', user_id: userId, login: 'private_pilot', scopes: TWITCH_FAVOR_SCOPES }));
    if (url === 'https://api.twitch.tv/helix/users') { await beforeProfile?.(); return new Response(JSON.stringify({ data: [{ id: userId, login: 'private_pilot', display_name: 'Private Pilot' }] })); }
    throw new Error('Unexpected network endpoint in private test');
  });
}
describe('private PostgreSQL Faveur OAuth and safe multi-subscription unlink', () => {
  it('keeps all three purpose states non-interchangeable and consumes Faveur once under concurrency', async () => {
    const { service, identity, player } = await setup();
    const urls = await Promise.all([service.start(identity), service.startRuntime(identity), service.startFavor(identity)]);
    const states = urls.map(value => new URL(value.url).searchParams.get('state')!);
    const suffix = states[2]!.slice('favor_'.length);
    const forbidden = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('No live OAuth in state test'));
    for (const altered of [suffix, `runtime_${suffix}`])
      await expect(service.callback({ state: altered, error: 'access_denied' })).rejects.toMatchObject({ code: 'TWITCH_STATE_INVALID' });
    expect(await db.twitchLinkState.count({ where: { playerId: player.id } })).toBe(3);
    const settled = await Promise.allSettled([service.callback({ state: states[2], error: 'access_denied' }), service.callback({ state: states[2], error: 'access_denied' })]);
    expect(settled.map(result => result.status === 'rejected' ? result.reason.code : 'unexpected').sort()).toEqual(['TWITCH_AUTH_DENIED', 'TWITCH_STATE_INVALID']);
    expect(await db.twitchLinkState.count({ where: { playerId: player.id } })).toBe(2);
    await db.twitchLinkState.updateMany({ where: { playerId: player.id }, data: { expiresAt: new Date('2000-01-01') } });
    for (const state of states.slice(0, 2)) await expect(service.callback({ state, error: 'access_denied' })).rejects.toMatchObject({ code: 'TWITCH_STATE_INVALID' });
    const expiredFavor = new URL((await service.startFavor(identity)).url).searchParams.get('state')!;
    await db.twitchLinkState.updateMany({ where: { playerId: player.id }, data: { expiresAt: new Date('2000-01-01') } });
    await expect(service.callback({ state: expiredFavor, error: 'access_denied' })).rejects.toMatchObject({ code: 'TWITCH_STATE_INVALID' });
    expect(forbidden).not.toHaveBeenCalled();
  });
  it.each([['enabled', 'enabled', 'enabled'], ['enabled', 'enabled', 'webhook_callback_verification_pending'], ['enabled', 'webhook_callback_verification_pending', 'enabled'], ['webhook_callback_verification_pending', 'enabled', 'enabled'], ['webhook_callback_verification_pending', 'webhook_callback_verification_pending', 'webhook_callback_verification_pending']])('validates signed OAuth then ensures group %s / %s / %s using the App token, without tokens/identity/economy persisted', async (status, giftStatus, resubStatus) => {
    const { service, identity, userId, network, player } = await setup();
    const before = await db.twitchIdentity.findUniqueOrThrow({ where: { playerId: player.id } });
    const url = new URL((await service.startFavor(identity)).url), state = url.searchParams.get('state')!;
    await oauth(userId, url.searchParams.get('nonce')!);
    const subscription = { id: randomUUID(), type: 'channel.subscribe', version: '1', status, condition: { broadcaster_user_id: userId }, transport: { method: 'webhook', callback } };
    network.mockResolvedValueOnce(new Response(JSON.stringify({ data: [], pagination: {} }))).mockResolvedValueOnce(new Response(JSON.stringify({ data: [subscription] }), { status: 202 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [], pagination: {} }))).mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ ...subscription, id: randomUUID(), type: 'channel.subscription.gift', status: giftStatus }] }), { status: 202 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [], pagination: {} }))).mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ ...subscription, id: randomUUID(), type: 'channel.subscription.message', status: resubStatus }] }), { status: 202 }));
    expect(await service.callback({ state, code: 'private-code' })).toEqual({ favorRuntimeActivated: true, favorSubscriptionPending: status !== 'enabled' || giftStatus !== 'enabled' || resubStatus !== 'enabled' });
    expect(await db.twitchIdentity.findUniqueOrThrow({ where: { playerId: player.id } })).toEqual(before);
    expect(await db.twitchLinkState.count({ where: { playerId: player.id } })).toBe(0);
    expect(JSON.stringify(await db.twitchIdentity.findMany())).not.toMatch(/private-user-token|private-refresh-token|private-app-token|private-code/);
    expect(network.mock.calls[1]![1]?.headers).toMatchObject({ authorization: 'Bearer private-app-token', 'client-id': 'private-client' });
    expect(JSON.parse(String(network.mock.calls[1]![1]?.body))).toEqual({ type: 'channel.subscribe', version: '1', condition: { broadcaster_user_id: userId }, transport: { method: 'webhook', callback, secret: 'private-webhook-secret' } });
    await expect(service.callback({ state, code: 'private-code' })).rejects.toMatchObject({ code: 'TWITCH_STATE_INVALID' });
    expect(await Promise.all([db.favorGrant.count(), db.favorDailyClaim.count(), db.businessOperation.count(), db.resourceMovement.count(), db.twitchEventReceipt.count()])).toEqual([0, 0, 0, 0, 0]);
  });
  it('rejects an unlink completed during callback without creating a subscription or restoring identity', async () => {
    const value = await setup(), url = new URL((await value.service.startFavor(value.identity)).url);
    value.network.mockImplementation(async () => new Response(JSON.stringify({ data: [], pagination: {} })));
    await oauth(value.userId, url.searchParams.get('nonce')!, () => value.service.unlink(value.identity).then(() => undefined));
    await expect(value.service.callback({ state: url.searchParams.get('state')!, code: 'private-code' })).rejects.toMatchObject({ code: 'TWITCH_ACCOUNT_MISMATCH' });
    expect(await db.twitchIdentity.findUnique({ where: { playerId: value.player.id } })).toBeNull();
    expect(value.network.mock.calls.map(([, options]) => options?.method)).toEqual(['GET', 'GET', 'GET', 'GET']);
  });
  it('preserves the identity after partially stopping Chat and completes Faveur unlink on retry', async () => {
    const value = await setup(), before = await db.player.findUniqueOrThrow({ where: { id: value.player.id } });
    const subscriptions: TwitchEventSubSubscription[] = [
      { id: 'private-chat', type: 'channel.chat.message', version: '1', status: 'enabled', condition: { broadcaster_user_id: value.userId, user_id: value.userId }, transport: { method: 'webhook', callback } },
      { id: 'private-resub', type: 'channel.subscription.message', version: '1', status: 'enabled', condition: { broadcaster_user_id: value.userId }, transport: { method: 'webhook', callback } },
      { id: 'private-gift', type: 'channel.subscription.gift', version: '1', status: 'enabled', condition: { broadcaster_user_id: value.userId }, transport: { method: 'webhook', callback } },
      { id: 'private-favor', type: 'channel.subscribe', version: '1', status: 'enabled', condition: { broadcaster_user_id: value.userId }, transport: { method: 'webhook', callback } },
    ];
    let failFavor = true;
    value.network.mockImplementation(async (input, options) => {
      const url = new URL(String(input));
      if (options?.method === 'GET') return new Response(JSON.stringify({ data: subscriptions.filter(item => item.type === url.searchParams.get('type')), pagination: {} }));
      const id = url.searchParams.get('id');
      expect(await db.twitchIdentity.findUnique({ where: { playerId: value.player.id } })).not.toBeNull();
      if (id === 'private-favor' && failFavor) return new Response('{}', { status: 503 });
      const index = subscriptions.findIndex(item => item.id === id); if (index >= 0) subscriptions.splice(index, 1);
      return new Response(null, { status: 204 });
    });
    await expect(value.service.unlink(value.identity)).rejects.toMatchObject({ code: 'TWITCH_EVENTSUB_API_FAILED' });
    expect(subscriptions.map(item => item.id)).toEqual(['private-resub', 'private-gift', 'private-favor']);
    expect(await db.twitchIdentity.findUnique({ where: { playerId: value.player.id } })).not.toBeNull();
    failFavor = false; expect(await value.service.unlink(value.identity)).toEqual({ linked: false });
    expect(subscriptions).toEqual([]); expect(await db.twitchIdentity.findUnique({ where: { playerId: value.player.id } })).toBeNull();
    expect(await db.player.findUniqueOrThrow({ where: { id: value.player.id } })).toEqual(before);
  });
});
