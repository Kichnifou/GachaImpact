import { commandKey } from '../player/player-command-execution.js';
import type { PlayerExecutionActor } from '../player/player-execution-actor.js';
import { isElementKey, type ElementKey } from '../../domain/economy/resources.js';
import { BusinessError } from '../errors.js';
import type { GetCurrentPlayer } from './get-current-player.js';
import type { PlayerElementStore } from './player-element-store.js';

export type ChoosePlayerElementResult = Readonly<{
  elementKey: ElementKey;
  alreadySelected: boolean;
}>;

export class ChoosePlayerElement {
  public constructor(
    private readonly getCurrentPlayer: GetCurrentPlayer,
    private readonly store: PlayerElementStore,
  ) {}

  public async execute(
    identity: PlayerExecutionActor,
    requestedElementKey: string,
  ): Promise<ChoosePlayerElementResult> {
    if (!isElementKey(requestedElementKey)) {
      throw new BusinessError(
        'ELEMENT_NOT_AVAILABLE',
        'The requested element does not exist or is not active.',
      );
    }

    const player = await this.getCurrentPlayer.execute(identity);
    const key = commandKey();
    const result = await (key ? this.store.chooseElement(player.id, requestedElementKey, key) : this.store.chooseElement(player.id, requestedElementKey));

    if (result === 'inactive') {
      throw new BusinessError(
        'ELEMENT_NOT_AVAILABLE',
        'The requested element does not exist or is not active.',
      );
    }

    if (result === 'different-element') {
      throw new BusinessError(
        'ELEMENT_ALREADY_CHOSEN',
        'The Player has already chosen a different permanent element.',
      );
    }

    return {
      elementKey: requestedElementKey,
      alreadySelected: result === 'already-selected',
    };
  }
}
