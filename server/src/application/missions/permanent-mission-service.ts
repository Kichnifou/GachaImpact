import {
  OperationStatus,
  PermanentMissionProgressStatus,
  PermanentMissionRank,
  Prisma,
  SourceChannel,
  type PermanentMissionMetric,
} from '../../../generated/prisma/client.js';
import {
  PERMANENT_MISSION_BAS_COUNT,
  PERMANENT_MISSION_DEFINITION_COUNT,
  type PermanentMissionMetricKey,
} from '../../domain/missions/permanent-mission-catalog.js';
import { MAX_PLAYER_LEVEL, XP_PER_LEVEL } from '../../domain/player/player-progression.js';
import { PrismaEconomyService } from '../../infrastructure/database/prisma-economy-service.js';

const rankOrder = { B: 0, A: 1, S: 2, Z: 3 } as const;
const chainRanks = [PermanentMissionRank.B, PermanentMissionRank.A, PermanentMissionRank.S] as const;

type MissionDefinition = Awaited<ReturnType<typeof readDefinitions>>[number];
type MissionProgress = Awaited<ReturnType<typeof readProgress>>[number];

export type PermanentMissionCompletion = Readonly<{
  externalKey: string;
  rank: PermanentMissionRank;
  metric: PermanentMissionMetric;
  displayName: string;
  rewardPrimogems: bigint;
  rewardOperationId: string;
}>;

export type PermanentMissionReconcileInput = Readonly<{
  playerId: string;
  sourceChannel: SourceChannel;
  now: Date;
  triggerOperationId?: string | null;
}>;

export type PermanentMissionProjection = Readonly<{
  ranks: Readonly<{
    B: readonly PermanentMissionProjectionEntry[];
    A: readonly PermanentMissionProjectionEntry[];
    S: readonly PermanentMissionProjectionEntry[];
  }>;
  z: Readonly<{ status: 'LOCKED' }> | Readonly<{
    status: 'ACTIVE' | 'COMPLETED';
    unlockedAt: Date;
    missions: readonly PermanentMissionProjectionEntry[];
  }>;
}>;

export type PermanentMissionProjectionEntry = Readonly<{
  externalKey: string;
  rank: PermanentMissionRank;
  displayName: string;
  description: string;
  progressLabel: string;
  progress: bigint;
  target: bigint;
  status: PermanentMissionProgressStatus;
  rewardPrimogems: bigint;
  completedAt: Date | null;
}>;

/** Transaction-local permanent Mission engine. It never owns or nests the caller transaction. */
export class PermanentMissionService {
  public constructor(private readonly economy = new PrismaEconomyService()) {}

  public async initializePlayer(transaction: Prisma.TransactionClient, playerId: string, initializedAt: Date): Promise<void> {
    const definitions = await readDefinitions(transaction);
    assertCatalog(definitions);
    await transaction.playerPermanentMissionState.upsert({
      where: { playerId },
      create: { playerId, initializedAt },
      update: {},
    });
    await transaction.playerPermanentMissionProgress.createMany({
      data: definitions.map(definition => ({
        playerId,
        definitionId: definition.id,
        status: definition.rank === PermanentMissionRank.B ? PermanentMissionProgressStatus.ACTIVE : PermanentMissionProgressStatus.LOCKED,
        progress: 0n,
        baselineValue: 0n,
        carriedProgress: 0n,
        startedAt: definition.rank === PermanentMissionRank.B ? initializedAt : null,
      })),
      skipDuplicates: true,
    });
  }

  public async reconcile(transaction: Prisma.TransactionClient, input: PermanentMissionReconcileInput) {
    await transaction.$queryRaw`SELECT id FROM players WHERE id = ${input.playerId}::uuid FOR UPDATE`;
    await this.initializePlayer(transaction, input.playerId, input.now);
    const [definitions, authoritative] = await Promise.all([
      readDefinitions(transaction),
      readAuthoritativeValues(transaction, input.playerId),
    ]);
    assertCatalog(definitions);
    const progress = await readProgress(transaction, input.playerId);
    if (progress.length !== definitions.length) throw new Error('Permanent Mission progress is incomplete for this Player.');
    const progressByDefinition = new Map(progress.map(row => [row.definitionId, row]));
    const completions: PermanentMissionCompletion[] = [];

    for (const metric of new Set(definitions.filter(definition => definition.rank !== PermanentMissionRank.Z).map(definition => definition.metric))) {
      let previousRankCompleted = true;
      for (const rank of chainRanks) {
        const definition = definitions.find(item => item.metric === metric && item.rank === rank);
        if (!definition) throw new Error(`Missing ${rank} Permanent Mission definition for ${metric}.`);
        const row = progressByDefinition.get(definition.id);
        if (!row) throw new Error(`Missing Permanent Mission progress for ${definition.externalKey}.`);
        const value = effectiveProgress(row, authoritative[metric], definition.target);
        if (row.status === PermanentMissionProgressStatus.COMPLETED) {
          previousRankCompleted = true;
          if (row.progress !== definition.target) await transaction.playerPermanentMissionProgress.update({ where: progressKey(input.playerId, definition.id), data: { progress: definition.target } });
          continue;
        }
        if (!previousRankCompleted) {
          await updateProgressIfChanged(transaction, row, input.playerId, definition.id, { status: PermanentMissionProgressStatus.LOCKED, progress: value, startedAt: null });
          continue;
        }
        if (value >= definition.target) {
          completions.push(await this.complete(transaction, input, definition, row));
          previousRankCompleted = true;
        } else {
          await updateProgressIfChanged(transaction, row, input.playerId, definition.id, { status: PermanentMissionProgressStatus.ACTIVE, progress: value, startedAt: row.startedAt ?? input.now });
          previousRankCompleted = false;
        }
      }
    }

    const completedBas = await transaction.playerPermanentMissionProgress.count({
      where: { playerId: input.playerId, status: PermanentMissionProgressStatus.COMPLETED, definition: { isActive: true, rank: { in: [...chainRanks] } } },
    });
    const state = await transaction.playerPermanentMissionState.findUniqueOrThrow({ where: { playerId: input.playerId } });
    let zUnlocked = false;
    let zUnlockedAt = state.zUnlockedAt;
    if (!zUnlockedAt && completedBas === PERMANENT_MISSION_BAS_COUNT) {
      zUnlocked = true;
      zUnlockedAt = input.now;
      await transaction.playerPermanentMissionState.update({ where: { playerId: input.playerId }, data: { zUnlockedAt } });
    }

    if (zUnlockedAt) {
      for (const definition of definitions.filter(item => item.rank === PermanentMissionRank.Z)) {
        const row = progressByDefinition.get(definition.id);
        if (!row) throw new Error(`Missing Permanent Mission progress for ${definition.externalKey}.`);
        if (row.status === PermanentMissionProgressStatus.COMPLETED) continue;
        const value = effectiveProgress(row, authoritative[definition.metric], definition.target);
        if (value >= definition.target) completions.push(await this.complete(transaction, input, definition, row));
        else await updateProgressIfChanged(transaction, row, input.playerId, definition.id, { status: PermanentMissionProgressStatus.ACTIVE, progress: value, startedAt: row.startedAt ?? zUnlockedAt });
      }
    }

    return { completions, zUnlocked, view: await this.project(transaction, input.playerId) };
  }

  public async project(transaction: Prisma.TransactionClient, playerId: string): Promise<PermanentMissionProjection> {
    const state = await transaction.playerPermanentMissionState.findUnique({ where: { playerId } });
    if (!state) throw new Error('Permanent Mission state is missing for this Player.');
    const rows = await readProgress(transaction, playerId);
    const ordered = rows.filter(row => row.definition.isActive).sort((left, right) => rankOrder[left.definition.rank] - rankOrder[right.definition.rank] || left.definition.displayOrder - right.definition.displayOrder);
    const project = (row: typeof ordered[number]): PermanentMissionProjectionEntry => ({
      externalKey: row.definition.externalKey,
      rank: row.definition.rank,
      displayName: row.definition.displayName,
      description: row.definition.description,
      progressLabel: row.definition.progressLabel,
      progress: row.progress,
      target: row.definition.target,
      status: row.status,
      rewardPrimogems: row.definition.rewardPrimogems,
      completedAt: row.completedAt,
    });
    const byRank = (rank: PermanentMissionRank) => ordered.filter(row => row.definition.rank === rank).map(project);
    const ranks = { B: byRank(PermanentMissionRank.B), A: byRank(PermanentMissionRank.A), S: byRank(PermanentMissionRank.S) };
    if (!state.zUnlockedAt) return { ranks, z: { status: 'LOCKED' } };
    const z = byRank(PermanentMissionRank.Z);
    return { ranks, z: { status: z.every(mission => mission.status === PermanentMissionProgressStatus.COMPLETED) ? 'COMPLETED' : 'ACTIVE', unlockedAt: state.zUnlockedAt, missions: z } };
  }

  private async complete(transaction: Prisma.TransactionClient, input: PermanentMissionReconcileInput, definition: MissionDefinition, row: MissionProgress): Promise<PermanentMissionCompletion> {
    const rewardOperation = await transaction.businessOperation.create({ data: {
      playerId: input.playerId,
      operationType: 'permanent-mission.reward',
      sourceChannel: input.sourceChannel,
      idempotencyKey: `permanent-mission-reward:${input.playerId}:${definition.externalKey}`,
      status: OperationStatus.PENDING,
      startedAt: input.now,
      resultSummary: { missionExternalKey: definition.externalKey, rank: definition.rank, rewardPrimogems: definition.rewardPrimogems.toString(), triggerOperationId: input.triggerOperationId ?? null },
    }, select: { id: true } });
    await this.economy.credit(transaction, {
      playerId: input.playerId,
      playerElementKey: null,
      resourceKey: 'primogems',
      amount: definition.rewardPrimogems,
      causeKey: 'permanent-mission.reward',
      domainKey: 'missions',
      operationId: rewardOperation.id,
      sourceChannel: input.sourceChannel,
    });
    await transaction.businessOperation.update({ where: { id: rewardOperation.id }, data: { status: OperationStatus.COMPLETED, completedAt: input.now } });
    await transaction.playerPermanentMissionProgress.update({ where: progressKey(input.playerId, definition.id), data: {
      status: PermanentMissionProgressStatus.COMPLETED,
      progress: definition.target,
      startedAt: row.startedAt ?? input.now,
      completedAt: input.now,
      rewardedAt: input.now,
      completionTriggerOperationId: input.triggerOperationId ?? null,
      rewardOperationId: rewardOperation.id,
    } });
    return { externalKey: definition.externalKey, rank: definition.rank, metric: definition.metric, displayName: definition.displayName, rewardPrimogems: definition.rewardPrimogems, rewardOperationId: rewardOperation.id };
  }
}

async function readDefinitions(transaction: Prisma.TransactionClient) {
  return transaction.permanentMissionDefinition.findMany({
    where: { isActive: true },
    orderBy: [{ rank: 'asc' }, { displayOrder: 'asc' }],
  });
}

async function readProgress(transaction: Prisma.TransactionClient, playerId: string) {
  return transaction.playerPermanentMissionProgress.findMany({ where: { playerId }, include: { definition: true } });
}

function assertCatalog(definitions: readonly MissionDefinition[]) {
  if (definitions.length !== PERMANENT_MISSION_DEFINITION_COUNT) throw new Error(`Permanent Mission catalog requires exactly ${PERMANENT_MISSION_DEFINITION_COUNT} active definitions.`);
}

function progressKey(playerId: string, definitionId: string) {
  return { playerId_definitionId: { playerId, definitionId } };
}

function effectiveProgress(row: Pick<MissionProgress, 'baselineValue' | 'carriedProgress'>, authoritative: bigint, target: bigint) {
  const sinceBaseline = authoritative > row.baselineValue ? authoritative - row.baselineValue : 0n;
  return min(target, row.carriedProgress + sinceBaseline);
}

async function updateProgressIfChanged(transaction: Prisma.TransactionClient, row: MissionProgress, playerId: string, definitionId: string, data: { status: PermanentMissionProgressStatus; progress: bigint; startedAt: Date | null }) {
  if (row.status === data.status && row.progress === data.progress && row.startedAt?.getTime() === data.startedAt?.getTime()) return;
  await transaction.playerPermanentMissionProgress.update({ where: progressKey(playerId, definitionId), data });
}

async function readAuthoritativeValues(transaction: Prisma.TransactionClient, playerId: string): Promise<Record<PermanentMissionMetricKey, bigint>> {
  const [progression, gacha, economy, expedition, combat, social, fourStars, fiveStars, c6Characters, perfectFriendships] = await Promise.all([
    transaction.playerProgression.findUnique({ where: { playerId }, select: { xp: true, countedMessages: true } }),
    transaction.playerGachaState.findUnique({ where: { playerId }, select: { totalPulls: true } }),
    transaction.playerEconomyStats.findUnique({ where: { playerId }, select: { totalMorasEarned: true, totalMainElementParticlesEarned: true } }),
    transaction.playerExpedition.findUnique({ where: { playerId }, select: { totalCompleted: true } }),
    transaction.playerCombatStats.findUnique({ where: { playerId }, select: { totalWins: true, totalManualWins: true } }),
    transaction.playerSocialStats.findUnique({ where: { playerId }, select: { totalFriendHeartsSent: true } }),
    transaction.playerCharacter.count({ where: { playerId, character: { rarity: 4 } } }),
    transaction.playerCharacter.count({ where: { playerId, character: { rarity: 5 } } }),
    transaction.playerCharacter.count({ where: { playerId, constellation: 6 } }),
    transaction.friendship.count({ where: { level: 1000, OR: [{ playerAId: playerId }, { playerBId: playerId }] } }),
  ]);
  const level = progression ? min(BigInt(MAX_PLAYER_LEVEL), progression.xp / XP_PER_LEVEL) : 0n;
  return {
    COUNTED_MESSAGES: progression?.countedMessages ?? 0n,
    PULLS: gacha?.totalPulls ?? 0n,
    DISTINCT_CHARACTERS_4: BigInt(fourStars),
    DISTINCT_CHARACTERS_5: BigInt(fiveStars),
    MORAS_EARNED: economy?.totalMorasEarned ?? 0n,
    MAIN_ELEMENT_PARTICLES_EARNED: economy?.totalMainElementParticlesEarned ?? 0n,
    EXPEDITIONS_COMPLETED: expedition?.totalCompleted ?? 0n,
    COMBAT_WINS: combat?.totalWins ?? 0n,
    FRIEND_HEARTS_SENT: social?.totalFriendHeartsSent ?? 0n,
    C6_CHARACTERS: BigInt(c6Characters),
    PERFECT_FRIENDSHIP: perfectFriendships > 0 ? 1n : 0n,
    PLAYER_LEVEL: level,
    MANUAL_COMBAT_WINS: combat?.totalManualWins ?? 0n,
  };
}

function min(left: bigint, right: bigint) { return left < right ? left : right; }
