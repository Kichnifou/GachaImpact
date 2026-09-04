import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import { getBusinessDate, type Clock } from '../../domain/time/business-date.js';
import type { WheelTodayState } from '../../domain/wheel/wheel.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';
import type { WheelStore } from './wheel-store.js';

export class GetTodayWheelState {
  public constructor(
    private readonly getCurrentPlayer: GetCurrentPlayer,
    private readonly store: WheelStore,
    private readonly clock: Clock,
  ) {}

  public async execute(identity: AuthenticatedIdentity): Promise<WheelTodayState> {
    const player = await this.getCurrentPlayer.execute(identity);
    const businessDate = getBusinessDate(this.clock.now());
    const persistedResult = await this.store.findByDate(player.id, businessDate);

    return {
      spun: persistedResult !== null,
      businessDate,
      result: persistedResult
        ? {
            resultType: persistedResult.resultType,
            resourceKey: persistedResult.resourceKey,
            amount: persistedResult.amount,
          }
        : null,
    };
  }
}
