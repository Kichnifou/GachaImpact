export const DAILY_REWARDS = {
  primogems: 160n,
  mainElementParticles: 160n,
  moras: 10_000n,
} as const;

export type DailyRewardTodayState = Readonly<{
  claimed: boolean;
  businessDate: string;
  rewards: typeof DAILY_REWARDS;
}>;

export type DailyRewardClaimResult = DailyRewardTodayState & Readonly<{
  alreadyClaimed: boolean;
}>;
