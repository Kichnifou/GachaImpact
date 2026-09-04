import { particleResourceKey, type ElementKey, type ResourceKey } from '../../domain/economy/resources.js';

export type EconomyEarnedIncrement = Readonly<{
  totalPrimosEarned: bigint;
  totalMorasEarned: bigint;
  totalMainElementParticlesEarned: bigint;
}>;

export function getEconomyEarnedIncrement(
  resourceKey: ResourceKey,
  amount: bigint,
  playerElementKey: ElementKey,
): EconomyEarnedIncrement {
  return {
    totalPrimosEarned: resourceKey === 'primogems' ? amount : 0n,
    totalMorasEarned: resourceKey === 'moras' ? amount : 0n,
    totalMainElementParticlesEarned:
      resourceKey === particleResourceKey(playerElementKey) ? amount : 0n,
  };
}
