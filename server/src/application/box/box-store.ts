import type { ElementKey } from '../../domain/economy/resources.js';

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
}
