import type { ElementKey } from '../../domain/economy/resources.js';
import type { C6StatKey, C6Stats } from '../../domain/contest/c6-progress.js';
import type { RandomSource } from '../../domain/wheel/wheel.js';

export const boxSortKeys = ['alphabetical', 'obtainedAt', 'constellation', 'element'] as const;
export const boxSortDirections = ['asc', 'desc'] as const;
export type BoxSortKey = typeof boxSortKeys[number];
export type BoxSortDirection = typeof boxSortDirections[number];
export type BoxSortPreference = Readonly<{ sortKey: BoxSortKey; direction: BoxSortDirection }>;
export const defaultBoxSortPreference: BoxSortPreference = { sortKey: 'alphabetical', direction: 'asc' };
export const MASTERLESS_STELLA_FORTUNA_KEY = 'masterless-stella-fortuna';

export type BoxCharacter = Readonly<{
  id: string;
  externalKey: string;
  name: string;
  rarity: 4 | 5;
  elementKey: ElementKey;
  weaponType: string | null;
  region: string | null;
  iconPath: string | null;
  splashPath: string | null;
  wishPath: string | null;
  fullbodyPath: string | null;
  constellation: number;
  copies: number;
  firstObtainedAt: Date;
  favorite: boolean;
}>;

export interface BoxStore {
  listVisiblePossessions(playerId: string): Promise<readonly BoxCharacter[]>;
  setFavorite(playerId: string, characterId: string, favorite: boolean): Promise<BoxCharacter | null>;
  getSortPreference(playerId: string): Promise<BoxSortPreference>;
  setSortPreference(playerId: string, preference: BoxSortPreference): Promise<BoxSortPreference>;
  getStellaQuantity(playerId: string): Promise<bigint>;
  useStella(input: UseStellaInput): Promise<StellaUseResult>;
}

export type StellaProgression = Readonly<{ type: 'unlocked'; stats: C6Stats }>
  | Readonly<{ type: 'stat'; stat: C6StatKey; valueAfter: number }>;

export type StellaUseResult = Readonly<{
  operation: Readonly<{ id: string; alreadyProcessed: boolean }>;
  character: BoxCharacter;
  stellaRemaining: bigint;
  c6Progression: StellaProgression | null;
}>;

export type UseStellaInput = Readonly<{
  playerId: string;
  characterId: string;
  idempotencyKey: string;
  now: Date;
  random: RandomSource;
}>;
