import { particleResourceKey, type ElementKey, type ResourceKey } from '../economy/resources.js';

export type WheelResultType = 'nothing' | 'particles' | 'moras' | 'primogems';

export type WheelReward = Readonly<{
  resultType: WheelResultType;
  resourceKey: ResourceKey | null;
  amount: bigint | null;
}>;

export interface RandomSource {
  nextInt(maxExclusive: number): number;
}

export type WheelSpinResult = WheelReward &
  Readonly<{
    businessDate: string;
    alreadySpun: boolean;
  }>;

export type WheelTodayState = Readonly<{
  spun: boolean;
  businessDate: string;
  result: WheelReward | null;
}>;

export function getWheelStatsIncrement(reward: WheelReward) {
  return {
    totalSpins: 1n,
    totalJackpots: reward.resultType === 'primogems' ? 1n : 0n,
  } as const;
}

const particleRanges = [
  'pyro',
  'hydro',
  'cryo',
  'electro',
  'anemo',
  'geo',
  'dendro',
] as const satisfies readonly ElementKey[];

export function selectWheelReward(roll: number): WheelReward {
  if (!Number.isInteger(roll) || roll < 0 || roll >= 100) {
    throw new RangeError('A wheel roll must be an integer from 0 through 99.');
  }

  if (roll < 2) {
    return { resultType: 'nothing', resourceKey: null, amount: null };
  }

  if (roll < 72) {
    const particleIndex = Math.floor((roll - 2) / 10);
    const elementKey = particleRanges[particleIndex];

    if (!elementKey) {
      throw new Error('The wheel particle range is incomplete.');
    }

    return {
      resultType: 'particles',
      resourceKey: particleResourceKey(elementKey),
      amount: 500n,
    };
  }

  if (roll < 92) {
    return { resultType: 'moras', resourceKey: 'moras', amount: 50_000n };
  }

  return { resultType: 'primogems', resourceKey: 'primogems', amount: 1_600n };
}
