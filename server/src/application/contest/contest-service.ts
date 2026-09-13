import {
  ContestCancellationKind,
  ContestParticipantKind,
  ContestPhase,
  ContestReplacementReason,
  ContestStatus,
  OperationStatus,
  Prisma,
  SourceChannel,
  type ContestTheme,
  type PrismaClient,
} from '../../../generated/prisma/client.js';
import { PrismaEconomyService } from '../../infrastructure/database/prisma-economy-service.js';
import {
  CONTEST_LOBBY_TIMEOUT_MS,
  CONTEST_MAX_SPECTATORS,
  CONTEST_REWARDS,
  CONTEST_SUPPORT_TIMEOUT_MS,
  CONTEST_TURN_TIMEOUT_MS,
  CONTEST_WINNING_SCORE,
  botIdentity,
  contestBasePoints,
  contestThemePresentation,
  contestTitle,
  contestTitleFloor,
  selectBotAction,
  selectBotStat,
  selectContestTheme,
  selectRiskPoints,
  selectSupportPoints,
  shuffledTurnOrder,
  type ContestAction,
  type ContestThemeKey,
} from '../../domain/contest/contest.js';
import { isElementKey } from '../../domain/economy/resources.js';
import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import { businessDateToDatabaseDate, databaseDateToBusinessDate, getBusinessDate, type Clock } from '../../domain/time/business-date.js';
import type { RandomSource } from '../../domain/wheel/wheel.js';
import { BusinessError } from '../errors.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';

const HISTORY_PAGE_SIZE = 10;
const ACTIVE_STATUSES = [ContestStatus.LOBBY, ContestStatus.RUNNING] as const;

const participantInclude = {
  player: { select: { id: true, displayName: true } },
  originalPlayer: { select: { id: true, displayName: true } },
} satisfies Prisma.ContestParticipantInclude;

const contestInclude = {
  participants: { include: participantInclude, orderBy: { slot: 'asc' as const } },
  spectators: { include: { player: { select: { id: true, displayName: true } } }, orderBy: { joinedAt: 'asc' as const } },
  events: { orderBy: { createdAt: 'asc' as const } },
  rewards: true,
} satisfies Prisma.ContestInclude;

type ContestRecord = Prisma.ContestGetPayload<{ include: typeof contestInclude }>;
type Client = PrismaClient | Prisma.TransactionClient;

export type ContestView = Awaited<ReturnType<ContestService['getCurrent']>>;

export class ContestService {
  public constructor(
    private readonly getPlayer: GetCurrentPlayer,
    private readonly database: PrismaClient,
    private readonly clock: Clock,
    private readonly random: RandomSource,
    private readonly economy = new PrismaEconomyService(),
  ) {}

  public async getCurrent(identity: AuthenticatedIdentity) {
    const player = await this.getPlayer.execute(identity);
    await this.reconcile();
    return this.readView(player.id);
  }

  public async createLobby(identity: AuthenticatedIdentity, characterId: string, idempotencyKey: string) {
    const player = await this.getPlayer.execute(identity);
    await this.reconcile();
    const replay = await this.findReplay(player.id, 'LOBBY_CREATED', idempotencyKey, { characterId });
    if (replay) return this.readView(player.id);
    const now = this.clock.now();
    const businessDate = getBusinessDate(now);
    try {
      await withSerializableRetry(this.database, async (tx) => {
        await lockContest(tx);
        const active = await findActive(tx);
        if (active) throw new BusinessError('CONTEST_ALREADY_ACTIVE', 'Un Concours est déjà en cours.');
        await assertDailyAvailable(tx, player.id, businessDate);
        const legend = await findLegend(tx, player.id, characterId);
        const theme = await ensureDailyTheme(tx, businessDate, this.random);
        const contest = await tx.contest.create({ data: {
          businessDate: businessDateToDatabaseDate(businessDate), theme,
          organizerPlayerId: player.id, lobbyDeadlineAt: new Date(now.getTime() + CONTEST_LOBBY_TIMEOUT_MS),
        } });
        await tx.contestParticipant.create({ data: {
          contestId: contest.id, slot: 1, kind: ContestParticipantKind.HUMAN,
          playerId: player.id, originalPlayerId: player.id, characterId,
          playerNameSnapshot: player.displayName, characterNameSnapshot: legend.character.name,
          avatarSnapshot: legend.character.iconPath, ready: false,
        } });
        await createEvent(tx, contest.id, 'LOBBY_CREATED', idempotencyKey, player.id, { characterId });
      });
    } catch (error) {
      if (await this.findReplay(player.id, 'LOBBY_CREATED', idempotencyKey, { characterId })) return this.readView(player.id);
      throw error;
    }
    return this.readView(player.id);
  }

  public async joinAsParticipant(identity: AuthenticatedIdentity, characterId: string, idempotencyKey: string) {
    const player = await this.getPlayer.execute(identity);
    await this.mutateActive(player.id, 'PARTICIPANT_JOINED', idempotencyKey, { characterId }, async (tx, contest) => {
      assertLobby(contest);
      await assertDailyAvailable(tx, player.id, databaseDateToBusinessDate(contest.businessDate));
      await findLegend(tx, player.id, characterId);
      const current = contest.participants.find((item) => item.playerId === player.id);
      if (current) throw new BusinessError('CONTEST_ALREADY_JOINED', 'Vous participez déjà à ce Concours.');
      const removal = await tx.contestLobbyRemoval.findUnique({ where: { contestId_playerId: { contestId: contest.id, playerId: player.id } } });
      if (removal && removal.count >= 3) throw new BusinessError('CONTEST_ALREADY_JOINED', 'Vous ne pouvez plus rejoindre ce lobby après trois retraits.');
      if (contest.participants.length >= 4) throw new BusinessError('CONTEST_LOBBY_FULL', 'Les quatre places du Concours sont occupées.');
      const legend = await findLegend(tx, player.id, characterId);
      await tx.contestSpectator.deleteMany({ where: { contestId: contest.id, playerId: player.id } });
      const occupied = new Set(contest.participants.map(({ slot }) => slot));
      const slot = [1, 2, 3, 4].find((value) => !occupied.has(value))!;
      await tx.contestParticipant.create({ data: {
        contestId: contest.id, slot, kind: ContestParticipantKind.HUMAN, playerId: player.id,
        originalPlayerId: player.id, characterId, playerNameSnapshot: player.displayName,
        characterNameSnapshot: legend.character.name, avatarSnapshot: legend.character.iconPath,
      } });
      await touchLobbyDeadline(tx, contest.id, this.clock.now());
      await createEvent(tx, contest.id, 'PARTICIPANT_JOINED', idempotencyKey, player.id, { slot, characterId });
    });
    return this.readView(player.id);
  }

  public async joinAsSpectator(identity: AuthenticatedIdentity, idempotencyKey: string) {
    const player = await this.getPlayer.execute(identity);
    await this.mutateActive(player.id, 'SPECTATOR_JOINED', idempotencyKey, {}, async (tx, contest) => {
      if (contest.participants.some((item) => item.playerId === player.id)) throw new BusinessError('CONTEST_ALREADY_JOINED', 'Un participant ne peut pas être spectateur actif.');
      if (contest.status === ContestStatus.RUNNING && contest.participants.some((item) => item.originalPlayerId === player.id)) {
        throw new BusinessError('CONTEST_ALREADY_JOINED', 'Un ancien participant ne peut pas devenir spectateur pendant ce Concours.');
      }
      if (contest.spectators.some((item) => item.playerId === player.id)) return;
      if (contest.spectators.length >= CONTEST_MAX_SPECTATORS) throw new BusinessError('CONTEST_SPECTATORS_FULL', 'Les dix places de spectateur actif sont occupées.');
      await tx.contestSpectator.create({ data: { contestId: contest.id, playerId: player.id } });
      await createEvent(tx, contest.id, 'SPECTATOR_JOINED', idempotencyKey, player.id);
    });
    return this.readView(player.id);
  }

  public async selectLegend(identity: AuthenticatedIdentity, characterId: string, idempotencyKey: string) {
    const player = await this.getPlayer.execute(identity);
    await this.mutateActive(player.id, 'LEGEND_SELECTED', idempotencyKey, { characterId }, async (tx, contest) => {
      assertLobby(contest);
      const participant = contest.participants.find((item) => item.playerId === player.id);
      if (!participant) throw new BusinessError('CONTEST_NOT_JOINED', 'Vous ne participez pas à ce lobby.');
      const legend = await findLegend(tx, player.id, characterId);
      await tx.contestParticipant.update({ where: { contestId_slot: { contestId: contest.id, slot: participant.slot } }, data: {
        characterId, characterNameSnapshot: legend.character.name, avatarSnapshot: legend.character.iconPath, ready: false,
      } });
      await touchLobbyDeadline(tx, contest.id, this.clock.now());
      await createEvent(tx, contest.id, 'LEGEND_SELECTED', idempotencyKey, player.id, { characterId, slot: participant.slot });
    });
    return this.readView(player.id);
  }

  public async setReady(identity: AuthenticatedIdentity, ready: boolean, idempotencyKey: string) {
    const player = await this.getPlayer.execute(identity);
    await this.mutateActive(player.id, 'READINESS_CHANGED', idempotencyKey, { ready }, async (tx, contest) => {
      assertLobby(contest);
      const participant = contest.participants.find((item) => item.playerId === player.id && item.kind === ContestParticipantKind.HUMAN);
      if (!participant) throw new BusinessError('CONTEST_NOT_JOINED', 'Vous ne participez pas à ce lobby.');
      await tx.contestParticipant.update({ where: { contestId_slot: { contestId: contest.id, slot: participant.slot } }, data: { ready } });
      await touchLobbyDeadline(tx, contest.id, this.clock.now());
      await createEvent(tx, contest.id, 'READINESS_CHANGED', idempotencyKey, player.id, { ready, slot: participant.slot });
    });
    return this.readView(player.id);
  }

  public async start(identity: AuthenticatedIdentity, idempotencyKey: string) {
    const player = await this.getPlayer.execute(identity);
    await this.mutateActive(player.id, 'CONTEST_STARTED', idempotencyKey, {}, async (tx, contest) => {
      assertLobby(contest);
      if (contest.organizerPlayerId !== player.id) throw new BusinessError('CONTEST_NOT_ORGANIZER', 'Seul l’organisateur peut lancer le Concours.');
      const humans = contest.participants.filter((item) => item.kind === ContestParticipantKind.HUMAN && item.playerId);
      if (humans.length === 0 || humans.some((item) => !item.ready)) throw new BusinessError('CONTEST_NOT_READY', 'Tous les participants humains doivent être prêts.');
      const snapshots = await Promise.all(humans.map(async (item) => {
        const progress = await findLegend(tx, item.playerId!, item.characterId!);
        const stat = progress[contestThemePresentation[contest.theme as ContestThemeKey].statKey];
        return { item, stat, base: contestBasePoints(stat), titleRank: titleRankForProgress(progress, contest.theme) };
      }));
      for (const { item, stat, base, titleRank } of snapshots) {
        await tx.contestParticipant.update({ where: { contestId_slot: { contestId: contest.id, slot: item.slot } }, data: {
          themeStatSnapshot: stat, basePointsSnapshot: base, titleRankSnapshot: titleRank,
        } });
        await consumeDaily(tx, item.playerId!, databaseDateToBusinessDate(contest.businessDate), contest.id, this.clock.now());
      }
      const humanStats = snapshots.map(({ stat }) => stat);
      const occupied = new Set(humans.map(({ slot }) => slot));
      for (const slot of [1, 2, 3, 4]) {
        if (occupied.has(slot)) continue;
        const stat = selectBotStat(humanStats, this.random);
        const bot = botIdentity(slot, this.random);
        await tx.contestParticipant.create({ data: {
          contestId: contest.id, slot, kind: ContestParticipantKind.BOT,
          playerNameSnapshot: bot.name, avatarSnapshot: bot.avatarKey,
          characterNameSnapshot: 'Légende invitée', themeStatSnapshot: stat,
          basePointsSnapshot: contestBasePoints(stat), ready: true,
        } });
      }
      const order = shuffledTurnOrder([1, 2, 3, 4], this.random);
      for (let index = 0; index < order.length; index += 1) {
        await tx.contestParticipant.update({ where: { contestId_slot: { contestId: contest.id, slot: order[index]! } }, data: { turnOrder: index + 1 } });
      }
      const now = this.clock.now();
      await tx.contest.update({ where: { id: contest.id }, data: {
        status: ContestStatus.RUNNING, phase: ContestPhase.TURNS, startedAt: now,
        lobbyDeadlineAt: null, currentTurnOrder: 1, currentRound: 1,
        turnDeadlineAt: new Date(now.getTime() + CONTEST_TURN_TIMEOUT_MS),
      } });
      await createEvent(tx, contest.id, 'CONTEST_STARTED', idempotencyKey, player.id, { order });
    });
    await this.reconcile();
    return this.readView(player.id);
  }

  public async play(identity: AuthenticatedIdentity, action: ContestAction, idempotencyKey: string) {
    const player = await this.getPlayer.execute(identity);
    await this.mutateActive(player.id, 'TURN_PLAYED', idempotencyKey, { action }, async (tx, contest) => {
      assertRunningTurns(contest);
      const participant = contest.participants.find((item) => item.playerId === player.id);
      if (!participant || participant.turnOrder !== contest.currentTurnOrder) throw new BusinessError('CONTEST_NOT_YOUR_TURN', 'Ce n’est pas votre tour.');
      await applyTurn(tx, contest, participant, action, false, idempotencyKey, player.id, this.clock.now(), this.random, this.economy);
    });
    await this.reconcile();
    return this.readView(player.id);
  }

  public async support(identity: AuthenticatedIdentity, targetSlot: number, idempotencyKey: string) {
    const player = await this.getPlayer.execute(identity);
    await this.mutateActive(player.id, 'SUPPORT_PLAYED', idempotencyKey, { targetSlot }, async (tx, contest) => {
      if (contest.status !== ContestStatus.RUNNING || contest.phase !== ContestPhase.SUPPORT || contest.selectedSpectatorPlayerId !== player.id) {
        throw new BusinessError('CONTEST_SUPPORT_UNAVAILABLE', 'Aucun soutien ne vous est proposé actuellement.');
      }
      const target = contest.participants.find((item) => item.slot === targetSlot);
      if (!target) throw new BusinessError('CONTEST_SUPPORT_UNAVAILABLE', 'Cette cible de soutien est invalide.');
      const points = selectSupportPoints(this.random);
      await tx.contestParticipant.update({ where: { contestId_slot: { contestId: contest.id, slot: targetSlot } }, data: { score: { increment: points } } });
      await createEvent(tx, contest.id, 'SUPPORT_PLAYED', idempotencyKey, player.id, { targetSlot, points }, target.playerId, targetSlot);
      if (target.score + points >= CONTEST_WINNING_SCORE) await finishContest(tx, contest.id, targetSlot, this.clock.now(), this.economy);
      else await beginNextRound(tx, contest.id, contest.currentRound, this.clock.now());
    });
    await this.reconcile();
    return this.readView(player.id);
  }

  public async leave(identity: AuthenticatedIdentity, idempotencyKey: string) {
    const player = await this.getPlayer.execute(identity);
    await this.mutateActive(player.id, 'MEMBER_LEFT', idempotencyKey, {}, async (tx, contest) => {
      const spectator = contest.spectators.find((item) => item.playerId === player.id);
      if (spectator) {
        await tx.contestSpectator.delete({ where: { contestId_playerId: { contestId: contest.id, playerId: player.id } } });
        if (contest.selectedSpectatorPlayerId === player.id) await beginNextRound(tx, contest.id, contest.currentRound, this.clock.now());
        await createEvent(tx, contest.id, 'SPECTATOR_LEFT', idempotencyKey, player.id);
        return;
      }
      const participant = contest.participants.find((item) => item.playerId === player.id);
      if (!participant) throw new BusinessError('CONTEST_NOT_JOINED', 'Vous n’êtes pas membre actif de ce Concours.');
      if (contest.status === ContestStatus.LOBBY) {
        const now = this.clock.now();
        await tx.contestParticipant.delete({ where: { contestId_slot: { contestId: contest.id, slot: participant.slot } } });
        await transferOrganizerOrCancel(tx, contest.id, player.id, now);
        await touchLobbyDeadline(tx, contest.id, now);
      } else {
        await replaceWithBot(tx, contest, participant.slot, ContestReplacementReason.LEFT, this.clock.now());
        await transferOrganizerOrCancel(tx, contest.id, player.id, this.clock.now());
      }
      await createEvent(tx, contest.id, 'MEMBER_LEFT', idempotencyKey, player.id, { slot: participant.slot });
    });
    await this.reconcile();
    return this.readView(player.id);
  }

  public async cancel(identity: AuthenticatedIdentity, idempotencyKey: string) {
    const player = await this.getPlayer.execute(identity);
    await this.mutateActive(player.id, 'CONTEST_CANCELLED', idempotencyKey, {}, async (tx, contest) => {
      if (contest.organizerPlayerId !== player.id) throw new BusinessError('CONTEST_NOT_ORGANIZER', 'Seul l’organisateur peut annuler le Concours.');
      await cancelContest(tx, contest, ContestCancellationKind.ORGANIZER, 'Annulation par l’organisateur', player.id, contest.status === ContestStatus.RUNNING, this.clock.now());
      await createEvent(tx, contest.id, 'CONTEST_CANCELLED', idempotencyKey, player.id);
    });
    return this.readView(player.id);
  }

  public async removeFromLobby(identity: AuthenticatedIdentity, targetPlayerId: string, idempotencyKey: string) {
    const organizer = await this.getPlayer.execute(identity);
    await this.mutateActive(organizer.id, 'LOBBY_PARTICIPANT_REMOVED', idempotencyKey, { targetPlayerId }, async (tx, contest) => {
      assertLobby(contest);
      if (contest.organizerPlayerId !== organizer.id) throw new BusinessError('CONTEST_NOT_ORGANIZER', 'Seul l’organisateur peut retirer un participant du lobby.');
      if (targetPlayerId === organizer.id) throw new BusinessError('CONTEST_NOT_ORGANIZER', 'L’organisateur doit quitter le lobby pour céder sa place.');
      const participant = contest.participants.find((item) => item.playerId === targetPlayerId);
      if (!participant) throw new BusinessError('CONTEST_NOT_JOINED', 'Ce joueur ne participe pas au lobby.');
      await tx.contestParticipant.delete({ where: { contestId_slot: { contestId: contest.id, slot: participant.slot } } });
      await tx.contestLobbyRemoval.upsert({ where: { contestId_playerId: { contestId: contest.id, playerId: targetPlayerId } }, create: { contestId: contest.id, playerId: targetPlayerId, count: 1 }, update: { count: { increment: 1 } } });
      await touchLobbyDeadline(tx, contest.id, this.clock.now());
      await createEvent(tx, contest.id, 'LOBBY_PARTICIPANT_REMOVED', idempotencyKey, organizer.id, { slot: participant.slot, targetPlayerId }, targetPlayerId, participant.slot);
    });
    return this.readView(organizer.id);
  }

  public async adminRemove(identity: AuthenticatedIdentity, targetPlayerId: string, idempotencyKey: string) {
    const actor = await this.getPlayer.execute(identity);
    const isAdmin = await this.database.playerRoleAssignment.findFirst({ where: { playerId: actor.id, role: 'ADMIN', revokedAt: null }, select: { id: true } });
    if (!isAdmin) throw new BusinessError('CONTEST_ADMIN_FORBIDDEN', 'Cette action est réservée à l’administration.');
    await this.mutateActive(actor.id, 'ADMIN_REMOVAL', idempotencyKey, { targetPlayerId }, async (tx, contest) => {
      const participant = contest.participants.find((item) => item.playerId === targetPlayerId);
      if (!participant) throw new BusinessError('CONTEST_NOT_JOINED', 'Ce joueur ne participe pas au Concours.');
      if (contest.status === ContestStatus.LOBBY) {
        const now = this.clock.now();
        await tx.contestParticipant.delete({ where: { contestId_slot: { contestId: contest.id, slot: participant.slot } } });
        await tx.contestLobbyRemoval.upsert({ where: { contestId_playerId: { contestId: contest.id, playerId: targetPlayerId } }, create: { contestId: contest.id, playerId: targetPlayerId, count: 1 }, update: { count: { increment: 1 } } });
        await transferOrganizerOrCancel(tx, contest.id, targetPlayerId, now);
        await touchLobbyDeadline(tx, contest.id, now);
      } else {
        await replaceWithBot(tx, contest, participant.slot, ContestReplacementReason.ADMIN_REMOVAL, this.clock.now());
        await transferOrganizerOrCancel(tx, contest.id, targetPlayerId, this.clock.now());
      }
      await createEvent(tx, contest.id, 'ADMIN_REMOVAL', idempotencyKey, actor.id, { slot: participant.slot, targetPlayerId }, targetPlayerId, participant.slot);
    });
    await this.reconcile();
    return this.readView(actor.id);
  }

  public async getHistory(page: number) {
    if (!Number.isInteger(page) || page < 1) throw new BusinessError('CONTEST_NOT_FOUND', 'Cette page d’historique est invalide.');
    await this.reconcile();
    const [total, contests] = await Promise.all([
      this.database.contest.count({ where: { status: ContestStatus.FINISHED } }),
      this.database.contest.findMany({ where: { status: ContestStatus.FINISHED }, include: contestInclude, orderBy: { finishedAt: 'desc' }, skip: (page - 1) * HISTORY_PAGE_SIZE, take: HISTORY_PAGE_SIZE }),
    ]);
    return { page, pageSize: HISTORY_PAGE_SIZE, total, pageCount: Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE)), contests: contests.map(presentContestHistorySummary) };
  }

  public async getHistoryDetail(contestId: string) {
    await this.reconcile();
    const contest = await this.database.contest.findFirst({ where: { id: contestId, status: ContestStatus.FINISHED }, include: contestInclude });
    if (!contest) throw new BusinessError('CONTEST_NOT_FOUND', 'Ce résultat de Concours est introuvable.');
    return presentContest(contest, null, true);
  }

  public async reconcile(): Promise<void> {
    for (let step = 0; step < 12; step += 1) {
      const outcome = await withSerializableRetry(this.database, async (tx) => {
        await lockContest(tx);
        const active = await findActive(tx);
        if (!active) return 'STOP' as const;
        const now = this.clock.now();
        if (active.status === ContestStatus.LOBBY) {
          if (active.lobbyDeadlineAt && active.lobbyDeadlineAt <= now) {
            await cancelContest(tx, active, ContestCancellationKind.LOBBY_TIMEOUT, 'Lobby inactif pendant dix minutes', null, false, now);
          }
          return 'STOP' as const;
        }
        const humans = active.participants.filter((item) => item.kind === ContestParticipantKind.HUMAN && item.playerId);
        if (humans.length === 0) {
          await cancelContest(tx, active, ContestCancellationKind.NO_HUMANS, 'Aucun participant humain restant', null, false, now);
          return 'STOP' as const;
        }
        if (active.phase === ContestPhase.SUPPORT) {
          if (!active.selectedSpectatorPlayerId || (active.supportDeadlineAt && active.supportDeadlineAt <= now)) {
            await createEvent(tx, active.id, 'SUPPORT_SKIPPED', null, null, { round: active.currentRound });
            await beginNextRound(tx, active.id, active.currentRound, now);
            return 'CONTINUE' as const;
          }
          return 'STOP' as const;
        }
        if (active.phase !== ContestPhase.TURNS || !active.currentTurnOrder) {
          await cancelContest(tx, active, ContestCancellationKind.TECHNICAL, 'État de tour impossible', null, true, now);
          return 'STOP' as const;
        }
        const participant = active.participants.find((item) => item.turnOrder === active.currentTurnOrder);
        if (!participant || !participant.basePointsSnapshot) {
          await cancelContest(tx, active, ContestCancellationKind.TECHNICAL, 'Participant de tour introuvable', null, true, now);
          return 'STOP' as const;
        }
        const isTimeout = Boolean(active.turnDeadlineAt && active.turnDeadlineAt <= now);
        if (participant.kind === ContestParticipantKind.HUMAN && !isTimeout) return 'STOP' as const;
        if (participant.kind === ContestParticipantKind.BOT) {
          const leadingScore = Math.max(...active.participants.map(({ score }) => score));
          const action = selectBotAction({ score: participant.score, leadingScore, basePoints: participant.basePointsSnapshot }, this.random);
          await applyTurn(tx, active, participant, action, false, null, null, now, this.random, this.economy);
        } else {
          await applyTurn(tx, active, participant, 'BASIC', true, null, participant.playerId, now, this.random, this.economy);
        }
        return 'CONTINUE' as const;
      });
      if (outcome === 'STOP') return;
    }
  }

  private async mutateActive(playerId: string, type: string, idempotencyKey: string, requestPayload: Record<string, unknown>, change: (tx: Prisma.TransactionClient, contest: ContestRecord) => Promise<void>) {
    await this.reconcile();
    const replay = await this.findReplay(playerId, type, idempotencyKey, requestPayload);
    if (replay) return;
    try {
      await withSerializableRetry(this.database, async (tx) => {
        await lockContest(tx);
        const contest = await findActive(tx);
        if (!contest) throw new BusinessError('CONTEST_NOT_FOUND', 'Aucun Concours actif.');
        await change(tx, contest);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && await this.findReplay(playerId, type, idempotencyKey, requestPayload)) return;
      throw error;
    }
  }

  private async findReplay(playerId: string, type: string, idempotencyKey: string, requestPayload: Record<string, unknown>) {
    const event = await this.database.contestEvent.findUnique({ where: { idempotencyKey } });
    if (!event) return null;
    const payload = event.payload && typeof event.payload === 'object' && !Array.isArray(event.payload) ? event.payload as Record<string, unknown> : {};
    const samePayload = Object.entries(requestPayload).every(([key, value]) => payload[key] === value);
    if (event.actorPlayerId !== playerId || event.type !== type || !samePayload) throw new BusinessError('CONTEST_IDEMPOTENCY_CONFLICT', 'Cette clé d’idempotence appartient à une autre action ou à un autre contenu.');
    return event;
  }

  private async readView(playerId: string) {
    const businessDate = getBusinessDate(this.clock.now());
    const [theme, active, lastResult, legends, daily, ownedC6] = await Promise.all([
      this.database.$transaction((tx) => ensureDailyTheme(tx, businessDate, this.random)),
      this.database.contest.findFirst({ where: { status: { in: [...ACTIVE_STATUSES] } }, include: contestInclude }),
      this.database.contest.findFirst({ where: { status: ContestStatus.FINISHED }, include: contestInclude, orderBy: { finishedAt: 'desc' } }),
      this.database.c6CompetitionProgress.findMany({ where: { playerId, character: { isActive: true, rarity: 5 } }, include: { character: true }, orderBy: { character: { displayOrder: 'asc' } } }),
      this.database.contestDailyParticipation.findUnique({ where: { playerId_businessDate: { playerId, businessDate: businessDateToDatabaseDate(businessDate) } } }),
      this.database.playerCharacter.findMany({ where: { playerId, constellation: 6, character: { isActive: true, rarity: 5 } }, select: { characterId: true } }),
    ]);
    const ownedIds = new Set(ownedC6.map(({ characterId }) => characterId));
    const eligibleLegends = legends.filter((legend) => ownedIds.has(legend.characterId));
    const dailyUsed = Boolean(daily && !daily.refundedAt);
    const participant = active?.participants.find((item) => item.playerId === playerId);
    const spectator = active?.spectators.some((item) => item.playerId === playerId) ?? false;
    return {
      businessDate,
      theme: presentTheme(theme),
      dailyUsed,
      permissions: {
        canOpen: !active && !dailyUsed && eligibleLegends.length > 0,
        canJoin: Boolean(active?.status === ContestStatus.LOBBY && !participant && !dailyUsed && active.participants.length < 4 && eligibleLegends.length > 0),
        canSpectate: Boolean(active && !participant && !spectator && active.spectators.length < CONTEST_MAX_SPECTATORS && !(active.status === ContestStatus.RUNNING && active.participants.some((item) => item.originalPlayerId === playerId))),
        canLeave: Boolean(active && (participant || spectator)),
        canReady: Boolean(active?.status === ContestStatus.LOBBY && participant),
        canStart: Boolean(active?.status === ContestStatus.LOBBY && active.organizerPlayerId === playerId && active.participants.every((item) => item.kind !== ContestParticipantKind.HUMAN || item.ready)),
        canCancel: Boolean(active && active.organizerPlayerId === playerId),
        canPlay: Boolean(active?.status === ContestStatus.RUNNING && active.phase === ContestPhase.TURNS && participant?.turnOrder === active.currentTurnOrder),
        canSupport: Boolean(active?.status === ContestStatus.RUNNING && active.phase === ContestPhase.SUPPORT && active.selectedSpectatorPlayerId === playerId),
      },
      active: active ? presentContest(active, playerId, false) : null,
      lastResult: !active && lastResult ? presentContest(lastResult, playerId, true) : null,
      legends: eligibleLegends.map((progress) => presentLegend(progress)),
    };
  }
}

export class ContestScheduler {
  private timer: NodeJS.Timeout | null = null;
  public constructor(private readonly service: ContestService) {}
  public start() { if (!this.timer) { this.timer = setInterval(() => { void this.service.reconcile(); }, 2_000); this.timer.unref(); } }
  public stop() { if (this.timer) clearInterval(this.timer); this.timer = null; }
}

const serializable = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20_000 } as const;

async function withSerializableRetry<T>(database: PrismaClient, action: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try { return await database.$transaction(action, serializable); }
    catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2034' || attempt >= 4) throw error;
    }
  }
}

async function lockContest(tx: Prisma.TransactionClient) { await tx.$queryRaw`SELECT true FROM pg_advisory_xact_lock(hashtext('contest:active'))`; }
async function findActive(tx: Client) { return tx.contest.findFirst({ where: { status: { in: [...ACTIVE_STATUSES] } }, include: contestInclude }); }
function assertLobby(contest: ContestRecord) { if (contest.status !== ContestStatus.LOBBY) throw new BusinessError('CONTEST_NOT_IN_LOBBY', 'Le lobby de ce Concours est fermé.'); }
function assertRunningTurns(contest: ContestRecord) { if (contest.status !== ContestStatus.RUNNING || contest.phase !== ContestPhase.TURNS) throw new BusinessError('CONTEST_NOT_RUNNING', 'Le Concours n’attend pas d’action de tour.'); }

async function ensureDailyTheme(tx: Client, businessDate: string, random: RandomSource): Promise<ContestTheme> {
  const date = businessDateToDatabaseDate(businessDate);
  const existing = await tx.contestDailyTheme.findUnique({ where: { businessDate: date } });
  if (existing) return existing.theme;
  const theme = selectContestTheme(random) as ContestTheme;
  try { return (await tx.contestDailyTheme.create({ data: { businessDate: date, theme } })).theme; }
  catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return (await tx.contestDailyTheme.findUniqueOrThrow({ where: { businessDate: date } })).theme;
    throw error;
  }
}

async function findLegend(tx: Client, playerId: string, characterId: string) {
  const legend = await tx.c6CompetitionProgress.findUnique({ where: { playerId_characterId: { playerId, characterId } }, include: { character: true, player: { select: { characters: { where: { characterId }, select: { constellation: true } } } } } });
  if (!legend || !legend.character.isActive || legend.character.rarity !== 5 || legend.player.characters[0]?.constellation !== 6) throw new BusinessError('CONTEST_LEGEND_INELIGIBLE', 'Seules vos Légendes 5★ actives en C6 peuvent participer.');
  return legend;
}

async function assertDailyAvailable(tx: Client, playerId: string, businessDate: string) {
  const daily = await tx.contestDailyParticipation.findUnique({ where: { playerId_businessDate: { playerId, businessDate: businessDateToDatabaseDate(businessDate) } } });
  if (daily && !daily.refundedAt) throw new BusinessError('CONTEST_DAILY_ALREADY_USED', 'Votre participation quotidienne a déjà été utilisée.');
}

async function consumeDaily(tx: Prisma.TransactionClient, playerId: string, businessDate: string, contestId: string, now: Date) {
  await assertDailyAvailable(tx, playerId, businessDate);
  await tx.contestDailyParticipation.upsert({
    where: { playerId_businessDate: { playerId, businessDate: businessDateToDatabaseDate(businessDate) } },
    create: { playerId, businessDate: businessDateToDatabaseDate(businessDate), contestId, consumedAt: now },
    update: { contestId, consumedAt: now, refundedAt: null },
  });
}

async function touchLobbyDeadline(tx: Prisma.TransactionClient, contestId: string, now: Date) {
  await tx.contest.updateMany({
    where: { id: contestId, status: ContestStatus.LOBBY },
    data: { lobbyDeadlineAt: new Date(now.getTime() + CONTEST_LOBBY_TIMEOUT_MS) },
  });
}

async function createEvent(tx: Prisma.TransactionClient, contestId: string, type: string, idempotencyKey: string | null, actorPlayerId: string | null, payload?: Prisma.InputJsonValue, targetPlayerId?: string | null, targetSlot?: number | null) {
  if (idempotencyKey && actorPlayerId) {
    const now = new Date();
    await tx.businessOperation.create({ data: {
      playerId: actorPlayerId,
      operationType: `contest.${type.toLowerCase()}`,
      sourceChannel: SourceChannel.UI,
      idempotencyKey,
      status: OperationStatus.COMPLETED,
      resultSummary: { contestId, type, payload: payload ?? null },
      completedAt: now,
    } });
  }
  await tx.contestEvent.create({ data: { contestId, type, idempotencyKey, actorPlayerId, targetPlayerId, targetSlot, payload } });
}

async function applyTurn(tx: Prisma.TransactionClient, contest: ContestRecord, participant: ContestRecord['participants'][number], action: ContestAction, automatic: boolean, idempotencyKey: string | null, actorPlayerId: string | null, now: Date, random: RandomSource, economy: PrismaEconomyService) {
  const base = participant.basePointsSnapshot!;
  const points = action === 'BASIC' ? base : selectRiskPoints(base, random);
  const inactivity = automatic && participant.kind === ContestParticipantKind.HUMAN ? participant.inactivityCount + 1 : 0;
  await tx.contestParticipant.update({ where: { contestId_slot: { contestId: contest.id, slot: participant.slot } }, data: { score: { increment: points }, inactivityCount: inactivity } });
  await createEvent(tx, contest.id, automatic ? 'TURN_AUTO_BASIC' : participant.kind === ContestParticipantKind.BOT ? 'BOT_TURN_PLAYED' : 'TURN_PLAYED', idempotencyKey, actorPlayerId, { slot: participant.slot, action, basePoints: base, points, round: contest.currentRound }, participant.playerId, participant.slot);
  if (inactivity >= 3 && participant.playerId) await replaceWithBot(tx, contest, participant.slot, ContestReplacementReason.INACTIVE, now);
  if (participant.score + points >= CONTEST_WINNING_SCORE) {
    await finishContest(tx, contest.id, participant.slot, now, economy);
    return;
  }
  await advanceTurn(tx, contest, now, random);
}

async function advanceTurn(tx: Prisma.TransactionClient, contest: ContestRecord, now: Date, random: RandomSource) {
  if ((contest.currentTurnOrder ?? 0) < 4) {
    await tx.contest.update({ where: { id: contest.id }, data: { currentTurnOrder: { increment: 1 }, turnDeadlineAt: new Date(now.getTime() + CONTEST_TURN_TIMEOUT_MS) } });
    return;
  }
  const spectators = await tx.contestSpectator.findMany({ where: { contestId: contest.id }, orderBy: { joinedAt: 'asc' } });
  if (spectators.length > 0) {
    const selected = spectators[random.nextInt(spectators.length)]!;
    await tx.contest.update({ where: { id: contest.id }, data: { phase: ContestPhase.SUPPORT, currentTurnOrder: null, turnDeadlineAt: null, selectedSpectatorPlayerId: selected.playerId, supportDeadlineAt: new Date(now.getTime() + CONTEST_SUPPORT_TIMEOUT_MS) } });
    await createEvent(tx, contest.id, 'SUPPORT_SELECTED', null, selected.playerId, { round: contest.currentRound });
  } else await beginNextRound(tx, contest.id, contest.currentRound, now);
}

async function beginNextRound(tx: Prisma.TransactionClient, contestId: string, currentRound: number, now: Date) {
  await tx.contest.update({ where: { id: contestId }, data: { phase: ContestPhase.TURNS, currentRound: currentRound + 1, currentTurnOrder: 1, selectedSpectatorPlayerId: null, supportDeadlineAt: null, turnDeadlineAt: new Date(now.getTime() + CONTEST_TURN_TIMEOUT_MS) } });
}

async function replaceWithBot(tx: Prisma.TransactionClient, contest: ContestRecord, slot: number, reason: ContestReplacementReason, now: Date) {
  const participant = await tx.contestParticipant.findUniqueOrThrow({ where: { contestId_slot: { contestId: contest.id, slot } } });
  const relayNames = ['Astra', 'Braise', 'Céleste', 'Dune'];
  await tx.contestParticipant.update({ where: { contestId_slot: { contestId: contest.id, slot } }, data: {
    kind: ContestParticipantKind.BOT, playerId: null, characterId: null, eligibleForResult: false,
    leftAt: now, replacedAt: now, replacementReason: reason,
    playerNameSnapshot: `${relayNames[slot - 1]} · Bot`, characterNameSnapshot: 'Légende relayée', avatarSnapshot: `bot-${slot}`,
  } });
  await createEvent(tx, contest.id, 'PARTICIPANT_REPLACED', null, null, { slot, reason, inheritedScore: participant.score, inheritedBasePoints: participant.basePointsSnapshot }, participant.originalPlayerId, slot);
}

async function transferOrganizerOrCancel(tx: Prisma.TransactionClient, contestId: string, departingPlayerId: string, now: Date) {
  const humans = await tx.contestParticipant.findMany({ where: { contestId, kind: ContestParticipantKind.HUMAN, playerId: { not: null } }, orderBy: { slot: 'asc' } });
  const contest = await tx.contest.findUniqueOrThrow({ where: { id: contestId }, include: contestInclude });
  if (humans.length === 0) { await cancelContest(tx, contest, ContestCancellationKind.NO_HUMANS, 'Aucun participant humain restant', null, false, now); return; }
  if (contest.organizerPlayerId === departingPlayerId) {
    await tx.contest.update({ where: { id: contestId }, data: { organizerPlayerId: humans[0]!.playerId } });
    await createEvent(tx, contestId, 'ORGANIZER_TRANSFERRED', null, humans[0]!.playerId, { previousOrganizerPlayerId: departingPlayerId });
  }
}

async function cancelContest(tx: Prisma.TransactionClient, contest: ContestRecord, kind: ContestCancellationKind, reason: string, actorPlayerId: string | null, refund: boolean, now: Date) {
  const fresh = await tx.contest.findUnique({ where: { id: contest.id } });
  if (!fresh || fresh.status === ContestStatus.CANCELLED || fresh.status === ContestStatus.FINISHED) return;
  await tx.contest.update({ where: { id: contest.id }, data: { status: ContestStatus.CANCELLED, phase: ContestPhase.CANCELLED, cancelledAt: now, cancellationKind: kind, cancellationReason: reason, turnDeadlineAt: null, supportDeadlineAt: null, lobbyDeadlineAt: null } });
  if (refund) {
    if (kind === ContestCancellationKind.ORGANIZER) {
      const present = await tx.contestParticipant.findMany({ where: { contestId: contest.id, kind: ContestParticipantKind.HUMAN, playerId: { not: null } }, select: { playerId: true } });
      const refundable = present.flatMap(({ playerId }) => playerId && playerId !== actorPlayerId ? [playerId] : []);
      if (refundable.length) await tx.contestDailyParticipation.updateMany({ where: { contestId: contest.id, playerId: { in: refundable }, refundedAt: null }, data: { refundedAt: now } });
    } else {
      await tx.contestDailyParticipation.updateMany({ where: { contestId: contest.id, refundedAt: null }, data: { refundedAt: now } });
    }
  }
  await createEvent(tx, contest.id, 'CANCELLED', null, actorPlayerId, { kind, reason, refund });
}

async function finishContest(tx: Prisma.TransactionClient, contestId: string, winnerSlot: number, now: Date, economy: PrismaEconomyService) {
  const contest = await tx.contest.findUniqueOrThrow({ where: { id: contestId }, include: contestInclude });
  const ranked = [...contest.participants].sort((a, b) => b.score - a.score || a.slot - b.slot);
  for (let index = 0; index < ranked.length; index += 1) {
    const participant = ranked[index]!;
    const rank = index + 1;
    const reward = CONTEST_REWARDS[index] ?? 0n;
    await tx.contestParticipant.update({ where: { contestId_slot: { contestId, slot: participant.slot } }, data: { finalRank: rank, rewardPrimogems: participant.kind === ContestParticipantKind.HUMAN && participant.playerId ? reward : 0n } });
    if (participant.kind !== ContestParticipantKind.HUMAN || !participant.playerId || !participant.characterId) continue;
    const won = participant.slot === winnerSlot;
    const progress = await tx.c6CompetitionProgress.findUniqueOrThrow({ where: { playerId_characterId: { playerId: participant.playerId, characterId: participant.characterId } } });
    const oldFloor = titleRankForProgress(progress, contest.theme);
    const themeWins = themeWinsForProgress(progress, contest.theme) + (won ? 1n : 0n);
    const newFloor = Math.max(oldFloor, contestTitleFloor(themeWins));
    await tx.c6CompetitionProgress.update({ where: { playerId_characterId: { playerId: participant.playerId, characterId: participant.characterId } }, data: themeProgressUpdate(contest.theme, won, newFloor) });
    if (newFloor > oldFloor) await createEvent(tx, contestId, 'TITLE_PROMOTED', null, participant.playerId, { slot: participant.slot, from: oldFloor, to: newFloor, title: contestTitle(contest.theme as ContestThemeKey, newFloor) }, participant.playerId, participant.slot);
    const operation = await tx.businessOperation.create({ data: {
      playerId: participant.playerId, operationType: 'contest.reward', sourceChannel: SourceChannel.SYSTEM,
      idempotencyKey: `contest:${contestId}:reward:${participant.playerId}`, status: OperationStatus.PENDING,
      resultSummary: { contestId, rank, reward: reward.toString() },
    } });
    if (reward > 0n) {
      const player = await tx.player.findUniqueOrThrow({ where: { id: participant.playerId }, select: { elementKey: true } });
      if (!player.elementKey || !isElementKey(player.elementKey)) throw new Error('Contest reward recipient has no valid element.');
      const playerElementKey = player.elementKey;
      await economy.credit(tx, { playerId: participant.playerId, playerElementKey, resourceKey: 'primogems', amount: reward, causeKey: 'contest.ranking', domainKey: 'contest', operationId: operation.id, sourceChannel: SourceChannel.SYSTEM });
    }
    await tx.contestReward.create({ data: { contestId, playerId: participant.playerId, rank, primogems: reward, operationId: operation.id, awardedAt: now } });
    await tx.businessOperation.update({ where: { id: operation.id }, data: { status: OperationStatus.COMPLETED, completedAt: now } });
  }
  await tx.contest.update({ where: { id: contestId }, data: { status: ContestStatus.FINISHED, phase: ContestPhase.FINISHED, winnerSlot, finishedAt: now, turnDeadlineAt: null, supportDeadlineAt: null, selectedSpectatorPlayerId: null } });
  await createEvent(tx, contestId, 'CONTEST_FINISHED', null, null, { winnerSlot, ranking: ranked.map((item, index) => ({ slot: item.slot, rank: index + 1, score: item.score })) });
}

function themeProgressUpdate(theme: ContestTheme, won: boolean, titleFloor: number): Prisma.C6CompetitionProgressUpdateInput {
  const common = { totalContests: { increment: 1n }, ...(won ? { totalWins: { increment: 1n } } : {}) };
  if (theme === 'STRENGTH') return { ...common, strengthParticipations: { increment: 1n }, ...(won ? { strengthWins: { increment: 1n } } : {}), strengthTitleFloor: titleFloor };
  if (theme === 'INTELLIGENCE') return { ...common, intelligenceParticipations: { increment: 1n }, ...(won ? { intelligenceWins: { increment: 1n } } : {}), intelligenceTitleFloor: titleFloor };
  if (theme === 'BEAUTY') return { ...common, beautyParticipations: { increment: 1n }, ...(won ? { beautyWins: { increment: 1n } } : {}), beautyTitleFloor: titleFloor };
  if (theme === 'CHARISMA') return { ...common, charismaParticipations: { increment: 1n }, ...(won ? { charismaWins: { increment: 1n } } : {}), charismaTitleFloor: titleFloor };
  return { ...common, popularityParticipations: { increment: 1n }, ...(won ? { popularityWins: { increment: 1n } } : {}), popularityTitleFloor: titleFloor };
}

function themeWinsForProgress(progress: Prisma.C6CompetitionProgressGetPayload<object>, theme: ContestTheme): bigint {
  if (theme === 'STRENGTH') return progress.strengthWins;
  if (theme === 'INTELLIGENCE') return progress.intelligenceWins;
  if (theme === 'BEAUTY') return progress.beautyWins;
  if (theme === 'CHARISMA') return progress.charismaWins;
  return progress.popularityWins;
}

function titleRankForProgress(progress: Prisma.C6CompetitionProgressGetPayload<object>, theme: ContestTheme): number {
  if (theme === 'STRENGTH') return progress.strengthTitleFloor;
  if (theme === 'INTELLIGENCE') return progress.intelligenceTitleFloor;
  if (theme === 'BEAUTY') return progress.beautyTitleFloor;
  if (theme === 'CHARISMA') return progress.charismaTitleFloor;
  return progress.popularityTitleFloor;
}

function presentTheme(theme: ContestTheme) { const item = contestThemePresentation[theme as ContestThemeKey]; return { key: theme, label: item.label, title: item.title, statKey: item.statKey }; }

function presentLegend(progress: Prisma.C6CompetitionProgressGetPayload<{ include: { character: true } }>) {
  return {
    character: { id: progress.character.id, externalKey: progress.character.externalKey, name: progress.character.name, iconPath: progress.character.iconPath, elementKey: progress.character.elementKey },
    stats: { strength: progress.strength, intelligence: progress.intelligence, beauty: progress.beauty, charisma: progress.charisma, popularity: progress.popularity },
    totals: { contests: progress.totalContests.toString(), wins: progress.totalWins.toString() },
    themes: Object.fromEntries((Object.keys(contestThemePresentation) as ContestThemeKey[]).map((theme) => {
      const prefix = contestThemePresentation[theme].statKey;
      const participations = progress[`${prefix}Participations` as keyof typeof progress] as bigint;
      const wins = progress[`${prefix}Wins` as keyof typeof progress] as bigint;
      const floor = progress[`${prefix}TitleFloor` as keyof typeof progress] as number;
      return [theme, { participations: participations.toString(), wins: wins.toString(), titleRank: floor, title: contestTitle(theme, floor) }];
    })),
  };
}

function presentContest(contest: ContestRecord, viewerPlayerId: string | null, history: boolean) {
  const viewerParticipant = contest.participants.find((item) => item.playerId === viewerPlayerId);
  const viewerSpectator = contest.spectators.find((item) => item.playerId === viewerPlayerId);
  const promotions = history ? presentPromotions(contest) : [];
  return {
    id: contest.id, businessDate: databaseDateToBusinessDate(contest.businessDate), theme: presentTheme(contest.theme),
    status: contest.status, phase: contest.phase, organizerPlayerId: contest.organizerPlayerId,
    lobbyDeadlineAt: contest.lobbyDeadlineAt?.toISOString() ?? null, turnDeadlineAt: contest.turnDeadlineAt?.toISOString() ?? null,
    supportDeadlineAt: contest.supportDeadlineAt?.toISOString() ?? null, currentTurnOrder: contest.currentTurnOrder,
    currentRound: contest.currentRound, winnerSlot: contest.winnerSlot, startedAt: contest.startedAt?.toISOString() ?? null,
    finishedAt: contest.finishedAt?.toISOString() ?? null,
    viewer: { participantSlot: viewerParticipant?.slot ?? null, selectedCharacterId: viewerParticipant?.characterId ?? null, spectator: Boolean(viewerSpectator), organizer: contest.organizerPlayerId === viewerPlayerId, selectedForSupport: contest.selectedSpectatorPlayerId === viewerPlayerId },
    participants: contest.participants.map((item) => ({
      slot: item.slot, kind: item.kind, playerId: item.playerId, displayName: item.playerNameSnapshot,
      characterName: item.characterNameSnapshot, avatar: item.avatarSnapshot, basePoints: item.basePointsSnapshot,
      titleRank: item.titleRankSnapshot, title: contestTitle(contest.theme as ContestThemeKey, item.titleRankSnapshot),
      score: item.score, turnOrder: item.turnOrder, ready: item.ready,
      activeTurn: contest.phase === ContestPhase.TURNS && item.turnOrder === contest.currentTurnOrder,
      replaced: Boolean(item.replacedAt), replacementReason: history ? item.replacementReason : undefined,
      finalRank: history ? item.finalRank : null, rewardPrimogems: history ? item.rewardPrimogems.toString() : null,
    })),
    spectators: contest.spectators.map((item) => ({ playerId: item.playerId, displayName: item.player.displayName, selected: contest.selectedSpectatorPlayerId === item.playerId })),
    promotions,
    historyEvents: history ? presentHistoryEvents(contest) : [],
  };
}

function presentContestHistorySummary(contest: ContestRecord) {
  const winner = contest.participants.find((item) => item.slot === contest.winnerSlot);
  return {
    id: contest.id,
    businessDate: databaseDateToBusinessDate(contest.businessDate),
    theme: presentTheme(contest.theme),
    currentRound: contest.currentRound,
    winner: winner ? { slot: winner.slot, displayName: winner.playerNameSnapshot, kind: winner.kind } : null,
    startedAt: contest.startedAt?.toISOString() ?? null,
    finishedAt: contest.finishedAt?.toISOString() ?? null,
  };
}

function presentPromotions(contest: ContestRecord) {
  return contest.events.flatMap((event) => {
    if (event.type !== 'TITLE_PROMOTED') return [];
    const payload = jsonObject(event.payload);
    const slot = numberValue(payload.slot) ?? event.targetSlot;
    const fromRank = numberValue(payload.from);
    const toRank = numberValue(payload.to);
    const title = stringValue(payload.title);
    const participant = contest.participants.find((item) => item.slot === slot && item.kind === ContestParticipantKind.HUMAN && !item.replacedAt);
    if (!participant || !event.targetPlayerId || fromRank === null || toRank === null || !title) return [];
    return [{ playerId: event.targetPlayerId, slot: participant.slot, characterName: participant.characterNameSnapshot, fromRank, toRank, title }];
  });
}

type PresentedHistoryEvent =
  | { kind: 'PARTICIPANT_LEFT'; occurredAt: string; slot: number | null; playerName: string | null }
  | { kind: 'PARTICIPANT_REPLACED'; occurredAt: string; slot: number | null; playerName: string | null; reason: string | null }
  | { kind: 'SUPPORT_SELECTED'; occurredAt: string; round: number | null; playerName: string | null }
  | { kind: 'SUPPORT_PLAYED'; occurredAt: string; slot: number | null; playerName: string | null; targetName: string | null; points: number | null }
  | { kind: 'SUPPORT_SKIPPED'; occurredAt: string; round: number | null }
  | { kind: 'TITLE_PROMOTED'; occurredAt: string; slot: number; playerName: string | null; characterName: string | null; fromRank: number; toRank: number; title: string };

function presentHistoryEvents(contest: ContestRecord): PresentedHistoryEvent[] {
  const displayName = (playerId: string | null) => {
    if (!playerId) return null;
    const participant = contest.participants.find((item) => item.playerId === playerId || item.originalPlayerId === playerId);
    if (participant?.playerId === playerId) return participant.playerNameSnapshot;
    if (participant?.originalPlayerId === playerId) return participant.originalPlayer?.displayName ?? participant.playerNameSnapshot;
    return contest.spectators.find((item) => item.playerId === playerId)?.player.displayName ?? null;
  };
  const result: PresentedHistoryEvent[] = [];
  for (const event of contest.events) {
    const payload = jsonObject(event.payload);
    const occurredAt = event.createdAt.toISOString();
    if (event.type === 'MEMBER_LEFT') result.push({ kind: 'PARTICIPANT_LEFT', occurredAt, slot: numberValue(payload.slot), playerName: displayName(event.actorPlayerId) });
    if (event.type === 'PARTICIPANT_REPLACED') result.push({ kind: 'PARTICIPANT_REPLACED', occurredAt, slot: numberValue(payload.slot), playerName: displayName(event.targetPlayerId), reason: stringValue(payload.reason) });
    if (event.type === 'SUPPORT_SELECTED') result.push({ kind: 'SUPPORT_SELECTED', occurredAt, round: numberValue(payload.round), playerName: displayName(event.actorPlayerId) });
    if (event.type === 'SUPPORT_PLAYED') result.push({ kind: 'SUPPORT_PLAYED', occurredAt, slot: numberValue(payload.targetSlot) ?? event.targetSlot, playerName: displayName(event.actorPlayerId), targetName: displayName(event.targetPlayerId), points: numberValue(payload.points) });
    if (event.type === 'SUPPORT_SKIPPED') result.push({ kind: 'SUPPORT_SKIPPED', occurredAt, round: numberValue(payload.round) });
    if (event.type === 'TITLE_PROMOTED') {
      const promotion = presentPromotions({ ...contest, events: [event] })[0];
      if (promotion) result.push({ kind: 'TITLE_PROMOTED', occurredAt, slot: promotion.slot, playerName: displayName(promotion.playerId), characterName: promotion.characterName, fromRank: promotion.fromRank, toRank: promotion.toRank, title: promotion.title });
    }
  }
  return result;
}

function jsonObject(value: Prisma.JsonValue | null): Record<string, Prisma.JsonValue> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, Prisma.JsonValue> : {};
}
function numberValue(value: Prisma.JsonValue | undefined): number | null { return typeof value === 'number' ? value : null; }
function stringValue(value: Prisma.JsonValue | undefined): string | null { return typeof value === 'string' ? value : null; }
