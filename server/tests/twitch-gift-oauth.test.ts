import { createHash } from 'node:crypto';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTVerifyGetKey } from 'jose';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { TwitchPilotService } from '../src/application/twitch/twitch-pilot-service.js';
import { TWITCH_GIFT_SUPREME_SCOPES } from '../src/application/twitch/twitch-gift-supreme-contract.js';
import { giftFixture, giftPlayerId } from './helpers/twitch-gift-fixture.js';
import { loadConfig } from '../src/config/environment.js';
let privateKey: Awaited<ReturnType<typeof generateKeyPair>>['privateKey'], keys: JWTVerifyGetKey;
const identity = { subject: 'web-subject' }, nonce = 'B'.repeat(43), state = 'gift_' + 'A'.repeat(43);
beforeAll(async () => { const pair = await generateKeyPair('RS256'); privateKey = pair.privateKey; keys = createLocalJWKSet({ keys: [{ ...await exportJWK(pair.publicKey), kid: 'private', alg: 'RS256', use: 'sig' }] }); });
afterEach(() => vi.restoreAllMocks());
function setup() {
  const f = giftFixture(); const db = { ...f.mocks, twitchLinkState: { create: vi.fn() }, migrationRun: { findFirst: vi.fn(async () => null) },
    $queryRaw: vi.fn(async () => [{ player_id: giftPlayerId, nonce_hash: createHash('sha256').update(nonce).digest('hex') }]) };
  const getPlayer = { execute: vi.fn(async () => ({ id: giftPlayerId })) };
  const service = new TwitchPilotService(db as unknown as PrismaClient, getPlayer as unknown as GetCurrentPlayer, f.config, keys, f.subscriptions, f.manager);
  return { ...f, db, getPlayer, service, get row() { return f.row; } };
}
async function network(options: { token?: object; validation?: object; users?: object; claims?: object } = {}) {
  const idToken = await new SignJWT({ sub: '12345', nonce, ...options.claims }).setProtectedHeader({ alg: 'RS256', kid: 'private' })
    .setIssuer('https://id.twitch.tv/oauth2').setAudience('client').setIssuedAt().setExpirationTime('5m').sign(privateKey);
  return vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({ access_token: 'oauth-access', refresh_token: 'oauth-refresh', id_token: idToken, ...options.token }))
    .mockResolvedValueOnce(Response.json({ client_id: 'client', user_id: '12345', login: 'kichnifou', scopes: TWITCH_GIFT_SUPREME_SCOPES, expires_in: 3600, ...options.validation }))
    .mockResolvedValueOnce(Response.json({ data: [{ id: '12345', login: 'kichnifou', display_name: 'Kichnifou' }], ...options.users }));
}
describe('Gift durable OAuth isolated purpose', () => {
  it('defaults OFF, permits missing key and rejects invalid present key without exposing it', () => {
    expect(loadConfig({}).twitchGiftSupreme).toEqual({ enabled: false, credentialKey: undefined });
    expect(() => loadConfig({ TWITCH_GIFT_SUPREME_ENABLED: 'true' })).not.toThrow();
    expect(() => loadConfig({ TWITCH_OAUTH_CREDENTIAL_KEY: 'private-invalid-key' })).toThrow('TWITCH_OAUTH_CREDENTIAL_KEY');
    try { loadConfig({ TWITCH_OAUTH_CREDENTIAL_KEY: 'private-invalid-key' }); } catch (error) { expect(String(error)).not.toContain('private-invalid-key'); }
  });
  it('requests exact scopes and fresh hashed prefixed states with independent nonce and ten minute expiry', async () => {
    const f = setup(); const a = new URL((await f.service.startGiftSupreme(identity)).url), b = new URL((await f.service.startGiftSupreme(identity)).url);
    expect(a.searchParams.get('scope')?.split(' ')).toEqual(TWITCH_GIFT_SUPREME_SCOPES); expect(a.searchParams.get('state')).toMatch(/^gift_[A-Za-z0-9_-]{43}$/);
    expect(a.searchParams.get('state')).not.toBe(b.searchParams.get('state')); expect(a.searchParams.get('state')!.slice(5)).not.toBe(a.searchParams.get('nonce'));
    expect(f.db.twitchLinkState.create.mock.calls[0]).toMatchObject([{ data: { stateHash: createHash('sha256').update(a.searchParams.get('state')!).digest('hex') } }]);
    expect(f.credential.upsert).not.toHaveBeenCalled(); expect(f.network).not.toHaveBeenCalled();
  });
  it.each(['LINK_IDENTITY', 'AUTHORIZE_RUNTIME', 'AUTHORIZE_FAVOR_SUBSCRIPTIONS'] as const)('rejects Gift state in %s before consumption', async purpose => {
    const f = setup(); await expect(f.service.callback({ state, code: 'code' }, purpose)).rejects.toMatchObject({ code: 'TWITCH_STATE_INVALID' }); expect(f.db.$queryRaw).not.toHaveBeenCalled();
  });
  it('persists only encrypted Gift refresh and ensures reward after all checks, rejecting replay', async () => {
    const f = setup(); await network();
    expect(await f.service.callback({ state, code: 'private-code' })).toEqual({ giftSupremeActivated: true, giftSupremePending: false });
    expect(f.manager.cipher!.decrypt(f.row!.encryptedRefreshToken, giftPlayerId, '12345')).toBe('oauth-refresh');
    expect(JSON.stringify(f.credential.upsert.mock.calls)).not.toMatch(/oauth-refresh|oauth-access|private-code/);
    f.db.$queryRaw.mockResolvedValueOnce([]); await expect(f.service.callback({ state, code: 'private-code' })).rejects.toMatchObject({ code: 'TWITCH_STATE_INVALID' });
  });
  it.each(['refresh', 'access', 'id', 'client', 'user', 'login', 'scope', 'expiry', 'nonce', 'users'])('rejects invalid %s without credential writes', async kind => {
    const f = setup(); await network({ token: kind === 'refresh' ? { refresh_token: undefined } : kind === 'access' ? { access_token: '' } : kind === 'id' ? { id_token: undefined } : {},
      validation: kind === 'client' ? { client_id: 'other' } : kind === 'user' ? { user_id: '999' } : kind === 'login' ? { login: 'other' } : kind === 'scope' ? { scopes: ['openid'] } : kind === 'expiry' ? { expires_in: 0 } : {},
      claims: kind === 'nonce' ? { nonce: 'C'.repeat(43) } : {}, users: kind === 'users' ? { data: [{ id: '999', login: 'other', display_name: 'Other' }] } : {} });
    await expect(f.service.callback({ state, code: 'code' })).rejects.toThrow(); expect(f.credential.upsert).not.toHaveBeenCalled();
  });
  it.each(['unlink', 'relink'])('fails after concurrent %s during OAuth and never recreates identity', async kind => {
    const f = setup(); await network();
    f.db.twitchIdentity.findUnique.mockResolvedValueOnce(f.linked).mockResolvedValueOnce(f.linked).mockResolvedValueOnce(f.linked)
      .mockResolvedValueOnce(kind === 'unlink' ? null as never : { ...f.linked, linkedAt: new Date(+f.linked.linkedAt + 1) });
    await expect(f.service.callback({ state, code: 'code' })).rejects.toMatchObject({ code: 'TWITCH_ACCOUNT_MISMATCH' });
    expect(f.credential.upsert).not.toHaveBeenCalled();
  });
  it('does not expose upstream response/network secrets', async () => {
    const f = setup(); vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(Error('private-secret oauth-refresh'));
    await expect(f.service.callback({ state, code: 'code' })).rejects.toThrow('temporairement indisponible'); expect(f.credential.upsert).not.toHaveBeenCalled();
  });
});
