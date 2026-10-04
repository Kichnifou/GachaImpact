import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { capturePrivateSchema, restorePrivateBackup, writePrivateBackup } from './private-schema-backup.js';
import { applyLegacyBoss } from '../src/application/migration/legacy-boss-apply.js';
import type { LegacyGlobalPlan } from '../src/application/migration/legacy-global-plan.js';
import { parseStreamerbotSnapshot, snapshotFileNames } from '../src/application/migration/streamerbot-snapshot.js';

const fixture = isolatedBatchDatabase();
beforeAll(() => fixture.setup({ seedPublicCatalog: true }), 60_000);
afterAll(() => fixture.cleanup(), 60_000);

describe('private technical backup and atomic restore', () => {
  it('rehearses a living 1,360,000 HP Boss in PostgreSQL without recalculating its source HP', async () => {
    const files = Object.fromEntries(snapshotFileNames.map(name => [name, name === 'monthly_events.json' ? '' : '{}']));
    files['monthly_boss.json'] = JSON.stringify({ currentBoss: { month: '2026-10', name: 'Private source Boss',
      maxHp: 1360000, currentHp: 1109050, resistance: 'pyro', defeated: false, defeatedAt: '',
      createdAt: '2026-10-01 07:51:31', totalDamage: 250950, totalAttacks: 7 } });
    const snapshot = parseStreamerbotSnapshot(files);
    const db = fixture.database;
    const batch = await db.migrationBatch.create({ data: { snapshotHash: snapshot.hash, mode: 'REHEARSAL', migratorVersion: 'private-backup-test' } });
    await db.$transaction(tx => applyLegacyBoss(tx, snapshot, { players: [] } as unknown as LegacyGlobalPlan, batch.id));
    const boss = await db.monthlyBoss.findFirstOrThrow({ include: { legacyAggregate: true } });
    expect(boss).toMatchObject({ baseHp: 1500000n, maxHp: 1360000n, currentHp: 1109050n, hpVariationPercent: -9, defeatedAt: null });
    expect(boss.legacyAggregate!.legacyProvenance).toMatchObject({ hpVariationPercentKnown: false, derivedHpVariationPercent: -9, maxHpSourceAuthoritative: true });
    expect(await db.bossAttack.count()).toBe(0);
    expect(await db.bossReward.count()).toBe(0);
    expect(await db.resourceMovement.count()).toBe(0);
  });
  it('restores exact int8, dates, JSON, sessions, accounts and claims in FK order', async () => {
    const db = fixture.database;
    const player = await db.player.create({ data: { displayName: 'Private restore fixture' } });
    await db.webIdentity.create({ data: { playerId: player.id, provider: 'fixture', providerSubject: randomUUID() } });
    await db.playerResourceBalance.create({ data: { playerId: player.id, resourceKey: 'moras', amount: 9223372036854775807n } });
    await db.playerPreference.create({ data: { playerId: player.id, preferenceKey: 'private.restore', value: { retained: true, nested: ['étoile'] } } });
    await db.playerSession.create({ data: { playerId: player.id, sessionTokenHash: randomBytes(32).toString('hex') } });
    const day = new Date('2026-10-04T00:00:00.000Z');
    await db.favorDailyClaim.create({ data: { playerId: player.id, businessDate: day, origin: 'LEGACY', legacyProvenance: { source: 'private-fixture' } } });
    const before = await capturePrivateSchema(fixture.admin, fixture.schema);
    const file = await writePrivateBackup(before, 'test');
    await db.playerResourceBalance.update({ where: { playerId_resourceKey: { playerId: player.id, resourceKey: 'moras' } }, data: { amount: 1n } });
    await db.playerSession.deleteMany();
    await db.favorDailyClaim.deleteMany();
    await db.player.create({ data: { displayName: 'Private temporary fixture' } });
    await restorePrivateBackup(fixture.admin, fixture.schema, file);
    expect((await capturePrivateSchema(fixture.admin, fixture.schema)).hash).toBe(before.hash);
    expect((await db.playerResourceBalance.findFirstOrThrow()).amount).toBe(9223372036854775807n);
    expect(await db.playerSession.count()).toBe(1);
    await expect(db.favorDailyClaim.create({ data: { playerId: player.id, businessDate: day, origin: 'LEGACY', legacyProvenance: { source: 'retry-fixture' } } })).rejects.toThrow();
    await expect(restorePrivateBackup(fixture.admin, 'public', file)).rejects.toThrow('isolated private schema');
    expect((await capturePrivateSchema(fixture.admin, fixture.schema)).hash).toBe(before.hash);
  }, 60_000);
});
