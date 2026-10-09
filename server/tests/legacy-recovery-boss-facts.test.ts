import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '../generated/prisma/client.js';
import { applyLegacyBoss } from '../src/application/migration/legacy-boss-apply.js';
import type { LegacyGlobalPlan } from '../src/application/migration/legacy-global-plan.js';
import { recoveryBossFacts } from '../src/application/migration/legacy-recovery-boss-facts.js';
import { parseStreamerbotSnapshot, snapshotFileNames } from '../src/application/migration/streamerbot-snapshot.js';

const importedAt = new Date('2026-10-09T10:00:00.000Z');
const now = new Date('2026-10-09T13:00:00.000Z');
const participant = (damage: number, attacks: number, highestHit: number, lastAttackDate: string) => ({ damage, attacks, highestHit, lastAttackDate });
function source() {
  const boss = (month: string, defeated: boolean, finalBlowBy: string, participants: Record<string, ReturnType<typeof participant>>) => {
    const totalDamage = Object.values(participants).reduce((sum, row) => sum + row.damage, 0);
    return { month, name: 'Synthetic monthly Boss', maxHp: 1_500_000, currentHp: 1_500_000 - totalDamage,
      resistance: 'pyro', defeated, createdAt: `${month}-01 07:00:00`,
      defeatedAt: defeated ? `${month}-${month === '2026-08' ? '27' : '16'} 20:00:00` : '', finalBlowBy,
      totalDamage, totalAttacks: Object.values(participants).reduce((sum, row) => sum + row.attacks, 0), rewardsDistributed: defeated, participants };
  };
  return { history: [boss('2026-08', true, 'hero', {
    hero: participant(900_000, 90, 10_000, '2026-08-27'), peer: participant(600_000, 60, 10_000, '2026-08-26'),
  }), boss('2026-09', true, 'peer', {
    hero: participant(400_000, 20, 20_000, '2026-09-15'), peer: participant(1_100_000, 55, 20_000, '2026-09-16'),
  })], currentBoss: boss('2026-10', false, '', {
    hero: participant(10_000, 2, 6_000, '2026-10-06'), peer: participant(20_000, 4, 8_000, '2026-10-06'),
  }), globalStats: { totalBossesGenerated: 3, totalBossesDefeated: 2, totalDamage: 3_030_000, totalAttacks: 231,
    highestHit: 20_000, highestHitPlayer: 'peer' } };
}
function fixture(boss = source(), stats: Record<string, unknown> = {}) {
  const files = Object.fromEntries(snapshotFileNames.map(name => [name, '{}']));
  files['monthly_boss.json'] = JSON.stringify(boss);
  files['viewers_data.json'] = JSON.stringify({ hero: { stats: { totalBossDamage: 1_000_000, totalBossAttacks: 100,
    bossesParticipated: 2, bossesDefeated: 1, totalBossFinalBlows: 0, highestBossHit: 10_000, lastBossParticipationMonth: '2026-10', ...stats } },
  quiet: { stats: {} }, peer: { stats: {} } });
  return parseStreamerbotSnapshot(files);
}

describe('source-only Boss recovery facts', () => {
  it('preserves the three independent source histories and derives R436 counters without attacks or payments', () => {
    const snapshot = fixture(), before = JSON.stringify(snapshot);
    const result = recoveryBossFacts(snapshot, ' Héro ', importedAt, now);
    expect(result.stats).toEqual({ totalDamage: 1_310_000n, totalAttacks: 112n, totalParticipated: 3n, totalRewarded: 2n, finalBlows: 1n, bestHit: 20_000n });
    expect(result.counts).toEqual({ bosses: 3, contributions: 3, distributedRewards: 2, finalBlows: 1, divergences: 6 });
    expect(result.facts).toMatchObject({ version: 1, source: 'monthly_boss.json', snapshotHash: snapshot.hash, legacyKey: 'hero', scope: 'SOURCE_HISTORY_ONLY' });
    expect(result.facts.instances[0]).toMatchObject({ month: '2026-08', defeated: true, currentHp: '0',
      createdAt: '2026-08-01T05:00:00.000Z', defeatedAt: '2026-08-27T18:00:00.000Z', contribution: {
        firstAttackAt: null, lastAttackAt: null, lastAttackDate: '2026-08-27', finalBlow: true,
        reward: { distributed: true, primogems: null, moras: null, awardedAt: null, operationId: null },
      } });
    expect(result.facts.instances[2]).toMatchObject({ defeated: false, currentHp: '1470000', defeatedAt: null, finalBlowLegacyKey: null,
      contribution: { reward: { distributed: false, primogems: null, moras: null, awardedAt: null, operationId: null } } });
    expect(() => JSON.stringify(result.facts)).not.toThrow();
    expect(JSON.stringify(result.facts)).not.toContain('bossId');
    expect(JSON.stringify(snapshot)).toBe(before);
    expect(recoveryBossFacts(snapshot, 'hero', importedAt, now)).toEqual(result);
  });

  it('uses a component-wise maximum for larger viewer minima, never an addition', () => {
    const result = recoveryBossFacts(fixture(source(), { totalBossDamage: 1_400_000, totalBossAttacks: 150, bossesParticipated: 4,
      bossesDefeated: 3, totalBossFinalBlows: 2, highestBossHit: 25_000 }), 'hero', importedAt, now);
    expect(result.stats).toEqual({ totalDamage: 1_400_000n, totalAttacks: 150n, totalParticipated: 4n, totalRewarded: 3n, finalBlows: 2n, bestHit: 25_000n });
    expect(result.counts.distributedRewards).toBe(2);
  });

  it('proves an empty profile without inventing participation or a reward', () => {
    const result = recoveryBossFacts(fixture(), 'quiet', importedAt, now);
    expect(result.stats).toEqual({ totalDamage: 0n, totalAttacks: 0n, totalParticipated: 0n, totalRewarded: 0n, finalBlows: 0n, bestHit: 0n });
    expect(result.counts).toEqual({ bosses: 3, contributions: 0, distributedRewards: 0, finalBlows: 0, divergences: 0 });
    expect(result.facts.instances.every(boss => boss.contribution === null)).toBe(true);
  });

  it('shares exactly the initial migration cumulative result', async () => {
    const snapshot = fixture();
    const create = vi.fn().mockResolvedValue({ id: 'synthetic-boss' });
    const stats = vi.fn();
    const tx = { monthlyBoss: { create }, bossLegacyAggregate: { create: vi.fn() }, playerBossParticipation: { create: vi.fn() },
      bossLegacyContribution: { create: vi.fn() }, bossReward: { create: vi.fn() }, migrationIssue: { create: vi.fn() }, playerBossStats: { create: stats } } as unknown as Prisma.TransactionClient;
    const viewer = (snapshot.sources['viewers_data.json'] as Record<string, Record<string, unknown>>).hero!;
    const plan = { players: [{ legacyUsername: 'hero', playerId: 'synthetic-player', viewer }] } as unknown as LegacyGlobalPlan;
    const applied = await applyLegacyBoss(tx, snapshot, plan, 'synthetic-batch');
    expect(applied).toMatchObject({ bosses: 3, participants: 3, rewards: 2, attacks: 0, operations: 0, divergences: 1 });
    expect(stats).toHaveBeenCalledExactlyOnceWith({ data: { playerId: 'synthetic-player', ...recoveryBossFacts(snapshot, 'hero', importedAt, now).stats } });
  });

  it('keeps source Boss identity stable across unrelated source-file changes', () => {
    const first = fixture(), second = { ...first, hash: 'f'.repeat(64) };
    expect(recoveryBossFacts(first, 'hero', importedAt, now).facts.instances.map(b => b.sourceBossKey))
      .toEqual(recoveryBossFacts(second, 'hero', importedAt, now).facts.instances.map(b => b.sourceBossKey));
  });

  it.each(['2026-10-09', '2026-10-10'])('rejects a last attack on or after the import business day: %s', day => {
    const data = source(); data.currentBoss.participants.hero!.lastAttackDate = day;
    expect(() => recoveryBossFacts(fixture(data), 'hero', importedAt, new Date('2026-10-10T13:00:00Z'))).toThrow('SOURCE_OVERLAP_UNPROVEN');
  });

  it('checks the Paris import day and isolates another participant’s overlap', () => {
    const data = source(); data.currentBoss.participants.hero!.lastAttackDate = '2026-10-08';
    data.currentBoss.participants.peer!.lastAttackDate = '2026-10-09';
    expect(() => recoveryBossFacts(fixture(data), 'hero', new Date('2026-10-08T22:30:00Z'), now)).not.toThrow();
    expect(() => recoveryBossFacts(fixture(data), 'peer', new Date('2026-10-08T22:30:00Z'), now)).toThrow('SOURCE_OVERLAP_UNPROVEN');
  });

  it('keeps a proven but unpaid victory blocked only for its contributors', () => {
    const data = source(); data.history[0]!.rewardsDistributed = false;
    expect(() => recoveryBossFacts(fixture(data), 'hero', importedAt, now)).toThrow('SOURCE_REWARD_UNRESOLVED');
    expect(() => recoveryBossFacts(fixture(data), 'quiet', importedAt, now)).not.toThrow();
  });

  it.each([
    ['duplicate month', (data: ReturnType<typeof source>) => { data.history.push(data.history[0]!); }, 'SOURCE_MONTH_DUPLICATE'],
    ['history newer than current', (data: ReturnType<typeof source>) => { data.history[0]!.month = '2026-11'; }, 'SOURCE_MONTH_ORDER'],
    ['normalized participant duplicate', (data: ReturnType<typeof source>) => { data.currentBoss.participants[' Héro '] = data.currentBoss.participants.hero!; }, 'SOURCE_KEY_DUPLICATE'],
    ['invalid calendar day', (data: ReturnType<typeof source>) => { data.currentBoss.participants.hero!.lastAttackDate = '2026-02-30'; }, 'SOURCE_DATE_INVALID'],
    ['invalid ISO calendar day', (data: ReturnType<typeof source>) => { data.currentBoss.createdAt = '2026-09-31T07:00:00Z'; }, 'SOURCE_DATE_INVALID'],
    ['ambiguous Paris instant', (data: ReturnType<typeof source>) => { data.currentBoss.createdAt = '2026-10-25 02:30:00'; }, 'SOURCE_DATE_INVALID'],
    ['attack before creation', (data: ReturnType<typeof source>) => { data.currentBoss.createdAt = '2026-10-07 07:00:00'; }, 'SOURCE_CONTRIBUTION_INVALID'],
    ['attack after defeat', (data: ReturnType<typeof source>) => { data.history[0]!.participants.hero!.lastAttackDate = '2026-08-28'; }, 'SOURCE_CONTRIBUTION_INVALID'],
    ['living Boss with rewards', (data: ReturnType<typeof source>) => { data.currentBoss.rewardsDistributed = true; }, 'SOURCE_LIFECYCLE_INVALID'],
    ['living Boss with defeat instant', (data: ReturnType<typeof source>) => { data.currentBoss.defeatedAt = '2026-10-06 20:00:00'; }, 'SOURCE_LIFECYCLE_INVALID'],
    ['defeated Boss still has HP', (data: ReturnType<typeof source>) => { data.history[0]!.currentHp = 1; }, 'SOURCE_LIFECYCLE_INVALID'],
    ['unknown final hitter', (data: ReturnType<typeof source>) => { data.history[0]!.finalBlowBy = 'unproven'; }, 'SOURCE_FINAL_BLOW_INVALID'],
    ['inconsistent contribution sums', (data: ReturnType<typeof source>) => { data.currentBoss.totalAttacks++; }, 'SOURCE_TOTALS_INVALID'],
    ['inconsistent HP', (data: ReturnType<typeof source>) => { data.currentBoss.currentHp++; }, 'SOURCE_TOTALS_INVALID'],
    ['inconsistent highest hit', (data: ReturnType<typeof source>) => { data.currentBoss.participants.hero!.highestHit = 1; }, 'SOURCE_CONTRIBUTION_INVALID'],
    ['inconsistent global sum', (data: ReturnType<typeof source>) => { data.globalStats.totalDamage++; }, 'SOURCE_GLOBAL_TOTALS_INVALID'],
    ['unproven global record holder', (data: ReturnType<typeof source>) => { data.globalStats.highestHitPlayer = 'unproven'; }, 'SOURCE_GLOBAL_TOTALS_INVALID'],
    ['unsafe number', (data: ReturnType<typeof source>) => { data.currentBoss.totalDamage = Number.MAX_SAFE_INTEGER + 1; }, 'SOURCE_INVALID'],
  ] as const)('rejects %s before providing counters', (_label, change, reason) => {
    const data = source(); change(data);
    expect(() => recoveryBossFacts(fixture(data), 'hero', importedAt, now)).toThrow(reason);
  });

  it.each([null, -1, '12', 1.2])('rejects malformed viewer counters %j', value => {
    expect(() => recoveryBossFacts(fixture(source(), { totalBossAttacks: value }), 'hero', importedAt, now)).toThrow('VIEWER_STATS_INVALID');
  });

  it('refuses ambiguous viewer keys, unknown current-month quota and invalid chronology', () => {
    const snapshot = fixture(), viewers = snapshot.sources['viewers_data.json'] as Record<string, unknown>;
    viewers[' Héro '] = viewers.hero;
    expect(() => recoveryBossFacts(snapshot, 'hero', importedAt, now)).toThrow('SOURCE_KEY_DUPLICATE');
    const unknown = fixture();
    (unknown.sources['viewers_data.json'] as Record<string, unknown>).quiet = { stats: { totalBossAttacks: 1, lastBossParticipationMonth: '2026-10' } };
    expect(() => recoveryBossFacts(unknown, 'quiet', importedAt, now)).toThrow('SOURCE_OVERLAP_UNPROVEN');
    expect(() => recoveryBossFacts(fixture(), 'hero', now, importedAt)).toThrow('INPUT_INVALID');
    expect(() => recoveryBossFacts(fixture(), 'hero', new Date('invalid'), now)).toThrow('INPUT_INVALID');
  });
});
