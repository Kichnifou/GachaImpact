import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import type { Clock } from '../../domain/time/business-date.js';
import type { RandomSource } from '../../domain/wheel/wheel.js';
import { BusinessError } from '../errors.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';
import type { BoxSortPreference, BoxStore } from './box-store.js';

export class GetCurrentPlayerBox {
  public constructor(private readonly getPlayer: GetCurrentPlayer, private readonly store: BoxStore) {}

  public async execute(identity: AuthenticatedIdentity) {
    const player = await this.getPlayer.execute(identity);
    const [characters, preference, stellaQuantity] = await Promise.all([
      this.store.listVisiblePossessions(player.id),
      this.store.getSortPreference(player.id),
      this.store.getStellaQuantity(player.id),
    ]);
    return {
      characters,
      summary: {
        totalOwned: characters.length,
        fiveStars: characters.filter(({ rarity }) => rarity === 5).length,
        fourStars: characters.filter(({ rarity }) => rarity === 4).length,
        c6: characters.filter(({ constellation }) => constellation === 6).length,
      },
      preference,
      stella: { quantity: stellaQuantity },
    };
  }
}

export class SetBoxSortPreference {
  public constructor(private readonly getPlayer: GetCurrentPlayer, private readonly store: BoxStore) {}

  public async execute(identity: AuthenticatedIdentity, preference: BoxSortPreference) {
    const player = await this.getPlayer.execute(identity);
    return this.store.setSortPreference(player.id, preference);
  }
}

export class UseMasterlessStella {
  public constructor(
    private readonly getPlayer: GetCurrentPlayer,
    private readonly store: BoxStore,
    private readonly clock: Clock,
    private readonly random: RandomSource,
  ) {}

  public async execute(identity: AuthenticatedIdentity, characterId: string, idempotencyKey: string) {
    const player = await this.getPlayer.execute(identity);
    return this.store.useStella({ playerId: player.id, characterId, idempotencyKey, now: this.clock.now(), random: this.random });
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
