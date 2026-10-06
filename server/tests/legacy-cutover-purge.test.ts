import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../generated/prisma/client.js';
import { applyPrivateCutoverPurge, buildCutoverPurgePlan, clearTables, preservedTables, referenceTables } from '../src/application/migration/legacy-cutover-purge.js';

function database(extra: string[] = [], fks: { child: string; parent: string }[] = []) {
  const query = vi.fn(async (sql: string) => sql.includes('pg_tables')
    ? [...referenceTables, ...preservedTables, ...clearTables, ...extra].map(tablename => ({ tablename }))
    : sql.includes('pg_constraint') ? fks : [{ count: 1n }]);
  return { $queryRawUnsafe: query, $executeRawUnsafe: vi.fn(), twitchNativeTarget: { findMany: vi.fn(async () => []) } } as unknown as PrismaClient;
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
});
