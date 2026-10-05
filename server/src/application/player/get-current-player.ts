import { playerFromServerActor, type PlayerExecutionActor } from './player-execution-actor.js';
import type { CurrentPlayer } from '../../domain/player/current-player.js';
import { BusinessError } from '../errors.js';
import type { CurrentPlayerStore } from './current-player-store.js';

const SUPABASE_PROVIDER = 'supabase';

export class GetCurrentPlayer {
  public constructor(private readonly store: CurrentPlayerStore) {}

  public async execute(identity: PlayerExecutionActor): Promise<CurrentPlayer> {
    const internalPlayer = playerFromServerActor(identity);
    if (internalPlayer) return internalPlayer;
    if (!('subject' in identity)) throw new BusinessError('PLAYER_NOT_FOUND', 'Invalid internal Player context.');
    const player = await this.store.findByIdentity(SUPABASE_PROVIDER, identity.subject);

    if (!player) {
      throw new BusinessError('PLAYER_NOT_FOUND', 'No Player is linked to this account.');
    }

    return player;
  }
}
