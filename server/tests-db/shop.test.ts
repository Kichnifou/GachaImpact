import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { OperationStatus, Prisma, SourceChannel } from '../generated/prisma/client.js';
import { loadConfig } from '../src/config/environment.js';
import { resourceKeys } from '../src/domain/economy/resources.js';
import { createDatabase } from '../src/infrastructure/database/prisma-database.js';
import { PrismaShopStore } from '../src/infrastructure/database/prisma-shop-store.js';

const config = loadConfig();
if (!config.databaseUrl) throw new Error('DATABASE_URL is required for Shop database tests.');
const database = createDatabase(config.databaseUrl);
const players = new Set<string>();
const temporaryItems = new Set<string>();
const now = new Date('2026-09-10T18:00:00.000Z');
const primosId = '79000000-0000-4000-8000-000000000002';
const ticketId = '79000000-0000-4000-8000-000000000003';
const missionId = '79000000-0000-4000-8000-000000000001';

afterEach(cleanup);
afterAll(async () => { try { await cleanup(); } finally { await database.$disconnect(); } });

async function createPlayer(moras: bigint, pity5 = 0) {
  const playerId = randomUUID(); players.add(playerId);
  await database.player.create({ data: {
    id: playerId, displayName: `Shop Fixture ${randomUUID().slice(0, 8)}`, elementKey: 'hydro',
    resourceBalances: { create: resourceKeys.map((resourceKey) => ({ resourceKey, amount: resourceKey === 'moras' ? moras : 0n })) },
    economyStats: { create: {} }, gachaState: { create: { pity5, pity4: 7, guaranteedFeatured5: true, captureProgress: 2, fiftyFiftyLostStreak: 1 } },
  } });
  return playerId;
}
async function cleanup() {
  const ids = [...players];
  if (ids.length) {
    await database.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM players WHERE id IN (${Prisma.join(ids)}) FOR UPDATE`);
      await tx.shopPurchase.deleteMany({ where: { playerId: { in: ids } } });
      await tx.resourceMovement.deleteMany({ where: { playerId: { in: ids } } });
      await tx.businessOperation.deleteMany({ where: { playerId: { in: ids } } });
      await tx.playerGachaState.deleteMany({ where: { playerId: { in: ids } } });
      await tx.playerResourceBalance.deleteMany({ where: { playerId: { in: ids } } });
      await tx.playerEconomyStats.deleteMany({ where: { playerId: { in: ids } } });
      await tx.player.deleteMany({ where: { id: { in: ids } } });
    }, { timeout: 30_000 });
    ids.forEach((id) => players.delete(id));
  }
  if (temporaryItems.size) { await database.shopItemDefinition.deleteMany({ where: { id: { in: [...temporaryItems] } } }); temporaryItems.clear(); }
}
const input = (playerId: string, itemId: string, quantity: bigint, idempotencyKey = randomUUID()) => ({ playerId, playerElementKey: 'hydro' as const, itemId, quantity, idempotencyKey, occurredAt: now });

describe('Shop persistence', () => {
  it('reads only the visible Primos and Ticket catalog with derived odds and no stock', async () => {
    const playerId = await createPlayer(1n); const view = await new PrismaShopStore(database, { nextInt: () => 0 }).getView(playerId);
    expect(view.items.map(({ externalKey }) => externalKey)).toEqual(['primogem-bundle', 'reward-ticket']);
    expect(view.items[0]).toMatchObject({ displayOrder: 2, priceAmount: 50_000n, rewardPerUnit: { resourceKey: 'primogems', amount: 160n }, quantityMode: 'multiple' });
    expect(view.items[1]?.ticketRewards.map(({ probabilityBasisPoints }) => probabilityBasisPoints)).toEqual([2000, 2000, 2000, 2000, 2000]);
    expect(Object.keys(view.items[1] ?? {}).some((key) => key.toLowerCase().includes('stock'))).toBe(false);
  });

  it('buys multiple Primogem bundles exactly once, updates economy stats, and persists an ordered history snapshot', async () => {
    const playerId = await createPlayer(600_000n); const store = new PrismaShopStore(database, { nextInt: () => 0 }); const key = randomUUID();
    const first = await store.purchase(input(playerId, primosId, 2n, key)); const retry = await store.purchase(input(playerId, primosId, 2n, key));
    expect(first).toMatchObject({ resources: { moras: 500_000n, primogems: 320n }, purchase: { quantity: 2n, unitPrice: 50_000n, totalPrice: 100_000n, effect: { type: 'resource_bundle', resourceKey: 'primogems', amount: 320n } }, operation: { alreadyProcessed: false } });
    expect(retry.operation).toMatchObject({ id: first.operation.id, alreadyProcessed: true }); expect(retry.purchase).toEqual(first.purchase);
    expect(await database.shopPurchase.count({ where: { playerId } })).toBe(1); expect(await database.resourceMovement.count({ where: { playerId } })).toBe(2);
    expect(await database.playerEconomyStats.findUniqueOrThrow({ where: { playerId } })).toMatchObject({ totalMorasSpent: 100_000n, totalPrimosEarned: 320n });
    await expect(store.purchase(input(playerId, primosId, 1n, key))).rejects.toMatchObject({ code: 'SHOP_IDEMPOTENCY_CONFLICT' });
    await store.purchase({ ...input(playerId, primosId, 10n), occurredAt: new Date(now.getTime() + 1) }); expect((await store.getView(playerId)).recentPurchases.map(({ quantity }) => quantity)).toEqual([10n, 2n]);
    const history = await store.getHistory(playerId, 1); expect(history).toMatchObject({ page: 1, pageSize: 10, totalCount: 2, totalPages: 1 }); expect(history.purchases.map(({ quantity }) => quantity)).toEqual([10n, 2n]);
  });

  it('paginates 21 history rows as 10/10/1 with stable order, lossless bigint snapshots and Player isolation', async () => {
    const preexistingIds = (await database.shopPurchase.findMany({ select: { id: true } })).map(({ id }) => id).sort();
    const playerId = await createPlayer(1n);
    const otherPlayerId = await createPlayer(1n);
    const largeQuantity = 9_007_199_254_740_993n;
    const fixtures = Array.from({ length: 21 }, (_, index) => {
      const purchasedAt = new Date(now.getTime() + Math.floor(index / 2));
      const quantity = index === 0 ? largeQuantity : BigInt(index + 1);
      return { id: randomUUID(), operationId: randomUUID(), purchasedAt, quantity };
    });
    const other = { id: randomUUID(), operationId: randomUUID(), purchasedAt: new Date(now.getTime() + 60_000) };

    await database.$transaction([
      database.businessOperation.createMany({ data: [...fixtures.map(({ operationId, purchasedAt }) => ({
        id: operationId, playerId, operationType: 'shop.purchase', sourceChannel: SourceChannel.UI,
        idempotencyKey: `history-${operationId}`, status: OperationStatus.COMPLETED, startedAt: purchasedAt, completedAt: purchasedAt,
      })), {
        id: other.operationId, playerId: otherPlayerId, operationType: 'shop.purchase', sourceChannel: SourceChannel.UI,
        idempotencyKey: `history-${other.operationId}`, status: OperationStatus.COMPLETED, startedAt: other.purchasedAt, completedAt: other.purchasedAt,
      }] }),
      database.shopPurchase.createMany({ data: [...fixtures.map(({ id, operationId, purchasedAt, quantity }) => ({
        id, playerId, shopItemId: primosId, quantity, unitPrice: 1n, totalPrice: quantity,
        effectSnapshot: { type: 'resource_bundle', resourceKey: 'primogems', amount: quantity.toString() }, operationId, purchasedAt,
      })), {
        id: other.id, playerId: otherPlayerId, shopItemId: primosId, quantity: 1n, unitPrice: 1n, totalPrice: 1n,
        effectSnapshot: { type: 'resource_bundle', resourceKey: 'primogems', amount: '1' }, operationId: other.operationId, purchasedAt: other.purchasedAt,
      }] }),
    ]);

    const store = new PrismaShopStore(database, { nextInt: () => 0 });
    const [page1, page2, page3] = await Promise.all([store.getHistory(playerId, 1), store.getHistory(playerId, 2), store.getHistory(playerId, 3)]);
    expect([page1.purchases.length, page2.purchases.length, page3.purchases.length]).toEqual([10, 10, 1]);
    expect(page1).toMatchObject({ page: 1, pageSize: 10, totalCount: 21, totalPages: 3 });
    expect(page2).toMatchObject({ page: 2, pageSize: 10, totalCount: 21, totalPages: 3 });
    expect(page3).toMatchObject({ page: 3, pageSize: 10, totalCount: 21, totalPages: 3 });
    const expectedIds = (await database.shopPurchase.findMany({
      where: { playerId }, orderBy: [{ purchasedAt: 'desc' }, { id: 'desc' }], select: { id: true },
    })).map(({ id }) => id);
    const purchases = [...page1.purchases, ...page2.purchases, ...page3.purchases];
    expect(purchases.map(({ id }) => id)).toEqual(expectedIds);
    expect(purchases.some(({ id }) => id === other.id)).toBe(false);
    expect(purchases.find(({ quantity }) => quantity === largeQuantity)).toMatchObject({
      quantity: largeQuantity, unitPrice: 1n, totalPrice: largeQuantity,
      effect: { type: 'resource_bundle', resourceKey: 'primogems', amount: largeQuantity },
    });

    await cleanup();
    expect((await database.shopPurchase.findMany({ where: { id: { in: preexistingIds } }, select: { id: true } })).map(({ id }) => id).sort()).toEqual(preexistingIds);
  });

  it('rejects invalid/unit/disabled/insufficient requests atomically', async () => {
    const playerId = await createPlayer(149_999n); const store = new PrismaShopStore(database, { nextInt: () => 0 });
    await expect(store.purchase(input(playerId, primosId, 0n))).rejects.toMatchObject({ code: 'SHOP_QUANTITY_INVALID' });
    await expect(store.purchase(input(playerId, ticketId, 2n))).rejects.toMatchObject({ code: 'SHOP_QUANTITY_INVALID' });
    await expect(store.purchase(input(playerId, missionId, 1n))).rejects.toMatchObject({ code: 'SHOP_ITEM_NOT_FOUND' });
    await expect(store.purchase(input(playerId, ticketId, 1n))).rejects.toMatchObject({ code: 'SHOP_WALLET_INSUFFICIENT' });
    expect(await database.shopPurchase.count({ where: { playerId } })).toBe(0); expect(await database.businessOperation.count({ where: { playerId } })).toBe(0); expect(await database.resourceMovement.count({ where: { playerId } })).toBe(0);
    expect((await database.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId, resourceKey: 'moras' } } })).amount).toBe(149_999n);
  });

  it('omits a hidden catalog fixture and refuses to purchase it', async () => {
    const playerId = await createPlayer(1_000_000n); const hiddenId = randomUUID(); temporaryItems.add(hiddenId);
    await database.shopItemDefinition.create({ data: { id: hiddenId, externalKey: `hidden-${randomUUID()}`, displayName: 'Masqué', description: 'Fixture masquée', visualKey: 'hidden', priceResourceKey: 'moras', priceAmount: 1n, effectType: 'resource_bundle', effectConfig: { resourceKey: 'primogems', amountPerUnit: 1, quantityMode: 'unit' }, displayOrder: 99, isVisible: false, isEnabled: true, limitConfig: { quantityMode: 'unit' } } });
    const store = new PrismaShopStore(database, { nextInt: () => 0 }); expect((await store.getView(playerId)).items.some(({ id }) => id === hiddenId)).toBe(false);
    await expect(store.purchase(input(playerId, hiddenId, 1n))).rejects.toMatchObject({ code: 'SHOP_ITEM_NOT_FOUND' }); expect(await database.shopPurchase.count({ where: { playerId } })).toBe(0);
  });

  it('resolves and persists every Ticket branch, including other-element choice and capped central Gacha pity', async () => {
    for (let branch = 0; branch < 5; branch += 1) {
      const playerId = await createPlayer(150_000n, branch === 3 ? 84 : 12); const random = { nextInt: vi.fn((maximum: number) => maximum === 5 ? branch : 2) }; const store = new PrismaShopStore(database, random); const key = randomUUID();
      const before = await database.playerGachaState.findUniqueOrThrow({ where: { playerId } }); const result = await store.purchase(input(playerId, ticketId, 1n, key)); const calls = random.nextInt.mock.calls.length;
      const retry = await new PrismaShopStore(database, { nextInt: () => { throw new Error('A persisted Ticket retry must not reroll.'); } }).purchase(input(playerId, ticketId, 1n, key));
      expect(retry.purchase).toEqual(result.purchase); expect(random.nextInt).toHaveBeenCalledTimes(calls); expect(await database.shopPurchase.count({ where: { playerId } })).toBe(1);
      const persisted = await database.shopPurchase.findFirstOrThrow({ where: { playerId } }); expect(persisted.effectSnapshot).toMatchObject({ type: result.purchase.effect.type });
      expect(await database.playerItem.count({ where: { playerId } })).toBe(0);
      const state = await database.playerGachaState.findUniqueOrThrow({ where: { playerId } }); expect(state).toMatchObject({ pity4: before.pity4, guaranteedFeatured5: before.guaranteedFeatured5, captureProgress: before.captureProgress });
      const stats = await database.playerEconomyStats.findUniqueOrThrow({ where: { playerId } }); expect(stats.totalMorasSpent).toBe(150_000n);
      if (branch === 0) { expect(result.purchase.effect).toMatchObject({ type: 'ticket_resource', resourceKey: 'primogems', amount: 1_600n }); expect(stats.totalPrimosEarned).toBe(1_600n); }
      if (branch === 1) { expect(result.purchase.effect).toMatchObject({ type: 'ticket_main_element_particles', elementKey: 'hydro', resourceKey: 'particles_hydro', amount: 1_000n }); expect(stats.totalMainElementParticlesEarned).toBe(1_000n); }
      if (branch === 2) { expect(result.purchase.effect).toMatchObject({ type: 'ticket_other_element_particles', elementKey: 'electro', resourceKey: 'particles_electro', amount: 800n }); expect(stats.totalMainElementParticlesEarned).toBe(0n); }
      if (branch === 3) { expect(result.purchase.effect).toMatchObject({ type: 'ticket_pity5', requestedAmount: 10, grantedAmount: 6, pity5After: 90 }); expect(state.pity5).toBe(90); }
      if (branch === 4) { expect(result.purchase.effect).toMatchObject({ type: 'ticket_resource', resourceKey: 'moras', amount: 50_000n }); expect(result.resources.moras).toBe(50_000n); expect(stats.totalMorasEarned).toBe(50_000n); }
    }
  }, 30_000);

  it('rolls back debit, stats, operation and history when Ticket resolution fails', async () => {
    const playerId = await createPlayer(150_000n); const store = new PrismaShopStore(database, { nextInt: () => { throw new Error('forced Ticket failure'); } });
    await expect(store.purchase(input(playerId, ticketId, 1n))).rejects.toThrow('forced Ticket failure');
    expect((await database.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId, resourceKey: 'moras' } } })).amount).toBe(150_000n);
    expect(await database.shopPurchase.count({ where: { playerId } })).toBe(0); expect(await database.businessOperation.count({ where: { playerId } })).toBe(0); expect(await database.resourceMovement.count({ where: { playerId } })).toBe(0); expect((await database.playerEconomyStats.findUniqueOrThrow({ where: { playerId } })).totalMorasSpent).toBe(0n);
  });

  it('serializes concurrent purchases without a negative wallet and deduplicates concurrent retries', async () => {
    const playerId = await createPlayer(150_000n); const store = new PrismaShopStore(database, { nextInt: () => 0 }); const key = randomUUID();
    const same = await Promise.all([store.purchase(input(playerId, primosId, 1n, key)), store.purchase(input(playerId, primosId, 1n, key))]); expect(new Set(same.map(({ operation }) => operation.id)).size).toBe(1);
    const outcomes = await Promise.allSettled([store.purchase(input(playerId, primosId, 2n)), store.purchase(input(playerId, primosId, 2n))]); expect(outcomes.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    const wallet = (await database.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId, resourceKey: 'moras' } } })).amount; expect(wallet).toBe(0n); expect(wallet >= 0n).toBe(true); expect(await database.shopPurchase.count({ where: { playerId } })).toBe(2);
  }, 20_000);
});
