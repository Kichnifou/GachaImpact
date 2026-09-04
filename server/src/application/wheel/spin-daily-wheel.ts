import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import { isElementKey } from '../../domain/economy/resources.js';
import { getBusinessDate, type Clock } from '../../domain/time/business-date.js';
import { selectWheelReward, type RandomSource, type WheelSpinResult } from '../../domain/wheel/wheel.js';
import { BusinessError } from '../errors.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';
import type { WheelStore } from './wheel-store.js';

export class SpinDailyWheel {
  public constructor(
    private readonly getCurrentPlayer: GetCurrentPlayer,
    private readonly store: WheelStore,
    private readonly clock: Clock,
    private readonly randomSource: RandomSource,
  ) {}

  public async execute(identity: AuthenticatedIdentity): Promise<WheelSpinResult> {
    const player = await this.getCurrentPlayer.execute(identity);

    if (!player.elementKey || !isElementKey(player.elementKey)) {
      throw new BusinessError(
        'PLAYER_ELEMENT_REQUIRED',
        'A permanent element must be chosen before spinning the Wheel.',
      );
    }

    const now = this.clock.now();

    return this.store.spin({
      playerId: player.id,
      businessDate: getBusinessDate(now),
      spunAt: now,
      sourceChannel: 'UI',
      roll: () => selectWheelReward(this.randomSource.nextInt(100)),
    });
  }
}
