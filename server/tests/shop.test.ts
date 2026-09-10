import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { GetOrProvisionCurrentPlayer } from '../src/application/player/get-or-provision-current-player.js';
import { GetCurrentPlayerShop, PurchaseShopItem } from '../src/application/shop/shop-services.js';
import type { ShopStore, ShopView } from '../src/application/shop/shop-store.js';
import { applyFiveStarPityBonus } from '../src/domain/gacha/pity.js';
import { resourceKeys } from '../src/domain/economy/resources.js';

const playerId = crypto.randomUUID();
const itemIds = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
const gachaState = { pity5: 84, pity4: 7, guaranteedFeatured5: true, captureProgress: 2, fiftyFiftyLostStreak: 1, selectedBannerCharacterId: null, totalPulls: 3n, totalFiveStars: 1n, totalFourStars: 2n, fiftyFiftyWon: 0n, fiftyFiftyLost: 1n, capturesTriggered: 0n };
const resources = Object.fromEntries(resourceKeys.map((key) => [key, key === 'moras' ? 9007199254740993n : 0n])) as ShopView['resources'];
const items: ShopView['items'] = [
  { id: itemIds[0]!, externalKey: 'daily-mission', displayName: 'Mission quotidienne', description: 'Mission', visualKey: 'mission', priceResourceKey: 'moras', priceAmount: 10_000n, effectType: 'daily_mission', displayOrder: 1, available: false, unavailableReason: 'Missions quotidiennes bientôt disponibles', quantityMode: 'unit', rewardPerUnit: null, ticketRewards: [] },
  { id: itemIds[1]!, externalKey: 'primogem-bundle', displayName: 'Lot de Primogemmes', description: 'Primos', visualKey: 'primogems', priceResourceKey: 'moras', priceAmount: 50_000n, effectType: 'resource_bundle', displayOrder: 2, available: true, unavailableReason: null, quantityMode: 'multiple', rewardPerUnit: { resourceKey: 'primogems', amount: 160n }, ticketRewards: [] },
  { id: itemIds[2]!, externalKey: 'reward-ticket', displayName: 'Ticket', description: 'Ticket', visualKey: 'ticket', priceResourceKey: 'moras', priceAmount: 150_000n, effectType: 'random_ticket', displayOrder: 3, available: true, unavailableReason: null, quantityMode: 'unit', rewardPerUnit: null, ticketRewards: Array.from({ length: 5 }, (_, index) => ({ id: `reward-${index}`, type: index === 3 ? 'pity5' as const : 'resource' as const, label: `Récompense ${index}`, amount: 10n, weight: 1, probabilityBasisPoints: 2000, resourceKey: 'moras' as const })) },
];
const view: ShopView = { resources, gachaState, items, recentPurchases: [] };

class FakeShopStore implements ShopStore {
  public readonly purchase = vi.fn(async (input: Parameters<ShopStore['purchase']>[0]) => ({ ...view, purchase: { id: crypto.randomUUID(), itemId: input.itemId, externalKey: 'primogem-bundle', displayName: 'Lot de Primogemmes', quantity: input.quantity, unitPrice: 50_000n, totalPrice: 50_000n * input.quantity, effect: { type: 'resource_bundle' as const, resourceKey: 'primogems' as const, amount: 160n * input.quantity }, operationId: crypto.randomUUID(), purchasedAt: new Date('2026-09-10T12:00:00Z') }, operation: { id: crypto.randomUUID(), alreadyProcessed: false } }));
  public async getView() { return view; }
}

describe('Shop domain and HTTP contract', () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
  afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));
  async function setup() {
    const store = new FakeShopStore();
    const playerStore = { findByIdentity: async () => ({ id: playerId, displayName: 'Shop Test', elementKey: 'hydro', status: 'ACTIVE' as const }), provision: vi.fn() };
    const current = new GetCurrentPlayer(playerStore);
    const app = await buildApp({ host: '127.0.0.1', port: 3001, supabase: {} }, { authIdentityVerifier: { verify: async () => ({ subject: 'subject' }) }, getOrProvisionCurrentPlayer: new GetOrProvisionCurrentPlayer(playerStore), getCurrentPlayerShop: new GetCurrentPlayerShop(current, store), purchaseShopItem: new PurchaseShopItem(current, store, { now: () => new Date('2026-09-10T12:00:00Z') }) });
    apps.push(app); return { app, store };
  }

  it('caps five-star pity without changing the source value', () => { expect(applyFiveStarPityBonus(84, 10)).toBe(90); expect(applyFiveStarPityBonus(0, 10)).toBe(10); expect(() => applyFiveStarPityBonus(90, 0)).toThrow(); });
  it('protects and serializes the ordered visible catalog, unavailable reason, probabilities and bigint values', async () => {
    const { app } = await setup(); expect((await app.inject({ url: '/api/v1/me/shop' })).statusCode).toBe(401);
    const response = await app.inject({ url: '/api/v1/me/shop', headers: { authorization: 'Bearer token' } });
    expect(response.statusCode).toBe(200); expect(response.json().items.map((item: { externalKey: string }) => item.externalKey)).toEqual(['daily-mission', 'primogem-bundle', 'reward-ticket']);
    expect(response.json().resources.moras).toBe('9007199254740993'); expect(response.json().items[0]).toMatchObject({ available: false, unavailableReason: 'Missions quotidiennes bientôt disponibles', priceAmount: '10000' }); expect(response.json().items[1]).toMatchObject({ rewardPerUnit: { amount: '160' } }); expect(response.json().items[2].ticketRewards).toHaveLength(5); expect(response.json().items[2].ticketRewards.every((reward: { probabilityBasisPoints: number }) => reward.probabilityBasisPoints === 2000)).toBe(true);
  });
  it('accepts only lossless positive integer quantities and never accepts client prices', async () => {
    const { app, store } = await setup(); const headers = { authorization: 'Bearer token' }; const idempotencyKey = crypto.randomUUID();
    const response = await app.inject({ method: 'POST', url: `/api/v1/me/shop/${itemIds[1]}/purchase`, headers, payload: { quantity: '2', idempotencyKey } });
    expect(response.statusCode).toBe(200); expect(response.json()).toMatchObject({ purchase: { quantity: '2', unitPrice: '50000', totalPrice: '100000', effect: { amount: '320' } } });
    expect(store.purchase.mock.calls[0]![0]).toMatchObject({ playerId, itemId: itemIds[1], quantity: 2n, idempotencyKey });
    for (const quantity of ['0', '-1', '1.5', 'abc']) expect((await app.inject({ method: 'POST', url: `/api/v1/me/shop/${itemIds[1]}/purchase`, headers, payload: { quantity, idempotencyKey: crypto.randomUUID() } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: `/api/v1/me/shop/${itemIds[1]}/purchase`, headers, payload: { quantity: '1', idempotencyKey: crypto.randomUUID(), price: '1' } })).statusCode).toBe(400);
  });
});
