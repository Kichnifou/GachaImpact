import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import type { CurrentPlayer } from '../../domain/player/current-player.js';
import { BusinessError } from '../errors.js';
import type { CurrentPlayerStore } from './current-player-store.js';

const SUPABASE_PROVIDER = 'supabase';

export class GetCurrentPlayer {
  public constructor(private readonly store: CurrentPlayerStore) {}

  public async execute(identity: AuthenticatedIdentity): Promise<CurrentPlayer> {
    const player = await this.store.findByIdentity(SUPABASE_PROVIDER, identity.subject);

    if (!player) {
      throw new BusinessError('PLAYER_NOT_FOUND', 'No Player is linked to this account.');
    }

    return player;
  }
}
