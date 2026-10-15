import type { CurrentPlayer } from '../../domain/player/current-player.js';

export type ProvisionCurrentPlayerInput = Readonly<{
  provider: string;
  providerSubject: string;
  displayName: string;
  presentationName?: string | null;
  presentationNameRevision?: number;
}>;

export type CurrentPlayerResult = Readonly<{
  player: CurrentPlayer;
  created: boolean;
}>;

export interface CurrentPlayerStore {
  findByIdentity(provider: string, providerSubject: string): Promise<CurrentPlayer | null>;
  provision(input: ProvisionCurrentPlayerInput): Promise<CurrentPlayerResult>;
}
