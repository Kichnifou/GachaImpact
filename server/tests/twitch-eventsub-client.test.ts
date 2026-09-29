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


describe('Gift Suprême EventSub client', () => {
  const type = 'channel.channel_points_custom_reward_redemption.add' as const;
  const request = { type, version: '1' as const, condition: { broadcaster_user_id: '12345', reward_id: 'exact-reward' }, transport: { method: 'webhook' as const, callback: 'https://api.example/api/v1/twitch/eventsub', secret: 'private-secret' } };
  const subscription = { ...request, transport: { method: 'webhook' as const, callback: request.transport.callback }, id: 'gift-sub', status: 'webhook_callback_verification_pending' };
  it('lists paginated Gift subscriptions and refreshes App token on 401', async () => {
    const { client, network, tokenNetwork } = setup();
    network.mockResolvedValueOnce(Response.json({}, { status: 401 })).mockResolvedValueOnce(Response.json({ data: [subscription], pagination: { cursor: 'next' } })).mockResolvedValueOnce(Response.json({ data: [], pagination: {} }));
    expect(await client.listGiftSupremeSubscriptions()).toEqual([subscription]); expect(tokenNetwork).toHaveBeenCalledTimes(2);
    expect(new URL(String(network.mock.calls[2]![0])).searchParams.get('after')).toBe('next');
    for (const [url] of network.mock.calls) expect(new URL(String(url)).searchParams.get('type')).toBe(type);
  });
  it('creates exact v1 condition and preserves pending confirmation', async () => {
    const { client, network } = setup(); network.mockResolvedValueOnce(Response.json({ data: [subscription] }, { status: 202 }));
    expect(await client.createGiftSupremeSubscription(request)).toEqual(subscription);
    expect(JSON.parse(String(network.mock.calls[0]![1]?.body))).toEqual(request);
  });
  it('deletes the exact Gift subscription and surfaces typed 404 for manager recovery', async () => {
    const { client, network } = setup(); network.mockResolvedValueOnce(new Response(null, { status: 204 })); await client.deleteSubscription('gift-sub');
    expect(new URL(String(network.mock.calls[0]![0])).searchParams.get('id')).toBe('gift-sub');
    network.mockResolvedValueOnce(Response.json({ error: 'private-secret' }, { status: 404 })); await expect(client.deleteSubscription('gift-sub')).rejects.toMatchObject({ upstreamStatus: 404 });
  });
});
