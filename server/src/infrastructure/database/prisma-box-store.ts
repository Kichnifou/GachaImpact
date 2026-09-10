import { OperationStatus, Prisma, SourceChannel, type PrismaClient } from '../../../generated/prisma/client.js';
import { BusinessError } from '../../application/errors.js';
import {
  MASTERLESS_STELLA_FORTUNA_KEY, boxSortDirections, boxSortKeys, defaultBoxSortPreference,
  type BoxCharacter, type BoxSortPreference, type BoxStore, type StellaProgression, type C6CompetitionStats,
  type StellaUseResult, type UseStellaInput,
} from '../../application/box/box-store.js';
import { C6_COMPETITION_STAT_MAX, c6StatKeys, type C6StatKey, type C6Stats } from '../../domain/contest/c6-progress.js';
import { isElementKey } from '../../domain/economy/resources.js';
import { isPrismaConcurrencyCollision } from './prisma-concurrency.js';
import { PrismaC6ProgressionService } from './prisma-c6-progression-service.js';
import { PrismaCharacterPossessionService } from './prisma-character-possession-service.js';

const BOX_SORT_PREFERENCE_KEY = 'box.sort';
const MAX_ATTEMPTS = 5;
const boxSelection = {
  characterId: true, constellation: true, copies: true, firstObtainedAt: true, favorite: true,
  character: { select: {
    id: true, externalKey: true, name: true, rarity: true, elementKey: true,
    weaponType: true, region: true, iconPath: true, splashPath: true, wishPath: true, fullbodyPath: true,
  } },
} satisfies Prisma.PlayerCharacterSelect;
type BoxRow = Prisma.PlayerCharacterGetPayload<{ select: typeof boxSelection }>;

export class PrismaBoxStore implements BoxStore {
  public constructor(
    private readonly database: PrismaClient,
    private readonly possessions = new PrismaCharacterPossessionService(),
    private readonly c6 = new PrismaC6ProgressionService(),
  ) {}

  public async listVisiblePossessions(playerId: string): Promise<readonly BoxCharacter[]> {
    const rows = await this.database.playerCharacter.findMany({ where: { playerId, character: { isActive: true } }, select: boxSelection });
    const progress = await this.database.c6CompetitionProgress.findMany({ where: { playerId, characterId: { in: rows.filter((row) => row.character.rarity === 5 && row.constellation === 6).map((row) => row.characterId) } }, select: { characterId: true, strength: true, intelligence: true, beauty: true, charisma: true, popularity: true } });
    const byCharacter = new Map(progress.map((value) => [value.characterId, c6Stats(value)]));
    return rows.map((row) => {
      const stats = byCharacter.get(row.characterId) ?? null;
      if (row.character.rarity === 5 && row.constellation === 6 && !stats) throw new Error(`C6 competition progression missing for possession ${playerId}/${row.characterId}.`);
      return toBoxCharacter(row, stats);
    });
  }

  public async setFavorite(playerId: string, characterId: string, favorite: boolean): Promise<BoxCharacter | null> {
    const updated = await this.database.playerCharacter.updateMany({ where: { playerId, characterId, character: { isActive: true } }, data: { favorite } });
    if (updated.count === 0) return null;
    return this.readCharacter(this.database, playerId, characterId);
  }

  public async getSortPreference(playerId: string): Promise<BoxSortPreference> {
    const row = await this.database.playerPreference.findUnique({
      where: { playerId_preferenceKey: { playerId, preferenceKey: BOX_SORT_PREFERENCE_KEY } }, select: { value: true },
    });
    return parseSortPreference(row?.value) ?? defaultBoxSortPreference;
  }

  public async setSortPreference(playerId: string, preference: BoxSortPreference): Promise<BoxSortPreference> {
    await this.database.playerPreference.upsert({
      where: { playerId_preferenceKey: { playerId, preferenceKey: BOX_SORT_PREFERENCE_KEY } },
      create: { playerId, preferenceKey: BOX_SORT_PREFERENCE_KEY, value: preference },
      update: { value: preference },
    });
    return preference;
  }

  public async getStellaQuantity(playerId: string): Promise<bigint> {
    const row = await this.database.playerItem.findFirst({
      where: { playerId, item: { externalKey: MASTERLESS_STELLA_FORTUNA_KEY, isActive: true } }, select: { quantity: true },
    });
    return row?.quantity ?? 0n;
  }

  public async useStella(input: UseStellaInput): Promise<StellaUseResult> {
    const operationKey = `box.stella:${input.playerId}:${input.idempotencyKey}`;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const persisted = await this.findPersistedStella(input.playerId, operationKey);
      if (persisted) return persisted;
      try {
        return await this.useStellaInTransaction(input, operationKey);
      } catch (error) {
        if (!isPrismaConcurrencyCollision(error)) throw error;
        const retryResult = await this.findPersistedStella(input.playerId, operationKey);
        if (retryResult) return retryResult;
        if (attempt === MAX_ATTEMPTS) throw error;
        await new Promise((resolve) => setTimeout(resolve, attempt * 100));
      }
    }
    throw new Error('Stella operation exhausted all retry attempts.');
  }

  private async useStellaInTransaction(input: UseStellaInput, operationKey: string): Promise<StellaUseResult> {
    return this.database.$transaction(async (transaction) => {
      const players = await transaction.$queryRaw<{ id: string }[]>`SELECT id FROM players WHERE id = ${input.playerId}::uuid FOR UPDATE`;
      if (!players[0]) throw new BusinessError('PLAYER_NOT_FOUND', 'No Player is linked to this account.');

      const existing = await transaction.businessOperation.findFirst({
        where: { playerId: input.playerId, sourceChannel: SourceChannel.UI, idempotencyKey: operationKey },
        select: { id: true, resultSummary: true },
      });
      if (existing) {
        const persisted = await this.readPersistedStella(transaction, input.playerId, existing.id, existing.resultSummary, true);
        if (persisted) return persisted;
        throw new BusinessError('STELLA_IDEMPOTENCY_CONFLICT', 'Cette intention Stella est déjà en cours.');
      }

      const definition = await transaction.itemDefinition.findUnique({
        where: { externalKey: MASTERLESS_STELLA_FORTUNA_KEY }, select: { id: true, isActive: true },
      });
      if (!definition?.isActive) throw new BusinessError('STELLA_UNAVAILABLE', 'Masterless Stella Fortuna est indisponible.');
      const balances = await transaction.$queryRaw<{ quantity: bigint }[]>`
        SELECT quantity FROM player_items WHERE player_id = ${input.playerId}::uuid AND item_id = ${definition.id}::uuid FOR UPDATE
      `;
      const quantity = balances[0]?.quantity ?? 0n;
      if (quantity < 1n) throw new BusinessError('STELLA_UNAVAILABLE', 'Vous ne possédez aucune Masterless Stella Fortuna.');

      const possession = await transaction.playerCharacter.findUnique({
        where: { playerId_characterId: { playerId: input.playerId, characterId: input.characterId } },
        include: { character: { select: { isActive: true, rarity: true } } },
      });
      if (!possession) throw new BusinessError('BOX_CHARACTER_NOT_OWNED', 'Ce personnage ne fait pas partie de votre Box.');
      if (!possession.character.isActive) throw new BusinessError('STELLA_CHARACTER_INACTIVE', 'Ce personnage n’est pas actif.');
      if (possession.character.rarity !== 5) throw new BusinessError('STELLA_CHARACTER_RARITY_INVALID', 'Une Stella peut uniquement être utilisée sur un personnage 5★.');

      let c6Progression: StellaProgression | null = null;
      if (possession.constellation === 6) {
        const progression = await this.c6.progress(transaction, input.playerId, input.characterId, input.now, input.random);
        if (progression.type === 'moras') throw new BusinessError('STELLA_C6_MAXED', 'Les statistiques Concours de ce personnage sont déjà au maximum.');
        c6Progression = { type: 'stat', stat: progression.stat, valueAfter: progression.stats[progression.stat] };
      }

      const operation = await transaction.businessOperation.create({ data: {
        playerId: input.playerId, operationType: 'box.stella.use', sourceChannel: SourceChannel.UI, idempotencyKey: operationKey,
      }, select: { id: true } });
      await transaction.playerItem.update({
        where: { playerId_itemId: { playerId: input.playerId, itemId: definition.id } },
        data: { quantity: { decrement: 1n } },
      });
      const acquisition = await this.possessions.acquire(transaction, input.playerId, input.characterId, input.now);
      if (acquisition.reachedC6) {
        const stats = await this.c6.unlock(transaction, input.playerId, input.characterId, input.now);
        c6Progression = { type: 'unlocked', stats };
      }
      const character = await this.readCharacter(transaction, input.playerId, input.characterId);
      if (!character) throw new Error('The Stella possession disappeared during its transaction.');
      const stellaRemaining = quantity - 1n;
      await transaction.businessOperation.update({ where: { id: operation.id }, data: {
        status: OperationStatus.COMPLETED, completedAt: input.now,
        resultSummary: {
          characterId: input.characterId, stellaRemaining: stellaRemaining.toString(),
          ...(c6Progression ? { c6Progression } : {}),
        },
      } });
      return { operation: { id: operation.id, alreadyProcessed: false }, character, stellaRemaining, c6Progression };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20_000 });
  }

  private async findPersistedStella(playerId: string, operationKey: string) {
    const operation = await this.database.businessOperation.findFirst({
      where: { playerId, sourceChannel: SourceChannel.UI, idempotencyKey: operationKey },
      select: { id: true, resultSummary: true },
    });
    return operation ? this.readPersistedStella(this.database, playerId, operation.id, operation.resultSummary, true) : null;
  }

  private async readPersistedStella(
    client: PrismaClient | Prisma.TransactionClient, playerId: string, operationId: string,
    summary: Prisma.JsonValue | null, alreadyProcessed: boolean,
  ): Promise<StellaUseResult | null> {
    if (!summary || typeof summary !== 'object' || Array.isArray(summary)) return null;
    const characterId = summary.characterId;
    const remaining = summary.stellaRemaining;
    if (typeof characterId !== 'string' || typeof remaining !== 'string' || !/^\d+$/.test(remaining)) return null;
    const character = await this.readCharacter(client, playerId, characterId);
    if (!character) return null;
    return {
      operation: { id: operationId, alreadyProcessed }, character, stellaRemaining: BigInt(remaining),
      c6Progression: parseStellaProgression(summary.c6Progression),
    };
  }

  private async readCharacter(client: PrismaClient | Prisma.TransactionClient, playerId: string, characterId: string) {
    const row = await client.playerCharacter.findUnique({ where: { playerId_characterId: { playerId, characterId } }, select: boxSelection });
    if (!row) return null;
    const needsC6CompetitionProgress = row.character.rarity === 5 && row.constellation === 6;
    const progress = needsC6CompetitionProgress ? await client.c6CompetitionProgress.findUnique({ where: { playerId_characterId: { playerId, characterId } }, select: { strength: true, intelligence: true, beauty: true, charisma: true, popularity: true } }) : null;
    if (needsC6CompetitionProgress && !progress) throw new Error(`C6 competition progression missing for possession ${playerId}/${characterId}.`);
    return toBoxCharacter(row, progress ? c6Stats(progress) : null);
  }
}

function parseSortPreference(value: Prisma.JsonValue | undefined): BoxSortPreference | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { sortKey, direction } = value;
  return typeof sortKey === 'string' && boxSortKeys.includes(sortKey as BoxSortPreference['sortKey'])
    && typeof direction === 'string' && boxSortDirections.includes(direction as BoxSortPreference['direction'])
    ? { sortKey: sortKey as BoxSortPreference['sortKey'], direction: direction as BoxSortPreference['direction'] }
    : null;
}

function parseStellaProgression(value: Prisma.JsonValue | undefined): StellaProgression | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (value.type === 'stat' && typeof value.stat === 'string' && c6StatKeys.includes(value.stat as C6StatKey)
    && typeof value.valueAfter === 'number' && Number.isInteger(value.valueAfter)) {
    return { type: 'stat', stat: value.stat as C6StatKey, valueAfter: value.valueAfter };
  }
  if (value.type === 'unlocked' && isC6Stats(value.stats)) return { type: 'unlocked', stats: value.stats };
  return null;
}

function isC6Stats(value: Prisma.JsonValue | undefined): value is C6Stats {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && c6StatKeys.every((key) => typeof value[key] === 'number' && Number.isInteger(value[key])));
}

function c6Stats(value: { strength: number; intelligence: number; beauty: number; charisma: number; popularity: number }): C6CompetitionStats {
  return { strength: value.strength, intelligence: value.intelligence, beauty: value.beauty, charisma: value.charisma, popularity: value.popularity, max: C6_COMPETITION_STAT_MAX }
}
function toBoxCharacter(row: BoxRow, c6CompetitionStats: C6CompetitionStats | null): BoxCharacter {
  if (row.character.rarity !== 4 && row.character.rarity !== 5) throw new Error(`Invalid stored rarity for ${row.character.id}.`);
  if (!isElementKey(row.character.elementKey)) throw new Error(`Invalid stored element for ${row.character.id}.`);
  return {
    ...row.character, rarity: row.character.rarity, elementKey: row.character.elementKey,
    constellation: Math.min(6, Math.max(0, row.constellation)), copies: row.copies,
    firstObtainedAt: row.firstObtainedAt, favorite: row.favorite,
    c6CompetitionStats,
  };
}
