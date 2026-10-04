import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '../generated/prisma/client.js';
import { applyLegacyBoss, validateLegacyBossSnapshot } from '../src/application/migration/legacy-boss-apply.js';
import { parseStreamerbotSnapshot, snapshotFileNames } from '../src/application/migration/streamerbot-snapshot.js';
import type { LegacyGlobalPlan } from '../src/application/migration/legacy-global-plan.js';

const plan = { players: [] } as unknown as LegacyGlobalPlan;
const fixture = (defeated: boolean, defeatedAt: string | null) => {
  const files = Object.fromEntries(snapshotFileNames.map(name => [name, name === 'monthly_events.json' ? '' : '{}']));
  files['monthly_boss.json'] = JSON.stringify({ currentBoss: { month: '2026-10', name: 'Private Boss', maxHp: 1500000,
    currentHp: defeated ? 0 : 1500000, resistance: 'pyro', defeated, defeatedAt, createdAt: '2026-10-01 07:51:31', totalDamage: 0, totalAttacks: 0 } });
  return parseStreamerbotSnapshot(files);
};

describe('legacy living Boss lifecycle', () => {
  it.each(['', null])('imports an untriggered defeat marker %j as null without attacks or rewards', async marker => {
    const create = vi.fn().mockResolvedValue({ id: 'private-boss' });
    const aggregate = vi.fn();
    const tx = { monthlyBoss: { create }, bossLegacyAggregate: { create: aggregate } } as unknown as Prisma.TransactionClient;
    expect(await applyLegacyBoss(tx, fixture(false, marker), plan, 'private-batch')).toMatchObject({ bosses: 1, attacks: 0, operations: 0, rewards: 0 });
    expect(create.mock.calls[0]![0].data.defeatedAt).toBeNull();
    expect(create.mock.calls[0]![0].data.createdAt).toBeInstanceOf(Date);
  });
  it.each([[true, ''], [false, '2026-10-02 12:00:00']])('blocks inconsistent defeat facts (%j, %j)', async (defeated, marker) => {
    await expect(applyLegacyBoss({} as Prisma.TransactionClient, fixture(defeated as boolean, marker as string), plan, 'private-batch')).rejects.toThrow('lifecycle timestamp');
  });
  it('preserves 1,360,000 source HP with derived -9 metadata, without applying native R449 retroactively', async () => {
    const snapshot = fixture(false, '');
    (snapshot.sources['monthly_boss.json'] as { currentBoss: { maxHp: number; currentHp: number } }).currentBoss = {
      ...(snapshot.sources['monthly_boss.json'] as { currentBoss: { maxHp: number; currentHp: number } }).currentBoss,
      maxHp: 1360000, currentHp: 1109050,
    };
    const create = vi.fn().mockResolvedValue({ id: 'private-boss' });
    const aggregate = vi.fn();
    expect(() => validateLegacyBossSnapshot(snapshot)).not.toThrow();
    await applyLegacyBoss({ monthlyBoss: { create }, bossLegacyAggregate: { create: aggregate } } as unknown as Prisma.TransactionClient, snapshot, plan, 'private-batch');
    expect(create.mock.calls[0]![0].data).toMatchObject({ baseHp: 1500000n, maxHp: 1360000n, currentHp: 1109050n, hpVariationPercent: -9 });
    expect(aggregate.mock.calls[0]![0].data.legacyProvenance).toMatchObject({ hpVariationPercentKnown: false, derivedHpVariationPercent: -9, maxHpSourceAuthoritative: true });
  });
});
