import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import { BusinessError } from '../errors.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';
import type { GachaStore } from './gacha-store.js';
import type { Clock } from '../../domain/time/business-date.js';
import type { RandomSource } from '../../domain/wheel/wheel.js';
import { isElementKey } from '../../domain/economy/resources.js';
import type { PullCount } from '../../domain/gacha/pull.js';

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

export class PerformGachaPull {
  public constructor(
    private readonly getPlayer: GetCurrentPlayer,
    private readonly store: GachaStore,
    private readonly clock: Clock,
    private readonly random: RandomSource,
  ) {}

  public async execute(identity: AuthenticatedIdentity, count: number, idempotencyKey: string) {
    if (count !== 1 && count !== 10) throw new BusinessError('GACHA_PULL_COUNT_INVALID', 'Une Invocation doit contenir 1 ou 10 vœux.');
    const player = await this.getPlayer.execute(identity);
    if (!player.elementKey || !isElementKey(player.elementKey)) throw new BusinessError('PLAYER_ELEMENT_REQUIRED', 'A permanent element is required to perform a pull.');
    return this.store.pull({ playerId: player.id, playerElementKey: player.elementKey, count: count as PullCount, idempotencyKey, now: this.clock.now(), random: this.random });
  }
}

export class GetGachaHistory {
  public constructor(private readonly getPlayer: GetCurrentPlayer, private readonly store: GachaStore) {}

  public async execute(identity: AuthenticatedIdentity, page: number) {
    if (!Number.isInteger(page) || page < 1) {
      throw new BusinessError('GACHA_HISTORY_PAGE_INVALID', 'La page d’historique doit être un entier supérieur ou égal à 1.');
    }
    const player = await this.getPlayer.execute(identity);
    return this.store.getHistory(player.id, page);
  }
}
