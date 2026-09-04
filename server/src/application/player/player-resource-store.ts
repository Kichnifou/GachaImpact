import type { ResourceKey } from '../../domain/economy/resources.js';

export type PlayerResourceBalances = Readonly<Record<ResourceKey, bigint>>;

export interface PlayerResourceStore {
  getBalances(playerId: string): Promise<ReadonlyMap<ResourceKey, bigint>>;
}
