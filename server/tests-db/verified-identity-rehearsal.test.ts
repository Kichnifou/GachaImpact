import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { assertLegacyAccountPreservation, readLegacyAccountProjection, seedLegacyAccountProjection, type AccountProjection } from './legacy-account-projection.js';
import { capturePrivateSchema, restorePrivateBackup, writePrivateBackup } from './private-schema-backup.js';
import { createVerifiedTwitchReport } from '../src/application/migration/verified-twitch-report.js';
import { buildLegacyGlobalPlan } from '../src/application/migration/legacy-global-plan.js';
import { parseStreamerbotSnapshot, snapshotFileNames } from '../src/application/migration/streamerbot-snapshot.js';
import { SnapshotPilotService } from '../src/application/migration/snapshot-pilot-service.js';
import { applyLegacyPersonalState, ensureLegacyCharacterAvatars } from '../src/application/migration/legacy-personal-apply.js';

const fixture = isolatedBatchDatabase();
const existingId = randomUUID(), unmatchedId = randomUUID();
const accounts: AccountProjection = {
  players: [
    { id: existingId, displayName: 'Private web nickname', elementKey: 'pyro', twitchUserId: '123', hasWebAccount: true },
    { id: unmatchedId, displayName: 'carla', elementKey: null, twitchUserId: null, hasWebAccount: true },
  ],
  identities: [{ playerId: existingId, twitchUserId: '123', login: 'alice_old', displayName: 'Old fixture name' }],
  preferences: [{ playerId: existingId, preferenceKey: 'menu.defaultTab', value: 'inventory' }],
  privacy: [{ playerId: existingId, categoryKey: 'CURRENCY_BALANCES', level: 'FRIENDS' }],
  roles: [{ playerId: existingId, role: 'TESTER', source: 'private-rehearsal' }],
};
beforeAll(async () => {
  await fixture.setup({ seedPublicCatalog: true });
  await fixture.database.$transaction(async tx => { await ensureLegacyCharacterAvatars(tx); await seedLegacyAccountProjection(tx, fixture.schema, accounts); });
}, 60_000);
afterAll(() => fixture.cleanup(), 60_000);

describe('verified report and existing accounts in an isolated PostgreSQL schema', () => {
  it('projects only account fields through a READ ONLY transaction, without auth subjects or credentials', async () => {
    const statements: string[] = [];
    const readonlyClient = { query: async (sql: string) => {
      statements.push(sql);
      if (sql.startsWith('SELECT')) expect((await fixture.admin.query('SHOW transaction_read_only')).rows[0].transaction_read_only).toBe('on');
      return fixture.admin.query(sql.replaceAll('public.', `"${fixture.schema}".`));
    } } as unknown as pg.Client;
    const result = await readLegacyAccountProjection(readonlyClient);
    expect(result.players).toHaveLength(2);
    expect(result.identities).toMatchObject([{ playerId: existingId, twitchUserId: '123' }]);
    expect(statements[0]).toContain('READ ONLY'); expect(statements.at(-1)).toBe('COMMIT');
    expect(statements.join(' ')).not.toMatch(/provider_subject|email|credentials|sessions|UPDATE|INSERT|DELETE/);
    await expect(seedLegacyAccountProjection(fixture.database, 'public', accounts)).rejects.toThrow('PRIVATE_SCHEMA');
  });
  it('reuses a verified renamed Player, creates Twitch-only without matching a web nickname, and proves rollback/restore/replay', async () => {
    const db = fixture.database;
    const files = Object.fromEntries(snapshotFileNames.map(name => [name, name === 'monthly_events.json' ? '' : '{}']));
    const viewer = { element: 'pyro', xp: 100, primogems: 120, moras: 80,
      particles: Object.fromEntries(['pyro','hydro','cryo','electro','anemo','geo','dendro'].map(key => [key, 0])),
      box: {}, team: [], savedTeams: {}, bank: { moras: 40 }, pity: { pity5: 3, pity4: 2 },
      dates: { lastXpDate: '2026-10-04' }, combat: {}, stats: { totalMessages: 1, countedMessages: 1, level100OverflowRewardsClaimed: 0 },
      guarantee: { guaranteedFeatured5: false }, expedition: { active: false }, favor: null,
      missions: { daily: null }, usedCodes: [], coffre: {}, specialItems: {} };
    files['viewers_data.json'] = JSON.stringify({ alice: viewer, carla: viewer });
    const snapshot = parseStreamerbotSnapshot(files), at = new Date('2026-10-04T20:02:33.000Z');
    const report = createVerifiedTwitchReport(snapshot, { users: [
      { legacyLogin: 'alice', twitchUserId: '123', currentLogin: 'alice_new', displayName: 'New fixture name', renamed: true },
      { legacyLogin: 'carla', twitchUserId: '456', currentLogin: 'carla', displayName: 'Carla fixture', renamed: false },
    ], missing: [], conflicts: [], duplicates: 0 });
    const plan = buildLegacyGlobalPlan(snapshot, report.users, accounts.players, new Set(), accounts.identities);
    expect(plan.issues.filter(row => row.severity === 'BLOCKER')).toEqual([]);
    expect(plan.players[0]!.playerId).toBe(existingId); expect(plan.players[1]!.playerId).not.toBe(unmatchedId);
    expect(plan.unmatchedWebPlayerIds).toEqual([unmatchedId]);
    const service = new SnapshotPilotService(db, {} as never, 'private-test');
    const mapped = await Promise.all(plan.players.map(player => service.globalPlayerPlan(player.playerId, player.legacyUsername, snapshot, at)));
    const before = await capturePrivateSchema(fixture.admin, fixture.schema), file = await writePrivateBackup(before, 'verified');
    const rollback = new Error('private rollback fixture');
    const execute = (fail: boolean) => db.$transaction(async tx => {
      const batch = await tx.migrationBatch.create({ data: { snapshotHash: snapshot.hash, mode: 'REHEARSAL', migratorVersion: 'verified-test' } });
      for (let index = 0; index < plan.players.length; index++) await applyLegacyPersonalState(tx, plan.players[index]!, mapped[index]!, batch.id, snapshot.hash, at);
      if (fail) throw rollback;
    }, { timeout: 60_000 });
    await expect(execute(true)).rejects.toBe(rollback);
    expect((await capturePrivateSchema(fixture.admin, fixture.schema)).hash).toBe(before.hash);
    await execute(false);
    await assertLegacyAccountPreservation(db, accounts, plan.players.map(row => row.playerId));
    const imported = await capturePrivateSchema(fixture.admin, fixture.schema), importedFile = await writePrivateBackup(imported, 'verified_imported');
    const summary = async () => ({ players: await db.player.count(), identities: await db.twitchIdentity.count(), runs: await db.migrationRun.count(),
      resources: (await db.playerResourceBalance.aggregate({ _sum: { amount: true } }))._sum.amount,
      operations: await db.businessOperation.count(), movements: await db.resourceMovement.count(), claims: await db.favorDailyClaim.count() });
    const first = await summary(); expect(first).toMatchObject({ players: 3, identities: 2, runs: 2, operations: 0, movements: 0, claims: 0 });
    expect(await db.twitchIdentity.findUnique({ where: { playerId: existingId } })).toMatchObject({ twitchUserId: '123', login: 'alice_new' });
    await restorePrivateBackup(fixture.admin, fixture.schema, file);
    await execute(false); expect(await summary()).toEqual(first);
    await restorePrivateBackup(fixture.admin, fixture.schema, importedFile);
    expect((await capturePrivateSchema(fixture.admin, fixture.schema)).hash).toBe(imported.hash);
  }, 120_000);
});
