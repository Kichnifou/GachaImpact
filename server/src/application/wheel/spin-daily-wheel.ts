import { commandSource } from '../player/player-command-execution.js';
import { commandNow } from '../player/player-command-execution.js';
import type { PlayerExecutionActor } from '../player/player-execution-actor.js';
import { isElementKey } from '../../domain/economy/resources.js';
import { getBusinessDate, type Clock } from '../../domain/time/business-date.js';
import { selectWheelReward, type RandomSource, type WheelSpinResult } from '../../domain/wheel/wheel.js';
import { BusinessError } from '../errors.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';
import type { WheelStore } from './wheel-store.js';
import { SourceChannel } from '../../../generated/prisma/client.js';

export class SpinDailyWheel {
  public constructor(
    private readonly getCurrentPlayer: GetCurrentPlayer,
    private readonly store: WheelStore,
    private readonly clock: Clock,
    private readonly randomSource: RandomSource,
    private readonly sourceChannel: 'UI' | 'INTERNAL_CHAT' | 'TWITCH' = SourceChannel.UI,
  ) {}

  public async execute(identity: PlayerExecutionActor, idempotencyKey?: string): Promise<WheelSpinResult> {
    const player = await this.getCurrentPlayer.execute(identity);

    if (!player.elementKey || !isElementKey(player.elementKey)) {
      throw new BusinessError(
        'PLAYER_ELEMENT_REQUIRED',
        'A permanent element must be chosen before spinning the Wheel.',
      );
    }

    const now = commandNow(this.clock);

    return this.store.spin({
      playerId: player.id,
      businessDate: getBusinessDate(now),
      spunAt: now,
      sourceChannel: commandSource(this.sourceChannel),
      idempotencyKey,
      roll: () => selectWheelReward(this.randomSource.nextInt(100)),
    });
  }
}
