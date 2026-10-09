import { assertPlayerDomainReady, isPlayerDomainReady } from '../player/player-recovery-readiness.js';
import { lockPlayerMutation, lockPlayerMutationState } from '../player/player-mutation-guard.js';
import { assertCommandTargets } from '../player/player-command-execution.js';
import { commandNow } from '../player/player-command-execution.js';
import type { PlayerExecutionActor } from '../player/player-execution-actor.js';
import { NotificationState, OperationStatus, Prisma, SourceChannel, type PrismaClient } from '../../../generated/prisma/client.js';
import { elementKeys, isElementKey, resourceKeys, type ElementKey } from '../../domain/economy/resources.js';
import { businessDateToDatabaseDate, databaseDateToBusinessDate, getBusinessDate, getBusinessDayStartAt, type Clock } from '../../domain/time/business-date.js';
import type { RandomSource } from '../../domain/wheel/wheel.js';
import {
  calculateBossDamage,
  calculateBossMaxHp,
  calculateBossVictoryTiming,
  calculateContributionBasisPoints,
  calculateNextBossBase,
  calculateRoundedBossAverage,
  getBusinessMonth,
  MONTHLY_BOSS_INITIAL_BASE_HP,
  MONTHLY_BOSS_REWARD,
  monthlyBossName,
  nextBusinessMonth,
  type BossCombatMember,
} from '../../domain/combat/monthly-boss.js';
import { BusinessError } from '../errors.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';
import type { PlayerResourceBalances } from '../player/player-resource-store.js';
import { PrismaEconomyService } from '../../infrastructure/database/prisma-economy-service.js';
import { isPrismaConcurrencyCollision } from '../../infrastructure/database/prisma-concurrency.js';
import { BossArchiveUnavailableError, readTwitchBossContributions, readTwitchBossHistory, type TwitchBossHistoryEntry } from './monthly-boss-archive-history.js';

const MAX_TRANSACTION_ATTEMPTS = 4;
const HISTORY_PAGE_SIZE = 10;

const possessionSelection = {
  characterId: true,
  constellation: true,
  copies: true,
  firstObtainedAt: true,
  favorite: true,
  character: { select: {
    id: true, externalKey: true, name: true, rarity: true, elementKey: true, weaponType: true, region: true,
    iconPath: true, splashPath: true, wishPath: true, fullbodyPath: true, displayOrder: true, isActive: true,
  } },
} satisfies Prisma.PlayerCharacterSelect;

type Possession = Prisma.PlayerCharacterGetPayload<{ select: typeof possessionSelection }>;
type Client = PrismaClient | Prisma.TransactionClient;

export type MonthlyBossCharacter = ReturnType<typeof toCharacter>;
export type MonthlyBossRankingEntry = Readonly<{
  rank: number;
  playerId: string;
  displayName: string;
  totalDamage: bigint;
  attackCount: bigint;
  bestHit: bigint;
}>;

export type MonthlyBossSummary = Readonly<{
  victoryDayCount: number | null;
  daysRemainingAfterVictory: number | null;
  community: {
    participantCount: number;
    attackCount: bigint;
    totalDamage: bigint;
    averageDamage: bigint;
  };
  records: {
    topContributor: MonthlyBossRankingEntry | null;
    biggestHit: { playerId: string; displayName: string; damage: bigint; createdAt: Date } | null;
    mostAttacks: MonthlyBossRankingEntry | null;
    finalBlow: { id: string; displayName: string } | null;
    topThree: readonly MonthlyBossRankingEntry[];
  };
}>;

export type MonthlyBossView = Readonly<{
  businessDate: string;
  boss: {
    id: string;
    monthStart: string;
    name: string;
    baseHp: bigint;
    hpVariationPercent: number;
    maxHp: bigint;
    currentHp: bigint;
    resistanceElementKey: ElementKey;
    defeatedAt: Date | null;
    finalBlowPlayer: { id: string; displayName: string } | null;
    nextBaseAdjustment: bigint | null;
  };
  status: 'ALIVE' | 'DEFEATED';
  attackState: 'AVAILABLE' | 'USED' | 'DEFEATED';
  todayDamage: bigint | null;
  canAttack: boolean;
  loadout: { slots: readonly { position: 1 | 2 | 3 | 4; character: MonthlyBossCharacter | null }[] };
  availableCharacters: readonly MonthlyBossCharacter[];
  preview: null | { totalDamage: bigint; contributions: ReturnType<typeof calculateBossDamage>['contributions'] };
  reward: typeof MONTHLY_BOSS_REWARD;
  participation: null | { rank: number; totalDamage: bigint; attackCount: bigint; bestHit: bigint; contributionBasisPoints: bigint };
  ranking: readonly MonthlyBossRankingEntry[];
  defeatedSummary: MonthlyBossSummary | null;
  publicSummary?: MonthlyBossSummary;
  playerStats: { totalDamage: bigint; totalAttacks: bigint; totalParticipated: bigint; totalRewarded: bigint; finalBlows: bigint; bestHit: bigint };
}>;

export class MonthlyBossService {
  public constructor(
    private readonly getPlayer: GetCurrentPlayer,
    private readonly database: PrismaClient,
    private readonly clock: Clock,
    private readonly random: RandomSource,
    private readonly economy = new PrismaEconomyService(),
  ) {}

  public async ensureCurrentBoss(now = commandNow(this.clock)): Promise<string> {
    const monthStart = getBusinessMonth(now);
    return this.database.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT true AS locked FROM pg_advisory_xact_lock(hashtext(${`monthly-boss:${monthStart}`}))`;
      const monthDate = businessDateToDatabaseDate(monthStart);
      const existing = await transaction.monthlyBoss.findUnique({ where: { monthStart: monthDate }, select: { id: true } });
      if (existing) return existing.id;
      const previous = await transaction.monthlyBoss.findFirst({ where: { monthStart: { lt: monthDate } }, orderBy: { monthStart: 'desc' } });
      const baseHp = previous ? calculateNextBossBase({
        baseHp: previous.baseHp,
        currentHp: previous.currentHp,
        monthStart: databaseDateToBusinessDate(previous.monthStart),
        defeatedAt: previous.defeatedAt,
      }).baseHp : MONTHLY_BOSS_INITIAL_BASE_HP;
      const hpVariationPercent = this.random.nextInt(31) - 15;
      const maxHp = calculateBossMaxHp(baseHp, hpVariationPercent);
      const resistanceElementKey = elementKeys[this.random.nextInt(elementKeys.length)]!;
      const created = await transaction.monthlyBoss.create({ data: {
        monthStart: monthDate,
        nameSnapshot: monthlyBossName(monthStart),
        baseHp,
        hpVariationPercent,
        maxHp,
        currentHp: maxHp,
        resistanceElementKey,
      }, select: { id: true } });
      return created.id;
    }, { timeout: 20_000 });
  }

  public async getCurrent(identity: PlayerExecutionActor): Promise<MonthlyBossView> {
    const context = await this.context(identity);
    const bossId = await this.ensureCurrentBoss(context.now);
    await this.clearInactiveSlots(context.playerId);
    return readView(this.database, context.playerId, context.businessDate, bossId);
  }

  public async getCurrentForChat(identity: PlayerExecutionActor): Promise<MonthlyBossView> {
    const context = await this.context(identity);
    const bossId = await this.ensureCurrentBoss(context.now);
    const [view, team] = await Promise.all([
      readView(this.database, context.playerId, context.businessDate, bossId),
      this.database.team.findFirst({ where: { playerId: context.playerId, isActive: true }, include: { members: { orderBy: { position: 'asc' } } } }),
    ]);
    const ids = team?.members.map(member => member.characterId) ?? [];
    if (ids.length !== 4 || new Set(ids).size !== 4) return { ...view, preview: null, canAttack: false };
    const possessions = await this.database.playerCharacter.findMany({ where: { playerId: context.playerId, characterId: { in: ids }, character: { isActive: true } }, select: possessionSelection });
    if (possessions.length !== 4) return { ...view, preview: null, canAttack: false };
    const byId = new Map(possessions.map(possession => [possession.characterId, possession]));
    return { ...view, preview: calculateBossDamage(ids.map(id => toCombatMember(byId.get(id)!)), view.boss.resistanceElementKey), canAttack: view.attackState === 'AVAILABLE' };
  }

  public async setSlot(identity: PlayerExecutionActor, position: number, characterId: string): Promise<MonthlyBossView> {
    if (!Number.isInteger(position) || position < 1 || position > 4) throw new BusinessError('BOSS_LOADOUT_INCOMPLETE', 'Cet emplacement de Boss est invalide.');
    const context = await this.context(identity);
    const bossId = await this.ensureCurrentBoss(context.now);
    await this.database.$transaction(async (transaction) => {
      await lockPlayerMutation(transaction, context.playerId);

      await assertPlayerDomainReady(transaction, context.playerId, 'BOSS');
      const possession = await transaction.playerCharacter.findUnique({ where: { playerId_characterId: { playerId: context.playerId, characterId } }, select: possessionSelection });
      if (!possession) throw new BusinessError('BOSS_CHARACTER_NOT_OWNED', 'Ce personnage ne fait pas partie de votre Box.');
      if (!possession.character.isActive) throw new BusinessError('BOSS_CHARACTER_INACTIVE', 'Ce personnage n’est plus disponible.');
      const duplicate = await transaction.playerBossLoadoutSlot.findFirst({ where: { playerId: context.playerId, characterId, position: { not: position } } });
      if (duplicate) throw new BusinessError('BOSS_CHARACTER_DUPLICATE', 'Ce personnage est déjà sélectionné.');
      await ensureLoadout(transaction, context.playerId);
      await transaction.playerBossLoadoutSlot.upsert({
        where: { playerId_position: { playerId: context.playerId, position } },
        create: { playerId: context.playerId, position, characterId },
        update: { characterId },
      });
    });
    return readView(this.database, context.playerId, context.businessDate, bossId);
  }

  public async removeSlot(identity: PlayerExecutionActor, position: number): Promise<MonthlyBossView> {
    if (!Number.isInteger(position) || position < 1 || position > 4) throw new BusinessError('BOSS_LOADOUT_INCOMPLETE', 'Cet emplacement de Boss est invalide.');
    const context = await this.context(identity);
    const bossId = await this.ensureCurrentBoss(context.now);
    await this.database.$transaction(async (transaction) => {
      await lockPlayerMutation(transaction, context.playerId);

      await assertPlayerDomainReady(transaction, context.playerId, 'BOSS');
      await ensureLoadout(transaction, context.playerId);
      await transaction.playerBossLoadoutSlot.deleteMany({ where: { playerId: context.playerId, position } });
    });
    return readView(this.database, context.playerId, context.businessDate, bossId);
  }

  public async copyActiveTeam(identity: PlayerExecutionActor): Promise<MonthlyBossView> {
    const context = await this.context(identity);
    const bossId = await this.ensureCurrentBoss(context.now);
    await this.database.$transaction(async (transaction) => {
      await lockPlayerMutation(transaction, context.playerId);

      await assertPlayerDomainReady(transaction, context.playerId, 'BOSS');
      const team = await transaction.team.findFirst({ where: { playerId: context.playerId, isActive: true }, include: { members: { include: { character: true }, orderBy: { position: 'asc' } } } });
      const members = team?.members.filter(({ character }) => character.isActive).slice(0, 4) ?? [];
      await ensureLoadout(transaction, context.playerId);
      await transaction.playerBossLoadoutSlot.deleteMany({ where: { playerId: context.playerId } });
      if (members.length) await transaction.playerBossLoadoutSlot.createMany({ data: members.map(({ position, characterId }) => ({ playerId: context.playerId, position, characterId })) });
    });
    return readView(this.database, context.playerId, context.businessDate, bossId);
  }

  public async clearLoadout(identity: PlayerExecutionActor): Promise<MonthlyBossView> {
    const context = await this.context(identity);
    const bossId = await this.ensureCurrentBoss(context.now);
    await this.database.$transaction(async (transaction) => {
      await lockPlayerMutation(transaction, context.playerId);

      await assertPlayerDomainReady(transaction, context.playerId, 'BOSS');
      await ensureLoadout(transaction, context.playerId);
      await transaction.playerBossLoadoutSlot.deleteMany({ where: { playerId: context.playerId } });
    });
    return readView(this.database, context.playerId, context.businessDate, bossId);
  }

  public async attack(identity: PlayerExecutionActor, bossId: string, idempotencyKey: string, copyActiveTeam = false, sourceChannel: SourceChannel = SourceChannel.UI) {
    const context = await this.context(identity);
    const currentBossId = await this.ensureCurrentBoss(context.now);
    if (bossId !== currentBossId) throw new BusinessError('BOSS_INSTANCE_CHANGED', 'Le Boss mensuel a changé. Rechargez sa fiche.');
    if (!copyActiveTeam && await this.clearInactiveSlots(context.playerId)) throw new BusinessError('BOSS_CHARACTER_INACTIVE', 'Un personnage indisponible a été retiré de la formation Boss.');
    const operationKey = `monthly-boss.attack:${context.playerId}:${idempotencyKey}`;
    for (let attemptNumber = 1; attemptNumber <= MAX_TRANSACTION_ATTEMPTS; attemptNumber += 1) {
      try {
        const committed = await this.database.$transaction(async (transaction) => {
          await lockPlayerMutation(transaction, context.playerId);

          await assertPlayerDomainReady(transaction, context.playerId, 'BOSS');
          await transaction.$queryRaw`SELECT id FROM monthly_bosses WHERE id = ${bossId}::uuid FOR UPDATE`;
          const existing = await transaction.businessOperation.findFirst({ where: { sourceChannel, idempotencyKey: operationKey } });
          if (existing) {
            if (existing.playerId !== context.playerId || existing.operationType !== 'monthly-boss.attack') throw new BusinessError('BOSS_IDEMPOTENCY_CONFLICT', 'Cette requête ne correspond plus à l’attaque attendue.');
            if (existing.status !== OperationStatus.COMPLETED) throw new BusinessError('BOSS_IDEMPOTENCY_CONFLICT', 'Cette attaque est encore en cours.');
            const prior = await transaction.bossAttack.findUniqueOrThrow({ where: { operationId: existing.id } });
            return { operationId: existing.id, alreadyProcessed: true, damage: prior.damage, defeated: Boolean((existing.resultSummary as { defeated?: boolean } | null)?.defeated) };
          }
          await assertCommandTargets(transaction, context.playerId, 'team');
          const boss = await transaction.monthlyBoss.findUniqueOrThrow({ where: { id: bossId } });
          if (databaseDateToBusinessDate(boss.monthStart) !== getBusinessMonth(context.now)) throw new BusinessError('BOSS_INSTANCE_CHANGED', 'Le Boss mensuel a changé. Rechargez sa fiche.');
          if (boss.defeatedAt) throw new BusinessError('BOSS_DEFEATED', 'Le Boss de ce mois est déjà vaincu.');
          const businessDate = businessDateToDatabaseDate(context.businessDate);
          const legacyAttack = await transaction.bossLegacyContribution.findUnique({ where: { bossId_playerId: { bossId, playerId: context.playerId } }, select: { lastAttackDate: true } });
          if (legacyAttack?.lastAttackDate?.getTime() === businessDate.getTime()) throw new BusinessError('BOSS_ATTACK_ALREADY_USED', 'Votre attaque Boss a déjà été utilisée aujourd’hui.');
          if (await transaction.bossAttack.findUnique({ where: { bossId_playerId_businessDate: { bossId, playerId: context.playerId, businessDate } } })) throw new BusinessError('BOSS_ATTACK_ALREADY_USED', 'Votre attaque Boss a déjà été utilisée aujourd’hui.');
          if (copyActiveTeam) {
            const team = await transaction.team.findFirst({ where: { playerId: context.playerId, isActive: true }, include: { members: { include: { character: true }, orderBy: { position: 'asc' } } } });
            const members = team?.members ?? [];
            if (members.length !== 4 || new Set(members.map(member => member.characterId)).size !== 4) throw new BusinessError('BOSS_LOADOUT_INCOMPLETE', 'La Team active doit contenir exactement 4 personnages.');
            if (members.some(member => !member.character.isActive)) throw new BusinessError('BOSS_CHARACTER_INACTIVE', 'Un personnage de la Team active n’est plus disponible.');
            await ensureLoadout(transaction, context.playerId);
            await transaction.playerBossLoadoutSlot.deleteMany({ where: { playerId: context.playerId } });
            await transaction.playerBossLoadoutSlot.createMany({ data: members.map((member, index) => ({ playerId: context.playerId, position: index + 1, characterId: member.characterId })) });
          }
          const loadout = await transaction.playerBossLoadout.findUnique({ where: { playerId: context.playerId }, include: { slots: { orderBy: { position: 'asc' } } } });
          if (!loadout || loadout.slots.length !== 4 || new Set(loadout.slots.map(({ characterId }) => characterId)).size !== 4) throw new BusinessError('BOSS_LOADOUT_INCOMPLETE', 'Sélectionnez exactement 4 personnages.');
          const ids = loadout.slots.map(({ characterId }) => characterId);
          const possessions = await transaction.playerCharacter.findMany({ where: { playerId: context.playerId, characterId: { in: ids } }, select: possessionSelection });
          if (possessions.length !== 4) throw new BusinessError('BOSS_CHARACTER_NOT_OWNED', 'Un personnage ne fait plus partie de votre Box.');
          if (possessions.some(({ character }) => !character.isActive)) throw new BusinessError('BOSS_CHARACTER_INACTIVE', 'Un personnage n’est plus disponible.');
          const byId = new Map(possessions.map((possession) => [possession.characterId, possession]));
          const ordered = loadout.slots.map(({ characterId }) => byId.get(characterId)!);
          const damage = calculateBossDamage(ordered.map(toCombatMember), elementKey(boss.resistanceElementKey));
          const operation = await transaction.businessOperation.create({ data: {
            playerId: context.playerId,
            operationType: 'monthly-boss.attack',
            sourceChannel,
            idempotencyKey: operationKey,
            resultSummary: { bossId, damage: damage.totalDamage.toString() },
          }, select: { id: true } });
          await transaction.bossAttack.create({ data: {
            bossId,
            playerId: context.playerId,
            businessDate,
            damage: damage.totalDamage,
            operationId: operation.id,
            members: { create: damage.contributions.map((item, index) => ({
              position: index + 1,
              characterId: item.characterId,
              characterNameSnapshot: item.characterName,
              raritySnapshot: item.rarity,
              elementKeySnapshot: item.elementKey,
              constellationSnapshot: item.constellation,
              damageBeforeResistance: item.damageBeforeResistance,
              resistanceApplied: item.resistanceApplied,
              damage: item.damage,
            })) },
          } });
          const existingParticipation = await transaction.playerBossParticipation.findUnique({ where: { bossId_playerId: { bossId, playerId: context.playerId } } });
          await transaction.playerBossParticipation.upsert({
            where: { bossId_playerId: { bossId, playerId: context.playerId } },
            create: { bossId, playerId: context.playerId, totalDamage: damage.totalDamage, attackCount: 1n, bestHit: damage.totalDamage, firstAttackAt: context.now, lastAttackAt: context.now },
            update: { totalDamage: { increment: damage.totalDamage }, attackCount: { increment: 1n }, bestHit: existingParticipation && existingParticipation.bestHit > damage.totalDamage ? existingParticipation.bestHit : damage.totalDamage, lastAttackAt: context.now },
          });
          const priorStats = await transaction.playerBossStats.findUnique({ where: { playerId: context.playerId } });
          await transaction.playerBossStats.upsert({
            where: { playerId: context.playerId },
            create: { playerId: context.playerId, totalDamage: damage.totalDamage, totalAttacks: 1n, totalParticipated: 1n, bestHit: damage.totalDamage },
            update: { totalDamage: { increment: damage.totalDamage }, totalAttacks: { increment: 1n }, totalParticipated: { increment: existingParticipation ? 0n : 1n }, bestHit: priorStats && priorStats.bestHit > damage.totalDamage ? priorStats.bestHit : damage.totalDamage },
          });
          const currentHp = boss.currentHp > damage.totalDamage ? boss.currentHp - damage.totalDamage : 0n;
          const defeated = currentHp === 0n;
          await transaction.monthlyBoss.update({ where: { id: bossId }, data: defeated
            ? { currentHp, defeatedAt: context.now, finalBlowPlayerId: context.playerId }
            : { currentHp } });
          if (defeated) await this.rewardParticipants(transaction, bossId, boss.nameSnapshot, context.playerId, context.now);
          await transaction.businessOperation.update({ where: { id: operation.id }, data: {
            status: OperationStatus.COMPLETED,
            completedAt: context.now,
            resultSummary: { bossId, damage: damage.totalDamage.toString(), defeated },
          } });
          return { operationId: operation.id, alreadyProcessed: false, damage: damage.totalDamage, defeated };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 });
        const [view, resources] = await Promise.all([
          readView(this.database, context.playerId, context.businessDate, bossId),
          readBalances(this.database, context.playerId),
        ]);
        return { operation: { id: committed.operationId, alreadyProcessed: committed.alreadyProcessed }, result: { damage: committed.damage, defeated: committed.defeated }, view, resources };
      } catch (error) {
        if (!isPrismaConcurrencyCollision(error) || attemptNumber === MAX_TRANSACTION_ATTEMPTS) throw error;
      }
    }
    throw new Error('monthly-boss.attack exhausted all retry attempts.');
  }

  public async attackWithActiveTeam(identity: PlayerExecutionActor, idempotencyKey: string, sourceChannel: SourceChannel = SourceChannel.INTERNAL_CHAT) {
    const context = await this.context(identity);
    const bossId = await this.ensureCurrentBoss(context.now);
    return this.attack(identity, bossId, idempotencyKey, true, sourceChannel);
  }

  public async getRanking(bossId: string) {
    const boss = await this.database.monthlyBoss.findUnique({ where: { id: bossId }, select: { id: true, nameSnapshot: true, monthStart: true, defeatedAt: true } });
    if (!boss) throw new BusinessError('BOSS_INSTANCE_CHANGED', 'Ce Boss n’existe plus.');
    return { boss: { ...boss, monthStart: databaseDateToBusinessDate(boss.monthStart) }, ranking: await readRanking(this.database, bossId) };
  }

  public async getHistory(page: number) {
    if (!Number.isSafeInteger(page) || page < 1) throw new BusinessError('BOSS_INSTANCE_CHANGED', 'Cette page d’historique est invalide.');
    const currentMonth = businessDateToDatabaseDate(getBusinessMonth(commandNow(this.clock)));
    // R1063 owner request (2026-10-09): hide only this unsuccessful September
    // instance from player-facing history. Keep its combat facts and scaling.
    const nativeHistoryWhere: Prisma.MonthlyBossWhereInput = { monthStart: { lt: currentMonth }, NOT: {
      id: '9e9caa8e-f94c-457c-ad0d-af83e69ad76e', monthStart: businessDateToDatabaseDate('2026-09-01'), defeatedAt: null,
    } };
    let archives: TwitchBossHistoryEntry[];
    let archiveStatus: 'AVAILABLE' | 'NONE' | 'UNAVAILABLE';
    try { archives = await readTwitchBossHistory(this.database); archiveStatus = archives.length ? 'AVAILABLE' : 'NONE'; }
    catch (error) {
      if (!(error instanceof BossArchiveUnavailableError)) throw error;
      archives = []; archiveStatus = 'UNAVAILABLE';
    }
    // Only the small native instance index is merged. Combat rows and attacks
    // are loaded for the selected page, never for the whole native history.
    const index = archives.length ? await this.database.monthlyBoss.findMany({ where: nativeHistoryWhere,
      select: { id: true, monthStart: true }, orderBy: { monthStart: 'desc' } }) : null;
    const ordered = index ? [...index.map(boss => ({ id: boss.id, monthStart: databaseDateToBusinessDate(boss.monthStart), origin: 'NATIVE' as const })),
      ...archives.map(boss => ({ id: boss.id, monthStart: boss.monthStart, origin: boss.origin }))]
      .sort((a, b) => b.monthStart.localeCompare(a.monthStart) || a.origin.localeCompare(b.origin) || a.id.localeCompare(b.id)) : null;
    const selected = ordered?.slice((page - 1) * HISTORY_PAGE_SIZE, page * HISTORY_PAGE_SIZE);
    const total = ordered?.length ?? await this.database.monthlyBoss.count({ where: nativeHistoryWhere });
    const bosses = await this.database.monthlyBoss.findMany({
      where: selected ? { id: { in: selected.filter(row => row.origin === 'NATIVE').map(row => row.id) } } : nativeHistoryWhere,
      orderBy: { monthStart: 'desc' },
      skip: selected ? 0 : (page - 1) * HISTORY_PAGE_SIZE,
      take: HISTORY_PAGE_SIZE,
      include: { finalBlowPlayer: { select: { id: true, displayName: true, status: true } } },
    });
    const summaries = await readBossSummaries(this.database, bosses);
    const nativeEntries = bosses.map((boss) => {
      const summary = summaries.get(boss.id)!.summary;
      return {
        id: boss.id,
        origin: 'NATIVE' as const,
        monthStart: databaseDateToBusinessDate(boss.monthStart),
        name: boss.nameSnapshot,
        baseHp: boss.baseHp,
        maxHp: boss.maxHp,
        currentHp: boss.currentHp,
        resistanceElementKey: elementKey(boss.resistanceElementKey),
        status: boss.defeatedAt ? 'DEFEATED' as const : 'FAILED' as const,
        defeatedAt: boss.defeatedAt,
        finalBlowPlayer: presentBossAttribution(boss.finalBlowPlayer),
        victoryDayCount: summary.victoryDayCount,
        daysRemainingAfterVictory: summary.daysRemainingAfterVictory,
        nextBaseAdjustment: calculateNextBossBase({ baseHp: boss.baseHp, currentHp: boss.currentHp, monthStart: databaseDateToBusinessDate(boss.monthStart), defeatedAt: boss.defeatedAt }).adjustment,
        community: summary.community,
        records: summary.records,
        historicalRewardsDistributed: null,
        contributions: null,
      };
    });
    const entries = new Map([...nativeEntries, ...archives].map(entry => [entry.id, entry]));
    return { page, pageSize: HISTORY_PAGE_SIZE, total, totalPages: Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE)), archiveStatus,
      bosses: selected ? selected.map(row => entries.get(row.id)!) : nativeEntries };
  }

  public async readArchiveContributions(archiveId: string, page: number) {
    return readTwitchBossContributions(this.database, archiveId, page);
  }

  private async context(identity: PlayerExecutionActor) {
    const player = await this.getPlayer.execute(identity);
    await assertPlayerDomainReady(this.database, player.id, 'BOSS');
    if (!player.elementKey || !isElementKey(player.elementKey)) throw new BusinessError('PLAYER_ELEMENT_REQUIRED', 'Un élément permanent est requis.');
    const now = commandNow(this.clock);
    return { playerId: player.id, playerElementKey: player.elementKey, now, businessDate: getBusinessDate(now) } as const;
  }

  private async clearInactiveSlots(playerId: string): Promise<boolean> {
    return this.database.$transaction(async tx => {
      if (!await lockPlayerMutationState(tx, playerId) || !await isPlayerDomainReady(tx, playerId, 'BOSS')) return false;
      const result = await tx.playerBossLoadoutSlot.deleteMany({ where: { playerId, character: { isActive: false } } });
      return result.count > 0;
    });
  }

  private async rewardParticipants(transaction: Prisma.TransactionClient, bossId: string, bossName: string, finalBlowPlayerId: string, now: Date) {
    const participants = await transaction.playerBossParticipation.findMany({ where: { bossId, player: { status: { not: 'ARCHIVED' } } }, include: { player: { select: { elementKey: true } } }, orderBy: { playerId: 'asc' } });
    for (const participant of participants) {
      if (!await lockPlayerMutationState(transaction, participant.playerId) || !await isPlayerDomainReady(transaction, participant.playerId, 'BOSS')) continue;
      if (!participant.player.elementKey || !isElementKey(participant.player.elementKey)) throw new Error(`Boss participant ${participant.playerId} has no valid element.`);
      const rewardOperation = await transaction.businessOperation.create({ data: {
        playerId: participant.playerId,
        operationType: 'monthly-boss.reward',
        sourceChannel: SourceChannel.SYSTEM,
        idempotencyKey: `monthly-boss.reward:${bossId}:${participant.playerId}`,
        status: OperationStatus.COMPLETED,
        completedAt: now,
        resultSummary: { bossId, primogems: MONTHLY_BOSS_REWARD.primogems.toString(), moras: MONTHLY_BOSS_REWARD.moras.toString() },
      }, select: { id: true } });
      await transaction.bossReward.create({ data: { bossId, playerId: participant.playerId, primogems: MONTHLY_BOSS_REWARD.primogems, moras: MONTHLY_BOSS_REWARD.moras, operationId: rewardOperation.id, awardedAt: now } });
      await this.economy.credit(transaction, { playerId: participant.playerId, playerElementKey: participant.player.elementKey, resourceKey: 'primogems', amount: MONTHLY_BOSS_REWARD.primogems, causeKey: 'monthly-boss.victory', domainKey: 'monthly-boss', operationId: rewardOperation.id, sourceChannel: SourceChannel.SYSTEM });
      await this.economy.credit(transaction, { playerId: participant.playerId, playerElementKey: participant.player.elementKey, resourceKey: 'moras', amount: MONTHLY_BOSS_REWARD.moras, causeKey: 'monthly-boss.victory', domainKey: 'monthly-boss', operationId: rewardOperation.id, sourceChannel: SourceChannel.SYSTEM });
      await transaction.playerBossStats.update({ where: { playerId: participant.playerId }, data: { totalRewarded: { increment: 1n }, finalBlows: { increment: participant.playerId === finalBlowPlayerId ? 1n : 0n } } });
      await transaction.notification.upsert({
        where: { deduplicationKey: `monthly-boss:defeated:${bossId}:${participant.playerId}` },
        create: {
          playerId: participant.playerId,
          domainKey: 'monthly-boss',
          typeKey: 'MONTHLY_BOSS_DEFEATED',
          payload: {
            title: 'Boss vaincu',
            bossName,
            message: `${bossName} a été vaincu.`,
            rewards: [
              { resourceKey: 'primogems', amount: MONTHLY_BOSS_REWARD.primogems.toString() },
              { resourceKey: 'moras', amount: MONTHLY_BOSS_REWARD.moras.toString() },
            ],
          },
          state: NotificationState.UNREAD,
          actionKey: 'OPEN_MONTHLY_BOSS',
          actionTargetId: bossId,
          deduplicationKey: `monthly-boss:defeated:${bossId}:${participant.playerId}`,
        },
        update: {},
      });
    }
  }
}

export class MonthlyBossScheduler {
  private timer: NodeJS.Timeout | undefined;
  public constructor(private readonly service: MonthlyBossService, private readonly clock: Clock) {}
  public async start(): Promise<void> { await this.service.ensureCurrentBoss(); this.schedule(); }
  public stop(): void { if (this.timer) clearTimeout(this.timer); this.timer = undefined; }
  private schedule(): void {
    const now = commandNow(this.clock);
    const next = getBusinessDayStartAt(nextBusinessMonth(getBusinessMonth(now)));
    const delay = Math.max(1_000, Math.min(next.getTime() - now.getTime() + 1_000, 2_147_000_000));
    this.timer = setTimeout(() => void this.start(), delay);
    this.timer.unref();
  }
}

async function readView(client: Client, playerId: string, businessDate: string, bossId: string): Promise<MonthlyBossView> {
  const [boss, loadout, possessions, todayAttack, stats, legacyAttack] = await Promise.all([
    client.monthlyBoss.findUniqueOrThrow({ where: { id: bossId }, include: { finalBlowPlayer: { select: { id: true, displayName: true, status: true } } } }),
    client.playerBossLoadout.findUnique({ where: { playerId }, include: { slots: { orderBy: { position: 'asc' } } } }),
    client.playerCharacter.findMany({ where: { playerId, character: { isActive: true } }, select: possessionSelection }),
    client.bossAttack.findUnique({ where: { bossId_playerId_businessDate: { bossId, playerId, businessDate: businessDateToDatabaseDate(businessDate) } } }),
    client.playerBossStats.findUnique({ where: { playerId } }),
    client.bossLegacyContribution.findUnique({ where: { bossId_playerId: { bossId, playerId } }, select: { lastAttackDate: true } }),
  ]);
  const summaryData = (await readBossSummaries(client, [boss])).get(boss.id)!;
  const summary = summaryData.summary;
  const ranking = summaryData.ranking;
  const characters = possessions.map(toCharacter);
  const byId = new Map(characters.map((character) => [character.id, character]));
  const slots = ([1, 2, 3, 4] as const).map((position) => {
    const selected = loadout?.slots.find((slot) => slot.position === position);
    return { position, character: selected ? byId.get(selected.characterId) ?? null : null };
  });
  const selected = slots.map(({ character }) => character).filter((character): character is MonthlyBossCharacter => Boolean(character));
  const complete = selected.length === 4 && new Set(selected.map(({ id }) => id)).size === 4;
  const preview = complete ? calculateBossDamage(selected.map((character) => ({ id: character.id, name: character.name, rarity: character.rarity, constellation: character.constellation, elementKey: character.elementKey })), elementKey(boss.resistanceElementKey)) : null;
  const own = ranking.find((entry) => entry.playerId === playerId);
  const defeated = Boolean(boss.defeatedAt);
  const nextBaseAdjustment = boss.defeatedAt ? calculateNextBossBase({ baseHp: boss.baseHp, currentHp: boss.currentHp, monthStart: databaseDateToBusinessDate(boss.monthStart), defeatedAt: boss.defeatedAt }).adjustment : null;
  return {
    businessDate,
    boss: { id: boss.id, monthStart: databaseDateToBusinessDate(boss.monthStart), name: boss.nameSnapshot, baseHp: boss.baseHp, hpVariationPercent: boss.hpVariationPercent, maxHp: boss.maxHp, currentHp: boss.currentHp, resistanceElementKey: elementKey(boss.resistanceElementKey), defeatedAt: boss.defeatedAt, finalBlowPlayer: presentBossAttribution(boss.finalBlowPlayer), nextBaseAdjustment },
    status: defeated ? 'DEFEATED' : 'ALIVE',
    attackState: defeated ? 'DEFEATED' : todayAttack || legacyAttack?.lastAttackDate?.getTime() === businessDateToDatabaseDate(businessDate).getTime() ? 'USED' : 'AVAILABLE',
    todayDamage: todayAttack?.damage ?? null,
    canAttack: !defeated && !todayAttack && legacyAttack?.lastAttackDate?.getTime() !== businessDateToDatabaseDate(businessDate).getTime() && complete,
    loadout: { slots },
    availableCharacters: characters,
    preview,
    reward: MONTHLY_BOSS_REWARD,
    participation: own ? { rank: own.rank, totalDamage: own.totalDamage, attackCount: own.attackCount, bestHit: own.bestHit, contributionBasisPoints: calculateContributionBasisPoints(own.totalDamage, boss.maxHp) } : null,
    ranking: summary.records.topThree,
    defeatedSummary: defeated ? summary : null,
    publicSummary: summary,
    playerStats: stats ? { totalDamage: stats.totalDamage, totalAttacks: stats.totalAttacks, totalParticipated: stats.totalParticipated, totalRewarded: stats.totalRewarded, finalBlows: stats.finalBlows, bestHit: stats.bestHit } : { totalDamage: 0n, totalAttacks: 0n, totalParticipated: 0n, totalRewarded: 0n, finalBlows: 0n, bestHit: 0n },
  };
}

type BossSummarySource = Readonly<{
  id: string;
  monthStart: Date;
  baseHp: bigint;
  maxHp: bigint;
  currentHp: bigint;
  defeatedAt: Date | null;
  finalBlowPlayer: { id: string; displayName: string; status?: string } | null;
}>;

function presentBossAttribution(player: BossSummarySource['finalBlowPlayer']) {
  return player ? { id: player.id, displayName: player.status === 'ARCHIVED' ? 'Progression archivée' : player.displayName } : null;
}

type BossSummaryData = Readonly<{ summary: MonthlyBossSummary; ranking: readonly MonthlyBossRankingEntry[] }>;

async function readBossSummaries(client: Client, bosses: readonly BossSummarySource[]): Promise<ReadonlyMap<string, BossSummaryData>> {
  if (!bosses.length) return new Map();
  const bossIds = bosses.map(({ id }) => id);
  const [participations, attacks] = await Promise.all([
    client.playerBossParticipation.findMany({
      where: { bossId: { in: bossIds } },
      include: { player: { select: { displayName: true, status: true } } },
    }),
    client.bossAttack.findMany({
      where: { bossId: { in: bossIds } },
      select: { id: true, bossId: true, playerId: true, damage: true, createdAt: true, player: { select: { displayName: true, status: true } } },
    }),
  ]);
  return new Map(bosses.map((boss) => {
    const bossParticipations = participations.filter(row => row.bossId === boss.id && row.player.status !== 'ARCHIVED').sort(compareParticipationRanking);
    const ranking = bossParticipations.map((row, index) => ({
      rank: index + 1,
      playerId: row.playerId,
      displayName: row.player.displayName,
      totalDamage: row.totalDamage,
      attackCount: row.attackCount,
      bestHit: row.bestHit,
    }));
    const bossAttacks = attacks.filter(({ bossId }) => bossId === boss.id);
    const totalDamage = bossAttacks.reduce((sum, { damage }) => sum + damage, 0n);
    const attackCount = BigInt(bossAttacks.length);
    const biggestHit = [...bossAttacks].sort(compareBiggestHit)[0];
    const mostAttacks = [...ranking].sort(compareMostAttacks)[0] ?? null;
    const timing = calculateBossVictoryTiming(databaseDateToBusinessDate(boss.monthStart), boss.defeatedAt);
    const summary: MonthlyBossSummary = {
      ...timing,
      community: {
        participantCount: ranking.length,
        attackCount,
        totalDamage,
        averageDamage: calculateRoundedBossAverage(totalDamage, attackCount),
      },
      records: {
        topContributor: ranking[0] ?? null,
        biggestHit: biggestHit ? { playerId: biggestHit.playerId, displayName: biggestHit.player.status === 'ARCHIVED' ? 'Progression archivée' : biggestHit.player.displayName, damage: biggestHit.damage, createdAt: biggestHit.createdAt } : null,
        mostAttacks,
        finalBlow: presentBossAttribution(boss.finalBlowPlayer),
        topThree: ranking.slice(0, 3),
      },
    };
    return [boss.id, { summary, ranking }] as const;
  }));
}

function compareParticipationRanking(left: { totalDamage: bigint; firstAttackAt: Date | null; playerId: string }, right: { totalDamage: bigint; firstAttackAt: Date | null; playerId: string }): number {
  const dateOrder = left.firstAttackAt && right.firstAttackAt ? left.firstAttackAt.getTime() - right.firstAttackAt.getTime()
    : left.firstAttackAt ? -1 : right.firstAttackAt ? 1 : 0;
  return compareBigIntDesc(left.totalDamage, right.totalDamage) || dateOrder || compareText(left.playerId, right.playerId);
}

function compareMostAttacks(left: MonthlyBossRankingEntry, right: MonthlyBossRankingEntry): number {
  return compareBigIntDesc(left.attackCount, right.attackCount) || compareBigIntDesc(left.totalDamage, right.totalDamage) || compareText(left.playerId, right.playerId);
}

function compareBiggestHit(left: { damage: bigint; createdAt: Date; playerId: string; id: string }, right: { damage: bigint; createdAt: Date; playerId: string; id: string }): number {
  return compareBigIntDesc(left.damage, right.damage) || left.createdAt.getTime() - right.createdAt.getTime() || compareText(left.playerId, right.playerId) || compareText(left.id, right.id);
}

function compareBigIntDesc(left: bigint, right: bigint): number { return left === right ? 0 : left > right ? -1 : 1; }
function compareText(left: string, right: string): number { return left < right ? -1 : left > right ? 1 : 0; }

async function readRanking(client: Client, bossId: string): Promise<MonthlyBossRankingEntry[]> {
  const rows = await client.playerBossParticipation.findMany({ where: { bossId, player: { status: { not: 'ARCHIVED' } } }, include: { player: { select: { displayName: true } } }, orderBy: [{ totalDamage: 'desc' }, { firstAttackAt: 'asc' }, { playerId: 'asc' }] });
  return rows.map((row, index) => ({ rank: index + 1, playerId: row.playerId, displayName: row.player.displayName, totalDamage: row.totalDamage, attackCount: row.attackCount, bestHit: row.bestHit }));
}

function toCharacter(possession: Possession) {
  return {
    id: possession.character.id,
    externalKey: possession.character.externalKey,
    name: possession.character.name,
    rarity: rarity(possession.character.rarity),
    elementKey: elementKey(possession.character.elementKey),
    weaponType: possession.character.weaponType,
    region: possession.character.region,
    iconPath: possession.character.iconPath,
    splashPath: possession.character.splashPath,
    wishPath: possession.character.wishPath,
    fullbodyPath: possession.character.fullbodyPath,
    displayOrder: possession.character.displayOrder,
    constellation: possession.constellation,
    copies: possession.copies,
    firstObtainedAt: possession.firstObtainedAt,
    favorite: possession.favorite,
  } as const;
}
function toCombatMember(possession: Possession): BossCombatMember { return { id: possession.characterId, name: possession.character.name, rarity: rarity(possession.character.rarity), constellation: possession.constellation, elementKey: elementKey(possession.character.elementKey) }; }
function rarity(value: number): 4 | 5 { if (value === 4 || value === 5) return value; throw new Error(`Unsupported character rarity ${value}.`); }
function elementKey(value: string): ElementKey { if (isElementKey(value)) return value; throw new Error(`Unsupported element ${value}.`); }
async function ensureLoadout(transaction: Prisma.TransactionClient, playerId: string) { await transaction.playerBossLoadout.upsert({ where: { playerId }, create: { playerId }, update: {} }); }

async function readBalances(client: Client, playerId: string): Promise<PlayerResourceBalances> {
  const rows = await client.playerResourceBalance.findMany({ where: { playerId, resourceKey: { in: [...resourceKeys] } }, select: { resourceKey: true, amount: true } });
  const values = new Map(rows.map(({ resourceKey, amount }) => [resourceKey, amount]));
  if (!resourceKeys.every((key) => values.has(key))) throw new BusinessError('RESOURCE_STATE_INCOMPLETE', 'L’état des ressources du joueur est incomplet.');
  return Object.fromEntries(resourceKeys.map((key) => [key, values.get(key)!])) as PlayerResourceBalances;
}
