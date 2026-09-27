import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { TwitchObservationConflict, type TwitchEventObserver } from '../../application/twitch/twitch-event-observer.js';

const MAX_AGE_MS = 10 * 60 * 1000;
const header = (value: string | string[] | undefined) => typeof value === 'string' ? value : null;
const envelope = z.object({ subscription: z.object({ type: z.string(), version: z.string(), status: z.string().optional() }) });
const challengeEnvelope = envelope.extend({ challenge: z.string().min(1).max(1024) });
const chatEnvelope = envelope.extend({ event: z.object({ chatter_user_id: z.string().min(1), chatter_user_login: z.string().optional(), chatter_user_name: z.string().optional(), message: z.object({ text: z.string() }) }) });

export async function registerTwitchEventSubRoutes(app: FastifyInstance, options: { secret: string; observer: TwitchEventObserver }) {
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
    const parsed = chatEnvelope.safeParse(body);
    if (!parsed.success) return reply.code(400).send();
    if (parsed.data.subscription.type !== 'channel.chat.message' || parsed.data.subscription.version !== '1') return reply.code(422).send();
    try {
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
