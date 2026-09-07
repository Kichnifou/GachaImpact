import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import { BusinessError } from '../errors.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';
import type { BoxStore } from './box-store.js';

export class GetCurrentPlayerBox {
  public constructor(private readonly getPlayer: GetCurrentPlayer, private readonly store: BoxStore) {}

  public async execute(identity: AuthenticatedIdentity) {
    const player = await this.getPlayer.execute(identity);
    const characters = await this.store.listVisiblePossessions(player.id);
    return {
      characters,
      summary: {
        totalOwned: characters.length,
        fiveStars: characters.filter(({ rarity }) => rarity === 5).length,
        fourStars: characters.filter(({ rarity }) => rarity === 4).length,
        c6: characters.filter(({ constellation }) => constellation === 6).length,
      },
    };
  }
}

export class SetBoxCharacterFavorite {
  public constructor(private readonly getPlayer: GetCurrentPlayer, private readonly store: BoxStore) {}

  public async execute(identity: AuthenticatedIdentity, characterId: string, favorite: boolean) {
    const player = await this.getPlayer.execute(identity);
    const character = await this.store.setFavorite(player.id, characterId, favorite);
    if (!character) {
      throw new BusinessError('BOX_CHARACTER_NOT_OWNED', 'Ce personnage actif ne fait pas partie de votre Box.');
    }
    return character;
  }
}
