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

export class SetPlayerTeamSlot {
  public constructor(private readonly getPlayer: GetCurrentPlayer, private readonly store: TeamStore) {}
  public async execute(identity: AuthenticatedIdentity, teamId: string, position: number, characterId: string) {
    assertSlotPosition(position);
    const player = await this.getPlayer.execute(identity);
    return this.store.setSlot(player.id, teamId, position, characterId);
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
