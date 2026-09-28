import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { AppConfig } from '../src/config/environment.js';
import { TwitchEventSubSubscriptionManager } from '../src/application/twitch/twitch-eventsub-subscription-manager.js';
import { TwitchAppAccessTokenProvider } from '../src/infrastructure/twitch/twitch-app-access-token-provider.js';
import { TwitchEventSubClient } from '../src/infrastructure/twitch/twitch-eventsub-client.js';

const playerId = '11111111-1111-4111-8111-111111111111';
const callback = 'https://backend.example/api/v1/twitch/eventsub';
const subscription = { id: 'subscription-id', type: 'channel.chat.message', version: '1', status: 'enabled',
  condition: { broadcaster_user_id: '12345', user_id: '12345' }, transport: { method: 'webhook', callback } };
const config: AppConfig = { host: '127.0.0.1', port: 3001, supabase: {}, twitch: { clientId: 'client', clientSecret: 'test-secret', pilotPlayerIds: [playerId], pilotLogin: 'kichnifou' },
  twitchEventSub: { enabled: true, secret: 'test-webhook-secret', callbackUrl: callback } };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const page = (data: unknown[], cursor?: string) => response({ data, pagination: cursor ? { cursor } : {} });
function setup(settings = config) {
  const network = vi.fn<typeof fetch>();
  const tokenNetwork = vi.fn<typeof fetch>().mockImplementation(async () => response({ access_token: 'app-token', token_type: 'bearer', expires_in: 1_000 }));
  const tokens = new TwitchAppAccessTokenProvider('client', 'test-secret', tokenNetwork);
  const db = { twitchIdentity: { findUnique: vi.fn().mockResolvedValue({ playerId, twitchUserId: '12345', login: 'kichnifou' }) } };
  const client = new TwitchEventSubClient('client', tokens, network);
  const manager = new TwitchEventSubSubscriptionManager(db as unknown as PrismaClient, settings, client);
  return { network, tokenNetwork, manager, db, client };
}

describe('EventSub pilot subscription manager', () => {
  it('is inert until explicitly called and creates exactly the pilot webhook once, including concurrent ensures', async () => {
    const { manager, network, tokenNetwork, db } = setup();
    expect(network).not.toHaveBeenCalled(); expect(tokenNetwork).not.toHaveBeenCalled();
    network.mockResolvedValueOnce(page([])).mockResolvedValueOnce(response({ data: [{ ...subscription, status: 'webhook_callback_verification_pending' }] }, 202));
    const [first, second] = await Promise.all([manager.ensurePilotChatSubscription(playerId), manager.ensurePilotChatSubscription(playerId)]);
    expect(first).toEqual(second); expect(first.status).toBe('webhook_callback_verification_pending');
    expect(db.twitchIdentity.findUnique).toHaveBeenCalledWith({ where: { playerId } });
    expect(network).toHaveBeenCalledTimes(2);
    const [url, options] = network.mock.calls[1]!;
    expect(String(url)).toBe('https://api.twitch.tv/helix/eventsub/subscriptions');
    expect(options?.method).toBe('POST');
    expect(options?.headers).toMatchObject({ authorization: 'Bearer app-token', 'client-id': 'client' });
    expect(JSON.parse(options?.body as string)).toEqual({ type: 'channel.chat.message', version: '1', condition: subscription.condition,
      transport: { method: 'webhook', callback, secret: 'test-webhook-secret' } });
    expect(JSON.stringify(first)).not.toContain('test-webhook-secret');
  });
  it.each(['enabled', 'webhook_callback_verification_pending'])('reuses an exact %s subscription', async status => {
    const { manager, network } = setup();
    network.mockResolvedValueOnce(page([{ ...subscription, status }]));
    expect((await manager.ensurePilotChatSubscription(playerId)).status).toBe(status);
    expect(network).toHaveBeenCalledOnce();
  });
  it('recovers a 409 by listing and finding the exact subscription without a second create', async () => {
    const { manager, network } = setup();
    network.mockResolvedValueOnce(page([])).mockResolvedValueOnce(response({ message: 'arbitrary upstream error' }, 409)).mockResolvedValueOnce(page([subscription]));
    expect(await manager.ensurePilotChatSubscription(playerId)).toEqual(subscription);
    expect(network.mock.calls.map(([, options]) => options?.method)).toEqual(['GET', 'POST', 'GET']);
  });
  it('refuses an unresolved 409', async () => {
    const { manager, network } = setup();
    network.mockResolvedValueOnce(page([])).mockResolvedValueOnce(response({}, 409)).mockResolvedValueOnce(page([]));
    await expect(manager.ensurePilotChatSubscription(playerId)).rejects.toMatchObject({ code: 'TWITCH_EVENTSUB_SUBSCRIPTION_CONFLICT' });
  });
  it.each([
    { ...subscription, transport: { method: 'webhook', callback: 'https://other.example/api/v1/twitch/eventsub' } },
    { ...subscription, version: '2' },
    { ...subscription, transport: { method: 'websocket' } },
    { ...subscription, status: 'authorization_revoked' },
    { ...subscription, condition: { ...subscription.condition, extra: 'unexpected' } },
  ])('reports incompatible subscriptions without creating or deleting anything', async incompatible => {
    const { manager, network } = setup(); network.mockResolvedValueOnce(page([incompatible]));
    await expect(manager.ensurePilotChatSubscription(playerId)).rejects.toMatchObject({ code: 'TWITCH_EVENTSUB_SUBSCRIPTION_CONFLICT' });
    expect(network).toHaveBeenCalledOnce();
  });
  it('checks every page even when an exact subscription was already found', async () => {
    const { manager, network } = setup();
    network.mockResolvedValueOnce(page([], 'next')).mockResolvedValueOnce(page([subscription]));
    expect(await manager.ensurePilotChatSubscription(playerId)).toEqual(subscription);
    expect(new URL(String(network.mock.calls[1]![0])).searchParams.get('after')).toBe('next');
    expect(network).toHaveBeenCalledTimes(2);
  });
  it('detects duplicates or conflicting entries on subsequent pages', async () => {
    const { manager, network } = setup();
    network.mockResolvedValueOnce(page([subscription], 'next')).mockResolvedValueOnce(page([{ ...subscription, id: 'other', version: '2' }]));
    await expect(manager.ensurePilotChatSubscription(playerId)).rejects.toMatchObject({ code: 'TWITCH_EVENTSUB_SUBSCRIPTION_CONFLICT' });
  });
  it('refreshes an App Token once on 401, then retries with the new token', async () => {
    const { manager, network, tokenNetwork } = setup();
    tokenNetwork.mockReset().mockResolvedValueOnce(response({ access_token: 'old', token_type: 'bearer', expires_in: 1_000 }))
      .mockResolvedValueOnce(response({ access_token: 'new', token_type: 'bearer', expires_in: 1_000 }));
    network.mockResolvedValueOnce(response({}, 401)).mockResolvedValueOnce(page([subscription]));
    expect(await manager.ensurePilotChatSubscription(playerId)).toEqual(subscription);
    expect(network.mock.calls[0]![1]?.headers).toMatchObject({ authorization: 'Bearer old' });
    expect(network.mock.calls[1]![1]?.headers).toMatchObject({ authorization: 'Bearer new' });
    expect(tokenNetwork).toHaveBeenCalledTimes(2);
  });
  it('stops after a second 401 without exposing tokens, secrets or upstream text', async () => {
    const { manager, network, tokenNetwork } = setup();
    network.mockImplementation(async () => response({ message: 'app-token test-secret test-webhook-secret' }, 401));
    await expect(manager.ensurePilotChatSubscription(playerId)).rejects.toMatchObject({ code: 'TWITCH_EVENTSUB_API_FAILED', message: 'API EventSub Twitch indisponible.' });
    expect(network).toHaveBeenCalledTimes(2); expect(tokenNetwork).toHaveBeenCalledTimes(2);
  });
  it.each([{ data: [] }, { data: [null], pagination: {} }, { data: [{ ...subscription, condition: { user_id: 12 } }], pagination: {} }])('validates runtime responses', async body => {
    const { manager, network } = setup(); network.mockResolvedValueOnce(response(body));
    await expect(manager.ensurePilotChatSubscription(playerId)).rejects.toMatchObject({ code: 'TWITCH_EVENTSUB_RESPONSE_INVALID' });
  });
  it('refuses repeated pagination cursors', async () => {
    const { manager, network } = setup(); network.mockImplementation(async () => page([], 'loop'));
    await expect(manager.ensurePilotChatSubscription(playerId)).rejects.toMatchObject({ code: 'TWITCH_EVENTSUB_RESPONSE_INVALID' });
    expect(network).toHaveBeenCalledTimes(2);
  });
  it('does no network work when off, unconfigured, non-pilot or unlinked', async () => {
    for (const settings of [{ ...config, twitchEventSub: { enabled: false } }, { ...config, twitchEventSub: { enabled: true } }]) {
      const { manager, network, tokenNetwork } = setup(settings);
      await expect(manager.ensurePilotChatSubscription(playerId)).rejects.toMatchObject({ code: 'TWITCH_RUNTIME_UNAVAILABLE' });
      expect(network).not.toHaveBeenCalled(); expect(tokenNetwork).not.toHaveBeenCalled();
    }
    const { manager, network, db } = setup();
    await expect(manager.ensurePilotChatSubscription('arbitrary-player')).rejects.toMatchObject({ code: 'TWITCH_PILOT_FORBIDDEN' });
    db.twitchIdentity.findUnique.mockResolvedValue(null);
    await expect(manager.ensurePilotChatSubscription(playerId)).rejects.toMatchObject({ code: 'TWITCH_RUNTIME_IDENTITY_REQUIRED' });
    expect(network).not.toHaveBeenCalled();
  });
});
