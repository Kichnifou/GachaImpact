import 'dotenv/config';
import { createHmac, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { TwitchEventObserver } from '../src/application/twitch/twitch-event-observer.js';
import { isolatedBatchDatabase } from './isolated-batch-database.js';

const fixture = isolatedBatchDatabase();
const db = fixture.database;
const secret = 'private-eventsub-test-secret';
let app: FastifyInstance;
let offApp: FastifyInstance;
const challenge = { subscription: { type: 'channel.chat.message', version: '1' }, challenge: 'exact-challenge-value' };
const chat = (text = 'hello') => ({ subscription: { type: 'channel.chat.message', version: '1' }, event: { chatter_user_id: '424242', chatter_user_login: 'known', chatter_user_name: 'Known', message: { text } } });

function signed(kind: string, body: object | string, id = randomUUID(), timestamp = new Date().toISOString()) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  const signature = createHmac('sha256', secret).update(id).update(timestamp).update(payload).digest('hex');
  return { payload, headers: { 'content-type': 'application/json', 'twitch-eventsub-message-id': id, 'twitch-eventsub-message-timestamp': timestamp,
    'twitch-eventsub-message-signature': `sha256=${signature}`, 'twitch-eventsub-message-type': kind } };
}
const post = (instance: FastifyInstance, value: ReturnType<typeof signed>) => instance.inject({ method: 'POST', url: '/api/v1/twitch/eventsub', ...value });

beforeAll(async () => {
  await fixture.setup();
  const player = await db.player.create({ data: { displayName: 'EventSub private fixture' } });
  await db.twitchIdentity.create({ data: { playerId: player.id, twitchUserId: '424242', login: 'known' } });
  const dependencies = { authIdentityVerifier: { verify: async () => ({ subject: 'test' }) }, getOrProvisionCurrentPlayer: {} as never, twitchEventObserver: new TwitchEventObserver(db) };
  app = await buildApp({ host: '127.0.0.1', port: 3001, supabase: {}, twitchEventSub: { enabled: true, secret } }, dependencies);
  offApp = await buildApp({ host: '127.0.0.1', port: 3001, supabase: {}, twitchEventSub: { enabled: false } }, dependencies);
}, 60_000);
afterAll(async () => { await app?.close(); await offApp?.close(); await fixture.cleanup(); }, 60_000);

describe('Twitch EventSub webhook transport', () => {
  it('does not expose the route or create receipts while the flag is off', async () => {
    expect((await post(offApp, signed('notification', chat()))).statusCode).toBe(404);
    expect(await db.twitchEventReceipt.count()).toBe(0);
  });
  it('returns the exact signed challenge as plain text without a receipt', async () => {
    const response = await post(app, signed('webhook_callback_verification', challenge));
    expect(response.statusCode).toBe(200);
    expect(response.body).toBe(challenge.challenge);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(await db.twitchEventReceipt.count()).toBe(0);
  });
  it('rejects invalid HMAC, stale timestamps and missing headers before observing', async () => {
    const value = signed('notification', chat());
    expect((await post(app, { ...value, payload: value.payload.replace('hello', 'changed') })).statusCode).toBe(403);
    expect((await post(app, signed('notification', chat(), randomUUID(), '2020-01-01T00:00:00Z'))).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/v1/twitch/eventsub', payload: value.payload, headers: { 'content-type': 'application/json' } })).statusCode).toBe(400);
    expect(await db.twitchEventReceipt.count()).toBe(0);
  });
  it('creates one private receipt, replays exactly and refuses contradictory signed content', async () => {
    const id = randomUUID();
    const first = signed('notification', chat(), id);
    expect((await post(app, first)).statusCode).toBe(204);
    expect((await post(app, first)).statusCode).toBe(204);
    expect((await post(app, signed('notification', chat('changed'), id))).statusCode).toBe(409);
    const receipts = await db.twitchEventReceipt.findMany({ where: { externalEventId: id } });
    expect(receipts).toHaveLength(1);
    expect(receipts[0]?.state).toBe('RECEIVED');
    expect(JSON.stringify(receipts[0]?.payloadMinimal)).not.toContain('hello');
    expect(JSON.stringify(receipts[0]?.payloadMinimal)).toContain('transportPayloadHash');
  });
  it('accepts a signed revocation without a receipt and rejects malformed JSON', async () => {
    const before = await db.twitchEventReceipt.count();
    expect((await post(app, signed('revocation', { subscription: { type: 'channel.chat.message', version: '1', status: 'authorization_revoked' } }))).statusCode).toBe(204);
    expect((await post(app, signed('notification', '{'))).statusCode).toBe(400);
    expect((await post(app, signed('notification', { ...chat(), subscription: { type: 'channel.follow', version: '2' } }))).statusCode).toBe(422);
    expect(await db.twitchEventReceipt.count()).toBe(before);
  });
  it('does not produce gameplay, progression, chat, direct messages or notifications', async () => {
    expect(await db.businessOperation.count()).toBe(0);
    expect(await db.resourceMovement.count()).toBe(0);
    expect(await db.playerProgression.count()).toBe(0);
    expect(await db.globalChatMessage.count()).toBe(0);
    expect(await db.directMessage.count()).toBe(0);
    expect(await db.notification.count()).toBe(0);
  });
});
