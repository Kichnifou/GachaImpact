import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/environment.js';
import { createDatabase } from '../src/infrastructure/database/prisma-database.js';
import { PrismaInventoryStore } from '../src/infrastructure/database/prisma-inventory-store.js';

const config = loadConfig();
if (!config.databaseUrl) throw new Error('DATABASE_URL is required for Inventory database tests.');
const database = createDatabase(config.databaseUrl);
const playerIds = new Set<string>();
const itemDefinitionIds = new Set<string>();

afterEach(async () => cleanup());
afterAll(async () => {
  try { await cleanup(); }
  finally { await database.$disconnect(); }
});

async function cleanup() {
  const players = [...playerIds];
  const definitions = [...itemDefinitionIds];
  await database.$transaction(async (transaction) => {
    if (players.length) await transaction.player.deleteMany({ where: { id: { in: players } } });
    if (definitions.length) await transaction.itemDefinition.deleteMany({ where: { id: { in: definitions } } });
  });
  playerIds.clear();
  itemDefinitionIds.clear();
}

async function createPlayer(label: string) {
  const player = await database.player.create({ data: { displayName: `${label} ${randomUUID().slice(0, 8)}` } });
  playerIds.add(player.id);
  return player;
}

describe('personal inventory persistence', () => {
  it('returns the nine stable resources at zero and isolates lossless player balances', async () => {
    const player = await createPlayer('Inventory');
    const other = await createPlayer('Other');
    await database.playerResourceBalance.createMany({ data: [
      { playerId: player.id, resourceKey: 'primogems', amount: 9_007_199_254_740_993n },
      { playerId: other.id, resourceKey: 'primogems', amount: 444n },
    ] });
    const store = new PrismaInventoryStore(database);
    const inventory = await store.getInventory(player.id);
    expect(inventory.resources).toHaveLength(9);
    expect(inventory.resources.map(({ key }) => key)).toEqual(['primogems', 'moras', 'particles_pyro', 'particles_hydro', 'particles_cryo', 'particles_electro', 'particles_anemo', 'particles_geo', 'particles_dendro']);
    expect(inventory.resources.find(({ key }) => key === 'primogems')?.amount).toBe(9_007_199_254_740_993n);
    expect(inventory.resources.filter(({ key }) => key !== 'primogems').every(({ amount }) => amount === 0n)).toBe(true);
    expect((await store.getInventory(other.id)).resources.find(({ key }) => key === 'primogems')?.amount).toBe(444n);
  });

  it('exposes only active definitions, real quantities and canonical objects or collection sections', async () => {
    const player = await createPlayer('Inventory');
    const other = await createPlayer('Other');
    const suffix = randomUUID();
    const [object, collection, inactive] = await Promise.all([
      database.itemDefinition.create({ data: { externalKey: `test:object:${suffix}`, displayName: 'Objet Test', category: 'SPECIAL', isActive: true, metadata: { inventorySection: 'objects' } } }),
      database.itemDefinition.create({ data: { externalKey: `test:collection:${suffix}`, displayName: 'Collection Test', category: 'COLLECTION', isActive: true, description: 'Souvenir réel', metadata: { acquisitionHint: 'Obtenu pendant un événement.' } } }),
      database.itemDefinition.create({ data: { externalKey: `test:inactive:${suffix}`, displayName: 'Objet Inactif', category: 'SPECIAL', isActive: false } }),
    ]);
    [object, collection, inactive].forEach(({ id }) => itemDefinitionIds.add(id));
    await database.playerItem.createMany({ data: [
      { playerId: player.id, itemId: object.id, quantity: 3n, firstObtainedAt: new Date('2026-09-09T10:00:00Z') },
      { playerId: player.id, itemId: inactive.id, quantity: 9n },
      { playerId: other.id, itemId: collection.id, quantity: 7n },
    ] });
    const items = (await new PrismaInventoryStore(database).getInventory(player.id)).items;
    expect(items.find(({ id }) => id === object.id)).toMatchObject({ section: 'objects', quantity: 3n });
    expect(items.find(({ id }) => id === collection.id)).toMatchObject({ section: 'collection', quantity: 0n, acquisitionHint: 'Obtenu pendant un événement.' });
    expect(items.some(({ id }) => id === inactive.id)).toBe(false);
    expect(items.find(({ id }) => id === collection.id)?.quantity).not.toBe(7n);
  });
});
