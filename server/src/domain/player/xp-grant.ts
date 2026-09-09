import { elementKeys, particleResourceKey, type ElementKey, type ResourceKey } from '../economy/resources.js';
import type { RandomSource } from '../wheel/wheel.js';
import { MAX_PLAYER_LEVEL, XP_PER_LEVEL, derivePlayerProgression, type PlayerProgressionState } from './player-progression.js';

export type XpReward = Readonly<{
  resourceKey: ResourceKey;
  amount: bigint;
}>;

export type PlayerXpGrantPlan = Readonly<{
  stateBefore: PlayerProgressionState;
  stateAfter: PlayerProgressionState;
  amount: bigint;
  levelsReached: readonly number[];
  overflowRewardsGranted: number;
  rewards: readonly XpReward[];
}>;

export function planPlayerXpGrant(
  state: PlayerProgressionState,
  amount: bigint,
  playerElementKey: ElementKey,
  now: Date,
  random: RandomSource,
): PlayerXpGrantPlan {
  if (amount <= 0n) throw new RangeError('An XP grant amount must be positive.');

  const before = derivePlayerProgression(state);
  const xpAfter = state.xp + amount;
  const after = derivePlayerProgression({ ...state, xp: xpAfter });
  const levelsReached = before.level < MAX_PLAYER_LEVEL
    ? Array.from({ length: after.level - before.level }, (_, index) => before.level + index + 1)
    : [];
  const theoreticalOverflow = xpAfter <= XP_PER_LEVEL * BigInt(MAX_PLAYER_LEVEL)
    ? 0
    : Number((xpAfter - XP_PER_LEVEL * BigInt(MAX_PLAYER_LEVEL)) / XP_PER_LEVEL);
  const overflowRewardsGranted = Math.max(0, theoreticalOverflow - state.level100OverflowRewardsClaimed);
  const rewardLevels = [...levelsReached, ...Array.from({ length: overflowRewardsGranted }, () => MAX_PLAYER_LEVEL)];
  const rewardTotals = new Map<ResourceKey, bigint>();

  for (const level of rewardLevels) {
    addReward(rewardTotals, 'primogems', 800n);
    addReward(rewardTotals, 'moras', 10_000n);
    if (level >= 5) addReward(rewardTotals, particleResourceKey(playerElementKey), 80n);
    if (level >= 10) {
      const otherElements = elementKeys.filter((element) => element !== playerElementKey);
      addReward(rewardTotals, particleResourceKey(otherElements[random.nextInt(otherElements.length)]!), 40n);
    }
  }

  return {
    stateBefore: state,
    stateAfter: {
      ...state,
      xp: xpAfter,
      level100OverflowRewardsClaimed: Math.max(state.level100OverflowRewardsClaimed, theoreticalOverflow),
      lastXpAt: now,
    },
    amount,
    levelsReached,
    overflowRewardsGranted,
    rewards: [...rewardTotals].map(([resourceKey, rewardAmount]) => ({ resourceKey, amount: rewardAmount })),
  };
}

function addReward(rewards: Map<ResourceKey, bigint>, resourceKey: ResourceKey, amount: bigint): void {
  rewards.set(resourceKey, (rewards.get(resourceKey) ?? 0n) + amount);
}
