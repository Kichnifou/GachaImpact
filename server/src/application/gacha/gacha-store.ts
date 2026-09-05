import type { BannerVoteWeight, FeaturedSelection, GachaCharacter } from '../../domain/gacha/gacha.js';

export type PlayerGachaState = Readonly<{
  pity5: number; pity4: number; guaranteedFeatured5: boolean; captureProgress: number;
  fiftyFiftyLostStreak: number; selectedBannerCharacterId: string | null;
  totalPulls: bigint; totalFiveStars: bigint; totalFourStars: bigint;
  fiftyFiftyWon: bigint; fiftyFiftyLost: bigint; capturesTriggered: bigint;
}>;
export type CurrentBanner = Readonly<{
  id: string; startsAt: Date; endsAt: Date; featuredFiveStars: readonly GachaCharacter[]; featuredFourStars: readonly GachaCharacter[];
}>;
export interface GachaStore {
  listActiveCharacters(): Promise<readonly GachaCharacter[]>;
  getCurrent(playerId: string): Promise<{ banner: CurrentBanner; playerState: PlayerGachaState } | null>;
  setTarget(playerId: string, characterId: string): Promise<PlayerGachaState>;
  ensureRotation(startsAt: Date, endsAt: Date, select: (catalog: readonly GachaCharacter[], previous: ReadonlySet<string>, votes: readonly BannerVoteWeight[]) => readonly FeaturedSelection[]): Promise<CurrentBanner>;
}
