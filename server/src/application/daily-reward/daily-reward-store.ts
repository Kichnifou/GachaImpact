import type { ElementKey } from '../../domain/economy/resources.js';
import type { DailyRewardClaimResult } from '../../domain/daily-reward/daily-reward.js';

export type DailyRewardClaimInput = Readonly<{
  playerId: string;
  playerElementKey: ElementKey;
  businessDate: string;
  claimedAt: Date;
  sourceChannel: 'UI';
}>;

export interface DailyRewardStore {
  isClaimed(playerId: string, businessDate: string): Promise<boolean>;
  claim(input: DailyRewardClaimInput): Promise<DailyRewardClaimResult>;
}
