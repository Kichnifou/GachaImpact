import { describe, expect, it } from 'vitest';

import { getEconomyEarnedIncrement } from '../src/application/economy/economy-stats.js';
import { getWheelStatsIncrement, selectWheelReward } from '../src/domain/wheel/wheel.js';

describe('Wheel probability table', () => {
  it.each([
    [0, 'nothing', null, null],
    [1, 'nothing', null, null],
    [2, 'particles', 'particles_pyro', 500n],
    [11, 'particles', 'particles_pyro', 500n],
    [12, 'particles', 'particles_hydro', 500n],
    [21, 'particles', 'particles_hydro', 500n],
    [22, 'particles', 'particles_cryo', 500n],
    [31, 'particles', 'particles_cryo', 500n],
    [32, 'particles', 'particles_electro', 500n],
    [41, 'particles', 'particles_electro', 500n],
    [42, 'particles', 'particles_anemo', 500n],
    [51, 'particles', 'particles_anemo', 500n],
    [52, 'particles', 'particles_geo', 500n],
    [61, 'particles', 'particles_geo', 500n],
    [62, 'particles', 'particles_dendro', 500n],
    [71, 'particles', 'particles_dendro', 500n],
    [72, 'moras', 'moras', 50_000n],
    [91, 'moras', 'moras', 50_000n],
    [92, 'primogems', 'primogems', 1_600n],
    [99, 'primogems', 'primogems', 1_600n],
  ] as const)('maps boundary roll %i correctly', (roll, resultType, resourceKey, amount) => {
    expect(selectWheelReward(roll)).toEqual({ resultType, resourceKey, amount });
  });

  it('covers exactly 100 integer outcomes with the validated distribution', () => {
    const rewards = Array.from({ length: 100 }, (_, roll) => selectWheelReward(roll));
    const count = (resultType: string) =>
      rewards.filter((reward) => reward.resultType === resultType).length;

    expect(count('nothing')).toBe(2);
    expect(count('particles')).toBe(70);
    expect(count('moras')).toBe(20);
    expect(count('primogems')).toBe(8);
  });

  it('rejects rolls outside the complete 0..99 interval', () => {
    expect(() => selectWheelReward(-1)).toThrow(RangeError);
    expect(() => selectWheelReward(100)).toThrow(RangeError);
    expect(() => selectWheelReward(1.5)).toThrow(RangeError);
  });

  it.each([
    [0, 0n],
    [2, 0n],
    [72, 0n],
    [92, 1n],
  ] as const)('increments spins once and jackpots only for roll %i', (roll, jackpots) => {
    expect(getWheelStatsIncrement(selectWheelReward(roll))).toEqual({
      totalSpins: 1n,
      totalJackpots: jackpots,
    });
  });
});

describe('economy earned counters', () => {
  it('increments Primogem and Mora earned totals for their rewards', () => {
    expect(getEconomyEarnedIncrement('primogems', 1_600n, 'hydro')).toEqual({
      totalPrimosEarned: 1_600n,
      totalMorasEarned: 0n,
      totalMainElementParticlesEarned: 0n,
    });
    expect(getEconomyEarnedIncrement('moras', 50_000n, 'hydro')).toEqual({
      totalPrimosEarned: 0n,
      totalMorasEarned: 50_000n,
      totalMainElementParticlesEarned: 0n,
    });
  });

  it('counts only personal-element particles in the existing historical counter', () => {
    expect(getEconomyEarnedIncrement('particles_hydro', 500n, 'hydro')).toMatchObject({
      totalMainElementParticlesEarned: 500n,
    });
    expect(getEconomyEarnedIncrement('particles_pyro', 500n, 'hydro')).toMatchObject({
      totalMainElementParticlesEarned: 0n,
    });
  });
});
