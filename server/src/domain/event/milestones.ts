import { elementKeys, isElementKey, type ElementKey } from '../economy/resources.js';
import type { RandomSource } from '../wheel/wheel.js';

export const EVENT_MILESTONES = [10, 20, 30, 40, 50, 60, 70, 80] as const;

export function milestoneParticleElement(milestone: 10 | 30, playerElementKey: string | null, random: RandomSource): ElementKey {
  if (milestone === 30 && playerElementKey && isElementKey(playerElementKey)) return playerElementKey;
  return elementKeys[random.nextInt(elementKeys.length)]!;
}
