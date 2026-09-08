import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import { BusinessError } from '../errors.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';
import type { TeamStore } from './team-store.js';

export class GetCurrentPlayerTeams {
  public constructor(private readonly getPlayer: GetCurrentPlayer, private readonly store: TeamStore) {}
  public async execute(identity: AuthenticatedIdentity) {
    const player = await this.getPlayer.execute(identity);
    return this.store.getOrProvision(player.id);
  }
}

export class ActivatePlayerTeam {
  public constructor(private readonly getPlayer: GetCurrentPlayer, private readonly store: TeamStore) {}
  public async execute(identity: AuthenticatedIdentity, teamId: string) {
    const player = await this.getPlayer.execute(identity);
    return this.store.activate(player.id, teamId);
  }
}

export class RenamePlayerTeam {
  public constructor(private readonly getPlayer: GetCurrentPlayer, private readonly store: TeamStore) {}
  public async execute(identity: AuthenticatedIdentity, teamId: string, rawName: string | null) {
    const name = normalizeTeamName(rawName);
    const player = await this.getPlayer.execute(identity);
    return this.store.rename(player.id, teamId, name);
  }
}

export class CreateNextPlayerTeam {
  public constructor(private readonly getPlayer: GetCurrentPlayer, private readonly store: TeamStore) {}
  public async execute(identity: AuthenticatedIdentity, expectedPosition: number) {
    if (!Number.isInteger(expectedPosition) || expectedPosition < 11) {
      throw new BusinessError('TEAM_CREATE_POSITION_INVALID', 'La prochaine Team supplémentaire demandée est invalide.');
    }
    const player = await this.getPlayer.execute(identity);
    return this.store.createNext(player.id, expectedPosition);
  }
}

export class DeleteExtraPlayerTeam {
  public constructor(private readonly getPlayer: GetCurrentPlayer, private readonly store: TeamStore) {}
  public async execute(identity: AuthenticatedIdentity, teamId: string) {
    const player = await this.getPlayer.execute(identity);
    return this.store.deleteExtra(player.id, teamId);
  }
}

export class ReorderPlayerTeams {
  public constructor(private readonly getPlayer: GetCurrentPlayer, private readonly store: TeamStore) {}
  public async execute(identity: AuthenticatedIdentity, teamIds: readonly string[]) {
    const player = await this.getPlayer.execute(identity);
    return this.store.reorderTeams(player.id, teamIds);
  }
}

export class SetPlayerTeamSlot {
  public constructor(private readonly getPlayer: GetCurrentPlayer, private readonly store: TeamStore) {}
  public async execute(identity: AuthenticatedIdentity, teamId: string, position: number, characterId: string) {
    assertSlotPosition(position);
    const player = await this.getPlayer.execute(identity);
    return this.store.setSlot(player.id, teamId, position, characterId);
  }
}

export class ReorderPlayerTeamSlots {
  public constructor(private readonly getPlayer: GetCurrentPlayer, private readonly store: TeamStore) {}
  public async execute(identity: AuthenticatedIdentity, teamId: string, characterIds: readonly (string | null)[]) {
    if (characterIds.length !== 4) {
      throw new BusinessError('TEAM_SLOT_ORDER_INVALID', 'L’ordre d’une Team doit contenir exactement quatre emplacements.');
    }
    const player = await this.getPlayer.execute(identity);
    return this.store.reorderSlots(player.id, teamId, characterIds);
  }
}

export class RemovePlayerTeamSlot {
  public constructor(private readonly getPlayer: GetCurrentPlayer, private readonly store: TeamStore) {}
  public async execute(identity: AuthenticatedIdentity, teamId: string, position: number) {
    assertSlotPosition(position);
    const player = await this.getPlayer.execute(identity);
    return this.store.removeSlot(player.id, teamId, position);
  }
}

export class ClearPlayerTeam {
  public constructor(private readonly getPlayer: GetCurrentPlayer, private readonly store: TeamStore) {}
  public async execute(identity: AuthenticatedIdentity, teamId: string) {
    const player = await this.getPlayer.execute(identity);
    return this.store.clear(player.id, teamId);
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
