import { describe, expect, it } from 'vitest';
import { calculateBossDamage, calculateBossMaxHp, calculateNextBossBase, getBusinessMonth, monthlyBossName } from '../src/domain/combat/monthly-boss.js';

describe('monthly Boss domain', () => {
  it('uses the Europe/Paris calendar month, including the UTC boundary', () => {
    expect(getBusinessMonth(new Date('2026-08-31T21:59:59Z'))).toBe('2026-08-01');
    expect(getBusinessMonth(new Date('2026-08-31T22:00:00Z'))).toBe('2026-09-01');
    expect(monthlyBossName('2026-09-01')).toBe('Seigneur des Ruines Oubliées');
  });

  it.each([[-15, 1_280_000n], [0, 1_500_000n], [15, 1_730_000n]] as const)('applies variation %s and rounds to the nearest 10,000', (variation, expected) => {
    expect(calculateBossMaxHp(1_500_000n, variation)).toBe(expected);
  });

  it('calculates each rarity and constellation contribution with resistance', () => {
    const result = calculateBossDamage([
      { id: 'four', name: 'Four', rarity: 4, constellation: 6, elementKey: 'pyro' },
      { id: 'five', name: 'Five', rarity: 5, constellation: 6, elementKey: 'hydro' },
    ], 'pyro');
    expect(result.contributions[0]).toMatchObject({ damageBeforeResistance: 1_400n, resistanceApplied: true, damage: 700n });
    expect(result.contributions[1]).toMatchObject({ damageBeforeResistance: 4_900n, resistanceApplied: false, damage: 4_900n });
    expect(result.totalDamage).toBe(5_600n);
  });

  it('raises the next base by remaining post-victory calendar days and caps the monthly increase', () => {
    expect(calculateNextBossBase({ baseHp: 1_500_000n, currentHp: 0n, monthStart: '2026-09-01', defeatedAt: new Date('2026-09-20T12:00:00Z') })).toEqual({ baseHp: 2_250_000n, adjustment: 750_000n });
    expect(calculateNextBossBase({ baseHp: 1_500_000n, currentHp: 0n, monthStart: '2026-01-01', defeatedAt: new Date('2026-01-01T12:00:00Z') })).toEqual({ baseHp: 3_000_000n, adjustment: 1_500_000n });
  });

  it('reduces a surviving Boss base by the HP left, with a 500,000 minimum and no maximum', () => {
    expect(calculateNextBossBase({ baseHp: 5_000_000n, currentHp: 1_200_000n, monthStart: '2026-09-01', defeatedAt: null })).toEqual({ baseHp: 3_800_000n, adjustment: -1_200_000n });
    expect(calculateNextBossBase({ baseHp: 800_000n, currentHp: 700_000n, monthStart: '2026-09-01', defeatedAt: null })).toEqual({ baseHp: 500_000n, adjustment: -300_000n });
  });
});
