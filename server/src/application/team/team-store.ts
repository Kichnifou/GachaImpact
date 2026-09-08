import type { ElementKey } from '../../domain/economy/resources.js';
import type { DerivedTeamPassive, TeamPassiveDefinition } from '../../domain/team/team-passives.js';

export type TeamCharacter = Readonly<{
  id: string;
  externalKey: string;
  name: string;
  rarity: 4 | 5;
  elementKey: ElementKey;
  classKey: string | null;
  weaponType: string | null;
  region: string | null;
  iconPath: string | null;
  splashPath: string | null;
  wishPath: string | null;
  fullbodyPath: string | null;
  constellation: number;
}>;

export type TeamSlot = Readonly<{
  position: 1 | 2 | 3 | 4;
  character: TeamCharacter | null;
}>;

export type PlayerTeam = Readonly<{
  id: string;
  position: number;
  name: string | null;
  active: boolean;
  slots: readonly TeamSlot[];
  passives: readonly DerivedTeamPassive[];
}>;

export type PlayerTeams = Readonly<{
  teams: readonly PlayerTeam[];
  availableCharacters: readonly TeamCharacter[];
  passiveReference: readonly TeamPassiveDefinition[];
}>;

export interface TeamStore {
  getOrProvision(playerId: string): Promise<PlayerTeams>;
  activate(playerId: string, teamId: string): Promise<PlayerTeams>;
  rename(playerId: string, teamId: string, name: string | null): Promise<PlayerTeams>;
  createNext(playerId: string, expectedPosition: number): Promise<PlayerTeams>;
  deleteExtra(playerId: string, teamId: string): Promise<PlayerTeams>;
  reorderTeams(playerId: string, teamIds: readonly string[]): Promise<PlayerTeams>;
  setSlot(playerId: string, teamId: string, position: number, characterId: string): Promise<PlayerTeams>;
  reorderSlots(playerId: string, teamId: string, characterIds: readonly (string | null)[]): Promise<PlayerTeams>;
  removeSlot(playerId: string, teamId: string, position: number): Promise<PlayerTeams>;
  clear(playerId: string, teamId: string): Promise<PlayerTeams>;
}
