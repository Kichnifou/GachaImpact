import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { MonthlyBossService } from '../src/application/combat/monthly-boss-service.js';

function setup(total: number) {
  const bosses = Array.from({ length: total }, (_, index) => ({
    id: randomUUID(),
    monthStart: new Date(Date.UTC(2098, 10 - index, 1)),
    nameSnapshot: `Boss ${index + 1}`,
    baseHp: 1_500_000n,
    hpVariationPercent: 0,
    maxHp: 1_500_000n,
    currentHp: 250_000n,
    resistanceElementKey: 'hydro',
    defeatedAt: null,
    finalBlowPlayerId: null,
    createdAt: new Date(Date.UTC(2098, 10 - index, 1)),
    finalBlowPlayer: null,
  }));
  const findMany = vi.fn(async ({ skip, take }: { skip: number; take: number }) => bosses.slice(skip, skip + take));
  const database = {
    monthlyBoss: { count: vi.fn(async () => total), findMany },
    playerBossParticipation: { findMany: vi.fn(async () => []) },
    bossAttack: { findMany: vi.fn(async () => []) },
  };
  const service = new MonthlyBossService({} as never, database as never, { now: () => new Date('2099-01-01T12:00:00Z') }, { nextInt: () => 0 });
  return { service, findMany };
}

describe('monthly Boss history pagination', () => {
  it.each([0, 1, 10])('projects a stable first page containing %s archived Bosses', async (total) => {
    const { service, findMany } = setup(total);
    const history = await service.getHistory(1);
    expect(history).toMatchObject({ page: 1, pageSize: 10, total, totalPages: 1 });
    expect(history.bosses).toHaveLength(total);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 10 }));
  });

  it('projects the eleventh Boss alone on page two with complete derived fields', async () => {
    const { service, findMany } = setup(11);
    const history = await service.getHistory(2);
    expect(history).toMatchObject({ page: 2, pageSize: 10, total: 11, totalPages: 2 });
    expect(history.bosses).toHaveLength(1);
    expect(history.bosses[0]).toMatchObject({ baseHp: 1_500_000n, maxHp: 1_500_000n, currentHp: 250_000n, status: 'FAILED', nextBaseAdjustment: -250_000n, community: { participantCount: 0, attackCount: 0n, totalDamage: 0n, averageDamage: 0n } });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10 }));
  });
});
