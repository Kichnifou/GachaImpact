import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';

const fixture = isolatedBatchDatabase();
const { database, admin } = fixture;

beforeAll(async () => {
  await fixture.setup();
  // The generated Prisma schema already contains 053. Restore the 052 shape
  // before executing the real migration SQL in this private schema.
  await admin.query('ALTER TABLE migration_runs DROP COLUMN preview_id CASCADE');
  await admin.query('CREATE UNIQUE INDEX migration_runs_pilot_player_hash_key ON migration_runs (player_id, snapshot_hash) WHERE batch_id IS NULL');
  await fixture.installMigrationOnlySql(new URL('../prisma/migrations/20260927150000_053_key_pilot_refresh_by_preview/migration.sql', import.meta.url));
}, 60_000);

afterAll(() => fixture.cleanup(), 60_000);

describe('Pilot refresh migration 053', () => {
  it('permits later same-hash refreshes but gives each consumed preview only one run', async () => {
    const player = await database.player.create({ data: { displayName: 'Private migration fixture' } });
    const hash = 'a'.repeat(64);
    const expiresAt = new Date('2026-09-28T00:00:00.000Z');
    const firstPreview = await database.migrationPreview.create({ data: { playerId: player.id, snapshotHash: hash, expiresAt } });
    const secondPreview = await database.migrationPreview.create({ data: { playerId: player.id, snapshotHash: hash, expiresAt } });
    await database.migrationRun.create({ data: { playerId: player.id, snapshotHash: hash, previewId: firstPreview.id, summary: {} } });
    await database.migrationRun.create({ data: { playerId: player.id, snapshotHash: hash, previewId: secondPreview.id, summary: {} } });
    expect(await database.migrationRun.count({ where: { playerId: player.id, snapshotHash: hash } })).toBe(2);
    await expect(database.migrationRun.create({ data: { playerId: player.id, snapshotHash: hash, previewId: firstPreview.id, summary: {} } })).rejects.toThrow();
    await expect(database.migrationRun.create({ data: { playerId: player.id, snapshotHash: hash, previewId: randomUUID(), summary: {} } })).rejects.toThrow();
  });
});
