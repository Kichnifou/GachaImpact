import 'dotenv/config';
import { createHmac, randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Prisma, type PrismaClient } from '../generated/prisma/client.js';
import { buildApp } from '../src/app.js';
import { FavorService } from '../src/application/favor/favor-service.js';
import { TwitchEventObserver, type TwitchObservedEvent } from '../src/application/twitch/twitch-event-observer.js';
import { subscriptionFavorKey, TwitchFavorSubscriptionConsumer } from '../src/application/twitch/twitch-favor-subscription-consumer.js';
import { TwitchReceiptRetention } from '../src/application/twitch/twitch-receipt-retention.js';
import { subscriptionFavorTier } from '../src/application/twitch/twitch-subscription-proof.js';
import { isolatedBatchDatabase } from './isolated-batch-database.js';

const fixture = isolatedBatchDatabase(), db = fixture.database;
const now = new Date('2026-09-29T12:00:00Z'), clock = { now: () => now };
const observer = new TwitchEventObserver(db), favor = new FavorService(db, clock);
const consumer = new TwitchFavorSubscriptionConsumer(db, clock, favor);
beforeAll(() => fixture.setup({ seedPublicCatalog: true }), 60_000);
afterAll(async () => {
  await fixture.cleanup();
  const inspector = new pg.Client({ connectionString: process.env['DATABASE_URL'] });
  try {
    await inspector.connect();
    expect((await inspector.query('SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname = $1', [fixture.schema])).rows).toHaveLength(0);
    console.info('Subscription private schema cleanup verified:', fixture.schema);
  } finally { await inspector.end(); }
}, 60_000);
let sequence = 1000;
const event = (twitchUserId = String(++sequence), tier: '1000' | '2000' | '3000' = '1000', isGift = false): TwitchObservedEvent => ({
  externalEventId: randomUUID(), eventType: 'channel.subscribe', twitchUserId, login: 'recipient', displayName: 'Recipient',
  sourceTimestamp: now.toISOString(), transportPayloadHash: 'a'.repeat(64),
  subscriptionProof: { broadcasterTwitchId: '12', tier, isGift },
});
async function beneficiary(elementKey: 'pyro' | null = 'pyro', status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED' = 'ACTIVE') {
  const player = await db.player.create({ data: { displayName: `Private subscription ${randomUUID().slice(0, 8)}`, elementKey, status,
    economyStats: { create: {} },
    resourceBalances: { create: { resourceKey: 'primogems', amount: 42n } } } });
  const twitchUserId = String(++sequence);
  await db.twitchIdentity.create({ data: { playerId: player.id, twitchUserId, login: 'recipient' } });
  return { playerId: player.id, twitchUserId };
}
async function counts() {
  return Promise.all([db.player.count(), db.twitchIdentity.count(), db.favorGrant.count(), db.businessOperation.count(),
    db.resourceMovement.count(), db.favorDailyClaim.count(), db.notification.count(), db.playerProgression.count()]);
}
async function assertEffect(playerId: string, receiptId: string, amount: bigint) {
  const grants = await db.favorGrant.findMany({ where: { playerId } });
  expect(grants).toHaveLength(1);
  expect(grants[0]).toMatchObject({ twitchEventReceiptId: receiptId, requestedDays: 30, addedDays: 30, blockedDays: 0, immediatePrimogems: amount });
  expect(await db.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId, resourceKey: 'primogems' } } })).toMatchObject({ amount: 42n + amount });
  expect(await db.playerEconomyStats.findUniqueOrThrow({ where: { playerId } })).toMatchObject({ totalPrimosEarned: amount });
  expect(await db.resourceMovement.findMany({ where: { playerId } })).toHaveLength(1);
  const operations = await db.businessOperation.findMany({ where: { playerId } });
  expect(operations).toHaveLength(1);
  expect(operations[0]).toMatchObject({ operationType: 'favor.grant', sourceChannel: 'TWITCH', status: 'COMPLETED' });
  expect(await db.twitchEventReceipt.findUniqueOrThrow({ where: { id: receiptId } })).toMatchObject({ state: 'PROCESSED',
    processedAt: now, externalReference: `favor:grant:${grants[0]!.id}`, errorMessage: null });
  expect(await favor.getCurrent(playerId)).toMatchObject({ daysRemaining: 30, active: false });
  expect(await db.playerFavorState.findUniqueOrThrow({ where: { playerId } })).toMatchObject({
    activeFromDate: new Date('2026-09-30T00:00:00Z'), activeUntilDate: new Date('2026-10-29T00:00:00Z') });
}
function failFinalization() {
  const update = vi.fn().mockRejectedValueOnce(new Error('private finalization failure'));
  const boundary = { $transaction: (run: (tx: Prisma.TransactionClient) => Promise<unknown>, options: object) =>
    db.$transaction(tx => run({ ...tx, twitchEventReceipt: { ...tx.twitchEventReceipt,
      update: (...args: Parameters<typeof tx.twitchEventReceipt.update>) => update(...args),
    } } as unknown as Prisma.TransactionClient), options) } as unknown as PrismaClient;
  return new TwitchFavorSubscriptionConsumer(boundary, clock, favor);
}

describe('private subscription consumption and durable terminal decisions', () => {
  it.each(['1000', '2000', '3000'] as const)('grants direct %s via the existing core, then replays without effects', async tier => {
    const player = await beneficiary(), input = event(player.twitchUserId, tier);
    const observed = await observer.observeTwitchEvent(input);
    const grantSpy = vi.spyOn(favor, 'grant');
    try {
      const first = await consumer.consume(observed.receipt.id);
      expect(grantSpy).toHaveBeenCalledWith({ playerId: player.playerId, tier: subscriptionFavorTier(tier),
        twitchEventReceiptId: observed.receipt.id, idempotencyKey: subscriptionFavorKey(input.externalEventId) }, expect.anything());
      const before = await counts();
      const replay = await observer.observeTwitchEvent(input);
      expect(replay.duplicate).toBe(true);
      expect(await consumer.consume(replay.receipt.id)).toEqual(first);
      expect(await counts()).toEqual(before); expect(grantSpy).toHaveBeenCalledTimes(1);
      await assertEffect(player.playerId, observed.receipt.id, ({ '1000': 1600n, '2000': 4800n, '3000': 9600n })[tier]);
    } finally { grantSpy.mockRestore(); }
  });
  it('pays a gift recipient normally and produces no gifter bonus or unrelated effect', async () => {
    const recipient = await beneficiary(), gifter = await beneficiary();
    const before = await counts(), observed = await observer.observeTwitchEvent(event(recipient.twitchUserId, '2000', true));
    await consumer.consume(observed.receipt.id);
    await assertEffect(recipient.playerId, observed.receipt.id, 4800n);
    expect(await db.favorGrant.count({ where: { playerId: gifter.playerId } })).toBe(0);
    expect(await db.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId: gifter.playerId, resourceKey: 'primogems' } } })).toMatchObject({ amount: 42n });
    expect(await counts()).toEqual(before.map((value, index) => value + ([2, 3, 4].includes(index) ? 1 : 0)));
    expect(observed.receipt.payloadMinimal).toMatchObject({ subscriptionProof: { isGift: true, tier: '2000', broadcasterTwitchId: '12' } });
    expect(JSON.stringify(observed.receipt.payloadMinimal)).not.toContain('gifter');
  });
  it('ignores an unknown identity durably, without provisioning; later account/link does not resurrect it', async () => {
    const input = event(), before = await counts(), observed = await observer.observeTwitchEvent(input);
    const terminal = await consumer.consume(observed.receipt.id);
    expect(terminal).toMatchObject({ state: 'PROCESSED', processedAt: now, externalReference: 'favor:ignored:identity-unresolved', errorMessage: null });
    expect(await counts()).toEqual(before);
    const player = await db.player.create({ data: { displayName: 'Private later account', elementKey: 'pyro' } });
    await db.twitchIdentity.create({ data: { playerId: player.id, twitchUserId: input.twitchUserId, login: 'recipient' } });
    const later = await counts();
    await observer.observeTwitchEvent(input);
    expect(await consumer.consume(observed.receipt.id)).toEqual(terminal);
    expect(await counts()).toEqual(later);
  });
  it.each(['element', 'SUSPENDED', 'ARCHIVED'] as const)('ignores %s and remains terminal after activation', async reason => {
    const player = await beneficiary(reason === 'element' ? null : 'pyro', reason === 'element' ? 'ACTIVE' : reason);
    const input = event(player.twitchUserId), before = await counts(), observed = await observer.observeTwitchEvent(input);
    const terminal = await consumer.consume(observed.receipt.id);
    expect(terminal).toMatchObject({ state: 'PROCESSED', processedAt: now, errorMessage: null,
      externalReference: `favor:ignored:${reason === 'element' ? 'element-missing' : 'player-inactive'}` });
    await db.player.update({ where: { id: player.playerId }, data: { status: 'ACTIVE', elementKey: 'pyro' } });
    await observer.observeTwitchEvent(input);
    expect(await consumer.consume(observed.receipt.id)).toEqual(terminal); expect(await counts()).toEqual(before);
  });
  it('serializes concurrent observation/consumption into one grant and credit', async () => {
    const player = await beneficiary(), input = event(player.twitchUserId);
    const deliver = async () => consumer.consume((await observer.observeTwitchEvent(input)).receipt.id);
    const receipts = await Promise.all(Array.from({ length: 3 }, deliver));
    expect(new Set(receipts.map(receipt => receipt.id)).size).toBe(1);
    await assertEffect(player.playerId, receipts[0]!.id, 1600n);
  });
  it('serializes concurrent ignored deliveries into the same terminal reference', async () => {
    const input = event(), before = await counts();
    const deliver = async () => consumer.consume((await observer.observeTwitchEvent(input)).receipt.id);
    const receipts = await Promise.all(Array.from({ length: 3 }, deliver));
    expect(receipts.every(receipt => receipt.id === receipts[0]!.id && receipt.state === 'PROCESSED'
      && receipt.externalReference === 'favor:ignored:identity-unresolved')).toBe(true);
    expect(await counts()).toEqual(before);
  });
  it('rejects a changed proof or transport envelope under the same Message ID', async () => {
    const player = await beneficiary(), input = event(player.twitchUserId);
    const receipt = (await observer.observeTwitchEvent(input)).receipt;
    await consumer.consume(receipt.id);
    await expect(observer.observeTwitchEvent({ ...input, subscriptionProof: { ...input.subscriptionProof!, isGift: true } })).rejects.toMatchObject({ code: 'TWITCH_EVENT_CONFLICT' });
    await expect(observer.observeTwitchEvent({ ...input, transportPayloadHash: 'b'.repeat(64) })).rejects.toMatchObject({ code: 'TWITCH_EVENT_CONFLICT' });
    await assertEffect(player.playerId, receipt.id, 1600n);
  });
  it('recovers a committed grant after failed receipt finalization even after unlink, without recrediting', async () => {
    const player = await beneficiary(), input = event(player.twitchUserId), receipt = (await observer.observeTwitchEvent(input)).receipt;
    await favor.grant({ playerId: player.playerId, tier: 1, idempotencyKey: subscriptionFavorKey(input.externalEventId), twitchEventReceiptId: receipt.id });
    const before = await counts();
    await expect(failFinalization().consume(receipt.id)).rejects.toThrow('private finalization failure');
    expect(await db.twitchEventReceipt.findUniqueOrThrow({ where: { id: receipt.id } })).toMatchObject({ state: 'RECEIVED', processedAt: null });
    expect(await counts()).toEqual(before);
    await db.twitchIdentity.delete({ where: { playerId: player.playerId } });
    await consumer.consume(receipt.id);
    await assertEffect(player.playerId, receipt.id, 1600n);
  });
  it('rolls back grant and terminal decision when finalization fails, then retries normally', async () => {
    const player = await beneficiary(), receipt = (await observer.observeTwitchEvent(event(player.twitchUserId))).receipt;
    const before = await counts();
    await expect(failFinalization().consume(receipt.id)).rejects.toThrow('private finalization failure');
    expect(await counts()).toEqual(before);
    expect(await db.playerFavorState.findUnique({ where: { playerId: player.playerId } })).toBeNull();
    expect(await db.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId: player.playerId, resourceKey: 'primogems' } } })).toMatchObject({ amount: 42n });
    expect(await db.twitchEventReceipt.findUniqueOrThrow({ where: { id: receipt.id } })).toMatchObject({ state: 'RECEIVED', processedAt: null, externalReference: null });
    await consumer.consume(receipt.id); await assertEffect(player.playerId, receipt.id, 1600n);
  });
  it('leaves infrastructure failures before the effect replayable', async () => {
    const player = await beneficiary(), receipt = (await observer.observeTwitchEvent(event(player.twitchUserId))).receipt;
    const before = await counts(), grant = vi.spyOn(favor, 'grant').mockRejectedValueOnce(new Error('private economy outage'));
    try {
      await expect(consumer.consume(receipt.id)).rejects.toThrow('private economy outage');
      expect(await counts()).toEqual(before);
      expect(await db.twitchEventReceipt.findUniqueOrThrow({ where: { id: receipt.id } })).toMatchObject({ state: 'RECEIVED', processedAt: null, errorMessage: null });
      await consumer.consume(receipt.id); await assertEffect(player.playerId, receipt.id, 1600n);
    } finally { grant.mockRestore(); }
  });
  it('excludes every subscription outcome from Chat-only retention, including a retryable receipt', async () => {
    const unresolved = (await observer.observeTwitchEvent(event())).receipt;
    const ignored = (await observer.observeTwitchEvent(event())).receipt; await consumer.consume(ignored.id);
    const player = await beneficiary(), success = (await observer.observeTwitchEvent(event(player.twitchUserId))).receipt;
    await consumer.consume(success.id);
    const ids = [unresolved.id, ignored.id, success.id], old = new Date(now.getTime() - 25 * 3600_000);
    await db.twitchEventReceipt.updateMany({ where: { id: { in: ids } }, data: { receivedAt: old } });
    const chat = await db.twitchEventReceipt.create({ data: { eventType: 'channel.chat.message', externalEventId: randomUUID(), receivedAt: old } });
    new TwitchReceiptRetention(db, () => now.getTime()).maybeCleanup();
    await vi.waitFor(async () => expect(await db.twitchEventReceipt.findUnique({ where: { id: chat.id } })).toBeNull(), { timeout: 5000 });
    expect(await db.twitchEventReceipt.count({ where: { id: { in: ids } } })).toBe(3);
  });
  it('wires signed HTTP delivery end to end, ACKs terminal ignore and returns 500 on retryable failure', async () => {
    const secret = 'private-subscription-secret', player = await beneficiary();
    const app = await buildApp({ host: '127.0.0.1', port: 3001, supabase: {}, twitchEventSub: { enabled: true, secret } }, {
      authIdentityVerifier: { verify: async () => ({ subject: 'test' }) }, getOrProvisionCurrentPlayer: {} as never,
      twitchEventObserver: observer, twitchFavorSubscriptions: consumer,
    });
    const deliver = (id: string, userId: string, isGift = false) => {
      const timestamp = new Date().toISOString(), payload = JSON.stringify({ subscription: {
        type: 'channel.subscribe', version: '1', condition: { broadcaster_user_id: '12' } }, event: {
        user_id: userId, user_login: 'recipient', user_name: 'Recipient', broadcaster_user_id: '12',
        broadcaster_user_login: 'channel', broadcaster_user_name: 'Channel', tier: '1000', is_gift: isGift } });
      const headers = { 'content-type': 'application/json', 'twitch-eventsub-message-id': id,
        'twitch-eventsub-message-timestamp': timestamp, 'twitch-eventsub-message-type': 'notification',
        'twitch-eventsub-message-signature': `sha256=${createHmac('sha256', secret).update(id).update(timestamp).update(payload).digest('hex')}` };
      // Keep timestamp/raw bytes identical on redelivery, as Twitch does.
      return () => app.inject({ method: 'POST', url: '/api/v1/twitch/eventsub', payload, headers });
    };
    const grant = vi.spyOn(favor, 'grant').mockRejectedValueOnce(new Error('private transient failure'));
    try {
      const id = randomUUID(), send = deliver(id, player.twitchUserId, true);
      expect((await send()).statusCode).toBe(500);
      expect(await db.twitchEventReceipt.findUniqueOrThrow({ where: { externalEventId: id } })).toMatchObject({ state: 'RECEIVED' });
      expect((await send()).statusCode).toBe(204); expect((await send()).statusCode).toBe(204);
      const receipt = await db.twitchEventReceipt.findUniqueOrThrow({ where: { externalEventId: id } });
      await assertEffect(player.playerId, receipt.id, 1600n);
      const unknown = randomUUID();
      expect((await deliver(unknown, String(++sequence))()).statusCode).toBe(204);
      expect(await db.twitchEventReceipt.findUniqueOrThrow({ where: { externalEventId: unknown } })).toMatchObject({
        state: 'PROCESSED', externalReference: 'favor:ignored:identity-unresolved', processedAt: now });
      expect((await deliver(id, player.twitchUserId, false)()).statusCode).toBe(409);
    } finally { grant.mockRestore(); await app.close(); }
  });
});
