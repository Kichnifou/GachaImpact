import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { readTwitchBossContributions, readTwitchBossHistory } from '../src/application/combat/monthly-boss-archive-history.js';
import { MonthlyBossService } from '../src/application/combat/monthly-boss-service.js';
import { bossArchiveFixture } from '../tests/fixtures/monthly-boss-archive.js';

const isolated = isolatedBatchDatabase(), database = isolated.database;
const proof = bossArchiveFixture();
beforeAll(async () => {
  await isolated.setup({ prismaMigrations: true });
  for (const player of proof.players) await database.player.create({ data: { id: player.id, displayName: player.displayName, status: 'ACTIVE',
    twitchIdentity: { create: { twitchUserId: player.twitchIdentity.twitchUserId, login: 'fixture_' + player.id.replaceAll('-', '').slice(0,12) } } } });
  const summary = { kind: 'BOSS_HISTORY', state: 'APPLIED', sourceKey: proof.projected.sourceKey, facts: {
    source: { privateRawSourceMustNotCrossAPI: 'private-source-'.repeat(10000) },
    bindings: proof.projected.bindings.map(binding => ({ playerId: binding.playerId, twitchUserId: binding.twitchUserId, legacyKey: 'private-legacy-login',
      facts: { instances: binding.instances.map(instance => ({ ...instance, finalBlowLegacyKey: 'private-legacy-login' })) } })) } };
  await database.migrationBatch.create({ data: { id: proof.projected.id, snapshotHash: 'a'.repeat(64), status: 'COMPLETED', mode: 'CUTOVER',
    migratorVersion: 'r1063-shared-v1', summary } });
  // Filtered-out journals deliberately contain malformed payloads. They are not
  // approved source authority and must never be selected by the SQL projection.
  for (const override of [ { status: 'ANALYZING' }, { mode: 'REHEARSAL' }, { migratorVersion: 'other-version' },
    { summary: { kind: 'BOSS_HISTORY', state: 'ROLLED_BACK', sourceKey: 'b'.repeat(64) } } ])
    await database.migrationBatch.create({ data: { id: randomUUID(), snapshotHash: 'b'.repeat(64), status: 'COMPLETED', mode: 'CUTOVER',
      migratorVersion: 'r1063-shared-v1', summary: { kind: 'BOSS_HISTORY', state: 'APPLIED', sourceKey: randomUUID() }, ...override } });
  await database.monthlyBoss.create({ data: { monthStart: new Date('2026-09-01'), nameSnapshot: 'Native September',
    baseHp: 1500000n, hpVariationPercent: 0, maxHp: 1500000n, currentHp: 1269000n, resistanceElementKey: 'anemo' } });
}, 60_000);
afterAll(() => isolated.cleanup(), 60_000);

describe('Twitch Boss history PostgreSQL projection', () => {
  it('reads approved projected facts under PostgreSQL READ ONLY with all 27 contributions and no economic change', async () => {
    const before = await Promise.all([database.monthlyBoss.findMany(), database.playerBossStats.findMany(), database.bossAttack.findMany(),
      database.bossReward.findMany(), database.businessOperation.findMany(), database.player.findMany(), database.migrationBatch.findMany()]);
    await database.$transaction(async tx => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      const archives = await readTwitchBossHistory(tx as never);
      expect(archives.map(row => row.contributions.total)).toEqual([10, 9, 8]);
      expect(archives.flatMap(row => row.contributions.entries)).toHaveLength(27);
      const service = new MonthlyBossService({} as never, tx as never, { now: () => new Date('2026-10-09T15:00:00Z') }, { nextInt: () => { throw Error('No historical RNG'); } });
      const history = await service.getHistory(1);
      expect(history).toMatchObject({ total: 4, archiveStatus: 'AVAILABLE' });
      expect(history.bosses.map(row => row.origin)).toEqual(['TWITCH_ARCHIVE', 'NATIVE', 'TWITCH_ARCHIVE', 'TWITCH_ARCHIVE']);
      expect(history.bosses.find(row => row.origin === 'NATIVE')).toMatchObject({ currentHp: 1269000n, baseHp: 1500000n, resistanceElementKey: 'anemo', status: 'FAILED' });
      const page = await readTwitchBossContributions(tx as never, archives[0]!.id, 2);
      expect(page).toMatchObject({ page: 2, total: 10, entries: [] });
      const text = JSON.stringify(history, (_key, value) => typeof value === 'bigint' ? value.toString() : value);
      expect(text).not.toContain('private-source'); expect(text).not.toContain('private-legacy');
      expect(text).not.toContain(proof.players[0]!.twitchIdentity.twitchUserId);
    }, { isolationLevel: 'RepeatableRead', timeout: 30_000 });
    const after = await Promise.all([database.monthlyBoss.findMany(), database.playerBossStats.findMany(), database.bossAttack.findMany(),
      database.bossReward.findMany(), database.businessOperation.findMany(), database.player.findMany(), database.migrationBatch.findMany()]);
    expect(after).toEqual(before);
  });
});
