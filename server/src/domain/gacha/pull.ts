import type { RandomSource } from '../wheel/wheel.js';
import { elementKeys, particleResourceKey, type ResourceKey } from '../economy/resources.js';
import type { GachaCharacter } from './gacha.js';

export const PULL_COST = { 1: 160n, 10: 1_600n } as const;

export type PullCount = keyof typeof PULL_COST;

export type PullState = Readonly<{
  pity5: number;
  pity4: number;
  guaranteedFeatured5: boolean;
  captureProgress: number;
  fiftyFiftyLostStreak: number;
  totalPulls: bigint;
  totalFiveStars: bigint;
  totalFourStars: bigint;
  fiftyFiftyWon: bigint;
  fiftyFiftyLost: bigint;
  capturesTriggered: bigint;
}>;

export type CharacterPullOutcome = Readonly<{
  type: 'character';
  character: GachaCharacter;
  rarity: 4 | 5;
  wasFiftyFifty: boolean;
  wonFiftyFifty: boolean | null;
  guaranteeConsumed: boolean;
  captureTriggered: boolean;
}>;

export type ResourcePullOutcome = Readonly<{
  type: 'resource';
  resourceKey: ResourceKey;
  amount: bigint;
}>;

export type PullOutcome = CharacterPullOutcome | ResourcePullOutcome;

export type ResolvedPull = Readonly<{
  index: number;
  outcome: PullOutcome;
  stateBefore: PullState;
  stateAfter: PullState;
}>;

export type PullBanner = Readonly<{
  target: GachaCharacter;
  featuredFiveStars: readonly GachaCharacter[];
  featuredFourStars: readonly GachaCharacter[];
}>;

export function fiveStarChanceBasisPoints(attempt: number): number {
  if (attempt >= 90) return 10_000;
  if (attempt <= 73) return 60;
  return 60 + (attempt - 73) * 600;
}

export function effectiveFiveStarChanceBasisPoints(attempt: number, bonusBasisPoints: number): number {
  if (!Number.isInteger(bonusBasisPoints) || bonusBasisPoints < 0) throw new RangeError('A five-star chance bonus must be non-negative basis points.');
  return Math.min(10_000, fiveStarChanceBasisPoints(attempt) + bonusBasisPoints);
}

export function fourStarChanceBasisPoints(attempt: number): number {
  if (attempt >= 10) return 10_000;
  return attempt === 9 ? 1_950 : 150;
}

export function resolvePulls(
  initialState: PullState,
  banner: PullBanner,
  count: PullCount,
  random: RandomSource,
  fiveStarChanceBonusBasisPoints = 0,
): Readonly<{ results: readonly ResolvedPull[]; state: PullState }> {
  validateBanner(banner);
  const results: ResolvedPull[] = [];
  let state = initialState;

  for (let index = 1; index <= count; index += 1) {
    const stateBefore = state;
    const pity5 = Math.min(90, state.pity5 + 1);
    const pity4 = Math.min(10, state.pity4 + 1);
    const fiveStarChance = effectiveFiveStarChanceBasisPoints(pity5, fiveStarChanceBonusBasisPoints);
    const fiveStar = succeeds(fiveStarChance, random);
    const fourStar = succeeds(fourStarChanceBasisPoints(pity4), random);
    let outcome: PullOutcome;

    state = { ...state, pity5, pity4, totalPulls: state.totalPulls + 1n };

    if (fiveStar) {
      const resolution = resolveFiveStar(state, banner, random);
      outcome = resolution.outcome;
      state = { ...resolution.state, pity5: 0, totalFiveStars: resolution.state.totalFiveStars + 1n };
    } else if (fourStar) {
      outcome = {
        type: 'character',
        character: banner.featuredFourStars[random.nextInt(banner.featuredFourStars.length)]!,
        rarity: 4,
        wasFiftyFifty: false,
        wonFiftyFifty: null,
        guaranteeConsumed: false,
        captureTriggered: false,
      };
      state = { ...state, pity4: 0, totalFourStars: state.totalFourStars + 1n };
    } else {
      outcome = resolveResource(random);
    }

    results.push({ index, outcome, stateBefore, stateAfter: state });
  }

  return { results, state };
}

function succeeds(chance: number, random: RandomSource): boolean {
  return chance >= 10_000 || random.nextInt(10_000) < chance;
}

function resolveFiveStar(state: PullState, banner: PullBanner, random: RandomSource) {
  if (state.guaranteedFeatured5) {
    return {
      outcome: characterOutcome(banner.target, false, null, true, false),
      state: { ...state, guaranteedFeatured5: false },
    };
  }

  if (state.captureProgress >= 3) {
    return {
      outcome: characterOutcome(banner.target, false, null, false, true),
      state: { ...state, captureProgress: 0, capturesTriggered: state.capturesTriggered + 1n },
    };
  }

  if (random.nextInt(2) === 0) {
    return {
      outcome: characterOutcome(banner.target, true, true, false, false),
      state: {
        ...state,
        captureProgress: Math.max(0, state.captureProgress - 1),
        fiftyFiftyLostStreak: 0,
        fiftyFiftyWon: state.fiftyFiftyWon + 1n,
      },
    };
  }

  const alternatives = banner.featuredFiveStars.filter(({ id }) => id !== banner.target.id);
  return {
    outcome: characterOutcome(alternatives[random.nextInt(alternatives.length)]!, true, false, false, false),
    state: {
      ...state,
      guaranteedFeatured5: true,
      captureProgress: Math.min(3, state.captureProgress + 1),
      fiftyFiftyLostStreak: state.fiftyFiftyLostStreak + 1,
      fiftyFiftyLost: state.fiftyFiftyLost + 1n,
    },
  };
}

function characterOutcome(character: GachaCharacter, wasFiftyFifty: boolean, wonFiftyFifty: boolean | null, guaranteeConsumed: boolean, captureTriggered: boolean): CharacterPullOutcome {
  return { type: 'character', character, rarity: character.rarity, wasFiftyFifty, wonFiftyFifty, guaranteeConsumed, captureTriggered };
}

function resolveResource(random: RandomSource): ResourcePullOutcome {
  if (random.nextInt(2) === 0) return { type: 'resource', resourceKey: 'moras', amount: BigInt(random.nextInt(10_001) + 5_000) };
  const element = elementKeys[random.nextInt(elementKeys.length)]!;
  return { type: 'resource', resourceKey: particleResourceKey(element), amount: BigInt(random.nextInt(61) + 20) };
}

function validateBanner(banner: PullBanner): void {
  if (banner.featuredFiveStars.length !== 4 || banner.featuredFourStars.length !== 6 || !banner.featuredFiveStars.some(({ id }) => id === banner.target.id)) {
    throw new RangeError('A pull requires four five-stars, six four-stars and a valid target.');
  }
}
