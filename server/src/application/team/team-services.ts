import type { PlayerExecutionActor } from '../player/player-execution-actor.js';
import { BusinessError } from '../errors.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';
import type { TeamStore } from './team-store.js';

export class GetCurrentPlayerTeams {
  public constructor(private readonly getPlayer: GetCurrentPlayer, private readonly store: TeamStore) {}
  public async execute(identity: PlayerExecutionActor) {
    const player = await this.getPlayer.execute(identity);
    return this.store.getOrProvision(player.id);
  }
}

export class ActivatePlayerTeam {
  public constructor(private readonly getPlayer: GetCurrentPlayer, private readonly store: TeamStore) {}
  public async execute(identity: PlayerExecutionActor, teamId: string, chatKey?: string) {
    const player = await this.getPlayer.execute(identity);
    return chatKey ? this.store.activate(player.id, teamId, chatKey) : this.store.activate(player.id, teamId);
  }
}

export class RenamePlayerTeam {
  public constructor(private readonly getPlayer: GetCurrentPlayer, private readonly store: TeamStore) {}
  public async execute(identity: PlayerExecutionActor, teamId: string, rawName: string | null, chatKey?: string) {
    const name = normalizeTeamName(rawName);
    const player = await this.getPlayer.execute(identity);
    return chatKey ? this.store.rename(player.id, teamId, name, chatKey) : this.store.rename(player.id, teamId, name);
  }
}

export class CreateNextPlayerTeam {
  public constructor(private readonly getPlayer: GetCurrentPlayer, private readonly store: TeamStore) {}
  public async execute(identity: PlayerExecutionActor, expectedPosition: number, chatKey?: string) {
    if (!Number.isInteger(expectedPosition) || expectedPosition < 11) {
      throw new BusinessError('TEAM_CREATE_POSITION_INVALID', 'La prochaine Team supplémentaire demandée est invalide.');
    }
    const player = await this.getPlayer.execute(identity);
    return chatKey ? this.store.createNext(player.id, expectedPosition, chatKey) : this.store.createNext(player.id, expectedPosition);
  }
}

export class DeleteExtraPlayerTeam {
  public constructor(private readonly getPlayer: GetCurrentPlayer, private readonly store: TeamStore) {}
  public async execute(identity: PlayerExecutionActor, teamId: string) {
    const player = await this.getPlayer.execute(identity);
    return this.store.deleteExtra(player.id, teamId);
  }
}

export class ReorderPlayerTeams {
  public constructor(private readonly getPlayer: GetCurrentPlayer, private readonly store: TeamStore) {}
  public async execute(identity: PlayerExecutionActor, teamIds: readonly string[]) {
    const player = await this.getPlayer.execute(identity);
    return this.store.reorderTeams(player.id, teamIds);
  }
}

export class SetPlayerTeamSlot {
  public constructor(private readonly getPlayer: GetCurrentPlayer, private readonly store: TeamStore) {}
  public async execute(identity: PlayerExecutionActor, teamId: string, position: number, characterId: string, chatKey?: string) {
    assertSlotPosition(position);
    const player = await this.getPlayer.execute(identity);
    return chatKey ? this.store.setSlot(player.id, teamId, position, characterId, chatKey) : this.store.setSlot(player.id, teamId, position, characterId);
  }
}

export class ReorderPlayerTeamSlots {
  public constructor(private readonly getPlayer: GetCurrentPlayer, private readonly store: TeamStore) {}
  public async execute(identity: PlayerExecutionActor, teamId: string, characterIds: readonly (string | null)[]) {
    if (characterIds.length !== 4) {
      throw new BusinessError('TEAM_SLOT_ORDER_INVALID', 'L’ordre d’une Team doit contenir exactement quatre emplacements.');
    }
    const player = await this.getPlayer.execute(identity);
    return this.store.reorderSlots(player.id, teamId, characterIds);
  }
}

export class RemovePlayerTeamSlot {
  public constructor(private readonly getPlayer: GetCurrentPlayer, private readonly store: TeamStore) {}
  public async execute(identity: PlayerExecutionActor, teamId: string, position: number, chatKey?: string) {
    assertSlotPosition(position);
    const player = await this.getPlayer.execute(identity);
    return chatKey ? this.store.removeSlot(player.id, teamId, position, chatKey) : this.store.removeSlot(player.id, teamId, position);
  }
}

export class ClearPlayerTeam {
  public constructor(private readonly getPlayer: GetCurrentPlayer, private readonly store: TeamStore) {}
  public async execute(identity: PlayerExecutionActor, teamId: string, chatKey?: string) {
    const player = await this.getPlayer.execute(identity);
    return chatKey ? this.store.clear(player.id, teamId, chatKey) : this.store.clear(player.id, teamId);
  }
}

function assertSlotPosition(position: number): void {
  if (!Number.isInteger(position) || position < 1 || position > 4) {
    throw new BusinessError('TEAM_SLOT_INVALID', 'Un emplacement d’équipe doit être compris entre 1 et 4.');
  }
}

function normalizeTeamName(rawName: string | null): string | null {
  const name = rawName?.trim() ?? '';
  if (Array.from(name).length > 20) {
    throw new BusinessError('TEAM_NAME_INVALID', 'Le nom d’une Team ne peut pas dépasser 20 caractères.');
  }
  return name || null;
}
