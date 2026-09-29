import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { TwitchObservationConflict, type TwitchEventObserver } from '../../application/twitch/twitch-event-observer.js';
import type { TwitchFavorSubscriptionConsumer } from '../../application/twitch/twitch-favor-subscription-consumer.js';
import type { TwitchFavorGiftConsumer } from '../../application/twitch/twitch-favor-gift-consumer.js';

const MAX_AGE_MS = 10 * 60 * 1000;
const header = (value: string | string[] | undefined) => typeof value === 'string' ? value : null;
const envelope = z.object({ subscription: z.object({ type: z.string(), version: z.string(), status: z.string().optional() }) });
const challengeEnvelope = envelope.extend({ challenge: z.string().min(1).max(1024) });
const chatEnvelope = envelope.extend({ event: z.object({ chatter_user_id: z.string().min(1), chatter_user_login: z.string().optional(), chatter_user_name: z.string().optional(), message: z.object({ text: z.string() }) }) });
const twitchId = z.string().regex(/^\d+$/).max(128);
const login = z.string().trim().min(1).max(64);
const name = z.string().trim().min(1).max(128);
const subscribeEnvelope = envelope.extend({
  subscription: envelope.shape.subscription.extend({ condition: z.object({ broadcaster_user_id: twitchId }).strict() }),
  event: z.object({ user_id: twitchId, user_login: login, user_name: name,
    broadcaster_user_id: twitchId, broadcaster_user_login: login, broadcaster_user_name: name,
    tier: z.enum(['1000', '2000', '3000']), is_gift: z.boolean() }).strict(),
}).refine(body => body.subscription.condition.broadcaster_user_id === body.event.broadcaster_user_id);
const giftEnvelope = envelope.extend({
  subscription: envelope.shape.subscription.extend({ condition: z.object({ broadcaster_user_id: twitchId }).strict() }),
  event: z.object({ user_id: twitchId.nullish(), user_login: login.nullish(), user_name: name.nullish(),
    broadcaster_user_id: twitchId, broadcaster_user_login: login, broadcaster_user_name: name,
    tier: z.enum(['1000', '2000', '3000']), total: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    is_anonymous: z.boolean(), cumulative_total: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullish(),
  }).strict(),
}).refine(body => body.subscription.condition.broadcaster_user_id === body.event.broadcaster_user_id)
  .refine(({ event }) => event.is_anonymous
    ? event.user_id == null && event.user_login == null && event.user_name == null
    : event.user_id != null);

export async function registerTwitchEventSubRoutes(app: FastifyInstance, options: {
  secret: string; observer: TwitchEventObserver; favorSubscriptions: TwitchFavorSubscriptionConsumer; favorGifts: TwitchFavorGiftConsumer;
}) {
  // Fastify's ordinary JSON parser loses the exact bytes Twitch signed. This parser is scoped to this route plugin.
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_request, body, done) => done(null, body));
  app.post('/api/v1/twitch/eventsub', { bodyLimit: 256_000, logLevel: 'silent' }, async (request, reply) => {
    const id = header(request.headers['twitch-eventsub-message-id']);
    const timestamp = header(request.headers['twitch-eventsub-message-timestamp']);
    const signature = header(request.headers['twitch-eventsub-message-signature']);
    const kind = header(request.headers['twitch-eventsub-message-type']);
    const raw = request.body;
    if (!id || id.length > 256 || !timestamp || !signature || !kind || !Buffer.isBuffer(raw)) return reply.code(400).send();
    const sentAt = Date.parse(timestamp);
    if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(timestamp) || !Number.isFinite(sentAt) || Math.abs(Date.now() - sentAt) > MAX_AGE_MS) return reply.code(400).send();
    if (!/^sha256=[0-9a-f]{64}$/i.test(signature)) return reply.code(403).send();
    const received = Buffer.from(signature.slice(7), 'hex');
    const expected = createHmac('sha256', options.secret).update(id).update(timestamp).update(raw).digest();
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) return reply.code(403).send();
    let body: unknown;
    try { body = JSON.parse(raw.toString('utf8')); }
    catch { return reply.code(400).send(); }
    if (kind === 'webhook_callback_verification') {
      const parsed = challengeEnvelope.safeParse(body);
      if (!parsed.success) return reply.code(400).send();
      return reply.code(200).type('text/plain; charset=utf-8').send(parsed.data.challenge);
    }
    if (kind === 'revocation') {
      const parsed = envelope.safeParse(body);
      if (!parsed.success) return reply.code(400).send();
      app.log.info({ status: parsed.data.subscription.status ?? 'unknown' }, 'Twitch EventSub subscription revoked');
      return reply.code(204).send();
    }
    if (kind !== 'notification') return reply.code(400).send();
    const notification = envelope.safeParse(body);
    if (!notification.success) return reply.code(400).send();
    if (notification.data.subscription.version !== '1'
      || !['channel.chat.message', 'channel.subscribe', 'channel.subscription.gift'].includes(notification.data.subscription.type)) return reply.code(422).send();
    try {
      if (notification.data.subscription.type === 'channel.subscription.gift') {
        const parsed = giftEnvelope.safeParse(body);
        if (!parsed.success) return reply.code(400).send();
        const event = parsed.data.event;
        const observed = await options.observer.observeTwitchEvent({ externalEventId: id, eventType: 'channel.subscription.gift',
          twitchUserId: event.user_id ?? null, login: event.user_login, displayName: event.user_name, sourceTimestamp: timestamp,
          transportPayloadHash: createHash('sha256').update(raw).digest('hex'),
          subscriptionGiftProof: { broadcasterTwitchId: event.broadcaster_user_id, tier: event.tier, total: event.total, isAnonymous: event.is_anonymous } });
        await options.favorGifts.consume(observed.receipt.id);
        return reply.code(204).send();
      }
      if (notification.data.subscription.type === 'channel.subscribe') {
        const parsed = subscribeEnvelope.safeParse(body);
        if (!parsed.success) return reply.code(400).send();
        const event = parsed.data.event;
        const observed = await options.observer.observeTwitchEvent({ externalEventId: id, eventType: 'channel.subscribe',
          twitchUserId: event.user_id, login: event.user_login, displayName: event.user_name, sourceTimestamp: timestamp,
          transportPayloadHash: createHash('sha256').update(raw).digest('hex'),
          subscriptionProof: { broadcasterTwitchId: event.broadcaster_user_id, tier: event.tier, isGift: event.is_gift } });
        await options.favorSubscriptions.consume(observed.receipt.id);
        return reply.code(204).send();
      }
      const parsed = chatEnvelope.safeParse(body);
      if (!parsed.success) return reply.code(400).send();
      await options.observer.observeTwitchEvent({
        externalEventId: id,
        eventType: parsed.data.subscription.type,
        twitchUserId: parsed.data.event.chatter_user_id,
        login: parsed.data.event.chatter_user_login,
        displayName: parsed.data.event.chatter_user_name,
        sourceTimestamp: timestamp,
        contentHash: createHash('sha256').update(parsed.data.event.message.text).digest('hex'),
        transportPayloadHash: createHash('sha256').update(raw).digest('hex'),
      });
      return reply.code(204).send();
    } catch (error) {
      if (error instanceof TwitchObservationConflict) return reply.code(409).send();
      throw error;
    }
  });
}
