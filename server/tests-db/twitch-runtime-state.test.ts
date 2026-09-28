import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { TwitchPilotService } from '../src/application/twitch/twitch-pilot-service.js';
import type { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { TwitchEventSubSubscriptionManager } from '../src/application/twitch/twitch-eventsub-subscription-manager.js';
import { TwitchEventSubClient } from '../src/infrastructure/twitch/twitch-eventsub-client.js';
import { TwitchAppAccessTokenProvider } from '../src/infrastructure/twitch/twitch-app-access-token-provider.js';

const fixture = isolatedBatchDatabase();
let playerId: string;
let service: TwitchPilotService;
const network = vi.fn<typeof fetch>();
const identity = { subject: 'private-runtime-fixture' };
beforeAll(async () => {
  await fixture.setup();
  const player = await fixture.database.player.create({ data: { displayName: 'Private runtime state' } }); playerId = player.id;
  await fixture.database.twitchIdentity.create({ data: { playerId, twitchUserId: '12345', login: 'kichnifou' } });
  const config = { host: '127.0.0.1', port: 3001, supabase: {}, twitch: { clientId: 'test-client', clientSecret: 'test-secret', redirectUri: 'https://backend.example/api/v1/me/twitch/callback', pilotPlayerIds: [playerId], pilotLogin: 'kichnifou' },
    twitchEventSub: { enabled: true, secret: 'private-test-secret', callbackUrl: 'https://backend.example/api/v1/twitch/eventsub' } };
  const tokens = new TwitchAppAccessTokenProvider('test-client', 'test-secret', vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify({ access_token: 'private-app', token_type: 'bearer', expires_in: 1_000 }))));
  const manager = new TwitchEventSubSubscriptionManager(fixture.database, config, new TwitchEventSubClient('test-client', tokens, network));
  service = new TwitchPilotService(fixture.database, { execute: async () => ({ id: playerId }) } as unknown as GetCurrentPlayer, config, undefined, manager);
}, 60_000);
afterAll(() => fixture.cleanup(), 60_000);
describe('private DB runtime OAuth states', () => {
  it('binds the purpose to the whole state and atomically consumes it once under concurrency', async () => {
    const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('No live Twitch calls allowed'));
    try {
      const state = new URL((await service.startRuntime(identity)).url).searchParams.get('state')!;
      await expect(service.callback({ state: state.slice('runtime_'.length), error: 'access_denied' })).rejects.toMatchObject({ code: 'TWITCH_STATE_INVALID' });
      expect(await fixture.database.twitchLinkState.count()).toBe(1);
      const results = await Promise.allSettled([service.callback({ state, error: 'access_denied' }), service.callback({ state, error: 'access_denied' })]);
      const codes = results.map(result => result.status === 'rejected' ? (result.reason as { code: string }).code : 'unexpected-success').sort();
      expect(codes).toEqual(['TWITCH_AUTH_DENIED', 'TWITCH_STATE_INVALID']);
      expect(await fixture.database.twitchLinkState.count()).toBe(0);
      expect(await fixture.database.twitchIdentity.count()).toBe(1);
      expect(await fixture.database.twitchEventReceipt.count()).toBe(0);
      expect(network).not.toHaveBeenCalled();
    } finally { network.mockRestore(); }
  });
  it('rejects an expired runtime state', async () => {
    const state = new URL((await service.startRuntime(identity)).url).searchParams.get('state')!;
    await fixture.database.twitchLinkState.updateMany({ data: { expiresAt: new Date('2000-01-01') } });
    await expect(service.callback({ state, error: 'access_denied' })).rejects.toMatchObject({ code: 'TWITCH_STATE_INVALID' });
  });
  it('keeps the real private identity on upstream failure and removes it only after confirmed subscription deletion', async () => {
    const db = fixture.database;
    const subscription = { id: 'private-subscription', type: 'channel.chat.message', version: '1', status: 'enabled',
      condition: { broadcaster_user_id: '12345', user_id: '12345' }, transport: { method: 'webhook', callback: 'https://backend.example/api/v1/twitch/eventsub' } };
    network.mockResolvedValueOnce(new Response(JSON.stringify({ data: [subscription], pagination: {} }))).mockResolvedValueOnce(new Response(null, { status: 503 }));
    await expect(service.unlink(identity)).rejects.toMatchObject({ code: 'TWITCH_EVENTSUB_API_FAILED' });
    expect(await db.twitchIdentity.count()).toBe(1);
    await db.twitchEventReceipt.create({ data: { externalEventId: 'private-historical-receipt', eventType: 'channel.chat.message', twitchUserId: '12345' } });
    const receiptsBefore = await db.twitchEventReceipt.findMany();
    const playerBefore = await db.player.findUniqueOrThrow({ where: { id: playerId } });
    network.mockResolvedValueOnce(new Response(JSON.stringify({ data: [subscription], pagination: {} }))).mockResolvedValueOnce(new Response(null, { status: 204 }));
    expect(await service.unlink(identity)).toEqual({ linked: false });
    expect(await db.twitchIdentity.count()).toBe(0);
    expect(await db.player.findUniqueOrThrow({ where: { id: playerId } })).toEqual(playerBefore);
    expect(await db.twitchEventReceipt.findMany()).toEqual(receiptsBefore);
    expect(await Promise.all([db.webIdentity.count(), db.playerProgression.count(), db.playerResourceBalance.count(), db.businessOperation.count(), db.resourceMovement.count(), db.globalChatMessage.count(), db.notification.count()])).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});
