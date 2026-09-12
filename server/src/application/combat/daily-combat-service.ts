import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import { isElementKey } from '../../domain/economy/resources.js';
import { getBusinessDate, type Clock } from '../../domain/time/business-date.js';
import { BusinessError } from '../errors.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';
import type { DailyCombatStore } from './daily-combat-store.js';

export class CombatService {
  public constructor(private readonly getPlayer: GetCurrentPlayer, private readonly store: DailyCombatStore, private readonly clock: Clock) {}

  private async context(identity: AuthenticatedIdentity) {
    const player = await this.getPlayer.execute(identity);
    if (!player.elementKey || !isElementKey(player.elementKey)) throw new BusinessError('PLAYER_ELEMENT_REQUIRED', 'Un élément permanent est requis.');
    const now = this.clock.now();
    return { playerId: player.id, playerElementKey: player.elementKey, now, businessDate: getBusinessDate(now) } as const;
  }

  public async getDaily(identity: AuthenticatedIdentity) { return this.store.getView(await this.context(identity)); }
  public async setSlot(identity: AuthenticatedIdentity, position: number, characterId: string) { return this.store.setSlot({ ...await this.context(identity), position, characterId }); }
  public async removeSlot(identity: AuthenticatedIdentity, position: number) { return this.store.removeSlot({ ...await this.context(identity), position }); }
  public async copyActiveTeam(identity: AuthenticatedIdentity) { return this.store.copyActiveTeam(await this.context(identity)); }
  public async autoSelect(identity: AuthenticatedIdentity) { return this.store.autoSelect(await this.context(identity)); }
  public async clearLoadout(identity: AuthenticatedIdentity) { return this.store.clearLoadout(await this.context(identity)); }
  public async fight(identity: AuthenticatedIdentity, idempotencyKey: string) { return this.store.fight({ ...await this.context(identity), idempotencyKey }); }
}
