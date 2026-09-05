import { describe, expect, it } from 'vitest';

import { derivePlayerProgression, type PlayerProgressionState } from '../src/domain/player/player-progression.js';

function state(xp: bigint): PlayerProgressionState {
  return {
    xp,
    level100OverflowRewardsClaimed: 0,
    totalMessages: 0n,
    countedMessages: 0n,
    lastXpAt: null,
    lastXpMessageAt: null,
  };
}

describe('Player progression derivation', () => {
  it.each([
    [0n, 0, 0n, false],
    [29n, 0, 29n, false],
    [30n, 1, 0n, false],
    [59n, 1, 29n, false],
    [60n, 2, 0n, false],
    [2_999n, 99, 29n, false],
    [3_000n, 100, 0n, true],
    [3_029n, 100, 29n, true],
    [6_001n, 100, 1n, true],
  ] as const)('derives %s XP without exceeding level 100', (xp, level, stepXp, isMaxLevel) => {
    expect(derivePlayerProgression(state(xp))).toMatchObject({
      totalXp: xp,
      level,
      xpIntoCurrentStep: stepXp,
      xpPerStep: 30n,
      isMaxLevel,
    });
  });
});
