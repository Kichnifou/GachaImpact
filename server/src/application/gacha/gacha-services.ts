import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import { BusinessError } from '../errors.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';
import type { GachaStore } from './gacha-store.js';

export class GetCharacters {
  public constructor(private readonly store: GachaStore) {}
  public execute() { return this.store.listActiveCharacters(); }
}

export class GetCurrentGacha {
  public constructor(private readonly getPlayer: GetCurrentPlayer, private readonly store: GachaStore) {}
  public async execute(identity: AuthenticatedIdentity) {
    const player = await this.getPlayer.execute(identity);
    const current = await this.store.getCurrent(player.id);
    if (!current) throw new BusinessError('GACHA_BANNER_UNAVAILABLE', 'No active Gacha banner is available.');
    return current;
  }
}

export class SetGachaTarget {
  public constructor(private readonly getPlayer: GetCurrentPlayer, private readonly store: GachaStore) {}
  public async execute(identity: AuthenticatedIdentity, characterId: string) {
    const player = await this.getPlayer.execute(identity);
    try { return await this.store.setTarget(player.id, characterId); }
    catch (error) {
      if (error instanceof BusinessError) throw error;
      throw error;
    }
  }
}
