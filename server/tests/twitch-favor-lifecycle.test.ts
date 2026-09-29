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
const gift: TwitchEventSubSubscription = { ...favor, id: 'gift-id', type: 'channel.subscription.gift' };
const resub: TwitchEventSubSubscription = { ...favor, id: 'resub-id', type: 'channel.subscription.message' };
const members = [favor, gift, resub];
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
  let failure: 'none' | 'chat' | 'favor' | 'gift' | 'resub' = 'none';
  value.network.mockImplementation(async (input, options) => {
    const url = new URL(String(input)), type = url.searchParams.get('type');
    if (options?.method === 'GET') { order.push(`GET:${type}`); return page(current.filter(item => item.type === type)); }
    if (options?.method === 'POST') {
      const body = JSON.parse(String(options.body)); order.push('POST:' + body.type);
      if ((failure === 'gift' && body.type === gift.type) || (failure === 'resub' && body.type === resub.type)) return response({}, 503);
      const created = { ...(members.find(item => item.type === body.type) ?? chat) };
      current.push(created); return response({ data: [created] }, 202);
    }
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


describe('EventSub gift client contract', () => {
  const body = { type: 'channel.subscription.gift' as const, version: '1' as const,
    condition: { broadcaster_user_id: '12345' }, transport: { method: 'webhook' as const, callback, secret: 'private-test-secret' } };
  it('paginates only gifts and sends the exact v1 broadcaster-only POST', async () => {
    const { client, network } = setup();
    network.mockResolvedValueOnce(page([gift], 'next')).mockResolvedValueOnce(page([])).mockResolvedValueOnce(response({ data: [gift] }, 202));
    expect(await client.listGiftSubscriptions()).toEqual([gift]);
    expect(network.mock.calls.slice(0, 2).map(([url]) => String(url))).toEqual([
      'https://api.twitch.tv/helix/eventsub/subscriptions?type=channel.subscription.gift',
      'https://api.twitch.tv/helix/eventsub/subscriptions?type=channel.subscription.gift&after=next']);
    expect(await client.createGiftSubscription(body)).toEqual(gift);
    expect(JSON.parse(String(network.mock.calls[2]![1]?.body))).toEqual(body);
  });
  it.each(['GET', 'POST', 'DELETE'] as const)('refreshes once on gift %s 401, never loops', async method => {
    const { client, network, tokenNetwork } = setup();
    const invoke = () => method === 'GET' ? client.listGiftSubscriptions() : method === 'POST' ? client.createGiftSubscription(body) : client.deleteSubscription('gift-id');
    network.mockResolvedValueOnce(response({}, 401)).mockResolvedValueOnce(method === 'GET' ? page([gift]) : method === 'POST' ? response({ data: [gift] }, 202) : new Response(null, { status: 204 }));
    await invoke(); expect(tokenNetwork).toHaveBeenCalledTimes(2); expect(network).toHaveBeenCalledTimes(2);
    network.mockReset().mockImplementation(async () => response({}, 401));
    await expect(invoke()).rejects.toMatchObject({ upstreamStatus: 401 }); expect(network).toHaveBeenCalledTimes(2);
  });
  it('rejects malformed gift pages, repeated pagination and POST results', async () => {
    const { client, network } = setup(); network.mockResolvedValueOnce(response({ data: [gift] }));
    await expect(client.listGiftSubscriptions()).rejects.toMatchObject({ code: 'TWITCH_EVENTSUB_RESPONSE_INVALID' });
    network.mockImplementation(async () => page([], 'again'));
    await expect(client.listGiftSubscriptions()).rejects.toMatchObject({ code: 'TWITCH_EVENTSUB_RESPONSE_INVALID' });
    network.mockReset().mockResolvedValueOnce(response({ data: [gift, gift] }, 202));
    await expect(client.createGiftSubscription(body)).rejects.toMatchObject({ code: 'TWITCH_EVENTSUB_RESPONSE_INVALID' });
  });
});

describe('EventSub resub client contract', () => {
  const body = { type: 'channel.subscription.message' as const, version: '1' as const,
    condition: { broadcaster_user_id: '12345' }, transport: { method: 'webhook' as const, callback, secret: 'private-test-secret' } };
  it('paginates only resubs and sends the exact v1 broadcaster-only POST', async () => {
    const { client, network } = setup();
    network.mockResolvedValueOnce(page([resub], 'next')).mockResolvedValueOnce(page([])).mockResolvedValueOnce(response({ data: [resub] }, 202));
    expect(await client.listResubSubscriptions()).toEqual([resub]);
    expect(network.mock.calls.slice(0, 2).map(([url]) => String(url))).toEqual([
      'https://api.twitch.tv/helix/eventsub/subscriptions?type=channel.subscription.message',
      'https://api.twitch.tv/helix/eventsub/subscriptions?type=channel.subscription.message&after=next']);
    expect(await client.createResubSubscription(body)).toEqual(resub);
    expect(JSON.parse(String(network.mock.calls[2]![1]?.body))).toEqual(body);
  });
  it.each(['GET', 'POST', 'DELETE'] as const)('refreshes once on resub %s 401, never loops', async method => {
    const { client, network, tokenNetwork } = setup();
    const invoke = () => method === 'GET' ? client.listResubSubscriptions() : method === 'POST' ? client.createResubSubscription(body) : client.deleteSubscription('resub-id');
    network.mockResolvedValueOnce(response({}, 401)).mockResolvedValueOnce(method === 'GET' ? page([resub]) : method === 'POST' ? response({ data: [resub] }, 202) : new Response(null, { status: 204 }));
    await invoke(); expect(tokenNetwork).toHaveBeenCalledTimes(2); expect(network).toHaveBeenCalledTimes(2);
    network.mockReset().mockImplementation(async () => response({}, 401));
    await expect(invoke()).rejects.toMatchObject({ upstreamStatus: 401 }); expect(network).toHaveBeenCalledTimes(2);
  });
  it('rejects malformed resub pages, repeated pagination and POST results', async () => {
    const { client, network } = setup(); network.mockResolvedValueOnce(response({ data: [resub] }));
    await expect(client.listResubSubscriptions()).rejects.toMatchObject({ code: 'TWITCH_EVENTSUB_RESPONSE_INVALID' });
    network.mockImplementation(async () => page([], 'again'));
    await expect(client.listResubSubscriptions()).rejects.toMatchObject({ code: 'TWITCH_EVENTSUB_RESPONSE_INVALID' });
    network.mockReset().mockResolvedValueOnce(response({ data: [resub, resub] }, 202));
    await expect(client.createResubSubscription(body)).rejects.toMatchObject({ code: 'TWITCH_EVENTSUB_RESPONSE_INVALID' });
  });
});

describe('Faveur group and shared pilot lifecycle queue', () => {
  it.each(members)('reports pending for exact $type among three members', async pendingMember => {
    const value = simulatedSubscriptions(members.map(item => item.type === pendingMember.type ? { ...item, status: 'webhook_callback_verification_pending' } : item));
    expect(await value.manager.inspectPilotFavorSubscription(playerId)).toBe('VERIFICATION_PENDING');
    expect((await value.manager.ensurePilotFavorSubscription(playerId)).status).toBe('webhook_callback_verification_pending');
    expect(value.order.some(item => item.startsWith('POST:'))).toBe(false);
  });
  it('retains the first two creations after third-member failure and retries only Resub', async () => {
    const value = simulatedSubscriptions([]); value.fail('resub');
    await expect(value.manager.ensurePilotFavorSubscription(playerId)).rejects.toMatchObject({ code: 'TWITCH_EVENTSUB_API_FAILED' });
    expect(value.current).toEqual([favor, gift]); expect(value.remove).not.toHaveBeenCalled();
    value.fail('none'); expect((await value.manager.ensurePilotFavorSubscription(playerId)).status).toBe('enabled');
    expect(value.current).toEqual(members);
    expect(value.order.filter(item => item === 'POST:channel.subscribe')).toHaveLength(1);
    expect(value.order.filter(item => item === 'POST:channel.subscription.gift')).toHaveLength(1);
    expect(value.order.filter(item => item === 'POST:channel.subscription.message')).toHaveLength(2);
  });
  it('does not hide a Resub outage behind earlier absent or pending members', async () => {
    for (const earlier of [[], [{ ...favor, status: 'webhook_callback_verification_pending' }]]) {
      const value = setup();
      value.network.mockResolvedValueOnce(page(earlier)).mockResolvedValueOnce(page([])).mockResolvedValueOnce(response({}, 503));
      await expect(value.manager.inspectPilotFavorSubscription(playerId)).rejects.toMatchObject({ code: 'TWITCH_EVENTSUB_API_FAILED' });
    }
  });
  it.each([
    [[], 'INACTIVE'], [[favor, gift, resub], 'ACTIVE'], [[favor], 'INACTIVE'], [[gift], 'INACTIVE'],
    [[resub], 'INACTIVE'], [[favor, gift], 'INACTIVE'], [[favor, resub], 'INACTIVE'], [[gift, resub], 'INACTIVE'],
    [[{ ...resub, status: 'webhook_callback_verification_pending' }], 'VERIFICATION_PENDING'],
    [[{ ...favor, status: 'webhook_callback_verification_pending' }], 'VERIFICATION_PENDING'],
    [[{ ...gift, status: 'webhook_callback_verification_pending' }], 'VERIFICATION_PENDING'],
    [[favor, { ...gift, status: 'webhook_callback_verification_pending' }], 'VERIFICATION_PENDING'],
    [[{ ...favor, status: 'webhook_callback_verification_pending' }, gift], 'VERIFICATION_PENDING'],
  ])('inspects group %j as %s without mutations', async (initial, expected) => {
    const value = simulatedSubscriptions(initial as TwitchEventSubSubscription[]);
    expect(await value.manager.inspectPilotFavorSubscription(playerId)).toBe(expected);
    expect(value.order).toEqual(['GET:channel.subscribe', 'GET:channel.subscription.gift', 'GET:channel.subscription.message']);
  });
  for (const subscription of members) {
    it.each([
      { ...subscription, version: '2' }, { ...subscription, condition: { broadcaster_user_id: '12345', user_id: '12345' } },
      { ...subscription, transport: { method: 'websocket' } }, { ...subscription, transport: { method: 'webhook', callback: 'https://other.example' } },
      { ...subscription, status: 'authorization_revoked' },
    ])('refuses incompatible group member %j without changing it', async item => {
      const value = simulatedSubscriptions([item as TwitchEventSubSubscription]);
      for (const run of [() => value.manager.inspectPilotFavorSubscription(playerId), () => value.manager.ensurePilotFavorSubscription(playerId), () => value.manager.disablePilotFavorSubscription(playerId)])
        await expect(run()).rejects.toMatchObject({ code: 'TWITCH_EVENTSUB_SUBSCRIPTION_CONFLICT' });
      expect(value.current).toContainEqual(item);
      expect(value.order).not.toContain('DELETE:' + subscription.id);
    });
    it('refuses duplicate ' + subscription.type, async () => {
      const value = simulatedSubscriptions([subscription, { ...subscription, id: 'duplicate' }]);
      await expect(value.manager.inspectPilotFavorSubscription(playerId)).rejects.toMatchObject({ code: 'TWITCH_EVENTSUB_SUBSCRIPTION_CONFLICT' });
    });
    it.each([true, false])('recovers POST 409 for ' + subscription.type + ' only when exact exists (%s)', async exists => {
      const value = setup();
      value.network.mockImplementation(async (input, options) => {
        const type = new URL(String(input)).searchParams.get('type');
        if (options?.method === 'POST') return response({}, 409);
        if (type !== subscription.type) return page(members.filter(item => item.type === type));
        const seenPost = value.network.mock.calls.some(([, opt]) => opt?.method === 'POST');
        return page(exists && seenPost ? [subscription] : []);
      });
      if (exists) expect((await value.manager.ensurePilotFavorSubscription(playerId)).subscriptions).toEqual(members);
      else await expect(value.manager.ensurePilotFavorSubscription(playerId)).rejects.toMatchObject({ code: 'TWITCH_EVENTSUB_SUBSCRIPTION_CONFLICT' });
    });
    it.each([true, false])('recovers DELETE 404 for ' + subscription.type + ' only when gone (%s)', async present => {
      const value = setup();
      value.network.mockImplementation(async (input, options) => {
        if (options?.method === 'DELETE') return response({}, 404);
        const afterDelete = value.network.mock.calls.some(([, opt]) => opt?.method === 'DELETE');
        return page(new URL(String(input)).searchParams.get('type') === subscription.type && (!afterDelete || present) ? [subscription] : []);
      });
      if (present) await expect(value.manager.disablePilotFavorSubscription(playerId)).rejects.toMatchObject({ code: 'TWITCH_EVENTSUB_SUBSCRIPTION_CONFLICT' });
      else expect(await value.manager.disablePilotFavorSubscription(playerId)).toBe('INACTIVE');
    });
    it('does not accept an unrelated POST response for ' + subscription.type, async () => {
      const value = setup();
      value.network.mockImplementation(async (input, options) => options?.method === 'POST' ? response({ data: [chat] }, 202)
        : page(members.filter(item => item.type === new URL(String(input)).searchParams.get('type') && item.type !== subscription.type)));
      await expect(value.manager.ensurePilotFavorSubscription(playerId)).rejects.toMatchObject({ code: 'TWITCH_EVENTSUB_SUBSCRIPTION_CONFLICT' });
    });
  }
  it('does not hide a gift inspection failure when beneficiary is absent', async () => {
    const value = setup(); value.network.mockResolvedValueOnce(page([])).mockResolvedValueOnce(response({}, 503));
    await expect(value.manager.inspectPilotFavorSubscription(playerId)).rejects.toMatchObject({ code: 'TWITCH_EVENTSUB_API_FAILED' });
  });
  it('uses the same abort deadline for both inspections', async () => {
    const value = setup(), controller = new AbortController();
    value.network.mockImplementation(async (_input, options) => {
      if (value.network.mock.calls.length === 1) return page([]);
      return new Promise<Response>((_resolve, reject) => options!.signal!.addEventListener('abort', () => reject(new Error('private abort')), { once: true }));
    });
    const pending = expect(value.manager.inspectPilotFavorSubscription(playerId, controller.signal)).rejects.toMatchObject({ upstreamStatus: 0 });
    await vi.waitFor(() => expect(value.network).toHaveBeenCalledTimes(2)); controller.abort(); await pending;
  });
  it.each([[favor], [gift], [resub], [favor, gift], [favor, resub], [gift, resub], members].map(initial => ({ initial })))('ensures only missing members of $initial and preserves unrelated broadcasters', async ({ initial }) => {
    const other = { ...gift, id: 'other', condition: { broadcaster_user_id: '99999' } };
    const value = simulatedSubscriptions([...initial, other]);
    const result = await value.manager.ensurePilotFavorSubscription(playerId);
    expect(result.status).toBe('enabled'); expect(result.subscriptions).toEqual(members);
    expect(value.order.filter(entry => entry.startsWith('POST:'))).toHaveLength(3 - initial.length);
    expect(value.current).toContainEqual(other);
  });
  it('reuses pending members and reports pending if either remains under verification', async () => {
    const value = simulatedSubscriptions([favor, { ...gift, status: 'webhook_callback_verification_pending' }, resub]);
    expect((await value.manager.ensurePilotFavorSubscription(playerId)).status).toBe('webhook_callback_verification_pending');
    expect(value.order).toEqual(['GET:channel.subscribe', 'GET:channel.subscription.gift', 'GET:channel.subscription.message']);
  });
  it('coalesces concurrent group ensures into three exact creations', async () => {
    const value = simulatedSubscriptions([]);
    const [first, second] = await Promise.all([value.manager.ensurePilotFavorSubscription(playerId), value.manager.ensurePilotFavorSubscription(playerId)]);
    expect(first).toEqual(second);
    expect(value.order).toEqual(['GET:channel.subscribe', 'POST:channel.subscribe', 'GET:channel.subscription.gift', 'POST:channel.subscription.gift', 'GET:channel.subscription.message', 'POST:channel.subscription.message']);
    for (const [, options] of value.network.mock.calls.filter(([, opt]) => opt?.method === 'POST')) {
      const body = JSON.parse(String(options?.body));
      expect(body).toEqual({ type: body.type, version: '1', condition: { broadcaster_user_id: '12345' }, transport: { method: 'webhook', callback, secret: 'private-test-secret' } });
    }
  });
  it('retains beneficiary creation after gift failure and completes only the missing member on retry', async () => {
    const value = simulatedSubscriptions([]); value.fail('gift');
    await expect(value.manager.ensurePilotFavorSubscription(playerId)).rejects.toMatchObject({ code: 'TWITCH_EVENTSUB_API_FAILED' });
    expect(value.current).toEqual([favor]); await expect(value.db.twitchIdentity.findUnique()).resolves.not.toBeNull();
    value.fail('none'); expect((await value.manager.ensurePilotFavorSubscription(playerId)).status).toBe('enabled');
    expect(value.order.filter(entry => entry === 'POST:channel.subscribe')).toHaveLength(1);
    expect(value.current).toEqual(members);
  });
  it('serializes Chat and the whole Faveur group without conflating operations', async () => {
    const value = simulatedSubscriptions([]);
    const [chatResult, favorResult] = await Promise.all([value.manager.ensurePilotChatSubscription(playerId), value.manager.ensurePilotFavorSubscription(playerId)]);
    expect(chatResult.type).toBe(chat.type); expect(favorResult.subscriptions).toEqual(members);
    expect(value.order).toEqual(['GET:channel.chat.message', 'POST:channel.chat.message', 'GET:channel.subscribe', 'POST:channel.subscribe', 'GET:channel.subscription.gift', 'POST:channel.subscription.gift', 'GET:channel.subscription.message', 'POST:channel.subscription.message']);
  });
  it('rechecks expected identity inside the shared queue', async () => {
    const value = simulatedSubscriptions(members);
    const settled = await Promise.allSettled([value.manager.ensurePilotFavorSubscription(playerId, '12345', 'kichnifou'),
      value.manager.ensurePilotFavorSubscription(playerId, '98765', 'kichnifou'), value.manager.ensurePilotFavorSubscription(playerId, '12345', 'other')]);
    expect(settled.map(item => item.status)).toEqual(['fulfilled', 'rejected', 'rejected']); expect(value.network).toHaveBeenCalledTimes(3);
  });
  it('disables all three Faveur subscriptions and leaves Chat intact; disabling Chat leaves all three Faveur intact', async () => {
    const value = simulatedSubscriptions([chat, ...members]);
    expect(await value.manager.disablePilotChatSubscription(playerId)).toBe('INACTIVE'); expect(value.current).toEqual(members);
    value.current.push(chat); expect(await value.manager.disablePilotFavorSubscription(playerId)).toBe('INACTIVE');
    expect(value.current).toEqual([chat]);
    expect(value.order.filter(entry => entry.startsWith('DELETE:'))).toEqual(['DELETE:chat-id', 'DELETE:favor-id', 'DELETE:gift-id', 'DELETE:resub-id']);
  });
  it('does not return disabled after an intermediate gift deletion failure, and retries', async () => {
    const value = simulatedSubscriptions([chat, ...members]); value.fail('gift');
    await expect(value.manager.disablePilotFavorSubscription(playerId)).rejects.toMatchObject({ code: 'TWITCH_EVENTSUB_API_FAILED' });
    expect(value.current).toEqual([chat, gift, resub]); value.fail('none');
    expect(await value.manager.disablePilotFavorSubscription(playerId)).toBe('INACTIVE'); expect(value.current).toEqual([chat]);
  });
  it.each(Array.from({ length: 16 }, (_, mask) => ({ initial: [chat, ...members].filter((_item, index) => mask & (1 << index)) })))('stops $initial before deleting identity', async ({ initial }) => {
    const value = simulatedSubscriptions(initial); await value.manager.unlinkPilotIdentity(playerId, value.remove);
    expect(value.current).toEqual([]); expect(value.order.at(-1)).toBe('identity'); expect(value.remove).toHaveBeenCalledOnce();
    expect(value.order.filter(entry => entry.startsWith('DELETE:'))).toEqual(initial.map(item => 'DELETE:' + item.id));
  });
  it.each(['chat', 'favor', 'gift', 'resub'] as const)('preserves identity on %s deletion failure and completes retry', async failed => {
    const value = simulatedSubscriptions([chat, ...members]); value.fail(failed);
    await expect(value.manager.unlinkPilotIdentity(playerId, value.remove)).rejects.toMatchObject({ code: 'TWITCH_EVENTSUB_API_FAILED' });
    expect(value.remove).not.toHaveBeenCalled(); expect(value.current.map(item => item.id)).toContain(failed + '-id');
    value.fail('none'); await value.manager.unlinkPilotIdentity(playerId, value.remove);
    expect(value.current).toEqual([]); expect(value.order.at(-1)).toBe('identity');
  });
  it.each([chat, ...members])('preserves identity on conflict in $type', async subscription => {
    const value = simulatedSubscriptions([chat, ...members].map(item => item.type === subscription.type ? { ...item, status: 'authorization_revoked' } : item));
    await expect(value.manager.unlinkPilotIdentity(playerId, value.remove)).rejects.toMatchObject({ code: 'TWITCH_EVENTSUB_SUBSCRIPTION_CONFLICT' });
    expect(value.remove).not.toHaveBeenCalled(); expect(value.order).not.toContain('DELETE:' + subscription.id);
  });
  it('cannot activate after an unlink queued ahead of the callback', async () => {
    const value = simulatedSubscriptions([]);
    const results = await Promise.allSettled([value.manager.unlinkPilotIdentity(playerId, value.remove), value.manager.ensurePilotFavorSubscription(playerId, '12345', 'kichnifou')]);
    expect(results.map(result => result.status)).toEqual(['fulfilled', 'rejected']);
    expect(value.order.some(entry => entry.startsWith('POST:'))).toBe(false);
  });
  it('permits removal with reception OFF and gates activation/non-pilots before network', async () => {
    const value = setup({ ...config, twitchEventSub: { ...config.twitchEventSub!, enabled: false } });
    await expect(value.manager.ensurePilotFavorSubscription(playerId)).rejects.toMatchObject({ code: 'TWITCH_RUNTIME_UNAVAILABLE' });
    await expect(value.manager.ensurePilotFavorSubscription(randomUUID())).rejects.toMatchObject({ code: 'TWITCH_PILOT_FORBIDDEN' });
    expect(value.network).not.toHaveBeenCalled(); value.network.mockImplementation(async () => page([]));
    const remove = vi.fn(async () => undefined); await value.manager.unlinkPilotIdentity(playerId, remove);
    expect(value.network).toHaveBeenCalledTimes(4); expect(remove).toHaveBeenCalledOnce();
  });
});
