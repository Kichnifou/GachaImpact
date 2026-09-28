import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { PrismaClient, TwitchEventReceipt } from '../generated/prisma/client.js';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { TwitchReceiptRetention } from '../src/application/twitch/twitch-receipt-retention.js';

const fixture = isolatedBatchDatabase();
const db = fixture.database;
const now = Date.parse('2026-09-28T12:00:00Z');
const cutoff = now - 24 * 60 * 60 * 1_000;
beforeAll(() => fixture.setup({ seedPublicCatalog: true }), 60_000);
afterAll(() => fixture.cleanup(), 60_000);

describe('private PostgreSQL Twitch receipt retention', () => {
  it('purges only expired pure observations and protects time boundary, processing, reference, state, type and FavorGrant', async () => {
    const data = [
      { receivedAt: new Date(cutoff + 1) },
      { receivedAt: new Date(cutoff - 1) },
      { receivedAt: new Date(cutoff - 1), processedAt: new Date(cutoff) },
      { receivedAt: new Date(cutoff - 1), state: 'PROCESSED' },
      { receivedAt: new Date(cutoff - 1), externalReference: 'durable-private-proof' },
      { receivedAt: new Date(cutoff - 1) },
      { receivedAt: new Date(cutoff - 1), eventType: 'channel.subscribe' },
      { receivedAt: new Date(cutoff) },
    ];
    const receipts: TwitchEventReceipt[] = [];
    for (const overrides of data) receipts.push(await db.twitchEventReceipt.create({ data: {
      externalEventId: randomUUID(), eventType: 'channel.chat.message', ...overrides,
    } }));
    const player = await db.player.create({ data: { displayName: 'Private retained proof' } });
    const operation = await db.businessOperation.create({ data: {
      playerId: player.id, operationType: 'retention.private-proof', sourceChannel: 'UI', idempotencyKey: randomUUID(),
    } });
    const grant = await db.favorGrant.create({ data: {
      playerId: player.id, twitchEventReceiptId: receipts[5]!.id, operationId: operation.id,
      requestedDays: 1, addedDays: 1, blockedDays: 0, immediatePrimogems: 0n, compensationPrimogems: 0n,
    } });
    new TwitchReceiptRetention(db, () => now).maybeCleanup();
    await vi.waitFor(async () => expect(await db.twitchEventReceipt.findUnique({ where: { id: receipts[1]!.id } })).toBeNull(), { timeout: 5_000 });
    const retained = await db.twitchEventReceipt.findMany({ where: { id: { in: receipts.map(receipt => receipt.id) } } });
    expect(retained.map(receipt => receipt.id).sort()).toEqual(receipts.filter((_receipt, index) => index !== 1).map(receipt => receipt.id).sort());
    expect(await db.favorGrant.findUnique({ where: { id: grant.id } })).toEqual(grant);
    expect(await db.businessOperation.findUnique({ where: { id: operation.id } })).toEqual(operation);
    expect(await db.player.findUnique({ where: { id: player.id } })).toEqual(player);
  });
  it('rechecks processing protection when a selected observation becomes consumed before DELETE', async () => {
    const receipt = await db.twitchEventReceipt.create({ data: {
      externalEventId: randomUUID(), eventType: 'channel.chat.message', receivedAt: new Date(cutoff - 1),
    } });
    let finished = false;
    const guarded = { twitchEventReceipt: {
      findMany: async (args: Parameters<typeof db.twitchEventReceipt.findMany>[0]) => {
        const rows = await db.twitchEventReceipt.findMany(args);
        await db.twitchEventReceipt.update({ where: { id: receipt.id }, data: { processedAt: new Date(now) } });
        return rows;
      },
      deleteMany: async (args: Parameters<typeof db.twitchEventReceipt.deleteMany>[0]) => {
        const result = await db.twitchEventReceipt.deleteMany(args); finished = true; return result;
      },
    } } as unknown as PrismaClient;
    new TwitchReceiptRetention(guarded, () => now).maybeCleanup();
    await vi.waitFor(() => expect(finished).toBe(true), { timeout: 5_000 });
    expect(await db.twitchEventReceipt.findUniqueOrThrow({ where: { id: receipt.id } })).toMatchObject({ processedAt: new Date(now) });
  });
});
