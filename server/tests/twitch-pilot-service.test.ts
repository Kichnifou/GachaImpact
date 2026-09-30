import { createHash } from 'node:crypto';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTVerifyGetKey } from 'jose';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import type { AuthenticatedIdentity } from '../src/domain/identity/authenticated-identity.js';
import { AppError } from '../src/api/errors.js';
import { TwitchPilotService, TWITCH_RUNTIME_SCOPES, TWITCH_FAVOR_SCOPES, twitchOAuthPurpose, verifyTwitchIdToken } from '../src/application/twitch/twitch-pilot-service.js';
import type { TwitchEventSubSubscriptionManager } from '../src/application/twitch/twitch-eventsub-subscription-manager.js';

const playerId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const identity = { subject: 'web-subject' } as AuthenticatedIdentity;
const config = { host: '127.0.0.1', port: 3001, frontendOrigin: 'https://game.example', supabase: {}, twitch: {
  clientId: 'client', clientSecret: 'server-secret', redirectUri: 'https://api.example/api/v1/me/twitch/callback', pilotPlayerIds: [playerId], pilotLogin: 'kichnifou',
} };
const state = 'A'.repeat(43);
const nonce = 'B'.repeat(43);
const nonceHash = createHash('sha256').update(nonce).digest('hex');
let privateKey: Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];
let keys: JWTVerifyGetKey;
beforeAll(async () => {
  const pair = await generateKeyPair('RS256');
  privateKey = pair.privateKey;
  keys = createLocalJWKSet({ keys: [{ ...await exportJWK(pair.publicKey), kid: 'test-key', alg: 'RS256', use: 'sig' }] });
});
function setup(id = playerId, runtime = false) {
  const db = {
    twitchIdentity: { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn().mockResolvedValue({}), deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    twitchLinkState: { create: vi.fn().mockResolvedValue({}) },
    twitchGiveawayCredential: { findUnique: vi.fn().mockResolvedValue(null), deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    giveawaySession: { findFirst: vi.fn().mockResolvedValue(null) },
    migrationRun: { findFirst: vi.fn().mockResolvedValue(null) },
    $queryRaw: vi.fn().mockResolvedValue([{ player_id: id, nonce_hash: nonceHash }]),
  };
  const getPlayer = { execute: vi.fn().mockResolvedValue({ id }) };
  const subscriptions = { activationAvailable: true, managementAvailable: true,
    ensurePilotChatSubscription: vi.fn().mockResolvedValue({ status: 'enabled' }),
    ensurePilotFavorSubscription: vi.fn().mockResolvedValue({ status: 'enabled' }),
    inspectPilotChatSubscription: vi.fn().mockResolvedValue('INACTIVE'),
    inspectPilotFavorSubscription: vi.fn().mockResolvedValue('INACTIVE'),
    disablePilotChatSubscription: vi.fn().mockResolvedValue('INACTIVE'),
    disablePilotFavorSubscription: vi.fn().mockResolvedValue('INACTIVE'),
    unlinkPilotIdentity: vi.fn(async (_id: string, remove: () => Promise<void>) => {
      await subscriptions.disablePilotChatSubscription(_id); await subscriptions.disablePilotFavorSubscription(_id); await remove(); }) };
  return { db, subscriptions, service: new TwitchPilotService(db as unknown as PrismaClient, getPlayer as unknown as GetCurrentPlayer,
    runtime ? { ...config, twitchEventSub: { enabled: true, secret: 'test-secret', callbackUrl: 'https://backend.example/api/v1/twitch/eventsub' } } : config,
    keys, runtime ? subscriptions as unknown as TwitchEventSubSubscriptionManager : undefined) };
}
async function signedToken(overrides: Record<string, unknown> = {}, signingKey = privateKey) {
  const payload = { sub: '12345', nonce, ...overrides };
  return new SignJWT(payload).setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuer('https://id.twitch.tv/oauth2').setAudience('client')
    .setIssuedAt().setExpirationTime('5m').sign(signingKey);
}
async function mockTwitch(login = 'kichnifou', userId = '12345', scopes: readonly string[] = ['openid'], claims: Record<string, unknown> = {}) {
  const fetchMock = vi.spyOn(globalThis, 'fetch');
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'transient', id_token: await signedToken(claims), refresh_token: 'discarded' }) } as Response);
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ client_id: 'client', user_id: userId, login, scopes }) } as Response);
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: userId, login, display_name: 'Kichnifou' }] }) } as Response);
}
afterEach(() => vi.restoreAllMocks());

describe('separate Faveur OAuth purpose', () => {
  const linked = { playerId, twitchUserId: '12345', login: 'kichnifou', displayName: 'Original', linkedAt: new Date() };
  const favorState = `favor_${state}`;
  const favorSetup = () => { const value = setup(playerId, true); value.db.twitchIdentity.findUnique.mockResolvedValue(linked); return value; };
  it('requests only openid and subscriptions with hashed, fresh state and separate nonce, without activating', async () => {
    const { service, db, subscriptions } = favorSetup();
    const first = new URL((await service.startFavor(identity)).url), second = new URL((await service.startFavor(identity)).url);
    expect(first.searchParams.get('scope')?.split(' ')).toEqual(['openid', 'channel:read:subscriptions']);
    expect(first.searchParams.get('state')).toMatch(/^favor_[A-Za-z0-9_-]{43}$/);
    expect(first.searchParams.get('nonce')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.searchParams.get('state')?.slice(6)).not.toBe(first.searchParams.get('nonce'));
    expect(first.searchParams.get('state')).not.toBe(second.searchParams.get('state'));
    expect(first.searchParams.get('nonce')).not.toBe(second.searchParams.get('nonce'));
    expect(db.twitchLinkState.create.mock.calls[0]![0].data).toMatchObject({ playerId,
      stateHash: createHash('sha256').update(first.searchParams.get('state')!).digest('hex'),
      nonceHash: createHash('sha256').update(first.searchParams.get('nonce')!).digest('hex') });
    expect(db.twitchLinkState.create.mock.calls[0]![0].data.expiresAt.getTime() - Date.now()).toBeGreaterThan(590_000);
    expect(subscriptions.ensurePilotChatSubscription).not.toHaveBeenCalled(); expect(subscriptions.ensurePilotFavorSubscription).not.toHaveBeenCalled();
  });
  it('requires a pilot, configured transport/OAuth and an existing identity', async () => {
    await expect(setup(otherId, true).service.startFavor(identity)).rejects.toMatchObject({ code: 'TWITCH_PILOT_FORBIDDEN' });
    await expect(setup().service.startFavor(identity)).rejects.toMatchObject({ code: 'TWITCH_RUNTIME_UNAVAILABLE' });
    const { service, db } = setup(playerId, true);
    await expect(service.startFavor(identity)).rejects.toMatchObject({ code: 'TWITCH_RUNTIME_IDENTITY_REQUIRED' });
    expect(db.twitchLinkState.create).not.toHaveBeenCalled();
  });
  const purposes = ['LINK_IDENTITY', 'AUTHORIZE_RUNTIME', 'AUTHORIZE_FAVOR_SUBSCRIPTIONS'] as const;
  const states = [state, `runtime_${state}`, favorState];
  it.each(purposes.flatMap((purpose, i) => purposes.filter(expected => expected !== purpose).map(expected => [states[i]!, expected] as const)))
    ('rejects state %s in purpose %s before consumption', async (inputState, expected) => {
      const { service, db } = favorSetup();
      await expect(service.callback({ state: inputState, code: 'test' }, expected)).rejects.toMatchObject({ code: 'TWITCH_STATE_INVALID' });
      expect(db.$queryRaw).not.toHaveBeenCalled();
    });
  it('hashes the complete Faveur purpose and rejects changing its prefix or replaying it', async () => {
    const { service, db, subscriptions } = favorSetup();
    let consumed = false;
    db.$queryRaw.mockImplementation(async (_query: unknown, digest: string) => {
      if (consumed || digest !== createHash('sha256').update(favorState).digest('hex')) return [];
      consumed = true; return [{ player_id: playerId, nonce_hash: nonceHash }];
    });
    for (const altered of [state, `runtime_${state}`])
      await expect(service.callback({ state: altered, code: 'test' })).rejects.toMatchObject({ code: 'TWITCH_STATE_INVALID' });
    await mockTwitch('kichnifou', '12345', TWITCH_FAVOR_SCOPES);
    expect(await service.callback({ state: favorState, code: 'test' })).toEqual({ favorRuntimeActivated: true, favorSubscriptionPending: false });
    await expect(service.callback({ state: favorState, code: 'test' })).rejects.toMatchObject({ code: 'TWITCH_STATE_INVALID' });
    expect(subscriptions.ensurePilotFavorSubscription).toHaveBeenCalledOnce();
  });
  it.each(['enabled', 'webhook_callback_verification_pending'])('ensures only Faveur after all checks (%s) without persisting tokens or identity', async status => {
    const { service, db, subscriptions } = favorSetup(); await mockTwitch('kichnifou', '12345', TWITCH_FAVOR_SCOPES);
    subscriptions.ensurePilotFavorSubscription.mockResolvedValue({ status });
    expect(await service.callback({ state: favorState, code: 'private-code' })).toEqual({ favorRuntimeActivated: true, favorSubscriptionPending: status !== 'enabled' });
    expect(subscriptions.ensurePilotFavorSubscription).toHaveBeenCalledWith(playerId, '12345', 'kichnifou');
    expect(subscriptions.ensurePilotChatSubscription).not.toHaveBeenCalled(); expect(db.twitchIdentity.upsert).not.toHaveBeenCalled();
    expect(JSON.stringify([db.twitchLinkState.create.mock.calls, db.$queryRaw.mock.calls])).not.toMatch(/transient|discarded|private-code/);
    expect(twitchOAuthPurpose(favorState)).toBe('AUTHORIZE_FAVOR_SUBSCRIPTIONS');
  });
  it.each(TWITCH_FAVOR_SCOPES)('rejects a missing %s scope before ensure', async missing => {
    const { service, subscriptions } = favorSetup();
    await mockTwitch('kichnifou', '12345', TWITCH_FAVOR_SCOPES.filter(scope => scope !== missing));
    await expect(service.callback({ state: favorState, code: 'test' })).rejects.toMatchObject({
      code: missing === 'openid' ? 'TWITCH_IDENTITY_INVALID' : 'TWITCH_FAVOR_SCOPES_MISSING' });
    expect(subscriptions.ensurePilotFavorSubscription).not.toHaveBeenCalled();
  });
  it.each([
    ['subject', 'kichnifou', '98765', { sub: '98765' }, 'TWITCH_ACCOUNT_MISMATCH'],
    ['login', 'different', '12345', {}, 'TWITCH_ACCOUNT_MISMATCH'],
    ['nonce', 'kichnifou', '12345', { nonce: 'C'.repeat(43) }, 'TWITCH_NONCE_INVALID'],
  ] as const)('rejects inconsistent %s', async (_label, login, id, claims, code) => {
    const { service, db, subscriptions } = favorSetup(); await mockTwitch(login, id, TWITCH_FAVOR_SCOPES, claims);
    await expect(service.callback({ state: favorState, code: 'test' })).rejects.toMatchObject({ code });
    expect(subscriptions.ensurePilotFavorSubscription).not.toHaveBeenCalled(); expect(db.twitchIdentity.upsert).not.toHaveBeenCalled();
  });
  it.each(['client', 'helix-id', 'helix-login'] as const)('rejects inconsistent %s response', async bad => {
    const { service, subscriptions } = favorSetup(); await mockTwitch('kichnifou', '12345', TWITCH_FAVOR_SCOPES);
    vi.mocked(fetch).mockReset().mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'transient', id_token: await signedToken() }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ client_id: bad === 'client' ? 'other' : 'client', user_id: '12345', login: 'kichnifou', scopes: TWITCH_FAVOR_SCOPES }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: bad === 'helix-id' ? '99999' : '12345', login: bad === 'helix-login' ? 'other' : 'kichnifou' }] }) } as Response);
    await expect(service.callback({ state: favorState, code: 'test' })).rejects.toMatchObject({ code: bad === 'client' ? 'TWITCH_IDENTITY_INVALID' : 'TWITCH_PROFILE_FAILED' });
    expect(subscriptions.ensurePilotFavorSubscription).not.toHaveBeenCalled();
  });
  it('fails after concurrent unlink or unavailable activation without recreating identity', async () => {
    const { service, db, subscriptions } = favorSetup(); await mockTwitch('kichnifou', '12345', TWITCH_FAVOR_SCOPES);
    db.twitchIdentity.findUnique.mockResolvedValueOnce(linked).mockResolvedValueOnce(linked).mockResolvedValueOnce(null);
    await expect(service.callback({ state: favorState, code: 'test' })).rejects.toMatchObject({ code: 'TWITCH_ACCOUNT_MISMATCH' });
    expect(subscriptions.ensurePilotFavorSubscription).not.toHaveBeenCalled(); expect(db.twitchIdentity.upsert).not.toHaveBeenCalled();
    vi.restoreAllMocks(); await mockTwitch('kichnifou', '12345', TWITCH_FAVOR_SCOPES);
    db.twitchIdentity.findUnique.mockResolvedValue(linked); subscriptions.activationAvailable = false;
    await expect(service.callback({ state: favorState, code: 'test' })).rejects.toMatchObject({ code: 'TWITCH_RUNTIME_UNAVAILABLE' });
  });
});

describe('Twitch identity pilot', () => {
  it('gates non-pilot Players on the backend', async () => {
    const { service } = setup(otherId);
    await expect(service.start(identity)).rejects.toMatchObject({ code: 'TWITCH_PILOT_FORBIDDEN' });
    await expect(service.unlink(identity)).rejects.toMatchObject({ code: 'TWITCH_PILOT_FORBIDDEN' });
  });
  it('starts a code grant with distinct fresh state and nonce', async () => {
    const { service, db } = setup();
    const url = new URL((await service.start(identity)).url);
    expect(url.hostname).toBe('id.twitch.tv');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('openid');
    expect(url.searchParams.get('state')).toHaveLength(43);
    expect(url.searchParams.get('nonce')).toHaveLength(43);
    expect(url.searchParams.get('nonce')).not.toBe(url.searchParams.get('state'));
    expect(db.twitchLinkState.create.mock.calls[0]?.[0]?.data.nonceHash).toBe(createHash('sha256').update(url.searchParams.get('nonce')!).digest('hex'));
    expect(JSON.stringify(db.twitchLinkState.create.mock.calls)).not.toContain('server-secret');
  });
  it('rejects absent, false, expired and replayed state', async () => {
    const { service, db } = setup();
    await expect(service.callback({ code: 'code' })).rejects.toMatchObject({ code: 'TWITCH_STATE_INVALID' });
    await expect(service.callback({ state: 'false', code: 'code' })).rejects.toMatchObject({ code: 'TWITCH_STATE_INVALID' });
    db.$queryRaw.mockResolvedValueOnce([]);
    await expect(service.callback({ state, code: 'code' })).rejects.toMatchObject({ code: 'TWITCH_STATE_INVALID' });
  });
  it('checks signature, issuer, audience, expiry, sub and nonce', async () => {
    await expect(verifyTwitchIdToken(await signedToken(), 'client', nonceHash, keys)).resolves.toBe('12345');
    await expect(verifyTwitchIdToken(await signedToken({ nonce: 'C'.repeat(43) }), 'client', nonceHash, keys)).rejects.toMatchObject({ code: 'TWITCH_NONCE_INVALID' });
    await expect(verifyTwitchIdToken(await signedToken({ nonce: undefined }), 'client', nonceHash, keys)).rejects.toThrow();
    await expect(verifyTwitchIdToken(await signedToken({ sub: undefined }), 'client', nonceHash, keys)).rejects.toThrow();
    const wrongIssuer = await new SignJWT({ sub: '12345', nonce }).setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer('https://other.example').setAudience('client').setIssuedAt().setExpirationTime('5m').sign(privateKey);
    await expect(verifyTwitchIdToken(wrongIssuer, 'client', nonceHash, keys)).rejects.toThrow();
    await expect(verifyTwitchIdToken(await signedToken(), 'other-client', nonceHash, keys)).rejects.toThrow();
    const expired = await new SignJWT({ sub: '12345', nonce }).setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer('https://id.twitch.tv/oauth2').setAudience('client').setIssuedAt(1).setExpirationTime(2).sign(privateKey);
    await expect(verifyTwitchIdToken(expired, 'client', nonceHash, keys)).rejects.toThrow();
    const other = await generateKeyPair('RS256');
    await expect(verifyTwitchIdToken(await signedToken({}, other.privateKey), 'client', nonceHash, keys)).rejects.toThrow();
    const futureIssuedAt = await new SignJWT({ sub: '12345', nonce }).setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer('https://id.twitch.tv/oauth2').setAudience('client').setIssuedAt(Math.floor(Date.now() / 1_000) + 120).setExpirationTime('5m').sign(privateKey);
    await expect(verifyTwitchIdToken(futureIssuedAt, 'client', nonceHash, keys)).rejects.toThrow();
    const missingIssuedAt = await new SignJWT({ sub: '12345', nonce }).setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer('https://id.twitch.tv/oauth2').setAudience('client').setExpirationTime('5m').sign(privateKey);
    await expect(verifyTwitchIdToken(missingIssuedAt, 'client', nonceHash, keys)).rejects.toThrow();
  });
  it('links the signed Twitch subject and never persists tokens', async () => {
    const { service, db } = setup(); await mockTwitch();
    await expect(service.callback({ state, code: 'code' })).resolves.toEqual({ linked: true });
    expect(db.twitchIdentity.upsert).toHaveBeenCalledOnce();
    expect(db.twitchIdentity.upsert.mock.calls[0]?.[0]?.create.twitchUserId).toBe('12345');
    expect(JSON.stringify(db.twitchIdentity.upsert.mock.calls)).not.toMatch(/transient|discarded|server-secret/);
  });
  it('blocks other Twitch accounts and conflicts', async () => {
    const wrong = setup(); await mockTwitch('someone_else');
    await expect(wrong.service.callback({ state, code: 'code' })).rejects.toMatchObject({ code: 'TWITCH_ACCOUNT_MISMATCH' });
    vi.restoreAllMocks();
    const conflict = setup(); conflict.db.twitchIdentity.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ playerId: otherId }); await mockTwitch();
    await expect(conflict.service.callback({ state, code: 'code' })).rejects.toMatchObject({ code: 'TWITCH_IDENTITY_CONFLICT' });
  });
  it('rejects access token subject mismatch', async () => {
    const { service } = setup(); await mockTwitch('kichnifou', '98765');
    await expect(service.callback({ state, code: 'code' })).rejects.toMatchObject({ code: 'TWITCH_IDENTITY_INVALID' });
  });
  it('unlinks only the Twitch identity', async () => {
    const { service, db } = setup();
    await expect(service.unlink(identity)).resolves.toEqual({ linked: false });
    expect(db.twitchIdentity.deleteMany).toHaveBeenCalledWith({ where: { playerId } });
  });
});

describe('separate Twitch Chat runtime authorization', () => {
  const runtimeState = `runtime_${state}`;
  const linked = { playerId, twitchUserId: '12345', login: 'kichnifou', displayName: 'Original name', linkedAt: new Date('2026-09-26') };
  function runtimeSetup() {
    const value = setup(playerId, true); value.db.twitchIdentity.findUnique.mockResolvedValue(linked); return value;
  }

  it('requires an allowlisted Player, configured OAuth and an existing TwitchIdentity', async () => {
    await expect(setup(otherId).service.startRuntime(identity)).rejects.toMatchObject({ code: 'TWITCH_PILOT_FORBIDDEN' });
    const { service, db } = setup(playerId, true);
    await expect(service.startRuntime(identity)).rejects.toMatchObject({ code: 'TWITCH_RUNTIME_IDENTITY_REQUIRED' });
    expect(db.twitchLinkState.create).not.toHaveBeenCalled();
    const off = new TwitchPilotService(db as unknown as PrismaClient, { execute: async () => ({ id: playerId }) } as unknown as GetCurrentPlayer, { ...config, twitch: { pilotPlayerIds: [playerId], pilotLogin: 'kichnifou' } }, keys);
    await expect(off.startRuntime(identity)).rejects.toMatchObject({ code: 'TWITCH_RUNTIME_UNAVAILABLE' });
  });
  it('requests exactly the four runtime scopes with 256-bit state/nonce, purpose in the full hash and ten-minute expiry', async () => {
    const { service, db } = runtimeSetup();
    const now = Date.now();
    const url = new URL((await service.startRuntime(identity)).url);
    expect(url.searchParams.get('scope')?.split(' ')).toEqual([...TWITCH_RUNTIME_SCOPES]);
    expect(url.searchParams.get('state')).toMatch(/^runtime_[A-Za-z0-9_-]{43}$/);
    expect(url.searchParams.get('nonce')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const stored = db.twitchLinkState.create.mock.calls[0]![0].data;
    expect(stored.stateHash).toBe(createHash('sha256').update(url.searchParams.get('state')!).digest('hex'));
    expect(stored.nonceHash).toBe(createHash('sha256').update(url.searchParams.get('nonce')!).digest('hex'));
    expect(stored.expiresAt.getTime()).toBeGreaterThanOrEqual(now + 600_000);
    expect(stored.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 600_000);
    const linkUrl = new URL((await service.start(identity)).url);
    expect(linkUrl.searchParams.get('scope')).toBe('openid');
  });
  it('refuses crossing LINK/RUNTIME purposes before consuming state', async () => {
    const { service, db } = runtimeSetup();
    await expect(service.callback({ state, code: 'code' }, 'AUTHORIZE_RUNTIME')).rejects.toMatchObject({ code: 'TWITCH_STATE_INVALID' });
    await expect(service.callback({ state: runtimeState, code: 'code' }, 'LINK_IDENTITY')).rejects.toMatchObject({ code: 'TWITCH_STATE_INVALID' });
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });
  it('uses the complete state hash, so adding/removing a prefix misses the lookup, and refuses replay', async () => {
    const { service, db } = runtimeSetup();
    let consumed = false;
    const digest = createHash('sha256').update(runtimeState).digest('hex');
    db.$queryRaw.mockImplementation(async (_query: unknown, value: string) => {
      if (value !== digest || consumed) return [];
      consumed = true; return [{ player_id: playerId, nonce_hash: nonceHash }];
    });
    await expect(service.callback({ state, code: 'code' })).rejects.toMatchObject({ code: 'TWITCH_STATE_INVALID' });
    await mockTwitch('kichnifou', '12345', TWITCH_RUNTIME_SCOPES);
    await expect(service.callback({ state: runtimeState, code: 'code' })).resolves.toEqual({ runtimeActivated: true, runtimeChatPending: false });
    await expect(service.callback({ state: runtimeState, code: 'code' })).rejects.toMatchObject({ code: 'TWITCH_STATE_INVALID' });
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });
  it('activates only after validated runtime consent without mutating identity or persisting tokens', async () => {
    const { service, db, subscriptions } = runtimeSetup(); await mockTwitch('kichnifou', '12345', TWITCH_RUNTIME_SCOPES);
    await expect(service.callback({ state: runtimeState, code: 'secret-code' })).resolves.toEqual({ runtimeActivated: true, runtimeChatPending: false });
    expect(subscriptions.ensurePilotChatSubscription).toHaveBeenCalledWith(playerId, '12345');
    expect(db.twitchIdentity.upsert).not.toHaveBeenCalled(); expect(db.twitchIdentity.deleteMany).not.toHaveBeenCalled();
    expect(linked.login).toBe('kichnifou'); expect(linked.displayName).toBe('Original name');
    expect(JSON.stringify([db.twitchLinkState.create.mock.calls, db.$queryRaw.mock.calls])).not.toMatch(/transient|discarded|secret-code/);
    const urls = vi.mocked(fetch).mock.calls.map(([url]) => String(url));
    expect(urls).toEqual(['https://id.twitch.tv/oauth2/token', 'https://id.twitch.tv/oauth2/validate', 'https://api.twitch.tv/helix/users']);
  });
  it.each(TWITCH_RUNTIME_SCOPES)('rejects a missing %s grant', async scope => {
    const { service, db } = runtimeSetup(); await mockTwitch('kichnifou', '12345', TWITCH_RUNTIME_SCOPES.filter(value => value !== scope));
    await expect(service.callback({ state: runtimeState, code: 'code' })).rejects.toMatchObject({ code: scope === 'openid' ? 'TWITCH_IDENTITY_INVALID' : 'TWITCH_RUNTIME_SCOPES_MISSING' });
    expect(db.twitchIdentity.upsert).not.toHaveBeenCalled();
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('eventsub'))).toBe(false);
  });
  it.each([
    ['different subject', 'kichnifou', '98765', { sub: '98765' }, 'TWITCH_ACCOUNT_MISMATCH'],
    ['different login', 'other', '12345', {}, 'TWITCH_ACCOUNT_MISMATCH'],
    ['wrong nonce', 'kichnifou', '12345', { nonce: 'C'.repeat(43) }, 'TWITCH_NONCE_INVALID'],
    ['missing nonce', 'kichnifou', '12345', { nonce: undefined }, 'TWITCH_IDENTITY_INVALID'],
  ] as const)('rejects %s without replacing the identity', async (_label, login, id, claims, code) => {
    const { service, db } = runtimeSetup(); await mockTwitch(login, id, TWITCH_RUNTIME_SCOPES, claims);
    await expect(service.callback({ state: runtimeState, code: 'code' })).rejects.toMatchObject({ code });
    expect(db.twitchIdentity.upsert).not.toHaveBeenCalled();
  });
  it('fails if identity is unlinked during the callback', async () => {
    const { service, db } = runtimeSetup();
    db.twitchIdentity.findUnique.mockResolvedValueOnce(linked).mockResolvedValueOnce(linked).mockResolvedValueOnce(null);
    await mockTwitch('kichnifou', '12345', TWITCH_RUNTIME_SCOPES);
    await expect(service.callback({ state: runtimeState, code: 'code' })).rejects.toMatchObject({ code: 'TWITCH_ACCOUNT_MISMATCH' });
    expect(db.twitchIdentity.upsert).not.toHaveBeenCalled();
  });
  it('refuses adding a runtime prefix to a stored LINK state', async () => {
    const { service, db } = runtimeSetup();
    const digest = createHash('sha256').update(state).digest('hex');
    db.$queryRaw.mockImplementation(async (_query: unknown, value: string) => value === digest ? [{ player_id: playerId, nonce_hash: nonceHash }] : []);
    await expect(service.callback({ state: runtimeState, code: 'code' })).rejects.toMatchObject({ code: 'TWITCH_STATE_INVALID' });
  });
  it('rejects missing identity and inconsistent Helix profiles without changing the linked data', async () => {
    const missing = setup(); await mockTwitch('kichnifou', '12345', TWITCH_RUNTIME_SCOPES);
    await expect(missing.service.callback({ state: runtimeState, code: 'code' })).rejects.toMatchObject({ code: 'TWITCH_ACCOUNT_MISMATCH' });
    vi.restoreAllMocks();
    const { service, db } = runtimeSetup(); await mockTwitch('kichnifou', '12345', TWITCH_RUNTIME_SCOPES);
    const calls = vi.mocked(fetch);
    calls.mockReset().mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'transient', id_token: await signedToken() }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ client_id: 'client', user_id: '12345', login: 'kichnifou', scopes: TWITCH_RUNTIME_SCOPES }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: '12345', login: 'different' }] }) } as Response);
    await expect(service.callback({ state: runtimeState, code: 'code' })).rejects.toMatchObject({ code: 'TWITCH_PROFILE_FAILED' });
    expect(db.twitchIdentity.upsert).not.toHaveBeenCalled();
  });
  it('status reads the configured pilot manager without creating subscriptions', async () => {
    const { service, subscriptions } = runtimeSetup(); const network = vi.spyOn(globalThis, 'fetch');
    await expect(service.status(identity)).resolves.toMatchObject({ runtimeSubscriptionAvailable: true, runtimeChatActive: false });
    expect(subscriptions.inspectPilotChatSubscription).toHaveBeenCalledWith(playerId, expect.any(AbortSignal));
    expect(subscriptions.ensurePilotChatSubscription).not.toHaveBeenCalled();
    expect(network).not.toHaveBeenCalled();
  });
});

describe('runtime account status, activation and safe unlink', () => {
  const linked = { playerId, twitchUserId: '12345', login: 'kichnifou', displayName: 'Kichnifou', linkedAt: new Date('2026-09-26') };
  const runtimeSetup = () => { const value = setup(playerId, true); value.db.twitchIdentity.findUnique.mockResolvedValue(linked); return value; };
  it('returns linked account information within the status deadline even if Twitch stalls', async () => {
    const controller = new AbortController();
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
    const { service, subscriptions } = runtimeSetup();
    subscriptions.inspectPilotChatSubscription.mockReturnValue(new Promise(() => undefined));
    const status = service.status(identity);
    await vi.waitFor(() => expect(subscriptions.inspectPilotChatSubscription).toHaveBeenCalled());
    expect(timeout).toHaveBeenCalledWith(3_000);
    controller.abort();
    expect(await status).toMatchObject({ linked: { login: 'kichnifou' }, runtimeSubscriptionAvailable: false, runtimeChatError: 'UNAVAILABLE' });
  });
  it.each(['INACTIVE', 'VERIFICATION_PENDING', 'ACTIVE'])('derives status from Twitch %s after each read, without local persistence', async state => {
    const { service, subscriptions } = runtimeSetup();
    subscriptions.inspectPilotChatSubscription.mockResolvedValue(state);
    expect(await service.status(identity)).toMatchObject({ runtimeSubscriptionAvailable: true, runtimeChatActive: state === 'ACTIVE', runtimeChatPending: state === 'VERIFICATION_PENDING' });
    subscriptions.inspectPilotChatSubscription.mockResolvedValue('INACTIVE');
    expect(await service.status(identity)).toMatchObject({ runtimeChatActive: false, runtimeChatPending: false });
    expect(subscriptions.ensurePilotChatSubscription).not.toHaveBeenCalled();
  });
  it.each(['off', 'non-pilot', 'unlinked'])('does no subscription work when %s', async kind => {
    const value = kind === 'off' ? setup() : kind === 'non-pilot' ? setup(otherId, true) : setup(playerId, true);
    if (kind === 'off') value.db.twitchIdentity.findUnique.mockResolvedValue(linked);
    expect(await value.service.status(identity)).toMatchObject({ runtimeSubscriptionAvailable: false, runtimeChatActive: false });
    expect(value.subscriptions.inspectPilotChatSubscription).not.toHaveBeenCalled();
  });
  it.each(['TWITCH_EVENTSUB_SUBSCRIPTION_CONFLICT', 'TWITCH_EVENTSUB_API_FAILED'])('preserves linked account information on %s', async code => {
    const { service, subscriptions, db } = runtimeSetup();
    subscriptions.inspectPilotChatSubscription.mockRejectedValue(new AppError('technical', 502, code));
    expect(await service.status(identity)).toMatchObject({ linked: { login: 'kichnifou' }, runtimeSubscriptionAvailable: false, runtimeChatError: code.includes('CONFLICT') ? 'CONFLICT' : 'UNAVAILABLE' });
    expect(db.twitchIdentity.deleteMany).not.toHaveBeenCalled();
  });
  it('never activates identity-link OAuth and accepts runtime challenge pending only after all checks', async () => {
    const value = runtimeSetup(); await mockTwitch();
    await expect(value.service.callback({ state, code: 'code' })).resolves.toEqual({ linked: true });
    expect(value.subscriptions.ensurePilotChatSubscription).not.toHaveBeenCalled();
    vi.restoreAllMocks(); await mockTwitch('kichnifou', '12345', TWITCH_RUNTIME_SCOPES);
    value.subscriptions.ensurePilotChatSubscription.mockResolvedValue({ status: 'webhook_callback_verification_pending' });
    expect(await value.service.callback({ state: `runtime_${state}`, code: 'code' })).toMatchObject({ runtimeActivated: true, runtimeChatPending: true });
  });
  it('does not create a subscription for invalid consent or when server activation becomes unavailable', async () => {
    const { service, subscriptions, db } = runtimeSetup();
    await mockTwitch('kichnifou', '12345', ['openid']);
    await expect(service.callback({ state: `runtime_${state}`, code: 'code' })).rejects.toMatchObject({ code: 'TWITCH_RUNTIME_SCOPES_MISSING' });
    expect(subscriptions.ensurePilotChatSubscription).not.toHaveBeenCalled();
    vi.restoreAllMocks(); await mockTwitch('kichnifou', '12345', TWITCH_RUNTIME_SCOPES);
    subscriptions.activationAvailable = false;
    await expect(service.callback({ state: `runtime_${state}`, code: 'code' })).rejects.toMatchObject({ code: 'TWITCH_RUNTIME_UNAVAILABLE' });
    expect(subscriptions.ensurePilotChatSubscription).not.toHaveBeenCalled();
    expect(db.twitchIdentity.deleteMany).not.toHaveBeenCalled();
  });
  it('removes the subscription before deleting only TwitchIdentity', async () => {
    const { service, subscriptions, db } = runtimeSetup();
    const order: string[] = [];
    subscriptions.disablePilotChatSubscription.mockImplementation(async () => { order.push('disable'); return 'INACTIVE'; });
    db.twitchIdentity.deleteMany.mockImplementation(async () => { order.push('identity'); return { count: 1 }; });
    expect(await service.unlink(identity)).toEqual({ linked: false });
    expect(order).toEqual(['disable', 'identity']);
    expect(db.twitchIdentity.deleteMany).toHaveBeenCalledWith({ where: { playerId } });
    expect(Object.keys(db)).toEqual(['twitchIdentity', 'twitchLinkState', 'twitchGiveawayCredential', 'giveawaySession', 'migrationRun', '$queryRaw']);
  });
  it('preserves identity when deletion cannot be guaranteed', async () => {
    const { service, subscriptions, db } = runtimeSetup();
    subscriptions.disablePilotChatSubscription.mockRejectedValue(new Error('upstream unavailable'));
    await expect(service.unlink(identity)).rejects.toThrow();
    expect(db.twitchIdentity.deleteMany).not.toHaveBeenCalled();
  });
  it('explicit disable resolves only the authenticated pilot and never unlinks identity', async () => {
    const { service, subscriptions, db } = runtimeSetup();
    expect(await service.disableRuntime(identity)).toEqual({ runtimeChatActive: false, runtimeChatPending: false });
    expect(subscriptions.disablePilotChatSubscription).toHaveBeenCalledWith(playerId);
    expect(db.twitchIdentity.deleteMany).not.toHaveBeenCalled();
    await expect(setup(otherId, true).service.disableRuntime(identity)).rejects.toMatchObject({ code: 'TWITCH_PILOT_FORBIDDEN' });
  });
});


describe('Faveur status projection and independent disable', () => {
  const prepare = () => { const value = setup(playerId, true); value.db.twitchIdentity.findUnique.mockResolvedValue({ playerId, twitchUserId: '12345', login: 'kichnifou', linkedAt: new Date() }); return value; };
  it.each(['INACTIVE', 'ACTIVE', 'VERIFICATION_PENDING'])('projects Faveur %s without changing Chat', async state => {
    const { service, subscriptions, db } = prepare();
    subscriptions.inspectPilotFavorSubscription.mockResolvedValue(state);
    subscriptions.inspectPilotChatSubscription.mockResolvedValue('ACTIVE');
    expect(await service.status(identity)).toMatchObject({ favorSubscriptionAvailable: true, favorSubscriptionActive: state === 'ACTIVE', favorSubscriptionPending: state === 'VERIFICATION_PENDING', runtimeChatActive: true });
    expect(subscriptions.inspectPilotFavorSubscription.mock.calls[0]![1]).toBe(subscriptions.inspectPilotChatSubscription.mock.calls[0]![1]);
    expect(subscriptions.ensurePilotFavorSubscription).not.toHaveBeenCalled(); expect(db.twitchIdentity.upsert).not.toHaveBeenCalled();
  });
  it.each(['TWITCH_EVENTSUB_SUBSCRIPTION_CONFLICT', 'TWITCH_EVENTSUB_API_FAILED'])('projects Faveur %s independently', async code => {
    const { service, subscriptions } = prepare(); subscriptions.inspectPilotFavorSubscription.mockRejectedValue(new AppError('technical', 502, code));
    expect(await service.status(identity)).toMatchObject({ favorSubscriptionAvailable: false, favorSubscriptionActive: false, favorSubscriptionError: code.includes('CONFLICT') ? 'CONFLICT' : 'UNAVAILABLE', runtimeSubscriptionAvailable: true });
  });
  it.each(['unlinked', 'non-pilot', 'off'])('skips Faveur network when %s', async kind => {
    const value = kind === 'off' ? setup() : kind === 'non-pilot' ? setup(otherId, true) : setup(playerId, true);
    expect(await value.service.status(identity)).toMatchObject({ favorSubscriptionAvailable: false, favorSubscriptionActive: false });
    expect(value.subscriptions.inspectPilotFavorSubscription).not.toHaveBeenCalled();
  });
  it('bounds two stalled reads with one deadline and preserves linked information', async () => {
    const { service, subscriptions } = prepare(), controller = new AbortController();
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
    subscriptions.inspectPilotChatSubscription.mockReturnValue(new Promise(() => undefined));
    subscriptions.inspectPilotFavorSubscription.mockReturnValue(new Promise(() => undefined));
    const result = service.status(identity); await vi.waitFor(() => expect(subscriptions.inspectPilotFavorSubscription).toHaveBeenCalled());
    expect(timeout).toHaveBeenCalledOnce(); expect(timeout).toHaveBeenCalledWith(3000); controller.abort();
    expect(await result).toMatchObject({ linked: { login: 'kichnifou' }, runtimeChatError: 'UNAVAILABLE', favorSubscriptionError: 'UNAVAILABLE' });
  });
  it('disables only its own type and keeps shared unlink stopping both', async () => {
    const { service, subscriptions } = prepare();
    expect(await service.disableFavor(identity)).toEqual({ favorSubscriptionActive: false, favorSubscriptionPending: false });
    expect(subscriptions.disablePilotFavorSubscription).toHaveBeenCalledWith(playerId); expect(subscriptions.disablePilotChatSubscription).not.toHaveBeenCalled();
    subscriptions.disablePilotFavorSubscription.mockClear(); await service.disableRuntime(identity);
    expect(subscriptions.disablePilotChatSubscription).toHaveBeenCalledOnce(); expect(subscriptions.disablePilotFavorSubscription).not.toHaveBeenCalled();
    subscriptions.disablePilotChatSubscription.mockClear(); await service.unlink(identity);
    expect(subscriptions.disablePilotChatSubscription).toHaveBeenCalledOnce(); expect(subscriptions.disablePilotFavorSubscription).toHaveBeenCalledOnce();
    await expect(setup(otherId, true).service.disableFavor(identity)).rejects.toMatchObject({ code: 'TWITCH_PILOT_FORBIDDEN' });
  });
});
