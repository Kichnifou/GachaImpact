import type { Prisma, PrismaClient } from '../../../generated/prisma/client.js';
import type { BoxCharacter, BoxStore } from '../../application/box/box-store.js';
import { isElementKey } from '../../domain/economy/resources.js';

const boxSelection = {
  constellation: true,
  copies: true,
  firstObtainedAt: true,
  favorite: true,
  character: { select: {
    id: true,
    externalKey: true,
    name: true,
    rarity: true,
    elementKey: true,
    weaponType: true,
    region: true,
    iconPath: true,
    splashPath: true,
    wishPath: true,
    fullbodyPath: true,
  } },
} satisfies Prisma.PlayerCharacterSelect;

type BoxRow = Prisma.PlayerCharacterGetPayload<{ select: typeof boxSelection }>;

export class PrismaBoxStore implements BoxStore {
  public constructor(private readonly database: PrismaClient) {}

  public async listVisiblePossessions(playerId: string): Promise<readonly BoxCharacter[]> {
    const rows = await this.database.playerCharacter.findMany({
      where: { playerId, character: { isActive: true } },
      select: boxSelection,
    });
    return rows.map(toBoxCharacter);
  }

  public async setFavorite(playerId: string, characterId: string, favorite: boolean): Promise<BoxCharacter | null> {
    const updated = await this.database.playerCharacter.updateMany({
      where: { playerId, characterId, character: { isActive: true } },
      data: { favorite },
    });
    if (updated.count === 0) return null;
    const row = await this.database.playerCharacter.findUnique({
      where: { playerId_characterId: { playerId, characterId } },
      select: boxSelection,
    });
    return row ? toBoxCharacter(row) : null;
  }
}

function toBoxCharacter(row: BoxRow): BoxCharacter {
  if (row.character.rarity !== 4 && row.character.rarity !== 5) throw new Error(`Invalid stored rarity for ${row.character.id}.`);
  if (!isElementKey(row.character.elementKey)) throw new Error(`Invalid stored element for ${row.character.id}.`);
  return {
    ...row.character,
    rarity: row.character.rarity,
    elementKey: row.character.elementKey,
    constellation: Math.min(6, Math.max(0, row.constellation)),
    copies: row.copies,
    firstObtainedAt: row.firstObtainedAt,
    favorite: row.favorite,
  };
}
