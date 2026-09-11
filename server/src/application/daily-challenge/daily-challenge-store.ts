import type { Prisma, SourceChannel } from '../../../generated/prisma/client.js';
import type { ElementKey } from '../../domain/economy/resources.js';
import type { RandomSource } from '../../domain/wheel/wheel.js';
import type { PlayerResourceBalances } from '../player/player-resource-store.js';

export const DAILY_CHALLENGE_PURCHASE_COST = 10_000n;
export const DAILY_CHALLENGE_REWARD = 800n;
export const DAILY_CHALLENGE_FIRST_SWITCH_COST = 20_000n;
export const DAILY_CHALLENGE_MAX_COST = 9_223_372_036_854_775_807n;

export type DailyChallengeType = 'messages' | 'pulls' | 'conversion';
export type DailyChallengeState = 'AVAILABLE' | 'ACTIVE' | 'COMPLETED';

export type DailyChallengeView = Readonly<{
  businessDate: string;
  status: DailyChallengeState;
  assigned: boolean;
  purchaseCost: bigint;
  challenge: Readonly<{
    externalKey: string;
    type: DailyChallengeType;
    displayName: string;
    description: string;
    progressLabel: string;
    progress: bigint;
    target: bigint;
    rewardPrimogems: bigint;
  }> | null;
  switchCount: number;
  nextSwitchCost: bigint | null;
  canSwitch: boolean;
  completedAt: Date | null;
}>;

export type DailyChallengeMutationResult = Readonly<{
  operation: Readonly<{ id: string; alreadyProcessed: boolean }>;
  view: DailyChallengeView;
  resources: PlayerResourceBalances;
}>;

export type DailyChallengePurchaseInput = Readonly<{
  playerId: string;
  playerElementKey: ElementKey;
  businessDate: string;
  now: Date;
  idempotencyKey: string;
  random: RandomSource;
}>;

export type DailyChallengeSwitchInput = Omit<DailyChallengePurchaseInput, 'random'> & Readonly<{ random: RandomSource }>;

export type ParticleConversionInput = Readonly<{
  playerId: string;
  playerElementKey: ElementKey;
  businessDate: string;
  now: Date;
  amount: bigint;
  idempotencyKey: string;
}>;

export interface DailyChallengeProgressor {
  progress(
    transaction: Prisma.TransactionClient,
    input: Readonly<{
      playerId: string;
      playerElementKey: ElementKey;
      businessDate: string;
      type: DailyChallengeType;
      amount: bigint;
      now: Date;
      operationId: string;
      sourceChannel: SourceChannel;
    }>,
  ): Promise<void>;
}

export interface DailyChallengeStore extends DailyChallengeProgressor {
  getView(playerId: string, businessDate: string): Promise<DailyChallengeView>;
  purchase(input: DailyChallengePurchaseInput): Promise<DailyChallengeMutationResult>;
  switchChallenge(input: DailyChallengeSwitchInput): Promise<DailyChallengeMutationResult>;
  convertParticles(input: ParticleConversionInput): Promise<DailyChallengeMutationResult>;
}

export function nextDailyChallengeSwitchCost(switchCount: number): bigint {
  if (!Number.isSafeInteger(switchCount) || switchCount < 0) throw new RangeError('A switch count must be a non-negative safe integer.');
  let cost = DAILY_CHALLENGE_FIRST_SWITCH_COST;
  for (let index = 0; index < switchCount; index += 1) {
    if (cost > DAILY_CHALLENGE_MAX_COST / 2n) return DAILY_CHALLENGE_MAX_COST;
    cost *= 2n;
  }
  return cost;
}
