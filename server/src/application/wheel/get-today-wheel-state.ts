import { commandNow } from '../player/player-command-execution.js';
import type { PlayerExecutionActor } from '../player/player-execution-actor.js';
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

  public async execute(identity: PlayerExecutionActor): Promise<WheelTodayState> {
    const player = await this.getCurrentPlayer.execute(identity);
    const businessDate = getBusinessDate(commandNow(this.clock));
    return this.store.getDailyState(player.id, businessDate);
  }
}
