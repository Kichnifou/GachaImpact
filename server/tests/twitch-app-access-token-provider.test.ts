import { describe, expect, it, vi } from 'vitest';
import { TwitchAppAccessTokenProvider } from '../src/infrastructure/twitch/twitch-app-access-token-provider.js';

const response = (token = 'app-token', expires = 1_000) => new Response(JSON.stringify({ access_token: token, expires_in: expires, token_type: 'bearer' }));

describe('Twitch App Access Token provider', () => {
  it('uses client credentials and reuses a fresh token without any network work during construction', async () => {
    const network = vi.fn<typeof fetch>().mockResolvedValue(response());
    const provider = new TwitchAppAccessTokenProvider('client', 'test-secret', network);
    expect(network).not.toHaveBeenCalled();
    expect(await provider.getToken()).toBe('app-token');
    expect(await provider.getToken()).toBe('app-token');
    expect(network).toHaveBeenCalledOnce();
    const [url, options] = network.mock.calls[0]!;
    expect(url).toBe('https://id.twitch.tv/oauth2/token');
    expect(options?.method).toBe('POST');
    expect(Object.fromEntries(options?.body as URLSearchParams)).toEqual({ client_id: 'client', client_secret: 'test-secret', grant_type: 'client_credentials' });
  });
  it('refreshes with a margin before expiration', async () => {
    let now = 0;
    const network = vi.fn<typeof fetch>().mockResolvedValueOnce(response('first')).mockResolvedValueOnce(response('second'));
    const provider = new TwitchAppAccessTokenProvider('client', 'secret', network, () => now);
    expect(await provider.getToken()).toBe('first');
    now = 939_999;
    expect(await provider.getToken()).toBe('first');
    now = 940_000;
    expect(await provider.getToken()).toBe('second');
    expect(network).toHaveBeenCalledTimes(2);
  });
  it('serializes concurrent initial requests and concurrent refreshes', async () => {
    let release!: (value: Response) => void;
    const network = vi.fn<typeof fetch>().mockImplementation(() => new Promise(resolve => { release = resolve; }));
    const provider = new TwitchAppAccessTokenProvider('client', 'secret', network);
    const first = provider.getToken(), second = provider.getToken();
    expect(network).toHaveBeenCalledOnce();
    release(response('old'));
    expect(await Promise.all([first, second])).toEqual(['old', 'old']);
    provider.invalidate('old');
    const refresh = provider.getToken(), concurrent = provider.getToken();
    expect(network).toHaveBeenCalledTimes(2);
    release(response('new'));
    expect(await Promise.all([refresh, concurrent])).toEqual(['new', 'new']);
    provider.invalidate('old');
    expect(await provider.getToken()).toBe('new');
    expect(network).toHaveBeenCalledTimes(2);
  });
  it.each([
    { access_token: 'sensitive-token', expires_in: 0, token_type: 'bearer' },
    { access_token: '', expires_in: 10, token_type: 'bearer' },
    { access_token: 'sensitive-token', expires_in: 10, token_type: 'user' },
    { message: 'test-secret sensitive-token' },
  ])('rejects invalid responses without disclosing their contents', async body => {
    const provider = new TwitchAppAccessTokenProvider('client', 'test-secret', vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(body))));
    await expect(provider.getToken()).rejects.toMatchObject({ code: 'TWITCH_APP_TOKEN_FAILED', message: 'App Access Token Twitch indisponible.' });
  });
  it('sanitizes network and HTTP errors and permits recovery after failure', async () => {
    const network = vi.fn<typeof fetch>().mockRejectedValueOnce(new Error('test-secret sensitive-token'))
      .mockResolvedValueOnce(new Response('sensitive-token', { status: 401 })).mockResolvedValueOnce(response());
    const provider = new TwitchAppAccessTokenProvider('client', 'test-secret', network);
    for (let i = 0; i < 2; i++) await expect(provider.getToken()).rejects.toMatchObject({ code: 'TWITCH_APP_TOKEN_FAILED', message: 'App Access Token Twitch indisponible.' });
    expect(await provider.getToken()).toBe('app-token');
  });
});
