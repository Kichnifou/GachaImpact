import type { TwitchFavorChatPresenceConsumer } from '../src/application/twitch/twitch-favor-chat-presence-consumer.js';
import { createHmac } from 'node:crypto';
import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { registerTwitchEventSubRoutes } from '../src/api/routes/twitch-eventsub.js';
import { TwitchObservationConflict, type TwitchEventObserver } from '../src/application/twitch/twitch-event-observer.js';
import type { TwitchFavorResubConsumer } from '../src/application/twitch/twitch-favor-resub-consumer.js';
import type { TwitchFavorGiftConsumer } from '../src/application/twitch/twitch-favor-gift-consumer.js';
import type { TwitchFavorSubscriptionConsumer } from '../src/application/twitch/twitch-favor-subscription-consumer.js';
import { subscriptionFavorTier } from '../src/application/twitch/twitch-subscription-proof.js';

const secret = 'private-subscription-secret';
const subscription = () => ({ subscription: { type: 'channel.subscribe', version: '1', condition: { broadcaster_user_id: '12' },
  id: 'subscription-id', transport: { method: 'webhook', callback: 'https://example.test/callback' } },
  event: { user_id: '34', user_login: 'recipient', user_name: 'Recipient', broadcaster_user_id: '12',
    broadcaster_user_login: 'channel', broadcaster_user_name: 'Channel', tier: '1000', is_gift: false } });
function signed(body: object | string, kind = 'notification', timestamp = new Date().toISOString()) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body), id = 'message-id';
  return { method: 'POST' as const, url: '/api/v1/twitch/eventsub', payload, headers: {
    'content-type': 'application/json', 'twitch-eventsub-message-id': id, 'twitch-eventsub-message-timestamp': timestamp,
    'twitch-eventsub-message-type': kind,
    'twitch-eventsub-message-signature': `sha256=${createHmac('sha256', secret).update(id).update(timestamp).update(payload).digest('hex')}`,
  } };
}
async function withRoute(run: (app: Awaited<ReturnType<typeof setup>>['app'], observe: ReturnType<typeof vi.fn>, consume: ReturnType<typeof vi.fn>) => Promise<void>) {
  const { app, observe, consume } = await setup();
  try { await run(app, observe, consume); } finally { await app.close(); }
}
async function setup() {
  const app = Fastify();
  const observe = vi.fn().mockResolvedValue({ receipt: { id: 'durable-receipt' } });
  const consume = vi.fn().mockResolvedValue({ state: 'PROCESSED' });
  await app.register(registerTwitchEventSubRoutes, { secret,
    observer: { observeTwitchEvent: observe } as unknown as TwitchEventObserver,
    favorSubscriptions: { consume } as unknown as TwitchFavorSubscriptionConsumer,
    favorGifts: { consume: vi.fn() } as unknown as TwitchFavorGiftConsumer,
    favorChatPresence: { consume: vi.fn() } as unknown as TwitchFavorChatPresenceConsumer,
    favorResubs: { consume: vi.fn() } as unknown as TwitchFavorResubConsumer });
  return { app, observe, consume };
}

describe('signed subscription webhook boundary', () => {
  it.each(['1000', '2000', '3000'] as const)('authenticates %s, observes the recipient proof, then consumes the receipt', async tier => {
    await withRoute(async (app, observe, consume) => {
      const body = subscription(); body.event.tier = tier;
      expect((await app.inject(signed(body))).statusCode).toBe(204);
      expect(observe).toHaveBeenCalledWith(expect.objectContaining({ externalEventId: 'message-id', eventType: 'channel.subscribe',
        twitchUserId: '34', login: 'recipient', displayName: 'Recipient', transportPayloadHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        subscriptionProof: { broadcasterTwitchId: '12', tier, isGift: false } }));
      expect(consume).toHaveBeenCalledWith('durable-receipt');
      expect(subscriptionFavorTier(tier)).toBe(({ '1000': 1, '2000': 2, '3000': 3 })[tier]);
    });
  });
  it('preserves Chat HMAC/raw bytes and challenge without consuming a subscription', async () => {
    await withRoute(async (app, observe, consume) => {
      const chat = { subscription: { type: 'channel.chat.message', version: '1' }, event: {
        chatter_user_id: '34', message: { text: 'hello' } } };
      const request = signed(chat);
      expect((await app.inject({ ...request, payload: request.payload.replace('hello', 'changed') })).statusCode).toBe(403);
      expect((await app.inject(request)).statusCode).toBe(204);
      expect(observe).toHaveBeenCalledTimes(1);
      const response = await app.inject(signed({ subscription: subscription().subscription, challenge: 'exact-challenge' }, 'webhook_callback_verification'));
      expect(response.statusCode).toBe(200); expect(response.body).toBe('exact-challenge');
      expect(consume).not.toHaveBeenCalled();
    });
  });
  it('rejects tampered or stale subscription signatures before observation', async () => {
    await withRoute(async (app, observe, consume) => {
      const request = signed(subscription());
      expect((await app.inject({ ...request, payload: request.payload.replace('Recipient', 'Other') })).statusCode).toBe(403);
      expect((await app.inject(signed(subscription(), 'notification', '2020-01-01T00:00:00Z'))).statusCode).toBe(400);
      expect(observe).not.toHaveBeenCalled(); expect(consume).not.toHaveBeenCalled();
    });
  });
  it.each(['channel.chat.notification', 'channel.subscription.end'])('rejects unsupported %s', async type => {
    await withRoute(async (app, observe) => {
      const body = subscription(); body.subscription.type = type;
      expect((await app.inject(signed(body))).statusCode).toBe(422); expect(observe).not.toHaveBeenCalled();
    });
  });
  it.each(['version', 'broadcaster', 'tier', 'gift-type', 'missing-user', 'unexpected-field'] as const)('rejects invalid %s before creating a receipt', async invalid => {
    await withRoute(async (app, observe) => {
      const body = subscription();
      if (invalid === 'version') body.subscription.version = '2';
      if (invalid === 'broadcaster') body.event.broadcaster_user_id = '56';
      if (invalid === 'tier') body.event.tier = '4000';
      if (invalid === 'gift-type') Object.assign(body.event, { is_gift: 'true' });
      if (invalid === 'missing-user') Reflect.deleteProperty(body.event, 'user_id');
      if (invalid === 'unexpected-field') Object.assign(body.event, { gifter_id: '56' });
      expect((await app.inject(signed(body))).statusCode).toBe(invalid === 'version' ? 422 : 400);
      expect(observe).not.toHaveBeenCalled();
    });
  });
  it('propagates transient failures for retry and preserves the existing envelope conflict response', async () => {
    await withRoute(async (app, observe, consume) => {
      consume.mockRejectedValueOnce(new Error('private infrastructure failure'));
      expect((await app.inject(signed(subscription()))).statusCode).toBe(500);
      expect((await app.inject(signed(subscription()))).statusCode).toBe(204);
      observe.mockRejectedValueOnce(new TwitchObservationConflict());
      expect((await app.inject(signed(subscription()))).statusCode).toBe(409);
      expect(consume).toHaveBeenCalledTimes(2);
    });
  });
});
