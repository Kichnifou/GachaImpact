import { createHash } from 'node:crypto';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTVerifyGetKey } from 'jose';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import type { AuthenticatedIdentity } from '../src/domain/identity/authenticated-identity.js';
import { TwitchPilotService, TWITCH_RUNTIME_SCOPES, verifyTwitchIdToken } from '../src/application/twitch/twitch-pilot-service.js';

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
function setup(id = playerId) {
  const db = {
    twitchIdentity: { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn().mockResolvedValue({}), deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    twitchLinkState: { create: vi.fn().mockResolvedValue({}) },
    migrationRun: { findFirst: vi.fn().mockResolvedValue(null) },
    $queryRaw: vi.fn().mockResolvedValue([{ player_id: id, nonce_hash: nonceHash }]),
  };
  const getPlayer = { execute: vi.fn().mockResolvedValue({ id }) };
  return { db, service: new TwitchPilotService(db as unknown as PrismaClient, getPlayer as unknown as GetCurrentPlayer, config, keys) };
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
    const value = setup(); value.db.twitchIdentity.findUnique.mockResolvedValue(linked); return value;
  }

  it('requires an allowlisted Player, configured OAuth and an existing TwitchIdentity', async () => {
    await expect(setup(otherId).service.startRuntime(identity)).rejects.toMatchObject({ code: 'TWITCH_PILOT_FORBIDDEN' });
    const { service, db } = setup();
    await expect(service.startRuntime(identity)).rejects.toMatchObject({ code: 'TWITCH_RUNTIME_IDENTITY_REQUIRED' });
    expect(db.twitchLinkState.create).not.toHaveBeenCalled();
    const off = new TwitchPilotService(db as unknown as PrismaClient, { execute: async () => ({ id: playerId }) } as unknown as GetCurrentPlayer, { ...config, twitch: { pilotPlayerIds: [playerId], pilotLogin: 'kichnifou' } }, keys);
    await expect(off.startRuntime(identity)).rejects.toMatchObject({ code: 'TWITCH_UNAVAILABLE' });
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
    await expect(service.callback({ state: runtimeState, code: 'code' })).resolves.toEqual({ runtimeAuthorized: true });
    await expect(service.callback({ state: runtimeState, code: 'code' })).rejects.toMatchObject({ code: 'TWITCH_STATE_INVALID' });
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });
  it('authorizes the existing identity without mutating it, persisting tokens or creating subscriptions', async () => {
    const { service, db } = runtimeSetup(); await mockTwitch('kichnifou', '12345', TWITCH_RUNTIME_SCOPES);
    await expect(service.callback({ state: runtimeState, code: 'secret-code' })).resolves.toEqual({ runtimeAuthorized: true });
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
  it('status reports configuration readiness only, with no network or subscription work', async () => {
    const { service } = runtimeSetup(); const network = vi.spyOn(globalThis, 'fetch');
    await expect(service.status(identity)).resolves.toMatchObject({ runtimeAuthorizationAvailable: true, runtimeSubscriptionAvailable: false });
    expect(network).not.toHaveBeenCalled();
  });
});
