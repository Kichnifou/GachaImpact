import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import { isElementKey } from '../../domain/economy/resources.js';
import type { DailyRewardClaimResult } from '../../domain/daily-reward/daily-reward.js';
import { getBusinessDate, type Clock } from '../../domain/time/business-date.js';
import { BusinessError } from '../errors.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';
import type { DailyRewardStore } from './daily-reward-store.js';

export class ClaimDailyReward {
  public constructor(private readonly getCurrentPlayer: GetCurrentPlayer, private readonly store: DailyRewardStore, private readonly clock: Clock) {}

  public async execute(identity: AuthenticatedIdentity): Promise<DailyRewardClaimResult> {
    const player = await this.getCurrentPlayer.execute(identity);
    if (!player.elementKey || !isElementKey(player.elementKey)) {
      throw new BusinessError('PLAYER_ELEMENT_REQUIRED', 'A permanent element is required to claim the daily reward.');
    }
    const now = this.clock.now();
    return this.store.claim({ playerId: player.id, playerElementKey: player.elementKey, businessDate: getBusinessDate(now), claimedAt: now, sourceChannel: 'UI' });
  }
}
