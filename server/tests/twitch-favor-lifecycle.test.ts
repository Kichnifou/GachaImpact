import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { AppConfig } from '../src/config/environment.js';
import { TwitchEventSubSubscriptionManager } from '../src/application/twitch/twitch-eventsub-subscription-manager.js';
import { TwitchEventSubClient, type TwitchEventSubSubscription } from '../src/infrastructure/twitch/twitch-eventsub-client.js';
import { TwitchAppAccessTokenProvider } from '../src/infrastructure/twitch/twitch-app-access-token-provider.js';

const playerId = randomUUID(), callback = 'https://backend.example/api/v1/twitch/eventsub';
const favor: TwitchEventSubSubscription = { id: 'favor-id', type: 'channel.subscribe', version: '1', status: 'enabled',
  condition: { broadcaster_user_id: '12345' }, transport: { method: 'webhook', callback } };
const chat: TwitchEventSubSubscription = { ...favor, id: 'chat-id', type: 'channel.chat.message', condition: { broadcaster_user_id: '12345', user_id: '12345' } };
const config: AppConfig = { host: '127.0.0.1', port: 3001, supabase: {}, twitch: { clientId: 'client', clientSecret: 'test-secret', pilotPlayerIds: [playerId], pilotLogin: 'kichnifou' },
  twitchEventSub: { enabled: true, secret: 'private-test-secret', callbackUrl: callback } };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const page = (data: unknown[], cursor?: string) => response({ data, pagination: cursor ? { cursor } : {} });
function setup(settings = config) {
  let generation = 0;
  const tokenNetwork = vi.fn<typeof fetch>().mockImplementation(async () => response({ access_token: `app-${++generation}`, expires_in: 1000, token_type: 'bearer' }));
  const network = vi.fn<typeof fetch>();
  const client = new TwitchEventSubClient('client', new TwitchAppAccessTokenProvider('client', 'test-secret', tokenNetwork), network);
  const db = { twitchIdentity: { findUnique: vi.fn().mockResolvedValue({ playerId, twitchUserId: '12345', login: 'kichnifou' }) } };
  const manager = new TwitchEventSubSubscriptionManager(db as unknown as PrismaClient, settings, client);
  return { client, manager, network, tokenNetwork, db };
}
function simulatedSubscriptions(initial: TwitchEventSubSubscription[]) {
  const value = setup(), current = [...initial], order: string[] = [];
  let failure: 'none' | 'chat' | 'favor' = 'none';
  value.network.mockImplementation(async (input, options) => {
    const url = new URL(String(input)), type = url.searchParams.get('type');
    if (options?.method === 'GET') { order.push(`GET:${type}`); return page(current.filter(item => item.type === type)); }
    const id = url.searchParams.get('id'); order.push(`DELETE:${id}`);
    if (failure !== 'none' && id === `${failure}-id`) return response({}, 503);
    const index = current.findIndex(item => item.id === id);
    if (index >= 0) current.splice(index, 1);
    return new Response(null, { status: 204 });
  });
  const remove = vi.fn(async () => { order.push('identity'); value.db.twitchIdentity.findUnique.mockResolvedValue(null); });
  return { ...value, current, order, remove, fail: (type: typeof failure) => { failure = type; } };
}

describe('EventSub Faveur client contract', () => {
  it('requests only channel.subscribe and paginates with an App token and fixed Client ID', async () => {
    const { client, network, tokenNetwork } = setup();
    network.mockResolvedValueOnce(page([favor], 'next')).mockResolvedValueOnce(page([{ ...favor, id: 'other', condition: { broadcaster_user_id: '99999' } }]));
    expect(await client.listFavorSubscriptions()).toHaveLength(2);
    expect(network.mock.calls.map(([url]) => String(url))).toEqual([
      'https://api.twitch.tv/helix/eventsub/subscriptions?type=channel.subscribe',
      'https://api.twitch.tv/helix/eventsub/subscriptions?type=channel.subscribe&after=next']);
    expect(network.mock.calls[0]![1]?.headers).toMatchObject({ authorization: 'Bearer app-1', 'client-id': 'client' });
    expect(tokenNetwork).toHaveBeenCalledOnce();
  });
  it.each(['enabled', 'webhook_callback_verification_pending'])('POSTs the exact broadcaster-only body and accepts 202 %s', async status => {
    const { client, network } = setup(); network.mockResolvedValueOnce(response({ data: [{ ...favor, status }] }, 202));
    const body = { type: 'channel.subscribe' as const, version: '1' as const, condition: { broadcaster_user_id: '12345' },
      transport: { method: 'webhook' as const, callback, secret: 'private-test-secret' } };
    expect((await client.createFavorSubscription(body)).status).toBe(status);
    expect(JSON.parse(String(network.mock.calls[0]![1]?.body))).toEqual(body);
  });
  it.each(['GET', 'POST', 'DELETE'] as const)('refreshes once after 401 for %s and never loops', async method => {
    const { client, network, tokenNetwork } = setup();
    network.mockResolvedValueOnce(response({}, 401)).mockResolvedValueOnce(method === 'DELETE' ? new Response(null, { status: 204 })
      : method === 'GET' ? page([]) : response({ data: [favor] }, 202));
    const invoke = () => method === 'GET' ? client.listFavorSubscriptions() : method === 'DELETE' ? client.deleteSubscription('favor-id')
      : client.createFavorSubscription({ type: 'channel.subscribe', version: '1', condition: { broadcaster_user_id: '12345' }, transport: { method: 'webhook', callback, secret: 'private-test-secret' } });
    await invoke(); expect(network).toHaveBeenCalledTimes(2); expect(tokenNetwork).toHaveBeenCalledTimes(2);
    expect(network.mock.calls[1]![1]?.headers).toMatchObject({ authorization: 'Bearer app-2' });
    network.mockReset().mockImplementation(async () => response({}, 401));
    await expect(invoke()).rejects.toMatchObject({ upstreamStatus: 401 }); expect(network).toHaveBeenCalledTimes(2);
  });
  it.each([{ data: [] }, { data: [favor, favor] }, { data: [{ ...favor, condition: { broadcaster_user_id: 12345 } }] }, 'bad-json'])('rejects invalid create response %j', async body => {
    const { client, network } = setup(); network.mockResolvedValueOnce(body === 'bad-json' ? new Response('{', { status: 202 }) : response(body, 202));
    await expect(client.createFavorSubscription({ type: 'channel.subscribe', version: '1', condition: { broadcaster_user_id: '12345' }, transport: { method: 'webhook', callback, secret: 'private-test-secret' } }))
      .rejects.toMatchObject({ code: 'TWITCH_EVENTSUB_RESPONSE_INVALID' });
  });
  it('rejects malformed pagination and repeated cursors', async () => {
    const { client, network } = setup(); network.mockResolvedValueOnce(response({ data: [favor] }));
    await expect(client.listFavorSubscriptions()).rejects.toMatchObject({ code: 'TWITCH_EVENTSUB_RESPONSE_INVALID' });
    network.mockImplementation(async () => page([], 'repeated'));
    await expect(client.listFavorSubscriptions()).rejects.toMatchObject({ code: 'TWITCH_EVENTSUB_RESPONSE_INVALID' });
  });
  it.each(['network', 'timeout'])('returns sanitized %s failure, with a bounded signal', async mode => {
    const { client, network } = setup();
    network.mockImplementation(async (_url, options) => { expect(options?.signal).toBeInstanceOf(AbortSignal);
      throw new Error(mode === 'timeout' ? 'private timeout/token details' : 'private network/token details'); });
    await expect(client.listFavorSubscriptions()).rejects.toMatchObject({ code: 'TWITCH_EVENTSUB_API_FAILED', upstreamStatus: 0, message: 'API EventSub Twitch indisponible.' });
  });
  it('propagates its ten-second timeout signal to the request and sanitizes an abort', async () => {
    const { client, network } = setup(), controller = new AbortController();
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
    network.mockImplementation(async (_url, options) => new Promise<Response>((_resolve, reject) => {
      options!.signal!.addEventListener('abort', () => reject(new Error('private timeout details')), { once: true });
    }));
    try {
      const result = expect(client.listFavorSubscriptions()).rejects.toMatchObject({ upstreamStatus: 0, message: 'API EventSub Twitch indisponible.' });
      await vi.waitFor(() => expect(network).toHaveBeenCalledOnce());
      expect(timeout).toHaveBeenCalledWith(10_000); controller.abort(); await result;
    } finally { timeout.mockRestore(); }
  });
});

describe('Faveur manager and shared pilot lifecycle queue', () => {
  it.each([['INACTIVE', null], ['ACTIVE', 'enabled'], ['VERIFICATION_PENDING', 'webhook_callback_verification_pending']] as const)('inspects %s without mutations', async (expected, status) => {
    const { manager, network } = setup(); network.mockResolvedValueOnce(page(status ? [{ ...favor, status }] : []));
    expect(await manager.inspectPilotFavorSubscription(playerId)).toBe(expected);
    expect(network.mock.calls.map(([, options]) => options?.method)).toEqual(['GET']);
  });
  it.each([
    { ...favor, version: '2' }, { ...favor, condition: { broadcaster_user_id: '12345', user_id: '12345' } },
    { ...favor, transport: { method: 'websocket' } }, { ...favor, transport: { method: 'webhook', callback: 'https://other.example' } },
    { ...favor, status: 'authorization_revoked' },
  ])('refuses incompatible %j for inspect/ensure/disable without deleting or posting', async item => {
    const { manager, network } = setup(); network.mockImplementation(async () => page([item]));
    for (const run of [() => manager.inspectPilotFavorSubscription(playerId), () => manager.ensurePilotFavorSubscription(playerId), () => manager.disablePilotFavorSubscription(playerId)])
      await expect(run()).rejects.toMatchObject({ code: 'TWITCH_EVENTSUB_SUBSCRIPTION_CONFLICT' });
    expect(network.mock.calls.every(([, options]) => options?.method === 'GET')).toBe(true);
  });
  it('refuses duplicates and malformed POST results instead of accepting an unrelated subscription', async () => {
    const { manager, network } = setup(); network.mockResolvedValueOnce(page([favor, { ...favor, id: 'duplicate' }]));
    await expect(manager.ensurePilotFavorSubscription(playerId)).rejects.toMatchObject({ code: 'TWITCH_EVENTSUB_SUBSCRIPTION_CONFLICT' });
    network.mockResolvedValueOnce(page([])).mockResolvedValueOnce(response({ data: [chat] }, 202));
    await expect(manager.ensurePilotFavorSubscription(playerId)).rejects.toMatchObject({ code: 'TWITCH_EVENTSUB_SUBSCRIPTION_CONFLICT' });
  });
  it('reuses an exact pending subscription; unrelated broadcasters remain untouched', async () => {
    const { manager, network } = setup(); network.mockResolvedValueOnce(page([
      { ...favor, id: 'other', condition: { broadcaster_user_id: '99999' } }, { ...favor, status: 'webhook_callback_verification_pending' }]));
    expect((await manager.ensurePilotFavorSubscription(playerId)).id).toBe('favor-id'); expect(network).toHaveBeenCalledOnce();
  });
  it('coalesces concurrent Faveur ensures and creates the exact broadcaster-only subscription', async () => {
    const { manager, network } = setup(); network.mockResolvedValueOnce(page([])).mockResolvedValueOnce(response({ data: [favor] }, 202));
    const [first, second] = await Promise.all([manager.ensurePilotFavorSubscription(playerId), manager.ensurePilotFavorSubscription(playerId)]);
    expect(first).toEqual(second); expect(network).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(network.mock.calls[1]![1]?.body))).toEqual({ type: 'channel.subscribe', version: '1',
      condition: { broadcaster_user_id: '12345' }, transport: { method: 'webhook', callback, secret: 'private-test-secret' } });
  });
  it.each([true, false])('recovers POST 409 only if the exact exists (exists=%s)', async exists => {
    const { manager, network } = setup(); network.mockResolvedValueOnce(page([])).mockResolvedValueOnce(response({}, 409)).mockResolvedValueOnce(page(exists ? [favor] : []));
    if (exists) expect((await manager.ensurePilotFavorSubscription(playerId)).id).toBe('favor-id');
    else await expect(manager.ensurePilotFavorSubscription(playerId)).rejects.toMatchObject({ code: 'TWITCH_EVENTSUB_SUBSCRIPTION_CONFLICT' });
  });
  it.each([true, false])('recovers DELETE 404 only if the exact disappeared (present=%s)', async present => {
    const { manager, network } = setup(); network.mockResolvedValueOnce(page([favor])).mockResolvedValueOnce(response({}, 404)).mockResolvedValueOnce(page(present ? [favor] : []));
    if (present) await expect(manager.disablePilotFavorSubscription(playerId)).rejects.toMatchObject({ code: 'TWITCH_EVENTSUB_SUBSCRIPTION_CONFLICT' });
    else expect(await manager.disablePilotFavorSubscription(playerId)).toBe('INACTIVE');
  });
  it('serializes Chat and Faveur operations per Player without conflating in-flight ensures', async () => {
    const { manager, network } = setup(), order: string[] = [];
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    network.mockImplementation(async (input, options) => {
      const type = options?.method === 'GET' ? new URL(String(input)).searchParams.get('type') : JSON.parse(String(options?.body)).type;
      order.push(`${options?.method}:${type}`);
      if (order.length === 1) await held;
      return options?.method === 'GET' ? page([]) : response({ data: [type === 'channel.subscribe' ? favor : chat] }, 202);
    });
    const first = manager.ensurePilotChatSubscription(playerId), second = manager.ensurePilotFavorSubscription(playerId);
    await vi.waitFor(() => expect(order).toHaveLength(1));
    release(); const subscriptions = await Promise.all([first, second]);
    expect(subscriptions.map(item => item.type)).toEqual(['channel.chat.message', 'channel.subscribe']);
    expect(order).toEqual(['GET:channel.chat.message', 'POST:channel.chat.message', 'GET:channel.subscribe', 'POST:channel.subscribe']);
  });
  it('rechecks expected ID/login inside the shared queue and cannot reuse a different validated identity', async () => {
    const { manager, network } = setup(); network.mockResolvedValueOnce(page([favor]));
    const valid = manager.ensurePilotFavorSubscription(playerId, '12345', 'kichnifou');
    const stale = manager.ensurePilotFavorSubscription(playerId, '98765', 'kichnifou');
    const badLogin = manager.ensurePilotFavorSubscription(playerId, '12345', 'other');
    const settled = await Promise.allSettled([valid, stale, badLogin]);
    expect(settled.map(item => item.status)).toEqual(['fulfilled', 'rejected', 'rejected']); expect(network).toHaveBeenCalledOnce();
  });
  it.each([{ initial: [] }, { initial: [chat] }, { initial: [favor] }, { initial: [chat, favor] }])('stops all exact subscriptions before unlink: $initial', async ({ initial }) => {
    const { manager, order, remove, current } = simulatedSubscriptions(initial);
    await manager.unlinkPilotIdentity(playerId, remove);
    expect(current).toEqual([]); expect(order.at(-1)).toBe('identity');
    expect(order.filter(value => value.startsWith('DELETE:'))).toEqual(initial.map(item => `DELETE:${item.id}`));
    expect(remove).toHaveBeenCalledOnce();
  });
  it.each(['chat', 'favor'] as const)('preserves identity on %s failure and retry completes without orphan', async failed => {
    const value = simulatedSubscriptions([chat, favor]); value.fail(failed);
    await expect(value.manager.unlinkPilotIdentity(playerId, value.remove)).rejects.toMatchObject({ code: 'TWITCH_EVENTSUB_API_FAILED' });
    expect(value.remove).not.toHaveBeenCalled();
    expect(value.current.map(item => item.id)).toContain(`${failed}-id`);
    value.fail('none'); await value.manager.unlinkPilotIdentity(playerId, value.remove);
    expect(value.current).toEqual([]); expect(value.order.at(-1)).toBe('identity');
  });
  it.each(['chat', 'favor'] as const)('preserves identity on %s conflict and never deletes the incompatible subscription', async failed => {
    const item = { ...(failed === 'chat' ? chat : favor), status: 'authorization_revoked' };
    const value = simulatedSubscriptions(failed === 'chat' ? [item, favor] : [chat, item]);
    await expect(value.manager.unlinkPilotIdentity(playerId, value.remove)).rejects.toMatchObject({ code: 'TWITCH_EVENTSUB_SUBSCRIPTION_CONFLICT' });
    expect(value.remove).not.toHaveBeenCalled(); expect(value.order).not.toContain(`DELETE:${failed}-id`);
  });
  it('cannot activate after an unlink already queued ahead of the callback', async () => {
    const value = simulatedSubscriptions([]);
    const unlink = value.manager.unlinkPilotIdentity(playerId, value.remove);
    const ensure = value.manager.ensurePilotFavorSubscription(playerId, '12345', 'kichnifou');
    const results = await Promise.allSettled([unlink, ensure]);
    expect(results.map(result => result.status)).toEqual(['fulfilled', 'rejected']);
    expect(value.network.mock.calls.every(([, options]) => options?.method !== 'POST')).toBe(true);
  });
  it('stops both types while reception is OFF, but gates activation/non-pilots before any network', async () => {
    const value = setup({ ...config, twitchEventSub: { ...config.twitchEventSub!, enabled: false } });
    await expect(value.manager.ensurePilotFavorSubscription(playerId)).rejects.toMatchObject({ code: 'TWITCH_RUNTIME_UNAVAILABLE' });
    await expect(value.manager.ensurePilotFavorSubscription(randomUUID())).rejects.toMatchObject({ code: 'TWITCH_PILOT_FORBIDDEN' });
    expect(value.network).not.toHaveBeenCalled();
    value.network.mockImplementation(async () => page([]));
    const remove = vi.fn(async () => undefined); await value.manager.unlinkPilotIdentity(playerId, remove);
    expect(value.network).toHaveBeenCalledTimes(2); expect(remove).toHaveBeenCalledOnce();
  });
});
