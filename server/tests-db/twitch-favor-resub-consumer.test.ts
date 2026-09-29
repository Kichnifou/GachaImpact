import 'dotenv/config';
import { createHmac, randomUUID } from 'node:crypto';
import pg from 'pg';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { type Prisma, type PrismaClient } from '../generated/prisma/client.js';
import { buildApp } from '../src/app.js';
import { FavorService } from '../src/application/favor/favor-service.js';
import { TwitchEventObserver, TwitchObservationConflict, type TwitchObservedEvent } from '../src/application/twitch/twitch-event-observer.js';
import { TwitchFavorResubConsumer, resubFavorKey } from '../src/application/twitch/twitch-favor-resub-consumer.js';
import { TwitchFavorSubscriptionConsumer } from '../src/application/twitch/twitch-favor-subscription-consumer.js';
import { TwitchFavorGiftConsumer } from '../src/application/twitch/twitch-favor-gift-consumer.js';
import { PrismaEconomyService } from '../src/infrastructure/database/prisma-economy-service.js';
import { TwitchReceiptRetention } from '../src/application/twitch/twitch-receipt-retention.js';
import { isolatedBatchDatabase } from './isolated-batch-database.js';

const fixture = isolatedBatchDatabase(), db = fixture.database;
const now = new Date('2026-09-29T12:00:00Z'), clock = { now: () => now };
const observer = new TwitchEventObserver(db), favor = new FavorService(db, clock);
const consumer = new TwitchFavorResubConsumer(db, clock, favor);
const subscribers = new TwitchFavorSubscriptionConsumer(db, clock, favor);
const secret = 'private-resub-secret';
let app: FastifyInstance, sequence = 600000;
beforeAll(async () => {
  await fixture.setup({ seedPublicCatalog: true });
  app = await buildApp({ host: '127.0.0.1', port: 3001, supabase: {}, twitchEventSub: { enabled: true, secret } }, {
    authIdentityVerifier: { verify: async () => ({ subject: 'private-test' }) }, getOrProvisionCurrentPlayer: {} as never,
    twitchEventObserver: observer, twitchFavorSubscriptions: subscribers,
    twitchFavorGifts: new TwitchFavorGiftConsumer(db, clock), twitchFavorResubs: consumer,
  });
}, 60_000);
afterAll(async () => {
  await app?.close(); await fixture.cleanup();
  const inspector = new pg.Client({ connectionString: process.env['DATABASE_URL'] });
  try {
    await inspector.connect();
    expect((await inspector.query('SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname = $1', [fixture.schema])).rows).toHaveLength(0);
    console.info('Resub private schema cleanup verified:', fixture.schema);
  } finally { await inspector.end(); }
}, 60_000);
async function player(elementKey: 'pyro' | null = 'pyro', status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED' = 'ACTIVE') {
  const row = await db.player.create({ data: { displayName: `Private resub ${randomUUID().slice(0, 8)}`, elementKey, status,
    economyStats: { create: { totalPrimosEarned: 123n, totalPrimosSpent: 17n } },
    resourceBalances: { create: { resourceKey: 'primogems', amount: 42n } } } });
  const twitchUserId = String(++sequence);
  await db.twitchIdentity.create({ data: { playerId: row.id, twitchUserId, login: 'subscriber' } });
  return { playerId: row.id, twitchUserId };
}
const event = (twitchUserId = String(++sequence), tier: '1000' | '2000' | '3000' = '1000'): TwitchObservedEvent => ({
  externalEventId: randomUUID(), eventType: 'channel.subscription.message', twitchUserId,
  subscriptionMessageProof: { broadcasterTwitchId: '12', tier }, sourceTimestamp: now.toISOString(), transportPayloadHash: 'c'.repeat(64),
});
async function snapshot(playerId: string) {
  return { state: await db.playerFavorState.findUnique({ where: { playerId } }),
    grants: await db.favorGrant.findMany({ where: { playerId } }), ops: await db.businessOperation.findMany({ where: { playerId } }),
    movements: await db.resourceMovement.findMany({ where: { playerId } }), stats: await db.playerEconomyStats.findUnique({ where: { playerId } }),
    balance: await db.playerResourceBalance.findUnique({ where: { playerId_resourceKey: { playerId, resourceKey: 'primogems' } } }),
  };
}
async function assertEffect(playerId: string, receiptId: string, amount: bigint) {
  const saved = await snapshot(playerId);
  expect(saved.grants).toHaveLength(1); expect(saved.ops).toHaveLength(1); expect(saved.movements).toHaveLength(1);
  expect(saved.grants[0]).toMatchObject({ twitchEventReceiptId: receiptId, requestedDays: 30, addedDays: 30, blockedDays: 0, immediatePrimogems: amount });
  expect(saved.ops[0]).toMatchObject({ operationType: 'favor.grant', sourceChannel: 'TWITCH', status: 'COMPLETED' });
  expect(saved.movements[0]).toMatchObject({ resourceKey: 'primogems', delta: amount, causeKey: 'favor.grant' });
  expect(saved.balance).toMatchObject({ amount: 42n + amount });
  expect(saved.stats).toMatchObject({ totalPrimosEarned: 123n + amount, totalPrimosSpent: 17n });
  expect(saved.state).toMatchObject({ activeFromDate: new Date('2026-09-30'), activeUntilDate: new Date('2026-10-29') });
  expect(await db.twitchEventReceipt.findUniqueOrThrow({ where: { id: receiptId } })).toMatchObject({
    state: 'PROCESSED', processedAt: now, externalReference: `favor:grant:${saved.grants[0]!.id}`, errorMessage: null,
  });
  expect(await db.businessOperation.count({ where: { playerId, operationType: 'favor.gifter-bonus' } })).toBe(0);
  expect(await db.playerPermanentMissionState.count({ where: { playerId } })).toBe(0);
}
const body = (userId: string, tier = '1000') => ({ subscription: { type: 'channel.subscription.message', version: '1', condition: { broadcaster_user_id: '12' } },
  event: { user_id: userId, user_login: 'subscriber', user_name: 'Subscriber', broadcaster_user_id: '12', broadcaster_user_login: 'broadcaster', broadcaster_user_name: 'Broadcaster',
    tier, cumulative_months: 15, duration_months: 6, streak_months: 1,
    message: { text: 'PRIVATE_RESUB_TEXT Kappa', emotes: [{ begin: 19, end: 23, id: 'private-emote-id' }] } },
});
function send(value: unknown, id = randomUUID(), timestamp = new Date().toISOString(), hmacSecret = secret, kind = 'notification') {
  const payload = JSON.stringify(value);
  return app.inject({ method: 'POST', url: '/api/v1/twitch/eventsub', payload, headers: {
    'content-type': 'application/json', 'twitch-eventsub-message-id': id, 'twitch-eventsub-message-timestamp': timestamp,
    'twitch-eventsub-message-type': kind, 'twitch-eventsub-message-signature': `sha256=${createHmac('sha256', hmacSecret).update(id).update(timestamp).update(payload).digest('hex')}`,
  } });
}
function failFinalization() {
  const boundary = { $transaction: (run: (tx: Prisma.TransactionClient) => Promise<unknown>, options: object) =>
    db.$transaction(tx => run({ ...tx, twitchEventReceipt: { ...tx.twitchEventReceipt,
      update: async () => { throw new Error('private resub finalization failure'); },
    } } as unknown as Prisma.TransactionClient), options) } as unknown as PrismaClient;
  return new TwitchFavorResubConsumer(boundary, clock, favor);
}

describe('signed reliable resub payments and privacy', () => {
  it.each([['1000', 1600n], ['2000', 9600n], ['3000', 20800n]] as const)('pays %s +30 days once, with no gifter effect or raw message persisted', async (tier, amount) => {
    const p = await player(), possibleGifter = await player(), gifterBefore = await snapshot(possibleGifter.playerId);
    const id = randomUUID(), timestamp = new Date().toISOString(), value = body(p.twitchUserId, tier);
    expect((await send(value, id, timestamp)).statusCode).toBe(204);
    expect((await send(value, id, timestamp)).statusCode).toBe(204);
    const receipt = await db.twitchEventReceipt.findUniqueOrThrow({ where: { externalEventId: id } });
    await assertEffect(p.playerId, receipt.id, amount);
    expect((await db.businessOperation.findFirstOrThrow({ where: { playerId: p.playerId } })).idempotencyKey).toBe(`favor:grant:${resubFavorKey(id)}`);
    expect(receipt.payloadMinimal).toMatchObject({ subscriptionMessageProof: { broadcasterTwitchId: '12', tier }, contentHash: null });
    const persisted = JSON.stringify({ receipt, player: await snapshot(p.playerId) }, (_key, value: unknown) => typeof value === 'bigint' ? value.toString() : value);
    for (const forbidden of ['PRIVATE_RESUB_TEXT', 'private-emote-id', 'emotes', 'streak_months', 'cumulative_months', 'duration_months']) expect(persisted).not.toContain(forbidden);
    expect(await snapshot(possibleGifter.playerId)).toEqual(gifterBefore);
  });
  it.each([[0, 0, null], [1, 1, 0], [Number.MAX_SAFE_INTEGER, 120, 72]] as const)('never multiplies rewards or days by months %s / %s / %s', async (cumulative, duration, streak) => {
    const p = await player(), value = body(p.twitchUserId, '2000'), id = randomUUID();
    expect((await send({ ...value, event: { ...value.event, cumulative_months: cumulative, duration_months: duration, streak_months: streak } }, id)).statusCode).toBe(204);
    await assertEffect(p.playerId, (await db.twitchEventReceipt.findUniqueOrThrow({ where: { externalEventId: id } })).id, 9600n);
  });
  it.each([[170, '2000', 10, 20, 1067n, 10667n], [180, '3000', 0, 30, 1600n, 22400n]] as const)('preserves overflow base for %s days, tier %s', async (days, tier, added, blocked, compensation, amount) => {
    const p = await player();
    const until = new Date('2026-09-29'); until.setUTCDate(until.getUTCDate() + days - 1);
    await db.playerFavorState.create({ data: { playerId: p.playerId, activeFromDate: new Date('2026-09-29'), activeUntilDate: until } });
    const observed = await observer.observeTwitchEvent(event(p.twitchUserId, tier)); await consumer.consume(observed.receipt.id);
    expect(await db.favorGrant.findFirstOrThrow({ where: { playerId: p.playerId } })).toMatchObject({ addedDays: added, blockedDays: blocked, compensationPrimogems: compensation });
    expect((await snapshot(p.playerId)).balance).toMatchObject({ amount: 42n + amount });
    expect(await favor.getCurrent(p.playerId)).toMatchObject({ daysRemaining: 180 });
  });
  it.each(['unknown', 'element', 'SUSPENDED', 'ARCHIVED'] as const)('ignores %s terminally, including later link/activation', async reason => {
    const p = reason === 'unknown' ? null : await player(reason === 'element' ? null : 'pyro', reason === 'SUSPENDED' || reason === 'ARCHIVED' ? reason : 'ACTIVE');
    const input = event(p?.twitchUserId), counts = await Promise.all([db.player.count(), db.twitchIdentity.count(), db.favorGrant.count(), db.businessOperation.count()]);
    const observed = await observer.observeTwitchEvent(input), terminal = await consumer.consume(observed.receipt.id);
    expect(terminal).toMatchObject({ state: 'PROCESSED', processedAt: now, externalReference: `favor:ignored:${reason === 'unknown' ? 'identity-unresolved' : reason === 'element' ? 'element-missing' : 'player-inactive'}` });
    expect(await Promise.all([db.player.count(), db.twitchIdentity.count(), db.favorGrant.count(), db.businessOperation.count()])).toEqual(counts);
    const later = p ?? await player();
    if (!p) await db.twitchIdentity.update({ where: { playerId: later.playerId }, data: { twitchUserId: input.twitchUserId! } });
    await db.player.update({ where: { id: later.playerId }, data: { status: 'ACTIVE', elementKey: 'pyro' } });
    const before = await snapshot(later.playerId);
    expect(await consumer.consume((await observer.observeTwitchEvent(input)).receipt.id)).toEqual(terminal);
    expect(await snapshot(later.playerId)).toEqual(before);
  });
  it('ACKs an unknown signed resub with a terminal ignored receipt', async () => {
    const id = randomUUID(); expect((await send(body(String(++sequence)), id)).statusCode).toBe(204);
    expect(await db.twitchEventReceipt.findUniqueOrThrow({ where: { externalEventId: id } })).toMatchObject({ state: 'PROCESSED', externalReference: 'favor:ignored:identity-unresolved' });
  });
  it('serializes concurrent observation and consumption into one attribution', async () => {
    const p = await player(), input = event(p.twitchUserId, '3000');
    const receipts = await Promise.all(Array.from({ length: 3 }, async () => consumer.consume((await observer.observeTwitchEvent(input)).receipt.id)));
    expect(new Set(receipts.map(receipt => receipt.id)).size).toBe(1); await assertEffect(p.playerId, receipts[0]!.id, 20800n);
  });
  it('uses separate Message IDs for subscribe and resub without artificial correlation', async () => {
    const p = await player(), resub = await observer.observeTwitchEvent(event(p.twitchUserId, '2000'));
    const initial = await observer.observeTwitchEvent({ externalEventId: randomUUID(), eventType: 'channel.subscribe', twitchUserId: p.twitchUserId,
      subscriptionProof: { broadcasterTwitchId: '12', tier: '2000', isGift: true } });
    await Promise.all([consumer.consume(resub.receipt.id), subscribers.consume(initial.receipt.id)]);
    expect(await db.favorGrant.count({ where: { playerId: p.playerId } })).toBe(2);
    expect(await favor.getCurrent(p.playerId)).toMatchObject({ daysRemaining: 60 });
    expect((await snapshot(p.playerId)).balance).toMatchObject({ amount: 19242n });
    expect(await db.businessOperation.count({ where: { playerId: p.playerId, operationType: 'favor.gifter-bonus' } })).toBe(0);
  });
  it('recovers a durable grant before changed identity or eligibility without recredit', async () => {
    const p = await player(), input = event(p.twitchUserId), observed = await observer.observeTwitchEvent(input);
    await favor.grant({ playerId: p.playerId, tier: 1, idempotencyKey: resubFavorKey(input.externalEventId), twitchEventReceiptId: observed.receipt.id });
    const before = await snapshot(p.playerId);
    await expect(failFinalization().consume(observed.receipt.id)).rejects.toThrow('private resub finalization failure');
    expect((await db.twitchEventReceipt.findUniqueOrThrow({ where: { id: observed.receipt.id } })).state).toBe('RECEIVED');
    await db.twitchIdentity.delete({ where: { playerId: p.playerId } });
    await db.player.update({ where: { id: p.playerId }, data: { status: 'SUSPENDED', elementKey: null } });
    await consumer.consume(observed.receipt.id); expect(await snapshot(p.playerId)).toEqual(before);
    await assertEffect(p.playerId, observed.receipt.id, 1600n);
  });
  it('rolls back grant, days, movement, stats and operation after failed finalization', async () => {
    const p = await player(), observed = await observer.observeTwitchEvent(event(p.twitchUserId)), before = await snapshot(p.playerId);
    await expect(failFinalization().consume(observed.receipt.id)).rejects.toThrow('private resub finalization failure');
    expect(await snapshot(p.playerId)).toEqual(before);
    expect(await db.twitchEventReceipt.findUniqueOrThrow({ where: { id: observed.receipt.id } })).toMatchObject({ state: 'RECEIVED', processedAt: null, externalReference: null });
    await consumer.consume(observed.receipt.id); await assertEffect(p.playerId, observed.receipt.id, 1600n);
  });
  it('rolls back an infrastructure failure after the economy credit', async () => {
    const p = await player(), observed = await observer.observeTwitchEvent(event(p.twitchUserId)), before = await snapshot(p.playerId);
    const economy = new PrismaEconomyService(() => now), real = economy.credit.bind(economy);
    vi.spyOn(economy, 'credit').mockImplementation(async (tx, input) => { await real(tx, input); throw new Error('private after-credit outage'); });
    await expect(new TwitchFavorResubConsumer(db, clock, new FavorService(db, clock, economy)).consume(observed.receipt.id)).rejects.toThrow('private after-credit outage');
    expect(await snapshot(p.playerId)).toEqual(before);
    expect((await db.twitchEventReceipt.findUniqueOrThrow({ where: { id: observed.receipt.id } })).state).toBe('RECEIVED');
    await consumer.consume(observed.receipt.id); await assertEffect(p.playerId, observed.receipt.id, 1600n);
  });
  it('returns 500 on a transient payment failure, then replays the same signed delivery', async () => {
    const p = await player(), id = randomUUID(), value = body(p.twitchUserId), timestamp = new Date().toISOString();
    const spy = vi.spyOn(favor, 'grant').mockRejectedValueOnce(new Error('private resub outage'));
    try {
      expect((await send(value, id, timestamp)).statusCode).toBe(500);
      expect((await db.twitchEventReceipt.findUniqueOrThrow({ where: { externalEventId: id } })).state).toBe('RECEIVED');
      expect((await send(value, id, timestamp)).statusCode).toBe(204);
      await assertEffect(p.playerId, (await db.twitchEventReceipt.findUniqueOrThrow({ where: { externalEventId: id } })).id, 1600n);
    } finally { spy.mockRestore(); }
  });
  it('does not infer a silent renewal from an expired Favor calendar', async () => {
    const p = await player();
    await db.playerFavorState.create({ data: { playerId: p.playerId, activeFromDate: new Date('2026-08-01'), activeUntilDate: new Date('2026-08-30') } });
    const before = await snapshot(p.playerId); expect(await favor.getCurrent(p.playerId)).toMatchObject({ active: false, daysRemaining: 0 });
    expect(await snapshot(p.playerId)).toEqual(before);
  });
  it('keeps all resub outcomes outside Chat-only retention', async () => {
    const pending = (await observer.observeTwitchEvent(event())).receipt, processed = (await observer.observeTwitchEvent(event())).receipt;
    await consumer.consume(processed.id);
    await db.twitchEventReceipt.updateMany({ where: { id: { in: [pending.id, processed.id] } }, data: { receivedAt: new Date(now.getTime() - 25 * 3600_000) } });
    const chat = await db.twitchEventReceipt.create({ data: { externalEventId: randomUUID(), eventType: 'channel.chat.message', receivedAt: new Date(now.getTime() - 25 * 3600_000) } });
    new TwitchReceiptRetention(db, () => now.getTime()).maybeCleanup();
    await vi.waitFor(async () => expect(await db.twitchEventReceipt.findUnique({ where: { id: chat.id } })).toBeNull(), { timeout: 5000 });
    expect(await db.twitchEventReceipt.count({ where: { id: { in: [pending.id, processed.id] } } })).toBe(2);
  });
});

describe('strict resub transport and dedicated Observer proof', () => {
  it.each([
    { tier: '4000' }, { user_id: null }, { user_id: 'bad-id' }, { broadcaster_user_id: '13' },
    { cumulative_months: -1 }, { cumulative_months: 1.5 }, { cumulative_months: Number.MAX_SAFE_INTEGER + 1 },
    { duration_months: -1 }, { duration_months: '6' }, { streak_months: -1 }, { streak_months: 1.5 },
    { message: null }, { message: { text: 42, emotes: [] } }, { message: { text: 'x' } },
    { message: { text: 'x', emotes: [{ begin: -1, end: 0, id: 'emote' }] } },
    { message: { text: 'x', emotes: [{ begin: 2, end: 1, id: 'emote' }] } },
    { unexpected: true },
  ])('rejects malformed signed resub %j without a receipt', async changed => {
    const value = body(String(++sequence)), id = randomUUID();
    expect((await send({ ...value, event: { ...value.event, ...changed } }, id)).statusCode).toBe(400);
    expect(await db.twitchEventReceipt.count({ where: { externalEventId: id } })).toBe(0);
  });
  it('accepts empty text/emotes and null streak without persisting them', async () => {
    const value = body(String(++sequence));
    expect((await send({ ...value, event: { ...value.event, message: { text: '', emotes: [] }, streak_months: null } })).statusCode).toBe(204);
  });
  it('preserves version, HMAC, freshness, strict condition, challenge and revocation gates', async () => {
    const value = body(String(++sequence));
    expect((await send({ ...value, subscription: { ...value.subscription, version: '2' } })).statusCode).toBe(422);
    expect((await send(value, randomUUID(), new Date().toISOString(), 'wrong')).statusCode).toBe(403);
    expect((await send(value, randomUUID(), '2000-01-01T00:00:00Z')).statusCode).toBe(400);
    expect((await send({ ...value, subscription: { ...value.subscription, condition: { broadcaster_user_id: '12', user_id: '12' } } })).statusCode).toBe(400);
    const challenge = await send({ subscription: value.subscription, challenge: 'resub-challenge' }, randomUUID(), new Date().toISOString(), secret, 'webhook_callback_verification');
    expect(challenge.statusCode).toBe(200); expect(challenge.body).toBe('resub-challenge');
    expect((await send({ subscription: value.subscription }, randomUUID(), new Date().toISOString(), secret, 'revocation')).statusCode).toBe(204);
  });
  it.each([{ tier: '3000' }, { message: { text: 'changed private text', emotes: [] } }, { duration_months: 0 }])('conflicts on changed payload under the same Message ID %j', async changed => {
    const p = await player(), value = body(p.twitchUserId), id = randomUUID(), timestamp = new Date().toISOString();
    expect((await send(value, id, timestamp)).statusCode).toBe(204);
    expect((await send({ ...value, event: { ...value.event, ...changed } }, id, timestamp)).statusCode).toBe(409);
    await assertEffect(p.playerId, (await db.twitchEventReceipt.findUniqueOrThrow({ where: { externalEventId: id } })).id, 1600n);
  });
  it('restricts minimal resub proofs to resub receipts, requires subscriber ID and conflicts on altered proof', async () => {
    const input = event(); await observer.observeTwitchEvent(input);
    for (const eventType of ['channel.subscribe', 'channel.chat.message', 'channel.subscription.gift'])
      await expect(observer.observeTwitchEvent({ ...input, eventType })).rejects.toThrow('Invalid resub proof');
    await expect(observer.observeTwitchEvent({ ...input, twitchUserId: null })).rejects.toThrow('Invalid resubscriber User ID');
    await expect(observer.observeTwitchEvent({ ...input, subscriptionMessageProof: undefined })).rejects.toThrow('Missing resub proof');
    await expect(observer.observeTwitchEvent({ ...input, subscriptionMessageProof: { ...input.subscriptionMessageProof!, tier: '3000' } })).rejects.toBeInstanceOf(TwitchObservationConflict);
  });
});
