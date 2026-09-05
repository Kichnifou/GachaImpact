import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import { derivePlayerProgression, type PlayerProgression } from '../../domain/player/player-progression.js';
import { BusinessError } from '../errors.js';
import type { GetCurrentPlayer } from './get-current-player.js';
import type { PlayerProgressionStore } from './player-progression-store.js';

export class GetCurrentPlayerProgression {
  public constructor(
    private readonly getCurrentPlayer: GetCurrentPlayer,
    private readonly store: PlayerProgressionStore,
  ) {}

  public async execute(identity: AuthenticatedIdentity): Promise<PlayerProgression> {
    const player = await this.getCurrentPlayer.execute(identity);
    const state = await this.store.getByPlayerId(player.id);

    if (!state) {
      throw new BusinessError(
        'PLAYER_PROGRESSION_STATE_MISSING',
        'The Player progression state is missing.',
      );
    }

    return derivePlayerProgression(state);
  }
}
