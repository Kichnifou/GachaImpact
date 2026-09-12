import { particleResourceKey, type ElementKey, type ResourceKey } from '../economy/resources.js';

export const EXPEDITION_DURATION_MS = 20 * 60 * 60 * 1_000;

export type ExpeditionReward = Readonly<{
  roll: number;
  kind: 'primogems' | 'particles' | 'moras';
  resourceKey: ResourceKey;
  amount: bigint;
}>;

export function selectExpeditionReward(roll: number, playerElementKey: ElementKey): ExpeditionReward {
  if (!Number.isInteger(roll) || roll < 1 || roll > 10) throw new RangeError('An expedition roll must be an integer from 1 through 10.');
  if (roll === 1) return { roll, kind: 'primogems', resourceKey: 'primogems', amount: 1_600n };
  if (roll <= 4) return { roll, kind: 'particles', resourceKey: particleResourceKey(playerElementKey), amount: 800n };
  return { roll, kind: 'moras', resourceKey: 'moras', amount: 30_000n };
}
