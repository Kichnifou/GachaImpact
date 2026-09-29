import 'dotenv/config';
import { createHmac, randomUUID } from 'node:crypto';
import pg from 'pg';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Prisma, type PrismaClient } from '../generated/prisma/client.js';
import { buildApp } from '../src/app.js';
import { FavorService } from '../src/application/favor/favor-service.js';
import { TwitchEventObserver, TwitchObservationConflict, type TwitchObservedEvent } from '../src/application/twitch/twitch-event-observer.js';
import { TwitchFavorResubConsumer } from '../src/application/twitch/twitch-favor-resub-consumer.js';
import { TwitchFavorGiftConsumer } from '../src/application/twitch/twitch-favor-gift-consumer.js';
import { TwitchFavorSubscriptionConsumer } from '../src/application/twitch/twitch-favor-subscription-consumer.js';
import { PrismaEconomyService } from '../src/infrastructure/database/prisma-economy-service.js';
import { isolatedBatchDatabase } from './isolated-batch-database.js';

const fixture = isolatedBatchDatabase(), db = fixture.database;
const now = new Date('2026-09-29T12:00:00Z'), clock = { now: () => now };
const observer = new TwitchEventObserver(db), favor = new FavorService(db, clock);
const consumer = new TwitchFavorGiftConsumer(db, clock, favor);
const beneficiaries = new TwitchFavorSubscriptionConsumer(db, clock, favor);
const secret = 'private-gift-test-secret';
let app: FastifyInstance, sequence = 300000;
beforeAll(async () => {
  await fixture.setup({ seedPublicCatalog: true });
  app = await buildApp({ host: '127.0.0.1', port: 3001, supabase: {}, twitchEventSub: { enabled: true, secret } }, {
    authIdentityVerifier: { verify: async () => ({ subject: 'private-test' }) }, getOrProvisionCurrentPlayer: {} as never,
    twitchEventObserver: observer, twitchFavorSubscriptions: beneficiaries, twitchFavorGifts: consumer, twitchFavorResubs: new TwitchFavorResubConsumer(db, clock),
  });
}, 60_000);
afterAll(async () => {
  await app?.close(); await fixture.cleanup();
  const inspector = new pg.Client({ connectionString: process.env['DATABASE_URL'] });
  try {
    await inspector.connect();
    expect((await inspector.query('SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname = $1', [fixture.schema])).rows).toHaveLength(0);
    console.info('Gift private schema cleanup verified:', fixture.schema);
  } finally { await inspector.end(); }
}, 60_000);

async function player(elementKey: 'pyro' | null = 'pyro', status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED' = 'ACTIVE') {
  const row = await db.player.create({ data: { displayName: `Private gift ${randomUUID().slice(0, 8)}`, elementKey, status,
    economyStats: { create: { totalPrimosEarned: 123n, totalPrimosSpent: 17n, totalMorasEarned: 456n } },
    resourceBalances: { create: { resourceKey: 'primogems', amount: 42n } } } });
  const twitchUserId = String(++sequence);
  await db.twitchIdentity.create({ data: { playerId: row.id, twitchUserId, login: 'gifter' } });
  return { playerId: row.id, twitchUserId };
}
const gift = (twitchUserId: string | null, tier: '1000' | '2000' | '3000' = '1000', total = 1): TwitchObservedEvent => ({
  externalEventId: randomUUID(), eventType: 'channel.subscription.gift', twitchUserId,
  login: twitchUserId ? 'gifter' : null, displayName: twitchUserId ? 'Gifter' : null,
  sourceTimestamp: now.toISOString(), transportPayloadHash: 'b'.repeat(64),
  subscriptionGiftProof: { broadcasterTwitchId: '12', tier, total, isAnonymous: twitchUserId == null },
});
const recipient = (twitchUserId: string): TwitchObservedEvent => ({ externalEventId: randomUUID(), eventType: 'channel.subscribe',
  twitchUserId, subscriptionProof: { broadcasterTwitchId: '12', tier: '2000', isGift: true } });
async function consume(input: TwitchObservedEvent) {
  return consumer.consume((await observer.observeTwitchEvent(input)).receipt.id);
}
async function assertPayment(playerId: string, amount: bigint, receiptId: string) {
  const operations = await db.businessOperation.findMany({ where: { playerId } });
  expect(operations).toHaveLength(1);
  expect(operations[0]).toMatchObject({ operationType: 'favor.gifter-bonus', sourceChannel: 'TWITCH', status: 'COMPLETED' });
  expect(await db.resourceMovement.findMany({ where: { playerId } })).toMatchObject([
    { delta: amount, resourceKey: 'primogems', causeKey: 'favor.gifter-bonus', operationId: operations[0]!.id },
  ]);
  expect(await db.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId, resourceKey: 'primogems' } } })).toMatchObject({ amount: 42n + amount });
  expect(await db.playerEconomyStats.findUniqueOrThrow({ where: { playerId } })).toMatchObject({
    totalPrimosEarned: 123n + amount, totalPrimosSpent: 17n, totalMorasEarned: 456n,
  });
  expect(await db.twitchEventReceipt.findUniqueOrThrow({ where: { id: receiptId } })).toMatchObject({ state: 'PROCESSED', processedAt: now,
    externalReference: `favor:gifter:${operations[0]!.id}`, errorMessage: null });
  expect(await Promise.all([db.favorGrant.count({ where: { playerId } }), db.playerFavorState.count({ where: { playerId } }),
    db.favorDailyClaim.count({ where: { playerId } }), db.playerPermanentMissionState.count({ where: { playerId } }),
    db.notification.count({ where: { playerId } })])).toEqual([0, 0, 0, 0, 0]);
}
async function noEffect(playerId: string) {
  expect(await db.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId, resourceKey: 'primogems' } } })).toMatchObject({ amount: 42n });
  expect(await db.playerEconomyStats.findUniqueOrThrow({ where: { playerId } })).toMatchObject({ totalPrimosEarned: 123n });
  expect(await Promise.all([db.businessOperation.count({ where: { playerId } }), db.resourceMovement.count({ where: { playerId } }),
    db.favorGrant.count({ where: { playerId } }), db.playerFavorState.count({ where: { playerId } })])).toEqual([0, 0, 0, 0]);
}

describe('gifter economic boundary in a private schema', () => {
  it.each([
    ['1000', 1, 1600n], ['2000', 1, 9600n], ['3000', 1, 20800n],
    ['1000', 10, 16000n], ['2000', 10, 96000n], ['3000', 20, 416000n],
    ['3000', 1_000_000_000_001, 20_800_000_000_020_800n],
  ] as const)('pays tier %s × %s exactly using BigInt, without days or mission catch-up', async (tier, total, amount) => {
    const p = await player(), input = gift(p.twitchUserId, tier, total), receipt = await consume(input);
    await assertPayment(p.playerId, amount, receipt.id);
    expect((await db.businessOperation.findFirstOrThrow({ where: { playerId: p.playerId } })).idempotencyKey).toBe(`favor:gifter:${input.externalEventId}`);
    expect(await consume(input)).toEqual(receipt);
    await assertPayment(p.playerId, amount, receipt.id);
  });
  it.each(['SUSPENDED', 'ARCHIVED'] as const)('ignores a %s gifter permanently', async status => {
    const p = await player('pyro', status), input = gift(p.twitchUserId, '2000', 10);
    const receipt = await consume(input);
    expect(receipt).toMatchObject({ state: 'PROCESSED', processedAt: now, externalReference: 'favor:gifter:ignored:player-inactive' });
    await db.player.update({ where: { id: p.playerId }, data: { status: 'ACTIVE' } });
    expect(await consume(input)).toEqual(receipt); await noEffect(p.playerId);
  });
  it('ignores missing element permanently, without deferred entitlement', async () => {
    const p = await player(null), input = gift(p.twitchUserId);
    const receipt = await consume(input);
    expect(receipt.externalReference).toBe('favor:gifter:ignored:element-missing');
    await db.player.update({ where: { id: p.playerId }, data: { elementKey: 'pyro' } });
    expect(await consume(input)).toEqual(receipt); await noEffect(p.playerId);
  });
  it.each([null, '999999999'] as const)('ignores anonymous/unresolved %s without provisioning', async userId => {
    const counts = await Promise.all([db.player.count(), db.twitchIdentity.count(), db.businessOperation.count()]);
    const input = gift(userId, '3000', 20), receipt = await consume(input);
    expect(receipt).toMatchObject({ state: 'PROCESSED', processedAt: now,
      externalReference: userId == null ? 'favor:gifter:ignored:anonymous' : 'favor:gifter:ignored:identity-unresolved' });
    expect(await Promise.all([db.player.count(), db.twitchIdentity.count(), db.businessOperation.count()])).toEqual(counts);
    if (userId) {
      const p = await player();
      await db.twitchIdentity.update({ where: { playerId: p.playerId }, data: { twitchUserId: userId } });
      expect(await consume(input)).toEqual(receipt); await noEffect(p.playerId);
    }
  });
  it('recognizes a committed operation before identity or eligibility changes', async () => {
    const p = await player(), input = gift(p.twitchUserId, '2000', 10), observed = await observer.observeTwitchEvent(input);
    await favor.creditGifterBonus({ playerId: p.playerId, tier: 2, total: 10, idempotencyKey: input.externalEventId, twitchEventReceiptId: observed.receipt.id });
    await db.twitchIdentity.delete({ where: { playerId: p.playerId } });
    await db.player.update({ where: { id: p.playerId }, data: { status: 'SUSPENDED', elementKey: null } });
    await consumer.consume(observed.receipt.id); await assertPayment(p.playerId, 96000n, observed.receipt.id);
  });
  it('serializes concurrent deliveries to one credit', async () => {
    const p = await player(), input = gift(p.twitchUserId, '3000', 20);
    const observed = await Promise.all(Array.from({ length: 3 }, () => observer.observeTwitchEvent(input)));
    expect(new Set(observed.map(item => item.receipt.id)).size).toBe(1);
    await Promise.all(observed.map(item => consumer.consume(item.receipt.id)));
    await assertPayment(p.playerId, 416000n, observed[0]!.receipt.id);
  });
  it('does not lose concurrent distinct gifts for the same Player', async () => {
    const p = await player();
    await Promise.all([consume(gift(p.twitchUserId, '2000', 10)), consume(gift(p.twitchUserId, '3000', 20))]);
    expect((await db.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId: p.playerId, resourceKey: 'primogems' } } })).amount).toBe(512042n);
    expect(await db.businessOperation.count({ where: { playerId: p.playerId } })).toBe(2);
  });
  it('rolls back credit, stats and operation when finalizing the receipt fails, then retries', async () => {
    const p = await player(), observed = await observer.observeTwitchEvent(gift(p.twitchUserId, '2000', 10));
    const boundary = { $transaction: (run: (tx: Prisma.TransactionClient) => Promise<unknown>, options: object) =>
      db.$transaction(tx => run({ ...tx, twitchEventReceipt: { ...tx.twitchEventReceipt,
        update: async () => { throw new Error('private receipt finalization failure'); },
      } } as unknown as Prisma.TransactionClient), options) } as unknown as PrismaClient;
    await expect(new TwitchFavorGiftConsumer(boundary, clock, favor).consume(observed.receipt.id)).rejects.toThrow('private receipt finalization failure');
    expect((await db.twitchEventReceipt.findUniqueOrThrow({ where: { id: observed.receipt.id } })).state).toBe('RECEIVED');
    await noEffect(p.playerId);
    await consumer.consume(observed.receipt.id); await assertPayment(p.playerId, 96000n, observed.receipt.id);
  });
  it('rolls back a failure after the economy credit and leaves the receipt retryable', async () => {
    const p = await player(), observed = await observer.observeTwitchEvent(gift(p.twitchUserId));
    const economy = new PrismaEconomyService(() => now), realCredit = economy.credit.bind(economy);
    vi.spyOn(economy, 'credit').mockImplementation(async (tx, input) => { await realCredit(tx, input); throw new Error('private post-credit failure'); });
    await expect(new TwitchFavorGiftConsumer(db, clock, new FavorService(db, clock, economy)).consume(observed.receipt.id)).rejects.toThrow('private post-credit failure');
    await noEffect(p.playerId);
    expect((await db.twitchEventReceipt.findUniqueOrThrow({ where: { id: observed.receipt.id } })).state).toBe('RECEIVED');
    await consumer.consume(observed.receipt.id); await assertPayment(p.playerId, 1600n, observed.receipt.id);
  });
  it('rejects reuse of a payment key for a different tier, total, player or receipt', async () => {
    const p = await player(), other = await player(), input = { playerId: p.playerId, tier: 2 as const, total: 10, idempotencyKey: randomUUID() };
    await favor.creditGifterBonus(input);
    for (const changed of [{ tier: 3 as const }, { total: 11 }, { playerId: other.playerId }, { twitchEventReceiptId: randomUUID() }])
      await expect(favor.creditGifterBonus({ ...input, ...changed })).rejects.toMatchObject({ code: 'FAVOR_IDEMPOTENCY_CONFLICT' });
    expect(await db.businessOperation.count({ where: { playerId: p.playerId } })).toBe(1);
  });
  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity])('rejects unsafe primitive quantity %s before writing', async total => {
    const p = await player();
    await expect(favor.creditGifterBonus({ playerId: p.playerId, tier: 1, total, idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'FAVOR_PROOF_INVALID' });
    await noEffect(p.playerId);
  });
});

describe('independent gifter and beneficiary economics', () => {
  it('pays total 10 Tier 2 even with only seven eligible beneficiaries', async () => {
    const gifter = await player();
    const paid = await consume(gift(gifter.twitchUserId, '2000', 10));
    for (let index = 0; index < 10; index++) {
      const beneficiary = index < 7 ? await player() : null;
      const observed = await observer.observeTwitchEvent(recipient(beneficiary?.twitchUserId ?? String(++sequence)));
      await beneficiaries.consume(observed.receipt.id);
      if (beneficiary) expect(await db.favorGrant.count({ where: { playerId: beneficiary.playerId } })).toBe(1);
    }
    await assertPayment(gifter.playerId, 96000n, paid.id);
  });
  it('pays an eligible beneficiary independently of an anonymous or inactive gifter', async () => {
    for (const userId of [null, (await player('pyro', 'SUSPENDED')).twitchUserId]) {
      await consume(gift(userId, '2000', 10));
      const p = await player(), observed = await observer.observeTwitchEvent(recipient(p.twitchUserId));
      await beneficiaries.consume(observed.receipt.id);
      expect(await db.favorGrant.findFirstOrThrow({ where: { playerId: p.playerId } })).toMatchObject({ immediatePrimogems: 9600n, addedDays: 30 });
      expect(await db.businessOperation.count({ where: { playerId: p.playerId, operationType: 'favor.gifter-bonus' } })).toBe(0);
    }
  });
  it('pays a gifter fully before any beneficiary delivery, including an ineligible beneficiary', async () => {
    const p = await player(), paid = await consume(gift(p.twitchUserId, '3000', 20));
    await assertPayment(p.playerId, 416000n, paid.id);
    const observed = await observer.observeTwitchEvent(recipient(String(++sequence)));
    expect((await beneficiaries.consume(observed.receipt.id)).externalReference).toBe('favor:ignored:identity-unresolved');
    await assertPayment(p.playerId, 416000n, paid.id);
  });
});

const giftBody = (userId: string | null = '999999998') => ({
  subscription: { type: 'channel.subscription.gift', version: '1', condition: { broadcaster_user_id: '12' } },
  event: { user_id: userId, user_login: userId ? 'gifter' : null, user_name: userId ? 'Gifter' : null,
    broadcaster_user_id: '12', broadcaster_user_login: 'broadcaster', broadcaster_user_name: 'Broadcaster',
    total: 10, tier: '2000', is_anonymous: userId == null, cumulative_total: 999 },
});
function send(body: unknown, id = randomUUID(), timestamp = new Date().toISOString(), signatureSecret = secret) {
  const payload = JSON.stringify(body);
  return app.inject({ method: 'POST', url: '/api/v1/twitch/eventsub', payload, headers: {
    'content-type': 'application/json', 'twitch-eventsub-message-id': id, 'twitch-eventsub-message-timestamp': timestamp,
    'twitch-eventsub-message-type': 'notification',
    'twitch-eventsub-message-signature': `sha256=${createHmac('sha256', signatureSecret).update(id).update(timestamp).update(payload).digest('hex')}`,
  } });
}
describe('signed gift webhook and observation proof', () => {
  it.each([false, true])('accepts signed anonymous=%s and persists only the minimal proof', async anonymous => {
    const p = anonymous ? null : await player(), body = giftBody(p?.twitchUserId ?? null), id = randomUUID();
    const timestamp = new Date().toISOString();
    expect((await send(body, id, timestamp)).statusCode).toBe(204);
    expect((await send(body, id, timestamp)).statusCode).toBe(204);
    const receipt = await db.twitchEventReceipt.findUniqueOrThrow({ where: { externalEventId: id } });
    expect(receipt.payloadMinimal).toMatchObject({ subscriptionGiftProof: { broadcasterTwitchId: '12', tier: '2000', total: 10, isAnonymous: anonymous } });
    expect(JSON.stringify(receipt.payloadMinimal)).not.toContain('cumulative');
    if (p) await assertPayment(p.playerId, 96000n, receipt.id);
    else expect(receipt).toMatchObject({ twitchUserId: null, state: 'PROCESSED', externalReference: 'favor:gifter:ignored:anonymous' });
  });
  it('accepts absent anonymous identity fields and null cumulative_total', async () => {
    const body = giftBody(null);
    const { user_id: _id, user_login: _login, user_name: _name, ...event } = body.event;
    expect((await send({ ...body, event: { ...event, cumulative_total: null } })).statusCode).toBe(204);
  });
  it.each([
    { total: 0 }, { total: -1 }, { total: 1.5 }, { total: Number.MAX_SAFE_INTEGER + 1 }, { total: '10' },
    { tier: '4000' }, { tier: 2000 }, { broadcaster_user_id: '13' }, { is_anonymous: true },
    { user_id: null }, { user_id: 'invalid' }, { is_anonymous: 'false' }, { unexpected: 'field' },
  ])('rejects malformed or incoherent signed gift %j before observation', async changed => {
    const body = giftBody(), id = randomUUID();
    expect((await send({ ...body, event: { ...body.event, ...changed } }, id)).statusCode).toBe(400);
    expect(await db.twitchEventReceipt.count({ where: { externalEventId: id } })).toBe(0);
  });
  it('rejects anonymous login/name even without a user ID', async () => {
    for (const changed of [{ user_login: 'hidden' }, { user_name: 'Hidden' }]) {
      const body = giftBody(null);
      expect((await send({ ...body, event: { ...body.event, ...changed } })).statusCode).toBe(400);
    }
  });
  it('rejects extra condition, unsupported version, bad HMAC and stale delivery', async () => {
    const body = giftBody();
    expect((await send({ ...body, subscription: { ...body.subscription, condition: { broadcaster_user_id: '12', user_id: '12' } } })).statusCode).toBe(400);
    expect((await send({ ...body, subscription: { ...body.subscription, version: '2' } })).statusCode).toBe(422);
    expect((await send(body, randomUUID(), new Date().toISOString(), 'wrong-secret')).statusCode).toBe(403);
    expect((await send(body, randomUUID(), '2000-01-01T00:00:00Z')).statusCode).toBe(400);
  });
  it.each([{ total: 11 }, { tier: '3000' }, { broadcaster_user_id: '13' }])('conflicts on same Message ID with changed proof %j', async changed => {
    const p = await player(), body = giftBody(p.twitchUserId), id = randomUUID(), timestamp = new Date().toISOString();
    expect((await send(body, id, timestamp)).statusCode).toBe(204);
    const next = { ...body, event: { ...body.event, ...changed } };
    if ('broadcaster_user_id' in changed) next.subscription.condition.broadcaster_user_id = changed.broadcaster_user_id!;
    expect((await send(next, id, timestamp)).statusCode).toBe(409);
    await assertPayment(p.playerId, 96000n, (await db.twitchEventReceipt.findUniqueOrThrow({ where: { externalEventId: id } })).id);
  });
  it('keeps a failed signed delivery RECEIVED and replays it through the same authenticated path', async () => {
    const p = await player(), body = giftBody(p.twitchUserId), id = randomUUID(), timestamp = new Date().toISOString();
    const failure = vi.spyOn(favor, 'creditGifterBonus').mockRejectedValueOnce(new Error('private transient payment failure'));
    try {
      expect((await send(body, id, timestamp)).statusCode).toBe(500); await noEffect(p.playerId);
      expect((await db.twitchEventReceipt.findUniqueOrThrow({ where: { externalEventId: id } })).state).toBe('RECEIVED');
      expect((await send(body, id, timestamp)).statusCode).toBe(204);
      await assertPayment(p.playerId, 96000n, (await db.twitchEventReceipt.findUniqueOrThrow({ where: { externalEventId: id } })).id);
    } finally { failure.mockRestore(); }
  });
  it('limits absent Observer IDs to anonymous gift proofs and preserves changed-proof conflicts', async () => {
    for (const eventType of ['channel.chat.message', 'channel.subscribe', 'other'])
      await expect(observer.observeTwitchEvent({ externalEventId: randomUUID(), eventType, twitchUserId: null })).rejects.toThrow('Missing Twitch User ID');
    const input = gift(null);
    await observer.observeTwitchEvent(input);
    await expect(observer.observeTwitchEvent({ ...input, subscriptionGiftProof: { ...input.subscriptionGiftProof!, total: 2 } })).rejects.toBeInstanceOf(TwitchObservationConflict);
    await expect(observer.observeTwitchEvent({ ...input, subscriptionGiftProof: undefined })).rejects.toThrow('Missing gift proof');
    await expect(observer.observeTwitchEvent({ ...input, subscriptionGiftProof: { ...input.subscriptionGiftProof!, isAnonymous: false } })).rejects.toThrow('Missing Twitch User ID');
    await expect(observer.observeTwitchEvent({ ...input, twitchUserId: '12' })).rejects.toThrow('Anonymous gift has an identity');
  });
});
