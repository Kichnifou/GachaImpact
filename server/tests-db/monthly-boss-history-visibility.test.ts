import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { MonthlyBossService } from '../src/application/combat/monthly-boss-service.js';
import { bossArchiveFixture } from '../tests/fixtures/monthly-boss-archive.js';

// Owner-approved public instance, independently asserted here rather than
// imported from the implementation so a broadened production filter fails.
const hiddenId = '9e9caa8e-f94c-457c-ad0d-af83e69ad76e';
const hiddenMonth = new Date('2026-09-01T00:00:00Z');
const alternateId = randomUUID();
const isolated = isolatedBatchDatabase(), database = isolated.database;
const proof = bossArchiveFixture();
const playerId = proof.players[0]!.id;
const ordinary = Array.from({ length: 12 }, (_, index) => ({ id: randomUUID(), monthStart: new Date(Date.UTC(2025, 8 + index, 1)) }));
const archiveSummary = { kind: 'BOSS_HISTORY', state: 'APPLIED', sourceKey: proof.projected.sourceKey, facts: {
  bindings: proof.projected.bindings.map(binding => ({ playerId: binding.playerId, twitchUserId: binding.twitchUserId,
    facts: { instances: binding.instances } })) } };

const snapshot = () => Promise.all([
  database.monthlyBoss.findMany({ orderBy: { id: 'asc' } }),
  database.bossAttack.findMany({ orderBy: { id: 'asc' } }),
  database.bossAttackMember.findMany({ orderBy: [{ attackId: 'asc' }, { position: 'asc' }] }),
  database.playerBossParticipation.findMany({ orderBy: [{ bossId: 'asc' }, { playerId: 'asc' }] }),
  database.playerBossStats.findMany({ orderBy: { playerId: 'asc' } }),
  database.bossReward.findMany({ orderBy: [{ bossId: 'asc' }, { playerId: 'asc' }] }),
  database.businessOperation.findMany({ orderBy: { id: 'asc' } }),
  database.resourceMovement.findMany({ orderBy: { id: 'asc' } }),
  database.migrationBatch.findMany({ orderBy: { id: 'asc' } }),
  database.player.findMany({ orderBy: { id: 'asc' } }),
  database.twitchIdentity.findMany({ orderBy: { playerId: 'asc' } }),
]);

beforeAll(async () => {
  await isolated.setup({ prismaMigrations: true });
  for (const player of proof.players) await database.player.create({ data: {
    id: player.id, displayName: player.displayName, status: 'ACTIVE', twitchIdentity: { create: {
      twitchUserId: player.twitchIdentity.twitchUserId, login: 'visibility_' + player.id.replaceAll('-', '').slice(0, 12),
    } },
  } });
  const shape = { nameSnapshot: 'Native visibility fixture', baseHp: 1_500_000n, hpVariationPercent: 0,
    maxHp: 1_500_000n, currentHp: 1_500_000n, resistanceElementKey: 'anemo' };
  await database.monthlyBoss.createMany({ data: [
    ...ordinary.map(row => ({ ...shape, ...row })),
    { ...shape, id: hiddenId, monthStart: hiddenMonth, currentHp: 1_269_000n },
    { ...shape, monthStart: new Date('2026-10-01T00:00:00Z') },
  ] });
  const attackOperations = Array.from({ length: 30 }, (_, index) => ({ id: randomUUID(), playerId,
    operationType: 'monthly-boss.attack', sourceChannel: 'UI' as const, status: 'COMPLETED' as const,
    idempotencyKey: `visibility-attack:${index}`, completedAt: new Date(Date.UTC(2026, 8, index + 1, 12)),
  }));
  await database.businessOperation.createMany({ data: attackOperations });
  await database.bossAttack.createMany({ data: attackOperations.map(operation => ({ bossId: hiddenId, playerId,
    operationId: operation.id, businessDate: operation.completedAt, createdAt: operation.completedAt, damage: 7_700n,
  })) });
  await database.playerBossParticipation.create({ data: { bossId: hiddenId, playerId, totalDamage: 231_000n,
    attackCount: 30n, bestHit: 7_700n, firstAttackAt: attackOperations[0]!.completedAt, lastAttackAt: attackOperations[29]!.completedAt,
  } });
  await database.playerBossStats.create({ data: { playerId, totalDamage: 231_000n, totalAttacks: 30n,
    totalParticipated: 1n, totalRewarded: 1n, bestHit: 7_700n } });
  const rewardedBoss = ordinary[11]!;
  const awardedAt = new Date('2026-08-25T12:00:00Z');
  await database.monthlyBoss.update({ where: { id: rewardedBoss.id }, data: {
    currentHp: 0n, defeatedAt: awardedAt, finalBlowPlayerId: playerId,
  } });
  const rewardOperation = await database.businessOperation.create({ data: { playerId, operationType: 'monthly-boss.reward',
    sourceChannel: 'SYSTEM', status: 'COMPLETED', idempotencyKey: 'visibility-reward', completedAt: awardedAt,
  } });
  await database.bossReward.create({ data: { bossId: rewardedBoss.id, playerId, primogems: 100n, moras: 500n,
    operationId: rewardOperation.id, awardedAt,
  } });
  await database.migrationBatch.create({ data: { id: proof.projected.id, snapshotHash: 'a'.repeat(64), status: 'COMPLETED',
    mode: 'REHEARSAL', migratorVersion: 'r1063-shared-v1', summary: archiveSummary,
  } });
}, 60_000);

beforeEach(async () => {
  await database.monthlyBoss.deleteMany({ where: { id: alternateId } });
  await database.monthlyBoss.update({ where: { id: hiddenId }, data: {
    monthStart: hiddenMonth, currentHp: 1_269_000n, defeatedAt: null, finalBlowPlayerId: null,
  } });
  await database.migrationBatch.update({ where: { id: proof.projected.id }, data: { mode: 'REHEARSAL', summary: archiveSummary } });
});
afterAll(() => isolated.cleanup(), 60_000);

async function readPages(archiveStatus: 'AVAILABLE' | 'NONE' | 'UNAVAILABLE', total: number) {
  const before = await snapshot();
  const pages = await database.$transaction(async transaction => {
    await transaction.$executeRaw`SET TRANSACTION READ ONLY`;
    const service = new MonthlyBossService({} as never, transaction as never,
      { now: () => new Date('2026-10-09T15:00:00Z') }, { nextInt: () => { throw Error('History must never use RNG'); } });
    return [await service.getHistory(1), await service.getHistory(2), await service.getHistory(3)];
  }, { isolationLevel: 'RepeatableRead', timeout: 30_000 });
  expect(await snapshot()).toEqual(before);
  for (const [index, page] of pages.entries()) {
    expect(page).toMatchObject({ page: index + 1, pageSize: 10, total, totalPages: Math.ceil(total / 10), archiveStatus });
    expect(page.bosses).toHaveLength(Math.max(0, Math.min(10, total - index * 10)));
  }
  const entries = pages.flatMap(page => page.bosses);
  expect(new Set(entries.map(row => row.id)).size).toBe(total);
  expect(entries.map(row => row.monthStart)).toEqual(entries.map(row => row.monthStart).sort().reverse());
  expect(await database.bossAttack.count({ where: { bossId: hiddenId } })).toBe(30);
  expect(await database.bossReward.count()).toBe(1);
  expect(await database.resourceMovement.count()).toBe(0);
  return entries;
}

describe('owner-approved native Boss history visibility in PostgreSQL', () => {
  it('excludes only the exact failed instance before combined count and pagination with verified archives', async () => {
    await database.migrationBatch.update({ where: { id: proof.projected.id }, data: { mode: 'CUTOVER' } });
    const entries = await readPages('AVAILABLE', 15);
    expect(entries.some(row => row.id === hiddenId)).toBe(false);
    expect(entries.filter(row => row.origin === 'NATIVE').map(row => row.id)).toEqual([...ordinary].reverse().map(row => row.id));
    expect(entries.filter(row => row.origin === 'TWITCH_ARCHIVE').map(row => row.monthStart)).toEqual(['2026-10-01', '2026-09-01', '2026-08-01']);
    expect(entries.find(row => row.origin === 'TWITCH_ARCHIVE' && row.monthStart === '2026-09-01')).toMatchObject({
      status: 'DEFEATED', contributions: { total: 9 },
    });
  });

  it('applies the same exact exclusion to native count and full pages when archives are absent', async () => {
    const entries = await readPages('NONE', 12);
    expect(entries.map(row => row.id)).toEqual([...ordinary].reverse().map(row => row.id));
    expect(entries.find(row => row.monthStart === '2026-07-01')).toMatchObject({ origin: 'NATIVE', status: 'FAILED' });
  });

  it('retains native pagination and the exact exclusion when an approved archive proof is malformed', async () => {
    await database.migrationBatch.update({ where: { id: proof.projected.id }, data: { mode: 'CUTOVER',
      summary: { kind: 'BOSS_HISTORY', state: 'APPLIED', sourceKey: proof.projected.sourceKey, facts: { bindings: 'invalid' } },
    } });
    const entries = await readPages('UNAVAILABLE', 12);
    expect(entries.map(row => row.id)).toEqual([...ordinary].reverse().map(row => row.id));
  });

  it('keeps another failed instance ID in September visible', async () => {
    await database.monthlyBoss.update({ where: { id: hiddenId }, data: { monthStart: new Date('2026-11-01') } });
    await database.monthlyBoss.create({ data: { id: alternateId, monthStart: hiddenMonth, nameSnapshot: 'Other native September',
      baseHp: 1_500_000n, hpVariationPercent: 0, maxHp: 1_500_000n, currentHp: 1_269_000n, resistanceElementKey: 'anemo',
    } });
    const entries = await readPages('NONE', 13);
    expect(entries[0]).toMatchObject({ id: alternateId, monthStart: '2026-09-01', status: 'FAILED' });
  });

  it('keeps the same instance ID visible if it is defeated', async () => {
    await database.monthlyBoss.update({ where: { id: hiddenId }, data: { currentHp: 0n,
      defeatedAt: new Date('2026-09-30T13:00:00Z'), finalBlowPlayerId: playerId,
    } });
    const entries = await readPages('NONE', 13);
    expect(entries[0]).toMatchObject({ id: hiddenId, monthStart: '2026-09-01', status: 'DEFEATED' });
  });

  it('keeps the same failed instance ID visible when its month differs', async () => {
    await database.monthlyBoss.update({ where: { id: hiddenId }, data: { monthStart: new Date('2025-08-01') } });
    const entries = await readPages('NONE', 13);
    expect(entries.at(-1)).toMatchObject({ id: hiddenId, monthStart: '2025-08-01', status: 'FAILED' });
  });
});
