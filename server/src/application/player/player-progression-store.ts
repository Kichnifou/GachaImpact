import type { PlayerProgressionState } from '../../domain/player/player-progression.js';

export interface PlayerProgressionStore {
  getByPlayerId(playerId: string): Promise<PlayerProgressionState | null>;
}
