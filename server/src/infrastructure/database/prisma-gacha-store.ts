import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import { BusinessError } from '../../application/errors.js';
import type { CurrentBanner, GachaStore, PlayerGachaState } from '../../application/gacha/gacha-store.js';
import type { BannerVoteWeight, FeaturedSelection, GachaCharacter } from '../../domain/gacha/gacha.js';
import { isPrismaConcurrencyCollision } from './prisma-concurrency.js';

const characterSelection = {
  id: true, externalKey: true, name: true, rarity: true, elementKey: true, weaponType: true,
  region: true, classKey: true, iconPath: true, splashPath: true, wishPath: true, fullbodyPath: true,
} satisfies Prisma.CharacterSelect;

const stateSelection = {
  pity5: true, pity4: true, guaranteedFeatured5: true, captureProgress: true, fiftyFiftyLostStreak: true,
  selectedBannerCharacterId: true, totalPulls: true, totalFiveStars: true, totalFourStars: true,
  fiftyFiftyWon: true, fiftyFiftyLost: true, capturesTriggered: true,
} satisfies Prisma.PlayerGachaStateSelect;

export class PrismaGachaStore implements GachaStore {
  public constructor(private readonly database: PrismaClient) {}

  public async listActiveCharacters(): Promise<readonly GachaCharacter[]> {
    const rows = await this.database.character.findMany({ where: { isActive: true }, select: characterSelection, orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }] });
    return rows.map(toCharacter);
  }

  public async getCurrent(playerId: string) {
    const [banner, state] = await Promise.all([
      this.database.bannerRotation.findFirst({ where: { status: 'ACTIVE' }, include: { featuredCharacters: { include: { character: { select: characterSelection } }, orderBy: [{ rarity: 'desc' }, { slot: 'asc' }] } } }),
      this.database.playerGachaState.findUnique({ where: { playerId }, select: stateSelection }),
    ]);
    if (!banner || !state) return null;
    return { banner: toBanner(banner), playerState: state };
  }

  public async setTarget(playerId: string, characterId: string): Promise<PlayerGachaState> {
    return this.database.$transaction(async (tx) => {
      const featured = await tx.bannerFeaturedCharacter.findFirst({ where: { characterId, rarity: 5, bannerRotation: { status: 'ACTIVE' }, character: { isActive: true } }, select: { characterId: true } });
      if (!featured) throw new BusinessError('GACHA_TARGET_INVALID', 'The selected character is not a featured five-star character.');
      return tx.playerGachaState.update({ where: { playerId }, data: { selectedBannerCharacterId: characterId }, select: stateSelection });
    });
  }

  public async ensureRotation(
    startsAt: Date, endsAt: Date,
    select: (catalog: readonly GachaCharacter[], previous: ReadonlySet<string>, votes: readonly BannerVoteWeight[]) => readonly FeaturedSelection[],
  ): Promise<CurrentBanner> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try { return await this.ensureRotationTransaction(startsAt, endsAt, select); }
      catch (error) { if (!isPrismaConcurrencyCollision(error) || attempt === 3) throw error; }
    }
    throw new Error('Banner rotation exhausted all retry attempts.');
  }

  private async ensureRotationTransaction(
    startsAt: Date, endsAt: Date,
    select: (catalog: readonly GachaCharacter[], previous: ReadonlySet<string>, votes: readonly BannerVoteWeight[]) => readonly FeaturedSelection[],
  ): Promise<CurrentBanner> {
    return this.database.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(70422401)`;
      const existing = await tx.bannerRotation.findUnique({ where: { startsAt }, include: { featuredCharacters: { include: { character: { select: characterSelection } } } } });
      if (existing) return toBanner(existing);

      const previous = await tx.bannerRotation.findFirst({ where: { status: 'ACTIVE' }, include: { featuredCharacters: true, votes: true } });
      const catalog = (await tx.character.findMany({ where: { isActive: true }, select: characterSelection })).map(toCharacter);
      const voteCounts = new Map<string, number>();
      for (const vote of previous?.votes ?? []) voteCounts.set(vote.characterId, (voteCounts.get(vote.characterId) ?? 0) + 1);
      const selections = select(catalog, new Set(previous?.featuredCharacters.map(({ characterId }) => characterId) ?? []), [...voteCounts].map(([characterId, votes]) => ({ characterId, votes })));
      validateSelections(selections);

      if (previous) await tx.bannerRotation.update({ where: { id: previous.id }, data: { status: 'ENDED' } });
      const created = await tx.bannerRotation.create({
        data: { startsAt, endsAt, status: 'ACTIVE', featuredCharacters: { create: selections.map(({ character, slot, selectionSource }) => ({ characterId: character.id, rarity: character.rarity, slot, selectionSource })) } },
        include: { featuredCharacters: { include: { character: { select: characterSelection } } } },
      });
      if (previous) {
        await tx.playerGachaState.updateMany({ where: { selectedBannerCharacterId: { in: previous.featuredCharacters.map(({ characterId }) => characterId) } }, data: { selectedBannerCharacterId: null } });
      }
      return toBanner(created);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}

function toCharacter(row: Prisma.CharacterGetPayload<{ select: typeof characterSelection }>): GachaCharacter {
  if (row.rarity !== 4 && row.rarity !== 5) throw new Error(`Invalid stored rarity for ${row.id}.`);
  return { ...row, rarity: row.rarity };
}

function toBanner(row: { id: string; startsAt: Date; endsAt: Date; featuredCharacters: readonly { rarity: number; slot: number; character: Prisma.CharacterGetPayload<{ select: typeof characterSelection }> }[] }): CurrentBanner {
  const sorted = [...row.featuredCharacters].sort((a, b) => a.slot - b.slot);
  return { id: row.id, startsAt: row.startsAt, endsAt: row.endsAt, featuredFiveStars: sorted.filter(({ rarity }) => rarity === 5).map(({ character }) => toCharacter(character)), featuredFourStars: sorted.filter(({ rarity }) => rarity === 4).map(({ character }) => toCharacter(character)) };
}

function validateSelections(selections: readonly FeaturedSelection[]): void {
  if (selections.length !== 10 || new Set(selections.map(({ character }) => character.id)).size !== 10 || selections.filter(({ character }) => character.rarity === 5).length !== 4 || selections.filter(({ character }) => character.rarity === 4).length !== 6) {
    throw new Error('Banner selection did not produce exactly four five-stars and six four-stars.');
  }
}
