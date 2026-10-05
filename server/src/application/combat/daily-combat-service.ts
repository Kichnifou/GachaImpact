import { commandNow } from '../player/player-command-execution.js';
import type { PlayerExecutionActor } from '../player/player-execution-actor.js';
import { SourceChannel } from '../../../generated/prisma/client.js';
import { isElementKey } from '../../domain/economy/resources.js';
import { getBusinessDate, type Clock } from '../../domain/time/business-date.js';
import { BusinessError } from '../errors.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';
import type { DailyCombatStore } from './daily-combat-store.js';

export class CombatService {
  public constructor(private readonly getPlayer: GetCurrentPlayer, private readonly store: DailyCombatStore, private readonly clock: Clock) {}

  private async context(identity: PlayerExecutionActor) {
    const player = await this.getPlayer.execute(identity);
    if (!player.elementKey || !isElementKey(player.elementKey)) throw new BusinessError('PLAYER_ELEMENT_REQUIRED', 'Un élément permanent est requis.');
    const now = commandNow(this.clock);
    return { playerId: player.id, playerElementKey: player.elementKey, now, businessDate: getBusinessDate(now) } as const;
  }

  public async getDaily(identity: PlayerExecutionActor) { return this.store.getView(await this.context(identity)); }
  public async prepareCommand(identity: PlayerExecutionActor, selection: 'ACTIVE_TEAM' | 'AUTO') { return this.store.prepareCommand?.(await this.context(identity), selection); }
  public async previewActiveTeam(identity: PlayerExecutionActor) { return this.store.previewActiveTeam(await this.context(identity)); }
  public async getElementMatrix() { return this.store.getElementMatrix(); }
  public async setSlot(identity: PlayerExecutionActor, position: number, characterId: string) { return this.store.setSlot({ ...await this.context(identity), position, characterId }); }
  public async removeSlot(identity: PlayerExecutionActor, position: number) { return this.store.removeSlot({ ...await this.context(identity), position }); }
  public async copyActiveTeam(identity: PlayerExecutionActor) { return this.store.copyActiveTeam(await this.context(identity)); }
  public async autoSelect(identity: PlayerExecutionActor) { return this.store.autoSelect(await this.context(identity)); }
  public async clearLoadout(identity: PlayerExecutionActor) { return this.store.clearLoadout(await this.context(identity)); }
  public async fight(identity: PlayerExecutionActor, idempotencyKey: string, selection?: 'ACTIVE_TEAM' | 'AUTO', sourceChannel: SourceChannel = SourceChannel.UI) { return this.store.fight({ ...await this.context(identity), idempotencyKey, selection, sourceChannel }); }
}
