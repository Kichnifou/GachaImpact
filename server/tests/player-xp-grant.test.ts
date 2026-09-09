import { describe, expect, it, vi } from 'vitest';
import { planPlayerXpGrant } from '../src/domain/player/xp-grant.js';
import type { PlayerProgressionState } from '../src/domain/player/player-progression.js';

const now = new Date('2026-09-09T08:00:00Z');
const fixedRandom = { nextInt: vi.fn(() => 0) };

function progression(xp: bigint, overflow = 0): PlayerProgressionState {
  return {
    xp,
    level100OverflowRewardsClaimed: overflow,
    totalMessages: 17n,
    countedMessages: 11n,
    lastXpAt: new Date('2026-09-08T08:00:00Z'),
    lastXpMessageAt: new Date('2026-09-08T07:00:00Z'),
  };
}

describe('central Player XP grant plan', () => {
  it('adds one cumulative XP without level reward and updates only global XP time', () => {
    const before = progression(12n);
    const result = planPlayerXpGrant(before, 1n, 'hydro', now, fixedRandom);
    expect(result).toMatchObject({ amount: 1n, levelsReached: [], overflowRewardsGranted: 0, rewards: [] });
    expect(result.stateAfter).toMatchObject({ xp: 13n, totalMessages: 17n, countedMessages: 11n, lastXpAt: now, lastXpMessageAt: before.lastXpMessageAt });
  });

  it('pays every crossed level and applies particle thresholds exactly', () => {
    const result = planPlayerXpGrant(progression(119n), 211n, 'hydro', now, fixedRandom);
    expect(result.levelsReached).toEqual([4, 5, 6, 7, 8, 9, 10, 11]);
    expect(result.rewards).toEqual([
      { resourceKey: 'primogems', amount: 6_400n },
      { resourceKey: 'moras', amount: 80_000n },
      { resourceKey: 'particles_hydro', amount: 560n },
      { resourceKey: 'particles_pyro', amount: 80n },
    ]);
    expect(fixedRandom.nextInt).toHaveBeenCalledWith(6);
  });

  it('reaches level 100, then pays each new overflow block without double payment', () => {
    const reachingMax = planPlayerXpGrant(progression(2_999n), 1n, 'hydro', now, fixedRandom);
    expect(reachingMax).toMatchObject({ levelsReached: [100], overflowRewardsGranted: 0 });

    const firstOverflow = planPlayerXpGrant(reachingMax.stateAfter, 30n, 'hydro', now, fixedRandom);
    expect(firstOverflow).toMatchObject({ levelsReached: [], overflowRewardsGranted: 1 });
    expect(firstOverflow.stateAfter.level100OverflowRewardsClaimed).toBe(1);

    const multiple = planPlayerXpGrant(progression(3_000n, 1), 90n, 'hydro', now, fixedRandom);
    expect(multiple.overflowRewardsGranted).toBe(2);
    expect(multiple.stateAfter.level100OverflowRewardsClaimed).toBe(3);
    expect(multiple.rewards).toContainEqual({ resourceKey: 'primogems', amount: 1_600n });

    const alreadyPaid = planPlayerXpGrant(progression(3_090n, 3), 1n, 'hydro', now, fixedRandom);
    expect(alreadyPaid).toMatchObject({ overflowRewardsGranted: 0, rewards: [] });
  });

  it('keeps bigint XP exact at high persisted values when no new overflow block is due', () => {
    const claimed = 2_000_000_000;
    const xp = 3_000n + 30n * BigInt(claimed) + 7n;
    const result = planPlayerXpGrant(progression(xp, claimed), 1n, 'hydro', now, fixedRandom);
    expect(result.stateAfter.xp).toBe(xp + 1n);
    expect(result.overflowRewardsGranted).toBe(0);
  });

  it('rejects zero and negative grants', () => {
    expect(() => planPlayerXpGrant(progression(0n), 0n, 'hydro', now, fixedRandom)).toThrow(RangeError);
    expect(() => planPlayerXpGrant(progression(0n), -1n, 'hydro', now, fixedRandom)).toThrow(RangeError);
  });
});
