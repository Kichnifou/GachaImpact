export const XP_PER_LEVEL = 30n;
export const MAX_PLAYER_LEVEL = 100;
const MAX_LEVEL_XP = XP_PER_LEVEL * BigInt(MAX_PLAYER_LEVEL);

export type PlayerProgressionState = Readonly<{
  xp: bigint;
  level100OverflowRewardsClaimed: number;
  totalMessages: bigint;
  countedMessages: bigint;
  lastXpAt: Date | null;
  lastXpMessageAt: Date | null;
}>;

export type PlayerProgression = Readonly<{
  totalXp: bigint;
  level: number;
  xpIntoCurrentStep: bigint;
  xpPerStep: bigint;
  isMaxLevel: boolean;
  level100OverflowRewardsClaimed: number;
  totalMessages: bigint;
  countedMessages: bigint;
}>;

export function derivePlayerProgression(state: PlayerProgressionState): PlayerProgression {
  if (state.xp < 0n) {
    throw new RangeError('Player XP cannot be negative.');
  }

  const isMaxLevel = state.xp >= MAX_LEVEL_XP;
  const level = isMaxLevel ? MAX_PLAYER_LEVEL : Number(state.xp / XP_PER_LEVEL);
  const xpIntoCurrentStep = isMaxLevel
    ? (state.xp - MAX_LEVEL_XP) % XP_PER_LEVEL
    : state.xp % XP_PER_LEVEL;

  return {
    totalXp: state.xp,
    level,
    xpIntoCurrentStep,
    xpPerStep: XP_PER_LEVEL,
    isMaxLevel,
    level100OverflowRewardsClaimed: state.level100OverflowRewardsClaimed,
    totalMessages: state.totalMessages,
    countedMessages: state.countedMessages,
  };
}
