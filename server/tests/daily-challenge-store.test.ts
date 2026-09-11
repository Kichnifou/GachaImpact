import { describe, expect, it } from 'vitest';
import { DAILY_CHALLENGE_MAX_COST, nextDailyChallengeSwitchCost } from '../src/application/daily-challenge/daily-challenge-store.js';

describe('daily challenge switch pricing', () => {
  it('starts at 20,000 Moras and doubles for each prior switch', () => {
    expect([0, 1, 2, 3].map(nextDailyChallengeSwitchCost)).toEqual([20_000n, 40_000n, 80_000n, 160_000n]);
  });

  it('saturates safely instead of overflowing PostgreSQL bigint', () => {
    expect(nextDailyChallengeSwitchCost(100)).toBe(DAILY_CHALLENGE_MAX_COST);
  });
});
