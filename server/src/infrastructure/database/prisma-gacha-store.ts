import { OperationStatus, Prisma, SourceChannel, type PrismaClient } from '../../../generated/prisma/client.js';
import { BusinessError } from '../../application/errors.js';
import type { CurrentBanner, GachaPullInput, GachaPullResult, GachaStore, PlayerGachaState, PullResultRecord } from '../../application/gacha/gacha-store.js';
import type { BannerVoteWeight, FeaturedSelection, GachaCharacter } from '../../domain/gacha/gacha.js';
import { PULL_COST, resolvePulls, type PullState } from '../../domain/gacha/pull.js';
import { isElementKey, isResourceKey, type ResourceKey } from '../../domain/economy/resources.js';
import { isPrismaConcurrencyCollision } from './prisma-concurrency.js';
import { PrismaEconomyService } from './prisma-economy-service.js';
import { PrismaCharacterPossessionService } from './prisma-character-possession-service.js';
import { PrismaC6ProgressionService } from './prisma-c6-progression-service.js';

const characterSelection = {
  id: true, externalKey: true, name: true, rarity: true, elementKey: true, weaponType: true,
  region: true, classKey: true, iconPath: true, splashPath: true, wishPath: true, fullbodyPath: true,
} satisfies Prisma.CharacterSelect;

const stateSelection = {
  pity5: true, pity4: true, guaranteedFeatured5: true, captureProgress: true, fiftyFiftyLostStreak: true,
  selectedBannerCharacterId: true, totalPulls: true, totalFiveStars: true, totalFourStars: true,
  fiftyFiftyWon: true, fiftyFiftyLost: true, capturesTriggered: true,
} satisfies Prisma.PlayerGachaStateSelect;
const MAX_PULL_ATTEMPTS = 5;

export class PrismaGachaStore implements GachaStore {
  public constructor(
    private readonly database: PrismaClient,
    private readonly economy = new PrismaEconomyService(),
    private readonly possessions = new PrismaCharacterPossessionService(),
    private readonly c6 = new PrismaC6ProgressionService(),
  ) {}

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

  public async pull(input: GachaPullInput): Promise<GachaPullResult> {
    const operationKey = `gacha.pull:${input.playerId}:${input.idempotencyKey}`;
    for (let attempt = 1; attempt <= MAX_PULL_ATTEMPTS; attempt += 1) {
      const existing = await this.findPersistedPull(input.playerId, operationKey, input.count);
      if (existing) return existing;
      try {
        return await this.pullInTransaction(input, operationKey);
      } catch (error) {
        if (!isPrismaConcurrencyCollision(error)) throw error;
        const persisted = await this.findPersistedPull(input.playerId, operationKey, input.count);
        if (persisted) return persisted;
        if (attempt === MAX_PULL_ATTEMPTS) throw error;
        await waitForConcurrentTransaction(attempt);
      }
    }
    throw new Error('Gacha pull exhausted all retry attempts.');
  }

  private async pullInTransaction(input: GachaPullInput, operationKey: string): Promise<GachaPullResult> {
    return this.database.$transaction(async (transaction) => {
      const lockedPlayers = await transaction.$queryRaw<{ elementKey: string | null }[]>`
        SELECT element_key AS "elementKey" FROM players WHERE id = ${input.playerId}::uuid FOR UPDATE
      `;
      const player = lockedPlayers[0];
      if (!player) throw new BusinessError('PLAYER_NOT_FOUND', 'No Player is linked to this account.');
      if (!player.elementKey || !isElementKey(player.elementKey) || player.elementKey !== input.playerElementKey) {
        throw new BusinessError('PLAYER_ELEMENT_REQUIRED', 'A permanent element is required to perform a pull.');
      }

      const existingOperation = await transaction.businessOperation.findFirst({
        where: { sourceChannel: SourceChannel.UI, idempotencyKey: operationKey }, select: { id: true },
      });
      if (existingOperation) {
        const existing = await this.readPersistedPull(transaction, existingOperation.id, input.count, true);
        if (existing) return existing;
        throw new BusinessError('GACHA_IDEMPOTENCY_CONFLICT', 'Cette intention d’Invocation est déjà en cours.');
      }

      const bannerRow = await transaction.bannerRotation.findFirst({
        where: { status: 'ACTIVE', startsAt: { lte: input.now }, endsAt: { gt: input.now } },
        include: { featuredCharacters: { include: { character: { select: characterSelection } }, orderBy: [{ rarity: 'desc' }, { slot: 'asc' }] } },
      });
      if (!bannerRow) throw new BusinessError('GACHA_BANNER_UNAVAILABLE', 'Aucune bannière Gacha active n’est disponible.');
      const banner = toBanner(bannerRow);
      if (banner.featuredFiveStars.length !== 4 || banner.featuredFourStars.length !== 6) {
        throw new BusinessError('GACHA_BANNER_INVALID', 'La bannière active ne contient pas la sélection attendue.');
      }

      await transaction.$queryRaw`SELECT player_id FROM player_gacha_states WHERE player_id = ${input.playerId}::uuid FOR UPDATE`;
      const storedState = await transaction.playerGachaState.findUnique({ where: { playerId: input.playerId }, select: stateSelection });
      if (!storedState) throw new BusinessError('GACHA_BANNER_UNAVAILABLE', 'L’état Gacha du joueur est indisponible.');
      if (!storedState.selectedBannerCharacterId) throw new BusinessError('GACHA_TARGET_REQUIRED', 'Choisissez une cible 5★ avant d’invoquer.');
      const target = banner.featuredFiveStars.find(({ id }) => id === storedState.selectedBannerCharacterId);
      if (!target) throw new BusinessError('GACHA_TARGET_INVALID', 'La cible choisie ne fait pas partie de la bannière active.');

      const businessOperation = await transaction.businessOperation.create({ data: {
        playerId: input.playerId, operationType: 'gacha.pull', sourceChannel: SourceChannel.UI, idempotencyKey: operationKey,
      }, select: { id: true } });
      const cost = PULL_COST[input.count];
      const pullOperation = await transaction.pullOperation.create({ data: {
        playerId: input.playerId, bannerRotationId: banner.id, targetCharacterId: target.id,
        pullCount: input.count, primogemCost: cost, sourceChannel: SourceChannel.UI,
        businessOperationId: businessOperation.id, createdAt: input.now,
      }, select: { id: true } });

      await this.economy.debit(transaction, {
        playerId: input.playerId, playerElementKey: input.playerElementKey, resourceKey: 'primogems', amount: cost,
        causeKey: 'gacha.pull.cost', domainKey: 'gacha', operationId: businessOperation.id, sourceChannel: SourceChannel.UI,
      });

      let state: PullState = storedState;
      const records: PullResultRecord[] = [];
      for (let index = 1; index <= input.count; index += 1) {
        const resolved = resolvePulls(state, { target, featuredFiveStars: banner.featuredFiveStars, featuredFourStars: banner.featuredFourStars }, 1, input.random).results[0]!;
        state = resolved.stateAfter;
        const bonusRewards: { resourceKey: ResourceKey; amount: bigint; causeKey: string }[] = [];
        let record: PullResultRecord;

        if (resolved.outcome.type === 'resource') {
          await this.economy.credit(transaction, {
            playerId: input.playerId, playerElementKey: input.playerElementKey,
            resourceKey: resolved.outcome.resourceKey, amount: resolved.outcome.amount,
            causeKey: 'gacha.pull.secondary-reward', domainKey: 'gacha', operationId: businessOperation.id, sourceChannel: SourceChannel.UI,
          });
          record = {
            index, resultType: 'resource', character: null, rarity: null,
            resourceKey: resolved.outcome.resourceKey, resourceAmount: resolved.outcome.amount,
            wasNewCharacter: null, constellationAfter: null, copiesAfter: null,
            wasFiftyFifty: false, wonFiftyFifty: null, guaranteeConsumed: false, captureTriggered: false, bonusRewards,
          };
        } else {
          const acquisition = await this.possessions.acquire(transaction, input.playerId, resolved.outcome.character.id, input.now);
          if (resolved.outcome.rarity === 5 && acquisition.reachedC6) {
            await this.c6.unlock(transaction, input.playerId, resolved.outcome.character.id, input.now);
          }
          if (acquisition.wasAlreadyC6) {
            const refund = resolved.outcome.rarity === 5 ? 160n : 80n;
            bonusRewards.push({ resourceKey: 'primogems', amount: refund, causeKey: 'gacha.c6-duplicate-refund' });
            await this.economy.credit(transaction, {
              playerId: input.playerId, playerElementKey: input.playerElementKey, resourceKey: 'primogems', amount: refund,
              causeKey: 'gacha.c6-duplicate-refund', domainKey: 'gacha', operationId: businessOperation.id, sourceChannel: SourceChannel.UI,
            });
            if (resolved.outcome.rarity === 5) {
              const progression = await this.c6.progress(transaction, input.playerId, resolved.outcome.character.id, input.now, input.random);
              if (progression.type === 'moras') {
                bonusRewards.push({ resourceKey: 'moras', amount: progression.amount, causeKey: 'gacha.c6-maxed-compensation' });
                await this.economy.credit(transaction, {
                  playerId: input.playerId, playerElementKey: input.playerElementKey, resourceKey: 'moras', amount: progression.amount,
                  causeKey: 'gacha.c6-maxed-compensation', domainKey: 'gacha', operationId: businessOperation.id, sourceChannel: SourceChannel.UI,
                });
              }
            }
          }
          record = {
            index, resultType: 'character', character: resolved.outcome.character, rarity: resolved.outcome.rarity,
            resourceKey: null, resourceAmount: null, wasNewCharacter: acquisition.wasNewCharacter,
            constellationAfter: acquisition.constellation, copiesAfter: acquisition.copies,
            wasFiftyFifty: resolved.outcome.wasFiftyFifty, wonFiftyFifty: resolved.outcome.wonFiftyFifty,
            guaranteeConsumed: resolved.outcome.guaranteeConsumed, captureTriggered: resolved.outcome.captureTriggered, bonusRewards,
          };
        }

        await transaction.pullResult.create({ data: {
          pullOperationId: pullOperation.id, resultIndex: index, resultType: record.resultType,
          characterId: record.character?.id, rarity: record.rarity, resourceKey: record.resourceKey,
          resourceAmount: record.resourceAmount, wasNewCharacter: record.wasNewCharacter,
          constellationAfter: record.constellationAfter, copiesAfter: record.copiesAfter,
          wasFiftyFifty: record.wasFiftyFifty, wonFiftyFifty: record.wonFiftyFifty,
          guaranteeConsumed: record.guaranteeConsumed, captureTriggered: record.captureTriggered,
          snapshot: snapshot(resolved.stateBefore, resolved.stateAfter, bonusRewards), createdAt: input.now,
        } });
        records.push(record);
      }

      const playerState = await transaction.playerGachaState.update({ where: { playerId: input.playerId }, data: state, select: stateSelection });
      await transaction.businessOperation.update({ where: { id: businessOperation.id }, data: {
        status: OperationStatus.COMPLETED, completedAt: input.now,
        resultSummary: { pullOperationId: pullOperation.id, pullCount: input.count, primogemCost: cost.toString() },
      } });
      return { operation: { id: pullOperation.id, pullCount: input.count, primogemCost: cost, createdAt: input.now, alreadyProcessed: false }, results: records, playerState };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async findPersistedPull(playerId: string, operationKey: string, count: GachaPullInput['count']) {
    const operation = await this.database.businessOperation.findFirst({ where: { playerId, sourceChannel: SourceChannel.UI, idempotencyKey: operationKey }, select: { id: true } });
    return operation ? this.readPersistedPull(this.database, operation.id, count, true) : null;
  }

  private async readPersistedPull(client: PrismaClient | Prisma.TransactionClient, businessOperationId: string, expectedCount: GachaPullInput['count'], alreadyProcessed: boolean): Promise<GachaPullResult | null> {
    const row = await client.pullOperation.findUnique({ where: { businessOperationId }, include: {
      results: { include: { character: { select: characterSelection } }, orderBy: { resultIndex: 'asc' } },
    } });
    if (!row) return null;
    if (row.pullCount !== expectedCount) throw new BusinessError('GACHA_IDEMPOTENCY_CONFLICT', 'Cette clé d’idempotence correspond à une autre quantité.');
    const playerState = await client.playerGachaState.findUniqueOrThrow({ where: { playerId: row.playerId }, select: stateSelection });
    return {
      operation: { id: row.id, pullCount: expectedCount, primogemCost: row.primogemCost, createdAt: row.createdAt, alreadyProcessed },
      results: row.results.map((result) => ({
        index: result.resultIndex, resultType: result.resultType as 'character' | 'resource',
        character: result.character ? toCharacter(result.character) : null,
        rarity: result.rarity as 4 | 5 | null, resourceKey: result.resourceKey && isResourceKey(result.resourceKey) ? result.resourceKey : null,
        resourceAmount: result.resourceAmount, wasNewCharacter: result.wasNewCharacter,
        constellationAfter: result.constellationAfter, copiesAfter: result.copiesAfter,
        wasFiftyFifty: result.wasFiftyFifty, wonFiftyFifty: result.wonFiftyFifty,
        guaranteeConsumed: result.guaranteeConsumed, captureTriggered: result.captureTriggered,
        bonusRewards: readBonusRewards(result.snapshot),
      })),
      playerState,
    };
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

function snapshot(before: PullState, after: PullState, bonusRewards: readonly { resourceKey: ResourceKey; amount: bigint; causeKey: string }[]): Prisma.InputJsonObject {
  return {
    stateBefore: snapshotState(before), stateAfter: snapshotState(after),
    bonusRewards: bonusRewards.map(({ resourceKey, amount, causeKey }) => ({ resourceKey, amount: amount.toString(), causeKey })),
  };
}

function snapshotState(state: PullState): Prisma.InputJsonObject {
  return {
    pity5: state.pity5, pity4: state.pity4, guaranteedFeatured5: state.guaranteedFeatured5,
    captureProgress: state.captureProgress, fiftyFiftyLostStreak: state.fiftyFiftyLostStreak,
    totalPulls: state.totalPulls.toString(), totalFiveStars: state.totalFiveStars.toString(),
    totalFourStars: state.totalFourStars.toString(), fiftyFiftyWon: state.fiftyFiftyWon.toString(),
    fiftyFiftyLost: state.fiftyFiftyLost.toString(), capturesTriggered: state.capturesTriggered.toString(),
  };
}

function readBonusRewards(value: Prisma.JsonValue | null): PullResultRecord['bonusRewards'] {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !('bonusRewards' in value) || !Array.isArray(value.bonusRewards)) return [];
  return value.bonusRewards.flatMap((reward) => {
    if (!reward || typeof reward !== 'object' || Array.isArray(reward)) return [];
    const { resourceKey, amount, causeKey } = reward;
    return typeof resourceKey === 'string' && isResourceKey(resourceKey) && typeof amount === 'string' && typeof causeKey === 'string'
      ? [{ resourceKey, amount: BigInt(amount), causeKey }] : [];
  });
}

function waitForConcurrentTransaction(attempt: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, attempt * 150));
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
