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
  it('materializes the twelve Collection definitions without granting a possession', async () => {
    const player = await createPlayer('Catalog');
    const expectedKeys = ['lanterne_nouvel_an', 'coeur_cristallin', 'bourgeon_eternel', 'oeuf_enchante', 'fleur_de_printemps', 'coquillage_dore', 'etoile_filante', 'boussole_antique', 'gerbe_de_recolte', 'citrouille_hantee', 'feuille_ancienne', 'flocon_enchante'];
    const definitions = await database.itemDefinition.findMany({ where: { externalKey: { in: expectedKeys } }, orderBy: { externalKey: 'asc' } });
    expect(definitions).toHaveLength(12);
    expect(definitions.every(({ category, isActive }) => category === 'COLLECTION' && isActive)).toBe(true);
    expect(await database.playerItem.count({ where: { playerId: player.id, itemId: { in: definitions.map(({ id }) => id) } } })).toBe(0);
    const items = (await new PrismaInventoryStore(database).getInventory(player.id)).items.filter(({ externalKey }) => expectedKeys.includes(externalKey));
    expect(items).toHaveLength(12);
    expect(items.every(({ quantity }) => quantity === 0n)).toBe(true);
    expect(await database.$queryRawUnsafe<{ relrowsecurity: boolean }[]>(`SELECT relrowsecurity FROM pg_class WHERE relname = 'item_acquisitions'`)).toEqual([{ relrowsecurity: true }]);
    expect(await database.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*)::bigint AS count FROM information_schema.role_table_grants WHERE table_name = 'item_acquisitions' AND grantee IN ('anon','authenticated')`)).toEqual([{ count: 0n }]);
    expect(await database.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*)::bigint AS count FROM _prisma_migrations WHERE migration_name = '20260914120000_018_add_collection_catalog_and_acquisitions' AND finished_at IS NOT NULL`)).toEqual([{ count: 1n }]);
  });
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

  it('reads only the requested player acquisition history without treating it as stock', async () => {
    const player = await createPlayer('History');
    const other = await createPlayer('OtherHistory');
    const item = await database.itemDefinition.findUniqueOrThrow({ where: { externalKey: 'lanterne_nouvel_an' } });
    await database.playerItem.create({ data: { playerId: player.id, itemId: item.id, quantity: 2n, firstObtainedAt: new Date('2026-01-15T10:00:00Z') } });
    await database.itemAcquisition.createMany({ data: [
      { playerId: player.id, itemId: item.id, quantity: 1n, sourceKey: 'EVENT', acquiredAt: new Date('2026-01-15T10:00:00Z') },
      { playerId: player.id, itemId: item.id, quantity: 1n, sourceKey: 'EVENT', acquiredAt: new Date('2027-01-15T10:00:00Z') },
      { playerId: other.id, itemId: item.id, quantity: 9_007_199_254_740_993n, sourceKey: 'TEST', acquiredAt: new Date('2026-01-15T10:00:00Z') },
    ] });
    const detail = await new PrismaInventoryStore(database).getItemDetail(player.id, item.id, 1);
    expect(detail?.item.quantity).toBe(2n);
    expect(detail?.history.map(({ quantity }) => quantity)).toEqual([1n, 1n]);
    expect(detail?.total).toBe(2);
    expect(detail?.item.originFestival).toBe('Festival du Nouvel An');
  });
});
