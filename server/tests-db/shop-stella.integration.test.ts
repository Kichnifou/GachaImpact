import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { OperationStatus, SourceChannel } from '../generated/prisma/client.js';
import { resourceKeys } from '../src/domain/economy/resources.js';
import { PrismaShopStore } from '../src/infrastructure/database/prisma-shop-store.js';
import { PrismaBoxStore } from '../src/infrastructure/database/prisma-box-store.js';
const isolated = isolatedBatchDatabase(), db = isolated.database;
const store = new PrismaShopStore(db, { nextInt: () => 0 });
const stellaId = '79000000-0000-4000-8000-000000000004', oldId = '79000000-0000-4000-8000-000000000002';
const now = new Date();
beforeAll(() => isolated.setup({ seedPublicCatalog: true, prismaMigrations: true }), 180000);
afterAll(() => isolated.cleanup(), 60000);
async function player(moras: bigint) {
  const id = randomUUID();
  await db.player.create({ data: { id, displayName: 'Stella privée', elementKey: 'hydro',
    resourceBalances: { create: resourceKeys.map(resourceKey => ({ resourceKey, amount: resourceKey === 'moras' ? moras : 0n })) },
    economyStats: { create: {} }, gachaState: { create: {} } } });
  return id;
}
const request = (playerId: string, key = randomUUID()) => ({ playerId, itemId: stellaId, quantity: 1n, playerElementKey: 'hydro' as const, occurredAt: now, idempotencyKey: key });
describe('Shop Stella / real private migration', () => {
  it('hides the retired offer and exposes one Stella at exactly 50 million with no daily quota', async () => {
    const id = await player(1n), view = await store.getView(id);
    expect(view.items.map(i => i.externalKey)).toEqual(['masterless-stella-fortuna', 'reward-ticket']);
    expect(view.items[0]).toMatchObject({ id: stellaId, priceAmount: 50000000n, effectType: 'masterless_stella', quantityMode: 'unit', rewardPerUnit: null });
    expect(await db.shopItemDefinition.findUniqueOrThrow({ where: { id: oldId } })).toMatchObject({ displayName: 'Lot de Primogemmes', effectType: 'resource_bundle', isVisible: false, isEnabled: false });
  });
  it('credits the real inventory atomically, refreshes Box stock and replays a lost response without debit', async () => {
    const id = await player(100000000n), input = request(id);
    const first = await store.purchase(input);
    expect(first).toMatchObject({ resources: { moras: 50000000n, primogems: 0n }, stellaQuantity: 1n, purchase: { quantity: 1n, unitPrice: 50000000n, totalPrice: 50000000n, effect: { type: 'masterless_stella', amount: 1n } } });
    await store.purchase(request(id));
    const retry = await store.purchase(input);
    expect(retry).toMatchObject({ stellaQuantity: 2n, resources: { moras: 0n }, walletMorasAfter: 50000000n, operation: { id: first.operation.id, alreadyProcessed: true } });
    expect(retry.purchase).toEqual(first.purchase);
    expect(await new PrismaBoxStore(db).getStellaQuantity(id)).toBe(2n);
    expect(await db.shopPurchase.count({ where: { playerId: id } })).toBe(2);
    expect(await db.resourceMovement.count({ where: { playerId: id } })).toBe(2);
    expect(await db.itemAcquisition.count({ where: { playerId: id, sourceKey: 'shop.masterless-stella-fortuna' } })).toBe(2);
    expect(await db.playerEconomyStats.findUniqueOrThrow({ where: { playerId: id } })).toMatchObject({ totalMorasSpent: 100000000n, totalPrimosEarned: 0n });
  });
  it('refuses insufficient, multiunit and retired new purchases without any economic residue', async () => {
    const id = await player(49999999n);
    await expect(store.purchase(request(id))).rejects.toMatchObject({ code: 'SHOP_WALLET_INSUFFICIENT' });
    await expect(store.purchase({ ...request(id), quantity: 2n })).rejects.toMatchObject({ code: 'SHOP_QUANTITY_INVALID' });
    await expect(store.purchase({ ...request(id), itemId: oldId })).rejects.toMatchObject({ code: 'SHOP_ITEM_NOT_FOUND' });
    expect(await db.businessOperation.count({ where: { playerId: id } })).toBe(0);
    expect(await db.itemAcquisition.count({ where: { playerId: id } })).toBe(0);
    expect((await store.getView(id)).resources.moras).toBe(49999999n);
  });
  it('serializes distinct competing purchases against one funded Stella', async () => {
    const id = await player(50000000n);
    const outcomes = await Promise.allSettled([store.purchase(request(id)), store.purchase(request(id))]);
    expect(outcomes.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.find(r => r.status === 'rejected')).toMatchObject({ reason: { code: 'SHOP_WALLET_INSUFFICIENT' } });
    expect((await store.getView(id))).toMatchObject({ stellaQuantity: 1n, resources: { moras: 0n } });
    expect(await db.itemAcquisition.count({ where: { playerId: id } })).toBe(1);
  });
  it('deduplicates simultaneous same-key Chat and Twitch retries within their source', async () => {
    for (const sourceChannel of [SourceChannel.INTERNAL_CHAT, SourceChannel.TWITCH]) {
      const id = await player(100000000n), input = { ...request(id), sourceChannel };
      const [a, b] = await Promise.all([store.purchase(input), store.purchase(input)]);
      expect(a.operation.id).toBe(b.operation.id);
      expect([a.operation.alreadyProcessed, b.operation.alreadyProcessed].sort()).toEqual([false, true]);
      expect((await store.getView(id))).toMatchObject({ stellaQuantity: 1n, resources: { moras: 50000000n } });
      expect(await db.resourceMovement.count({ where: { playerId: id } })).toBe(1);
    }
  });
  it('replays a persisted old receipt before visibility checks and keeps old/new history intact', async () => {
    const id = await player(50000000n), key = randomUUID();
    const operation = await db.businessOperation.create({ data: { playerId: id, operationType: 'shop.purchase', sourceChannel: SourceChannel.INTERNAL_CHAT,
      idempotencyKey: 'shop.purchase:' + id + ':' + key, status: OperationStatus.COMPLETED, completedAt: now,
      resultSummary: { itemId: oldId, quantity: '2', walletMorasAfter: '50000000' } } });
    const old = await db.shopPurchase.create({ data: { playerId: id, shopItemId: oldId, quantity: 2n, unitPrice: 50000n, totalPrice: 100000n,
      effectSnapshot: { type: 'resource_bundle', resourceKey: 'primogems', amount: '320' }, operationId: operation.id, purchasedAt: now } });
    const retry = await store.purchase({ ...request(id, key), itemId: oldId, quantity: 2n, sourceChannel: SourceChannel.INTERNAL_CHAT });
    expect(retry.purchase).toMatchObject({ id: old.id, displayName: 'Lot de Primogemmes', effect: { type: 'resource_bundle', amount: 320n } });
    expect(retry.operation.alreadyProcessed).toBe(true);
    expect(await db.resourceMovement.count({ where: { playerId: id } })).toBe(0);
    await store.purchase(request(id));
    expect((await store.getHistory(id, 1)).purchases.map(p => p.effect.type).sort()).toEqual(['masterless_stella', 'resource_bundle']);
    await expect(store.purchase({ ...request(id, key), sourceChannel: SourceChannel.INTERNAL_CHAT })).rejects.toMatchObject({ code: 'SHOP_IDEMPOTENCY_CONFLICT' });
  });
});
