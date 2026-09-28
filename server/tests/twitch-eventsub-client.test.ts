import { describe, expect, it, vi } from 'vitest';
import { TwitchAppAccessTokenProvider } from '../src/infrastructure/twitch/twitch-app-access-token-provider.js';
import { TwitchEventSubClient } from '../src/infrastructure/twitch/twitch-eventsub-client.js';

function setup() {
  let generation = 0;
  const tokenNetwork = vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify({ access_token: `app-${++generation}`, token_type: 'bearer', expires_in: 1_000 })));
  const network = vi.fn<typeof fetch>();
  const client = new TwitchEventSubClient('client', new TwitchAppAccessTokenProvider('client', 'test-secret', tokenNetwork), network);
  return { client, network, tokenNetwork };
}
describe('EventSub DELETE client', () => {
  it('sends only the exact ID and accepts 204 without parsing a JSON body', async () => {
    const { client, network } = setup(); network.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await client.deleteChatSubscription('exact id');
    const [url, options] = network.mock.calls[0]!;
    expect(new URL(String(url)).searchParams.get('id')).toBe('exact id');
    expect(options).toMatchObject({ method: 'DELETE', headers: { authorization: 'Bearer app-1', 'client-id': 'client' } });
    expect(options?.body).toBeUndefined();
  });
  it('refreshes once on 401, retries DELETE with the same ID and accepts 204', async () => {
    const { client, network, tokenNetwork } = setup();
    network.mockResolvedValueOnce(new Response(null, { status: 401 })).mockResolvedValueOnce(new Response(null, { status: 204 }));
    await client.deleteChatSubscription('exact');
    expect(network.mock.calls.map(([url]) => String(url))).toEqual(Array(2).fill('https://api.twitch.tv/helix/eventsub/subscriptions?id=exact'));
    expect(network.mock.calls[1]![1]?.headers).toMatchObject({ authorization: 'Bearer app-2' });
    expect(tokenNetwork).toHaveBeenCalledTimes(2);
  });
  it.each([401, 404, 503])('returns sanitized %s errors without leaking upstream payload', async status => {
    const { client, network } = setup(); network.mockImplementation(async () => new Response('sensitive upstream', { status }));
    await expect(client.deleteChatSubscription('exact')).rejects.toMatchObject({ upstreamStatus: status, message: 'API EventSub Twitch indisponible.' });
    expect(network).toHaveBeenCalledTimes(status === 401 ? 2 : 1);
  });
});
