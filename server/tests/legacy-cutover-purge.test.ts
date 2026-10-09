import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../generated/prisma/client.js';
import { applyPrivateCutoverPurge, buildCutoverPurgePlan, clearTables, preservedTables, referenceTables } from '../src/application/migration/legacy-cutover-purge.js';

function database(extra: string[] = [], fks: { child: string; parent: string }[] = [], proofs = { plans: 0, legacyRelations: 0 }) {
  const query = vi.fn(async (sql: string) => sql.includes('pg_tables')
    ? [...referenceTables, ...preservedTables, ...clearTables, ...extra].map(tablename => ({ tablename }))
    : sql.includes('pg_constraint') ? fks : [{ count: 1n }]);
  return { $queryRawUnsafe: query, $executeRawUnsafe: vi.fn(), twitchLinkResolution: { findMany: vi.fn(async () => []) }, twitchNativeTarget: { findMany: vi.fn(async () => []) },
    externalBannerVote: { count: vi.fn(async () => 0) },
    twitchCanonicalizationPlan: { count: vi.fn(async () => proofs.plans) }, friendship: { count: vi.fn(async () => proofs.legacyRelations) } } as unknown as PrismaClient;
}

describe('exhaustive cutover purge contract', () => {
  it('classifies current Arcade/Giveaway gameplay and preserves operational credentials', async () => {
    const plan = await buildCutoverPurgePlan(database(), 'batch_test_' + 'a'.repeat(32));
    expect(plan.deleteOrder.map(row => row.table)).toEqual(expect.arrayContaining(['arcade_sessions', 'arcade_daily_grants', 'giveaway_command_receipts', 'giveaway_rewards']));
    expect(plan.deleteOrder.some(row => row.table.endsWith('_credentials'))).toBe(false);
    expect(preservedTables).toEqual(expect.arrayContaining(['twitch_gift_supreme_credentials', 'twitch_giveaway_credentials']));
  });
  it('blocks unclassified tables before any deletion', async () => {
    const db = database(['future_gameplay']);
    await expect(buildCutoverPurgePlan(db, 'private_schema')).rejects.toThrow('future_gameplay');
    expect(db.$executeRawUnsafe).not.toHaveBeenCalled();
  });
  it.each(['operator plan', 'versioned legacy relationship'] as const)('refuses purge planning when a protected %s exists', async proof => {
    const db = database([], [], { plans: proof === 'operator plan' ? 1 : 0, legacyRelations: proof === 'versioned legacy relationship' ? 1 : 0 });
    await expect(buildCutoverPurgePlan(db, 'batch_test_' + 'b'.repeat(32))).rejects.toThrow('CUTOVER_OPERATOR_RELATION_PROOFS_PRESENT');
    expect(db.twitchCanonicalizationPlan.count).toHaveBeenCalledExactlyOnceWith();
    if (proof === 'versioned legacy relationship') expect(db.friendship.count).toHaveBeenCalledExactlyOnceWith({ where: { legacyFactId: { not: null } } });
    expect(db.$executeRawUnsafe).not.toHaveBeenCalled();
    expect(preservedTables).toEqual(expect.arrayContaining(['twitch_canonicalization_plans', 'legacy_friendship_facts']));
    expect(clearTables).not.toEqual(expect.arrayContaining(['twitch_canonicalization_plans']));
    expect(clearTables).not.toEqual(expect.arrayContaining(['legacy_friendship_facts']));
  });
  it('orders children first and blocks dependencies from preserved tables', async () => {
    const plan = await buildCutoverPurgePlan(database([], [{ child: 'arcade_receipts', parent: 'business_operations' }]), 'private_schema');
    const names = plan.deleteOrder.map(row => row.table);
    expect(names.indexOf('arcade_receipts')).toBeLessThan(names.indexOf('business_operations'));
    await expect(buildCutoverPurgePlan(database([], [{ child: 'players', parent: 'arcade_sessions' }]), 'private_schema')).rejects.toThrow('Preserved table');
  });
  it('has no public purge path', async () => {
    const db = database();
    const plan = await buildCutoverPurgePlan(db, 'public');
    await expect(applyPrivateCutoverPurge(db, plan)).rejects.toThrow('Public cutover mutation is unavailable');
    expect(db.$executeRawUnsafe).not.toHaveBeenCalled();
  });
  it('retains external ballot proof by refusing the unreviewed global purge', async () => {
    const db = database();
    vi.mocked(db.externalBannerVote.count).mockResolvedValue(3);
    await expect(buildCutoverPurgePlan(db, 'batch_test_' + 'c'.repeat(32))).rejects.toThrow('CUTOVER_LEGACY_VOTE_PROOFS_PRESENT');
    expect(db.$executeRawUnsafe).not.toHaveBeenCalled();
  });
});
