import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { PrismaPlayerElementStore } from '../src/infrastructure/database/prisma-player-element-store.js';
import { PrismaBoxStore } from '../src/infrastructure/database/prisma-box-store.js';

const fixture = isolatedBatchDatabase(), db = fixture.database;
const elements = new PrismaPlayerElementStore(db), box = new PrismaBoxStore(db);
beforeAll(() => fixture.setup({ prismaMigrations: true, seedPublicCatalog: true }), 60_000);
afterAll(() => fixture.cleanup(), 60_000);
const player = () => db.player.create({ data: { displayName: 'Private setting concurrency' } });

it('serves distinct players concurrently with a pool of three, retaining one operation per intent', async () => {
  const players = await Promise.all(Array.from({ length: 32 }, player));
  const keys = players.map(() => randomUUID());
  for (let offset = 0; offset < players.length; offset += 8) {
    const results = await Promise.all(players.slice(offset, offset + 8).map((row, index) => elements.chooseElement(row.id, 'pyro', keys[offset + index])));
    expect(results.every(result => result === 'selected')).toBe(true);
  }
  expect(await db.player.count({ where: { id: { in: players.map(row => row.id) }, elementKey: 'pyro' } })).toBe(32);
  expect(await db.businessOperation.count({ where: { playerId: { in: players.map(row => row.id) } } })).toBe(32);
});

it('serializes the same intent and preserves later UI settings on replay', async () => {
  const row = await player(), key = randomUUID(), initial = await box.getSortPreference(row.id);
  const result = await Promise.all(Array.from({ length: 8 }, () => box.setSortPreference(row.id, initial, key)));
  expect(result).toEqual(Array.from({ length: 8 }, () => initial));
  const later = { ...initial, direction: initial.direction === 'asc' ? 'desc' as const : 'asc' as const };
  await box.setSortPreference(row.id, later);
  expect(await box.setSortPreference(row.id, initial, key)).toEqual(initial);
  expect(await box.getSortPreference(row.id)).toEqual(later);
  expect(await db.businessOperation.count({ where: { playerId: row.id } })).toBe(1);
  await expect(box.setSortPreference(row.id, later, key)).rejects.toMatchObject({ code: 'SETTING_IDEMPOTENCY_CONFLICT' });
});

it('rolls back the losing player when two players collide on an intent key', async () => {
  const rows = await Promise.all([player(), player()]), key = randomUUID();
  const results = await Promise.allSettled(rows.map(row => elements.chooseElement(row.id, 'pyro', key)));
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  const rejected = results.find(result => result.status === 'rejected');
  expect(rejected).toMatchObject({ status: 'rejected', reason: { code: 'SETTING_IDEMPOTENCY_CONFLICT' } });
  expect(await db.player.count({ where: { id: { in: rows.map(row => row.id) }, elementKey: 'pyro' } })).toBe(1);
  expect(await db.businessOperation.count({ where: { playerId: { in: rows.map(row => row.id) } } })).toBe(1);
});
