import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import { DAILY_REWARDS, type DailyRewardTodayState } from '../../domain/daily-reward/daily-reward.js';
import { getBusinessDate, type Clock } from '../../domain/time/business-date.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';
import type { DailyRewardStore } from './daily-reward-store.js';

export class GetTodayDailyReward {
  public constructor(private readonly getCurrentPlayer: GetCurrentPlayer, private readonly store: DailyRewardStore, private readonly clock: Clock) {}

  public async execute(identity: AuthenticatedIdentity): Promise<DailyRewardTodayState> {
    const player = await this.getCurrentPlayer.execute(identity);
    const businessDate = getBusinessDate(this.clock.now());
    return { claimed: await this.store.isClaimed(player.id, businessDate), businessDate, rewards: DAILY_REWARDS };
  }
}
