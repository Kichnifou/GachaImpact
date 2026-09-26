import { createHash } from 'node:crypto';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTVerifyGetKey } from 'jose';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import type { AuthenticatedIdentity } from '../src/domain/identity/authenticated-identity.js';
import { TwitchPilotService, verifyTwitchIdToken } from '../src/application/twitch/twitch-pilot-service.js';

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
async function mockTwitch(login = 'kichnifou', userId = '12345') {
  const fetchMock = vi.spyOn(globalThis, 'fetch');
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'transient', id_token: await signedToken(), refresh_token: 'discarded' }) } as Response);
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ client_id: 'client', user_id: userId, login, scopes: ['openid'] }) } as Response);
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
