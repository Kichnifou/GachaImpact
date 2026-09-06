import type { BannerVoteWeight, FeaturedSelection, GachaCharacter } from '../../domain/gacha/gacha.js';
import type { PullCount } from '../../domain/gacha/pull.js';
import type { ElementKey, ResourceKey } from '../../domain/economy/resources.js';
import type { RandomSource } from '../../domain/wheel/wheel.js';
import type { C6StatKey } from '../../domain/contest/c6-progress.js';

export type PlayerGachaState = Readonly<{
  pity5: number; pity4: number; guaranteedFeatured5: boolean; captureProgress: number;
  fiftyFiftyLostStreak: number; selectedBannerCharacterId: string | null;
  totalPulls: bigint; totalFiveStars: bigint; totalFourStars: bigint;
  fiftyFiftyWon: bigint; fiftyFiftyLost: bigint; capturesTriggered: bigint;
}>;
export type CurrentBanner = Readonly<{
  id: string; startsAt: Date; endsAt: Date; featuredFiveStars: readonly GachaCharacter[]; featuredFourStars: readonly GachaCharacter[];
}>;
export type PullResultRecord = Readonly<{
  index: number;
  resultType: 'character' | 'resource';
  character: GachaCharacter | null;
  rarity: 4 | 5 | null;
  resourceKey: ResourceKey | null;
  resourceAmount: bigint | null;
  wasNewCharacter: boolean | null;
  constellationAfter: number | null;
  copiesAfter: number | null;
  wasFiftyFifty: boolean;
  wonFiftyFifty: boolean | null;
  guaranteeConsumed: boolean;
  captureTriggered: boolean;
  bonusRewards: readonly Readonly<{ resourceKey: ResourceKey; amount: bigint; causeKey: string }>[];
  c6Progression: Readonly<{ type: 'stat'; stat: C6StatKey; valueAfter: number }> | Readonly<{ type: 'maxed' }> | null;
}>;
export type GachaPullResult = Readonly<{
  operation: Readonly<{ id: string; pullCount: PullCount; primogemCost: bigint; createdAt: Date; alreadyProcessed: boolean }>;
  results: readonly PullResultRecord[];
  playerState: PlayerGachaState;
}>;
export type GachaPullInput = Readonly<{
  playerId: string;
  playerElementKey: ElementKey;
  count: PullCount;
  idempotencyKey: string;
  now: Date;
  random: RandomSource;
}>;
export const GACHA_HISTORY_PAGE_SIZE = 10;
export type GachaHistoryResult = PullResultRecord & Readonly<{
  operationId: string;
  operationPullCount: PullCount;
  occurredAt: Date;
  pity5AtPull: number | null;
  pity4AtPull: number | null;
}>;
export type GachaHistoryPage = Readonly<{
  page: number;
  pageSize: typeof GACHA_HISTORY_PAGE_SIZE;
  totalResults: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
  results: readonly GachaHistoryResult[];
}>;
export interface GachaStore {
  listActiveCharacters(): Promise<readonly GachaCharacter[]>;
  getCurrent(playerId: string): Promise<{ banner: CurrentBanner; playerState: PlayerGachaState } | null>;
  setTarget(playerId: string, characterId: string): Promise<PlayerGachaState>;
  pull(input: GachaPullInput): Promise<GachaPullResult>;
  getHistory(playerId: string, page: number): Promise<GachaHistoryPage>;
  ensureRotation(startsAt: Date, endsAt: Date, select: (catalog: readonly GachaCharacter[], previous: ReadonlySet<string>, votes: readonly BannerVoteWeight[]) => readonly FeaturedSelection[]): Promise<CurrentBanner>;
}
