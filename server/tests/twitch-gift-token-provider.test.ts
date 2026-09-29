import { describe, expect, it, vi } from 'vitest';
import { TwitchGiftAccessTokenProvider } from '../src/infrastructure/twitch/twitch-gift-access-token-provider.js';
import { TwitchGiftCredentialCipher } from '../src/infrastructure/twitch/twitch-gift-credential-cipher.js';
import { TWITCH_GIFT_SUPREME_SCOPES } from '../src/application/twitch/twitch-gift-supreme-contract.js';
import { giftFixture, giftKey, giftPlayerId } from './helpers/twitch-gift-fixture.js';
describe('Gift user access token provider', () => {
  it('coalesces refresh, encrypts rotation and keeps access tokens exclusively in memory', async () => {
    const f = giftFixture(), provider = f.manager.tokens!;
    expect(await Promise.all([provider.getToken(giftPlayerId), provider.getToken(giftPlayerId)])).toEqual(['private-access', 'private-access']);
    expect(await provider.getToken(giftPlayerId)).toBe('private-access'); expect(f.request).toHaveBeenCalledTimes(2);
    expect(new TwitchGiftCredentialCipher(giftKey).decrypt(f.row!.encryptedRefreshToken, giftPlayerId, '12345')).toBe('rotated-refresh');
    expect(JSON.stringify(f.credential.updateMany.mock.calls)).not.toMatch(/private-access|private-refresh|rotated-refresh/);
    provider.invalidate(giftPlayerId, 'obsolete-token'); await provider.getToken(giftPlayerId); expect(f.request).toHaveBeenCalledTimes(2);
    provider.invalidate(giftPlayerId, 'private-access'); await provider.getToken(giftPlayerId); expect(f.request).toHaveBeenCalledTimes(4);
  });
  it('respects the expiration margin and revalidates cached access within five minutes', async () => {
    const f = giftFixture(); let time = 0;
    const provider = new TwitchGiftAccessTokenProvider(f.db, f.manager.cipher!, 'client', 'secret', f.request, () => time);
    await provider.getToken(giftPlayerId); time = 301_000; await provider.getToken(giftPlayerId); expect(f.request).toHaveBeenCalledTimes(3);
    time = 3_550_000; await provider.getToken(giftPlayerId); expect(f.request).toHaveBeenCalledTimes(5);
  });
  it.each(['client', 'user', 'scope', 'expiry', 'cipher'])('rejects invalid %s without secrets', async kind => {
    const f = giftFixture(); if (kind === 'cipher') f.row = { ...f.row!, encryptedRefreshToken: 'plain-private-refresh' };
    else f.network.mockResolvedValueOnce(Response.json({ client_id: kind === 'client' ? 'other' : 'client', user_id: kind === 'user' ? '999' : '12345',
      scopes: kind === 'scope' ? ['openid'] : TWITCH_GIFT_SUPREME_SCOPES, expires_in: kind === 'expiry' ? 0 : 3600 }));
    await expect(f.manager.tokens!.getToken(giftPlayerId)).rejects.toMatchObject({ code: 'TWITCH_GIFT_CREDENTIAL_INVALID' });
  });
  it.each([400, 401, 500])('bounds upstream %s errors and never persists access', async status => {
    const f = giftFixture(); f.request.mockResolvedValueOnce(Response.json({ error: 'private-refresh' }, { status }));
    await expect(f.manager.tokens!.getToken(giftPlayerId)).rejects.toMatchObject({ code: status < 500 ? 'TWITCH_GIFT_CREDENTIAL_INVALID' : 'TWITCH_GIFT_UNAVAILABLE' });
    expect(f.request).toHaveBeenCalledOnce(); expect(f.credential.updateMany).not.toHaveBeenCalled();
  });
  it('recovers a failed refresh after another worker rotates revision exactly once', async () => {
    const f = giftFixture(); f.request.mockImplementationOnce(async () => { f.row = { ...f.row!, revision: 2,
      encryptedRefreshToken: f.manager.cipher!.encrypt('other-worker-refresh', giftPlayerId, '12345') }; return Response.json({}, { status: 400 }); });
    await expect(f.manager.tokens!.getToken(giftPlayerId)).resolves.toBe('private-access');
    expect(f.request).toHaveBeenCalledTimes(3); expect(String(f.request.mock.calls[1]![1]?.body)).toContain('other-worker-refresh'); expect(f.row!.revision).toBe(3);
  });
  it('bounds a second revision race and retries optimistic compare-and-swap once', async () => {
    const f = giftFixture(); f.credential.updateMany.mockImplementationOnce(async () => { f.row = { ...f.row!, revision: 2 }; return { count: 0 }; });
    await expect(f.manager.tokens!.getToken(giftPlayerId)).resolves.toBe('private-access'); expect(f.request).toHaveBeenCalledTimes(3);
    const g = giftFixture(); g.request.mockImplementation(async () => { g.row = { ...g.row!, revision: g.row!.revision + 1 }; return Response.json({}, { status: 400 }); });
    await expect(g.manager.tokens!.getToken(giftPlayerId)).rejects.toMatchObject({ code: 'TWITCH_GIFT_CREDENTIAL_INVALID' }); expect(g.request).toHaveBeenCalledTimes(2);
  });
  it('sanitizes timeout/network failures and uses a bounded abort signal', async () => {
    const f = giftFixture(); f.request.mockRejectedValueOnce(new Error('timeout private-refresh private-access'));
    await expect(f.manager.tokens!.getToken(giftPlayerId)).rejects.toThrow('temporairement indisponible');
    expect(f.request.mock.calls[0]![1]?.signal).toBeInstanceOf(AbortSignal);
    expect(vi.isMockFunction(f.request)).toBe(true);
  });
});
