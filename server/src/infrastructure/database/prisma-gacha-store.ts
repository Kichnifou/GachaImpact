import { OperationStatus, Prisma, SourceChannel, type PrismaClient } from '../../../generated/prisma/client.js';
import { BusinessError } from '../../application/errors.js';
import { GACHA_HISTORY_PAGE_SIZE, type CurrentBanner, type GachaHistoryPage, type GachaPassiveEffect, type GachaPullInput, type GachaPullResult, type GachaStore, type PlayerGachaState, type PullResultRecord } from '../../application/gacha/gacha-store.js';
import type { BannerVoteWeight, FeaturedSelection, GachaCharacter } from '../../domain/gacha/gacha.js';
import { PULL_COST, resolvePulls, type PullState } from '../../domain/gacha/pull.js';
import { elementKeys, isElementKey, isResourceKey, particleResourceKey, type ElementKey, type ResourceKey } from '../../domain/economy/resources.js';
import { isPrismaConcurrencyCollision } from './prisma-concurrency.js';
import { PrismaEconomyService } from './prisma-economy-service.js';
import { PrismaCharacterPossessionService } from './prisma-character-possession-service.js';
import { PrismaC6ProgressionService } from './prisma-c6-progression-service.js';
import { c6StatKeys, type C6StatKey } from '../../domain/contest/c6-progress.js';
import { applyExactMultiplier, deriveActiveTeamGachaEffects, type ActiveTeamGachaEffects, type ExactMultiplier } from '../../domain/team/team-passives.js';
import { PrismaPlayerXpService } from './prisma-player-xp-service.js';
import type { DailyChallengeProgressor } from '../../application/daily-challenge/daily-challenge-store.js';
import { getBusinessDate } from '../../domain/time/business-date.js';

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
    private readonly xp = new PrismaPlayerXpService(),
    private readonly dailyChallenges?: DailyChallengeProgressor,
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

  public async getHistory(playerId: string, page: number): Promise<GachaHistoryPage> {
    const totalResults = await this.database.pullResult.count({ where: { pullOperation: { playerId } } });
    const totalPages = Math.ceil(totalResults / GACHA_HISTORY_PAGE_SIZE);
    const rows = await this.database.pullResult.findMany({
      where: { pullOperation: { playerId } },
      orderBy: [
        { pullOperation: { createdAt: 'desc' } },
        { pullOperationId: 'desc' },
        { resultIndex: 'desc' },
      ],
      skip: (page - 1) * GACHA_HISTORY_PAGE_SIZE,
      take: GACHA_HISTORY_PAGE_SIZE,
      include: {
        character: { select: characterSelection },
        pullOperation: { select: { id: true, pullCount: true, createdAt: true } },
      },
    });
    return {
      page,
      pageSize: GACHA_HISTORY_PAGE_SIZE,
      totalResults,
      totalPages,
      hasPrevious: page > 1,
      hasNext: page < totalPages,
      results: rows.map((result) => ({
        operationId: result.pullOperation.id,
        operationPullCount: result.pullOperation.pullCount as 1 | 10,
        occurredAt: result.pullOperation.createdAt,
        index: result.resultIndex,
        resultType: result.resultType as 'character' | 'resource',
        character: result.character ? toCharacter(result.character) : null,
        rarity: result.rarity as 4 | 5 | null,
        resourceKey: result.resourceKey && isResourceKey(result.resourceKey) ? result.resourceKey : null,
        resourceAmount: result.resourceAmount,
        wasNewCharacter: result.wasNewCharacter,
        constellationAfter: result.constellationAfter,
        copiesAfter: result.copiesAfter,
        wasFiftyFifty: result.wasFiftyFifty,
        wonFiftyFifty: result.wonFiftyFifty,
        guaranteeConsumed: result.guaranteeConsumed,
        captureTriggered: result.captureTriggered,
        bonusRewards: readBonusRewards(result.snapshot),
        c6Progression: readC6Progression(result.snapshot),
        passiveEffects: readPassiveEffects(result.snapshot),
        pity5AtPull: readPityAtPull(result.snapshot, 'pity5'),
        pity4AtPull: readPityAtPull(result.snapshot, 'pity4'),
      })),
    };
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

      const activeTeam = await readActiveTeamSnapshot(transaction, input.playerId);

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
        const resolved = resolvePulls(
          state,
          { target, featuredFiveStars: banner.featuredFiveStars, featuredFourStars: banner.featuredFourStars },
          1,
          input.random,
          activeTeam.effects.fiveStarChanceBonusBasisPoints,
        ).results[0]!;
        state = resolved.stateAfter;
        const bonusRewards: { resourceKey: ResourceKey; amount: bigint; causeKey: string }[] = [];
        const passiveEffects: GachaPassiveEffect[] = activeTeam.effects.fiveStarChanceBonusBasisPoints > 0
          ? [{ elementKey: 'hydro', type: 'five_star_chance_bonus', basisPoints: activeTeam.effects.fiveStarChanceBonusBasisPoints }]
          : [];
        let c6Progression: PullResultRecord['c6Progression'] = null;
        let record: PullResultRecord;

        if (resolved.outcome.type === 'resource') {
          const amountBefore = resolved.outcome.amount;
          const multiplier = resourcePassiveMultiplier(resolved.outcome.resourceKey, activeTeam.effects);
          const resourceAmount = applyExactMultiplier(amountBefore, multiplier);
          if (multiplier.numerator !== multiplier.denominator) {
            passiveEffects.push({
              elementKey: resolved.outcome.resourceKey === 'moras' ? 'geo' : 'pyro',
              type: 'secondary_reward_multiplier',
              numerator: multiplier.numerator,
              denominator: multiplier.denominator,
              amountBefore,
              amountAfter: resourceAmount,
            });
          }
          await this.economy.credit(transaction, {
            playerId: input.playerId, playerElementKey: input.playerElementKey,
            resourceKey: resolved.outcome.resourceKey, amount: resourceAmount,
            causeKey: 'gacha.pull.secondary-reward', domainKey: 'gacha', operationId: businessOperation.id, sourceChannel: SourceChannel.UI,
          });
          record = {
            index, resultType: 'resource', character: null, rarity: null,
            resourceKey: resolved.outcome.resourceKey, resourceAmount,
            wasNewCharacter: null, constellationAfter: null, copiesAfter: null,
            wasFiftyFifty: false, wonFiftyFifty: null, guaranteeConsumed: false, captureTriggered: false, bonusRewards, c6Progression, passiveEffects,
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
              if (progression.type === 'stat') {
                c6Progression = { type: 'stat', stat: progression.stat, valueAfter: progression.stats[progression.stat] };
              } else {
                c6Progression = { type: 'maxed' };
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
            guaranteeConsumed: resolved.outcome.guaranteeConsumed, captureTriggered: resolved.outcome.captureTriggered, bonusRewards, c6Progression, passiveEffects,
          };
        }

        if (activeTeam.effects.xpReward && succeedsOneIn(activeTeam.effects.xpReward.oneIn, input.random)) {
          const xpGrant = await this.xp.grant(transaction, {
            playerId: input.playerId, playerElementKey: input.playerElementKey,
            amount: BigInt(activeTeam.effects.xpReward.amount), source: 'team.passive.cryo', now: input.now,
            operationId: businessOperation.id, sourceChannel: SourceChannel.UI, random: input.random,
          });
          passiveEffects.push({
            elementKey: 'cryo', type: 'xp', amount: xpGrant.amount, xpAfter: xpGrant.stateAfter.xp,
            levelsReached: xpGrant.levelsReached, overflowRewardsGranted: xpGrant.overflowRewardsGranted,
          });
          bonusRewards.push(...xpGrant.rewards.map((reward) => ({ ...reward, causeKey: 'player.xp.level-reward' })));
        }

        if (activeTeam.effects.pity5Reward && succeedsOneIn(activeTeam.effects.pity5Reward.oneIn, input.random)) {
          const pityBefore = state.pity5;
          state = { ...state, pity5: Math.min(89, state.pity5 + activeTeam.effects.pity5Reward.amount) };
          passiveEffects.push({ elementKey: 'electro', type: 'pity5', amount: state.pity5 - pityBefore, requestedAmount: 2 });
        }

        if (activeTeam.effects.primogemRecovery && succeedsOneIn(activeTeam.effects.primogemRecovery.oneIn, input.random)) {
          const amount = BigInt(activeTeam.effects.primogemRecovery.amount);
          await this.economy.credit(transaction, {
            playerId: input.playerId, playerElementKey: input.playerElementKey, resourceKey: 'primogems', amount,
            causeKey: 'team.passive.anemo.primogem-recovery', domainKey: 'gacha', operationId: businessOperation.id, sourceChannel: SourceChannel.UI,
          });
          bonusRewards.push({ resourceKey: 'primogems', amount, causeKey: 'team.passive.anemo.primogem-recovery' });
          passiveEffects.push({ elementKey: 'anemo', type: 'primogem_recovery', amount });
        }

        if (activeTeam.effects.dendroBundle && succeedsOneIn(activeTeam.effects.dendroBundle.oneIn, input.random)) {
          const bundleRewards = dendroRewards(activeTeam.effects.dendroBundle);
          for (const reward of bundleRewards) {
            await this.economy.credit(transaction, {
              playerId: input.playerId, playerElementKey: input.playerElementKey,
              resourceKey: reward.resourceKey, amount: reward.amount,
              causeKey: 'team.passive.dendro.bundle', domainKey: 'gacha', operationId: businessOperation.id, sourceChannel: SourceChannel.UI,
            });
            bonusRewards.push({ ...reward, causeKey: 'team.passive.dendro.bundle' });
          }
          passiveEffects.push({ elementKey: 'dendro', type: 'resource_bundle', rewards: bundleRewards });
        }

        await transaction.pullResult.create({ data: {
          pullOperationId: pullOperation.id, resultIndex: index, resultType: record.resultType,
          characterId: record.character?.id, rarity: record.rarity, resourceKey: record.resourceKey,
          resourceAmount: record.resourceAmount, wasNewCharacter: record.wasNewCharacter,
          constellationAfter: record.constellationAfter, copiesAfter: record.copiesAfter,
          wasFiftyFifty: record.wasFiftyFifty, wonFiftyFifty: record.wonFiftyFifty,
          guaranteeConsumed: record.guaranteeConsumed, captureTriggered: record.captureTriggered,
          snapshot: snapshot(resolved.stateBefore, state, bonusRewards, c6Progression, activeTeam, passiveEffects), createdAt: input.now,
        } });
        records.push(record);
      }

      const playerState = await transaction.playerGachaState.update({ where: { playerId: input.playerId }, data: state, select: stateSelection });
      await this.dailyChallenges?.progress(transaction, {
        playerId: input.playerId,
        playerElementKey: input.playerElementKey,
        businessDate: getBusinessDate(input.now),
        type: 'pulls',
        amount: BigInt(input.count),
        now: input.now,
        operationId: businessOperation.id,
        sourceChannel: SourceChannel.UI,
      });
      await transaction.businessOperation.update({ where: { id: businessOperation.id }, data: {
        status: OperationStatus.COMPLETED, completedAt: input.now,
        resultSummary: { pullOperationId: pullOperation.id, pullCount: input.count, primogemCost: cost.toString() },
      } });
      return { operation: { id: pullOperation.id, pullCount: input.count, primogemCost: cost, createdAt: input.now, alreadyProcessed: false }, results: records, playerState };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 20_000,
    });
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
    const currentPlayerState = await client.playerGachaState.findUniqueOrThrow({ where: { playerId: row.playerId }, select: stateSelection });
    const playerState = readPersistedPlayerState(row.results.at(-1)?.snapshot ?? null, row.targetCharacterId) ?? currentPlayerState;
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
        bonusRewards: readBonusRewards(result.snapshot), c6Progression: readC6Progression(result.snapshot),
        passiveEffects: readPassiveEffects(result.snapshot),
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

function snapshot(
  before: PullState,
  after: PullState,
  bonusRewards: readonly { resourceKey: ResourceKey; amount: bigint; causeKey: string }[],
  c6Progression: PullResultRecord['c6Progression'],
  activeTeam: ActiveTeamSnapshot,
  passiveEffects: readonly GachaPassiveEffect[],
): Prisma.InputJsonObject {
  return {
    stateBefore: snapshotState(before), stateAfter: snapshotState(after),
    bonusRewards: bonusRewards.map(({ resourceKey, amount, causeKey }) => ({ resourceKey, amount: amount.toString(), causeKey })),
    activeTeam: activeTeamSnapshotJson(activeTeam),
    passiveEffects: passiveEffects.map(passiveEffectJson),
    ...(c6Progression ? { c6Progression } : {}),
  };
}

type ActiveTeamSnapshot = Readonly<{
  teamId: string | null;
  elements: readonly ElementKey[];
  effects: ActiveTeamGachaEffects;
}>;

async function readActiveTeamSnapshot(transaction: Prisma.TransactionClient, playerId: string): Promise<ActiveTeamSnapshot> {
  const team = await transaction.team.findFirst({
    where: { playerId, isActive: true },
    select: {
      id: true,
      members: {
        where: { character: { isActive: true } },
        orderBy: { position: 'asc' },
        select: { character: { select: { elementKey: true } } },
      },
    },
  });
  const elements = (team?.members ?? []).flatMap(({ character }) => isElementKey(character.elementKey) ? [character.elementKey] : []);
  return { teamId: team?.id ?? null, elements, effects: deriveActiveTeamGachaEffects(elements) };
}

function resourcePassiveMultiplier(resourceKey: ResourceKey, effects: ActiveTeamGachaEffects): ExactMultiplier {
  if (resourceKey === 'moras') return effects.secondaryMoraMultiplier;
  if (resourceKey.startsWith('particles_')) return effects.secondaryParticleMultiplier;
  return { numerator: 1, denominator: 1 };
}

function succeedsOneIn(oneIn: number, random: GachaPullInput['random']): boolean {
  return random.nextInt(oneIn) === 0;
}

function dendroRewards(bundle: NonNullable<ActiveTeamGachaEffects['dendroBundle']>): readonly { resourceKey: ResourceKey; amount: bigint }[] {
  return [
    { resourceKey: 'primogems', amount: BigInt(bundle.primogems) },
    { resourceKey: 'moras', amount: BigInt(bundle.moras) },
    ...elementKeys.map((element) => ({ resourceKey: particleResourceKey(element), amount: BigInt(bundle.particlesPerElement) })),
  ];
}

function activeTeamSnapshotJson(activeTeam: ActiveTeamSnapshot): Prisma.InputJsonObject {
  return {
    teamId: activeTeam.teamId,
    elements: [...activeTeam.elements],
    effects: activeTeam.effects as unknown as Prisma.InputJsonObject,
  };
}

function passiveEffectJson(effect: GachaPassiveEffect): Prisma.InputJsonObject {
  if (effect.type === 'five_star_chance_bonus') return { ...effect };
  if (effect.type === 'secondary_reward_multiplier') {
    return { ...effect, amountBefore: effect.amountBefore.toString(), amountAfter: effect.amountAfter.toString() };
  }
  if (effect.type === 'xp') {
    return { ...effect, amount: effect.amount.toString(), xpAfter: effect.xpAfter.toString(), levelsReached: [...effect.levelsReached] };
  }
  if (effect.type === 'pity5') return { ...effect };
  if (effect.type === 'primogem_recovery') return { ...effect, amount: effect.amount.toString() };
  return { ...effect, rewards: effect.rewards.map(({ resourceKey, amount }) => ({ resourceKey, amount: amount.toString() })) };
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

function readC6Progression(value: Prisma.JsonValue | null): PullResultRecord['c6Progression'] {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !('c6Progression' in value)) return null;
  const progression = value.c6Progression;
  if (!progression || typeof progression !== 'object' || Array.isArray(progression) || typeof progression.type !== 'string') return null;
  if (progression.type === 'maxed') return { type: 'maxed' };
  if (progression.type !== 'stat' || typeof progression.stat !== 'string' || typeof progression.valueAfter !== 'number') return null;
  if (!c6StatKeys.includes(progression.stat as C6StatKey) || !Number.isInteger(progression.valueAfter)) return null;
  return { type: 'stat', stat: progression.stat as C6StatKey, valueAfter: progression.valueAfter };
}

function readPassiveEffects(value: Prisma.JsonValue | null): PullResultRecord['passiveEffects'] {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !('passiveEffects' in value) || !Array.isArray(value.passiveEffects)) return [];
  return value.passiveEffects.flatMap((effect): GachaPassiveEffect[] => {
    if (!effect || typeof effect !== 'object' || Array.isArray(effect)) return [];
    const { elementKey, type } = effect;
    if (!isElementKeyValue(elementKey) || typeof type !== 'string') return [];
    if (elementKey === 'hydro' && type === 'five_star_chance_bonus' && isNonNegativeInteger(effect.basisPoints)) {
      return [{ elementKey, type, basisPoints: effect.basisPoints }];
    }
    if ((elementKey === 'pyro' || elementKey === 'geo') && type === 'secondary_reward_multiplier'
      && isPositiveInteger(effect.numerator) && isPositiveInteger(effect.denominator)
      && typeof effect.amountBefore === 'string' && typeof effect.amountAfter === 'string') {
      return [{ elementKey, type, numerator: effect.numerator, denominator: effect.denominator, amountBefore: BigInt(effect.amountBefore), amountAfter: BigInt(effect.amountAfter) }];
    }
    if (elementKey === 'cryo' && type === 'xp' && typeof effect.amount === 'string' && typeof effect.xpAfter === 'string'
      && Array.isArray(effect.levelsReached) && effect.levelsReached.every(isNonNegativeInteger) && isNonNegativeInteger(effect.overflowRewardsGranted)) {
      return [{ elementKey, type, amount: BigInt(effect.amount), xpAfter: BigInt(effect.xpAfter), levelsReached: effect.levelsReached, overflowRewardsGranted: effect.overflowRewardsGranted }];
    }
    if (elementKey === 'electro' && type === 'pity5' && isNonNegativeInteger(effect.amount) && effect.requestedAmount === 2) {
      return [{ elementKey, type, amount: effect.amount, requestedAmount: 2 }];
    }
    if (elementKey === 'anemo' && type === 'primogem_recovery' && typeof effect.amount === 'string') {
      return [{ elementKey, type, amount: BigInt(effect.amount) }];
    }
    if (elementKey === 'dendro' && type === 'resource_bundle' && Array.isArray(effect.rewards)) {
      const rewards = effect.rewards.flatMap((reward) => {
        if (!reward || typeof reward !== 'object' || Array.isArray(reward) || !isResourceKeyValue(reward.resourceKey) || typeof reward.amount !== 'string') return [];
        return [{ resourceKey: reward.resourceKey, amount: BigInt(reward.amount) }];
      });
      return rewards.length === effect.rewards.length ? [{ elementKey, type, rewards }] : [];
    }
    return [];
  });
}

function isElementKeyValue(value: unknown): value is ElementKey {
  return typeof value === 'string' && isElementKey(value);
}

function isResourceKeyValue(value: unknown): value is ResourceKey {
  return typeof value === 'string' && isResourceKey(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return isNonNegativeInteger(value) && value > 0;
}

function readPityAtPull(value: Prisma.JsonValue | null, key: 'pity5' | 'pity4'): number | null {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !('stateBefore' in value)) return null;
  const stateBefore = value.stateBefore;
  if (!stateBefore || typeof stateBefore !== 'object' || Array.isArray(stateBefore)) return null;
  const pity = stateBefore[key];
  return typeof pity === 'number' && Number.isInteger(pity) && pity >= 0 ? pity + 1 : null;
}

function readPersistedPlayerState(value: Prisma.JsonValue | null, selectedBannerCharacterId: string): PlayerGachaState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !('stateAfter' in value)) return null;
  const state = value.stateAfter;
  if (!state || typeof state !== 'object' || Array.isArray(state)) return null;
  const integerKeys = ['pity5', 'pity4', 'captureProgress', 'fiftyFiftyLostStreak'] as const;
  const bigintKeys = ['totalPulls', 'totalFiveStars', 'totalFourStars', 'fiftyFiftyWon', 'fiftyFiftyLost', 'capturesTriggered'] as const;
  if (!integerKeys.every((key) => isNonNegativeInteger(state[key]))) return null;
  if (!bigintKeys.every((key) => typeof state[key] === 'string')) return null;
  if (typeof state.guaranteedFeatured5 !== 'boolean') return null;
  return {
    pity5: state.pity5 as number,
    pity4: state.pity4 as number,
    guaranteedFeatured5: state.guaranteedFeatured5,
    captureProgress: state.captureProgress as number,
    fiftyFiftyLostStreak: state.fiftyFiftyLostStreak as number,
    selectedBannerCharacterId,
    totalPulls: BigInt(state.totalPulls as string),
    totalFiveStars: BigInt(state.totalFiveStars as string),
    totalFourStars: BigInt(state.totalFourStars as string),
    fiftyFiftyWon: BigInt(state.fiftyFiftyWon as string),
    fiftyFiftyLost: BigInt(state.fiftyFiftyLost as string),
    capturesTriggered: BigInt(state.capturesTriggered as string),
  };
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
