import { EventEditionStatus, OperationStatus, Prisma, SourceChannel, type PrismaClient } from '../../../generated/prisma/client.js';
import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import { activeEventGameAWindow, computeEventRefreshAfterMs, EVENT_GAME_A_COOLDOWN_MS, eventGameASucceeded, generateEventGameAState, parseEventGameAState } from '../../domain/event/game-a.js';
import { EVENT_GAME_B_CODES, EVENT_GAME_B_MAX_ATTEMPTS, generateEventGameBSolution, isEventGameBCode, parseEventGameBTestedCodes } from '../../domain/event/game-b.js';
import { businessDateToDatabaseDate, getBusinessDate, getBusinessDayStartAt, getBusinessMinuteAt, getNextBusinessResetAt, type Clock } from '../../domain/time/business-date.js';
import type { RandomSource } from '../../domain/wheel/wheel.js';
import { isPrismaConcurrencyCollision } from '../../infrastructure/database/prisma-concurrency.js';
import { BusinessError } from '../errors.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';

type Database = PrismaClient | Prisma.TransactionClient;

type FestivalConfig = Readonly<{
  emoji: string;
  currency: Readonly<{ label: string; emoji: string }>;
  collection: Readonly<{ key: string; label: string }>;
}>;

type EditionSnapshot = Readonly<{
  externalKey: string;
  displayName: string;
  calendarMonth: number;
  currencyKey: string;
  config: FestivalConfig;
}>;

const gameAThemes = {
  'new-year': { key: 'feu', label: 'Feu' }, hearts: { key: 'coeur', label: 'Cœur' }, spring: { key: 'pousse', label: 'Pousse' },
  bells: { key: 'oeuf', label: 'Œuf' }, flowers: { key: 'fleur', label: 'Fleur' }, summer: { key: 'peche', label: 'Pêche' },
  stars: { key: 'etoile', label: 'Étoile' }, adventurers: { key: 'expedition', label: 'Expédition' }, harvest: { key: 'recolte', label: 'Récolte' },
  shadows: { key: 'fantome', label: 'Fantôme' }, mists: { key: 'feuille', label: 'Feuille' }, christmas: { key: 'cadeau', label: 'Cadeau' },
} as const;

const gameBThemes = {
  'new-year': 'Coffre', hearts: 'Cadeau', spring: 'Racine', bells: 'Panier', flowers: 'Bouquet', summer: 'Trésor',
  stars: 'Constellation', adventurers: 'Ruine', harvest: 'Grenier', shadows: 'Crypte', mists: 'Relique', christmas: 'Hotte',
} as const;

type Definition = Readonly<{
  id: string;
  externalKey: string;
  displayName: string;
  calendarMonth: number;
  currencyKey: string;
  config: unknown;
}>;

export type CurrentEventPeriod = Readonly<{
  businessDate: string;
  year: number;
  month: number;
  startsAt: Date;
  endsAt: Date;
}>;

export function resolveCurrentEventPeriod(now: Date): CurrentEventPeriod {
  const businessDate = getBusinessDate(now);
  const year = Number(businessDate.slice(0, 4));
  const month = Number(businessDate.slice(5, 7));
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return {
    businessDate,
    year,
    month,
    startsAt: getBusinessDayStartAt(`${year}-${String(month).padStart(2, '0')}-01`),
    endsAt: getBusinessDayStartAt(`${nextYear}-${String(nextMonth).padStart(2, '0')}-01`),
  };
}

export class EventService {
  public constructor(
    private readonly getPlayer: GetCurrentPlayer,
    private readonly database: PrismaClient,
    private readonly clock: Clock,
    private readonly random: RandomSource,
  ) {}

  public async getCurrent(identity: AuthenticatedIdentity) {
    const player = await this.getPlayer.execute(identity);
    const now = this.clock.now();
    const context = await this.resolveCurrentEdition(this.database, now);
    await this.ensureGameBState(context.edition.id, context.period.businessDate, now);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.database.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM players WHERE id = ${player.id}::uuid FOR UPDATE`;
          return this.snapshot(tx, player.id, context, now, true);
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (attempt < 2 && isPrismaConcurrencyCollision(error)) continue;
        throw error;
      }
    }
    throw new Error('Current Event state could not be loaded.');
  }

  public async join(identity: AuthenticatedIdentity, idempotencyKey: string) {
    const player = await this.getPlayer.execute(identity);
    const now = this.clock.now();
    const context = await this.resolveCurrentEdition(this.database, now);
    await this.ensureGameBState(context.edition.id, context.period.businessDate, now);
    let operationId = '';
    let alreadyProcessed = false;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const result = await this.database.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT event_edition_id FROM event_game_b_daily_states WHERE event_edition_id = ${context.edition.id}::uuid AND business_date = ${businessDateToDatabaseDate(context.period.businessDate)}::date FOR UPDATE`;
          await tx.$queryRaw`SELECT id FROM players WHERE id = ${player.id}::uuid FOR UPDATE`;
          const existingOperation = await tx.businessOperation.findFirst({
            where: { sourceChannel: SourceChannel.UI, idempotencyKey },
          });
          if (existingOperation) {
            const request = readRecord(existingOperation.resultSummary)?.request;
            if (
              existingOperation.playerId !== player.id
              || existingOperation.operationType !== 'event.join'
              || readRecord(request)?.editionId !== context.edition.id
              || existingOperation.status !== OperationStatus.COMPLETED
            ) {
              throw new BusinessError('EVENT_IDEMPOTENCY_CONFLICT', 'Cette clé d’idempotence appartient à une autre opération.');
            }
            return { operationId: existingOperation.id, alreadyProcessed: true, view: null };
          }

          await tx.$queryRaw`SELECT id FROM event_editions WHERE id = ${context.edition.id}::uuid FOR SHARE`;
          const participant = await tx.eventParticipant.findUnique({
            where: { eventEditionId_playerId: { eventEditionId: context.edition.id, playerId: player.id } },
            select: { playerId: true },
          });
          const operation = await tx.businessOperation.create({
            data: {
              playerId: player.id,
              operationType: 'event.join',
              sourceChannel: SourceChannel.UI,
              idempotencyKey,
              status: OperationStatus.PENDING,
              resultSummary: { request: { editionId: context.edition.id } },
            },
          });

          if (!participant) {
            const gameB = await tx.eventGameBDailyState.findUniqueOrThrow({ where: { eventEditionId_businessDate: { eventEditionId: context.edition.id, businessDate: businessDateToDatabaseDate(context.period.businessDate) } }, select: { solvedAt: true } });
            const lateReward = gameB.solvedAt !== null;
            await tx.eventParticipant.create({
              data: { eventEditionId: context.edition.id, playerId: player.id, points: lateReward ? 1 : 0, joinedAt: now },
            });
            await tx.playerEventCurrencyBalance.upsert({
              where: { playerId_eventDefinitionId: { playerId: player.id, eventDefinitionId: context.definition.id } },
              create: { playerId: player.id, eventDefinitionId: context.definition.id, amount: lateReward ? 2n : 1n, updatedAt: now },
              update: { amount: { increment: lateReward ? 2n : 1n }, updatedAt: now },
            });
          }

          await tx.businessOperation.update({
            where: { id: operation.id },
            data: {
              status: OperationStatus.COMPLETED,
              completedAt: now,
              resultSummary: { request: { editionId: context.edition.id }, joined: true, credited: !participant },
            },
          });
          return { operationId: operation.id, alreadyProcessed: false, view: await this.snapshot(tx, player.id, context, now, true) };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

        operationId = result.operationId;
        alreadyProcessed = result.alreadyProcessed;
        if (result.view) return { ...result.view, operation: { id: operationId, alreadyProcessed } };
        break;
      } catch (error) {
        if (attempt < 2 && isPrismaConcurrencyCollision(error)) continue;
        throw error;
      }
    }

    return {
      ...await this.getCurrent(identity),
      operation: { id: operationId, alreadyProcessed },
    };
  }

  public async attemptGameA(identity: AuthenticatedIdentity, idempotencyKey: string) {
    const player = await this.getPlayer.execute(identity);
    const now = this.clock.now();
    const context = await this.resolveCurrentEdition(this.database, now);
    await this.ensureGameBState(context.edition.id, context.period.businessDate, now);
    let retainedRoll: number | null = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.database.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM players WHERE id = ${player.id}::uuid FOR UPDATE`;
          const existingOperation = await tx.businessOperation.findFirst({ where: { sourceChannel: SourceChannel.UI, idempotencyKey } });
          if (existingOperation) {
            const summary = readRecord(existingOperation.resultSummary);
            const request = readRecord(summary?.request);
            if (existingOperation.playerId !== player.id || existingOperation.operationType !== 'event.game-a.attempt' || request?.editionId !== context.edition.id || request.businessDate !== context.period.businessDate || existingOperation.status !== OperationStatus.COMPLETED) {
              throw new BusinessError('EVENT_GAME_A_IDEMPOTENCY_CONFLICT', 'Cette clé d’idempotence appartient à une autre tentative.');
            }
            return { ...await this.snapshot(tx, player.id, context, now, true), operation: { id: existingOperation.id, alreadyProcessed: true }, attempt: { succeeded: summary?.succeeded === true } };
          }

          await tx.$queryRaw`SELECT id FROM event_editions WHERE id = ${context.edition.id}::uuid FOR SHARE`;
          const participant = await tx.eventParticipant.findUnique({ where: { eventEditionId_playerId: { eventEditionId: context.edition.id, playerId: player.id } } });
          if (!participant) throw new BusinessError('EVENT_NOT_JOINED', 'Rejoignez le Festival avant de jouer.');
          let daily = await this.ensureDailyState(tx, context.edition.id, player.id, context.period.businessDate, now);
          await tx.$queryRaw`SELECT event_edition_id FROM event_daily_player_states WHERE event_edition_id = ${context.edition.id}::uuid AND player_id = ${player.id}::uuid AND business_date = ${businessDateToDatabaseDate(context.period.businessDate)}::date FOR UPDATE`;
          daily = await tx.eventDailyPlayerState.findUniqueOrThrow({ where: { eventEditionId_playerId_businessDate: { eventEditionId: context.edition.id, playerId: player.id, businessDate: businessDateToDatabaseDate(context.period.businessDate) } } });
          if (daily.gameASuccess) throw new BusinessError('EVENT_GAME_A_ALREADY_COMPLETED', 'Le Jeu A est déjà réussi pour aujourd’hui.');
          const state = parseEventGameAState(daily.state);
          const activeWindowIndex = activeEventGameAWindow(state.gameA.windows, parisMinuteOfDay(now));
          if (activeWindowIndex === null) throw new BusinessError('EVENT_GAME_A_OUTSIDE_WINDOW', 'Aucune fenêtre du Jeu A n’est active actuellement.');
          if (daily.gameALastAttemptAt && now.getTime() - daily.gameALastAttemptAt.getTime() < EVENT_GAME_A_COOLDOWN_MS) throw new BusinessError('EVENT_GAME_A_COOLDOWN', 'Patientez avant une nouvelle tentative.');

          retainedRoll ??= this.random.nextInt(100);
          const succeeded = eventGameASucceeded(retainedRoll);
          const operation = await tx.businessOperation.create({ data: { playerId: player.id, operationType: 'event.game-a.attempt', sourceChannel: SourceChannel.UI, idempotencyKey, status: OperationStatus.PENDING, resultSummary: { request: { editionId: context.edition.id, businessDate: context.period.businessDate } } } });
          await tx.eventDailyPlayerState.update({ where: { eventEditionId_playerId_businessDate: { eventEditionId: context.edition.id, playerId: player.id, businessDate: businessDateToDatabaseDate(context.period.businessDate) } }, data: { gameAAttempts: { increment: 1 }, gameASuccess: succeeded, gameALastAttemptAt: now, updatedAt: now } });
          if (succeeded) {
            await tx.eventParticipant.update({ where: { eventEditionId_playerId: { eventEditionId: context.edition.id, playerId: player.id } }, data: { points: { increment: 1 } } });
            await tx.playerEventCurrencyBalance.upsert({ where: { playerId_eventDefinitionId: { playerId: player.id, eventDefinitionId: context.definition.id } }, create: { playerId: player.id, eventDefinitionId: context.definition.id, amount: 1n, updatedAt: now }, update: { amount: { increment: 1n }, updatedAt: now } });
          }
          await tx.businessOperation.update({ where: { id: operation.id }, data: { status: OperationStatus.COMPLETED, completedAt: now, resultSummary: { request: { editionId: context.edition.id, businessDate: context.period.businessDate }, succeeded } } });
          return { ...await this.snapshot(tx, player.id, context, now, false), operation: { id: operation.id, alreadyProcessed: false }, attempt: { succeeded } };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (attempt < 2 && isPrismaConcurrencyCollision(error)) continue;
        throw error;
      }
    }
    throw new Error('Event Game A attempt could not be completed.');
  }

  public async attemptGameB(identity: AuthenticatedIdentity, code: string, idempotencyKey: string) {
    if (!isEventGameBCode(code)) throw new BusinessError('EVENT_GAME_B_INVALID_CODE', 'Le code doit contenir exactement cinq chiffres 0 ou 1.');
    const player = await this.getPlayer.execute(identity);
    const now = this.clock.now();
    const context = await this.resolveCurrentEdition(this.database, now);
    await this.ensureGameBState(context.edition.id, context.period.businessDate, now);
    const key = { eventEditionId: context.edition.id, businessDate: businessDateToDatabaseDate(context.period.businessDate) };

    for (let retry = 0; retry < 4; retry += 1) {
      try {
        return await this.database.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT event_edition_id FROM event_game_b_daily_states WHERE event_edition_id = ${context.edition.id}::uuid AND business_date = ${key.businessDate}::date FOR UPDATE`;
          await tx.$queryRaw`SELECT id FROM players WHERE id = ${player.id}::uuid FOR UPDATE`;
          const existingOperation = await tx.businessOperation.findFirst({ where: { sourceChannel: SourceChannel.UI, idempotencyKey } });
          if (existingOperation) {
            const summary = readRecord(existingOperation.resultSummary);
            const request = readRecord(summary?.request);
            if (existingOperation.playerId !== player.id || existingOperation.operationType !== 'event.game-b.attempt' || request?.editionId !== context.edition.id || request.businessDate !== context.period.businessDate || request.code !== code || existingOperation.status !== OperationStatus.COMPLETED) {
              throw new BusinessError('EVENT_GAME_B_IDEMPOTENCY_CONFLICT', 'Cette clé d’idempotence appartient à une autre tentative.');
            }
            return { ...await this.snapshot(tx, player.id, context, now, false), operation: { id: existingOperation.id, alreadyProcessed: true }, attempt: { kind: parseGameBResultKind(summary?.kind) } };
          }

          const participant = await tx.eventParticipant.findUnique({ where: { eventEditionId_playerId: { eventEditionId: context.edition.id, playerId: player.id } } });
          if (!participant) throw new BusinessError('EVENT_NOT_JOINED', 'Rejoignez le Festival avant de jouer.');
          const global = await tx.eventGameBDailyState.findUniqueOrThrow({ where: { eventEditionId_businessDate: key } });
          if (global.solvedAt) throw new BusinessError('EVENT_GAME_B_ALREADY_SOLVED', 'La combinaison a déjà été découverte aujourd’hui.');
          const testedCodes = parseEventGameBTestedCodes(global.testedCodes);
          const alreadyTested = testedCodes.includes(code);
          const daily = await this.ensureDailyState(tx, context.edition.id, player.id, context.period.businessDate, now);
          if (!alreadyTested && daily.gameBAttemptsUsed >= EVENT_GAME_B_MAX_ATTEMPTS) throw new BusinessError('EVENT_GAME_B_NO_ATTEMPTS', 'Vous avez utilisé vos trois essais du jour.');

          const kind = alreadyTested ? 'ALREADY_TESTED' : code === global.solutionCode ? 'CORRECT' : 'INCORRECT';
          const operation = await tx.businessOperation.create({ data: { playerId: player.id, operationType: 'event.game-b.attempt', sourceChannel: SourceChannel.UI, idempotencyKey, status: OperationStatus.PENDING, resultSummary: { request: { editionId: context.edition.id, businessDate: context.period.businessDate, code } } } });
          if (!alreadyTested) {
            await tx.eventDailyPlayerState.update({ where: { eventEditionId_playerId_businessDate: { eventEditionId: context.edition.id, playerId: player.id, businessDate: key.businessDate } }, data: { gameBAttemptsUsed: { increment: 1 }, updatedAt: now } });
            await tx.eventGameBDailyState.update({ where: { eventEditionId_businessDate: key }, data: { testedCodes: [...testedCodes, code], ...(kind === 'CORRECT' ? { solvedAt: now, discovererPlayerId: player.id } : {}), updatedAt: now } });
            if (kind === 'CORRECT') {
              const participants = await tx.eventParticipant.findMany({ where: { eventEditionId: context.edition.id }, orderBy: { playerId: 'asc' }, select: { playerId: true } });
              for (const entry of participants) {
                await tx.eventParticipant.update({ where: { eventEditionId_playerId: { eventEditionId: context.edition.id, playerId: entry.playerId } }, data: { points: { increment: 1 } } });
                await tx.playerEventCurrencyBalance.upsert({ where: { playerId_eventDefinitionId: { playerId: entry.playerId, eventDefinitionId: context.definition.id } }, create: { playerId: entry.playerId, eventDefinitionId: context.definition.id, amount: 1n, updatedAt: now }, update: { amount: { increment: 1n }, updatedAt: now } });
              }
            }
          }
          await tx.businessOperation.update({ where: { id: operation.id }, data: { status: OperationStatus.COMPLETED, completedAt: now, resultSummary: { request: { editionId: context.edition.id, businessDate: context.period.businessDate, code }, kind } } });
          return { ...await this.snapshot(tx, player.id, context, now, false), operation: { id: operation.id, alreadyProcessed: false }, attempt: { kind } };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (retry < 3 && isPrismaConcurrencyCollision(error)) continue;
        throw error;
      }
    }
    throw new Error('Event Game B attempt could not be completed.');
  }

  public async resolveCurrentEdition(database: Database, now: Date) {
    const period = resolveCurrentEventPeriod(now);
    const definition = await database.eventDefinition.findFirst({
      where: { calendarMonth: period.month, isActive: true },
    });
    if (!definition) throw new BusinessError('EVENT_CONFIGURATION_MISSING', 'Le Festival du mois courant n’est pas configuré.');
    const editionKey = { eventDefinitionId: definition.id, year: period.year };
    let edition = await database.eventEdition.findUnique({
      where: { eventDefinitionId_year: editionKey },
    });
    if (!edition) {
      const config = parseConfig(definition.config);
      try {
        edition = await database.eventEdition.upsert({
          where: { eventDefinitionId_year: editionKey },
          create: {
            ...editionKey,
            startsAt: period.startsAt,
            endsAt: period.endsAt,
            status: EventEditionStatus.ACTIVE,
            snapshot: definitionSnapshot(definition, config),
          },
          update: {},
        });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
        edition = await database.eventEdition.findUnique({ where: { eventDefinitionId_year: editionKey } });
        if (!edition) throw error;
      }
    }
    return { period, definition, edition, editionSnapshot: parseEditionSnapshot(edition.snapshot) };
  }

  private async snapshot(
    database: Database,
    playerId: string,
    context: Awaited<ReturnType<EventService['resolveCurrentEdition']>>,
    now: Date,
    materializeDaily: boolean,
  ) {
    const [participant, balance, global] = await Promise.all([
      database.eventParticipant.findUnique({
        where: { eventEditionId_playerId: { eventEditionId: context.edition.id, playerId } },
      }),
      database.playerEventCurrencyBalance.findUnique({
        where: { playerId_eventDefinitionId: { playerId, eventDefinitionId: context.definition.id } },
      }),
      database.eventGameBDailyState.findUnique({ where: { eventEditionId_businessDate: { eventEditionId: context.edition.id, businessDate: businessDateToDatabaseDate(context.period.businessDate) } } }),
    ]);
    const daily = participant && materializeDaily ? await this.ensureDailyState(database, context.edition.id, playerId, context.period.businessDate, now) : participant ? await database.eventDailyPlayerState.findUnique({ where: { eventEditionId_playerId_businessDate: { eventEditionId: context.edition.id, playerId, businessDate: businessDateToDatabaseDate(context.period.businessDate) } } }) : null;
    const gameA = this.gameAProjection(context.editionSnapshot.externalKey, context.period.businessDate, daily, now);
    if (!global) throw new Error('Event Game B daily state was not materialized.');
    const testedCodes = parseEventGameBTestedCodes(global.testedCodes);
    const discoverer = global.discovererPlayerId ? await database.player.findUnique({ where: { id: global.discovererPlayerId }, select: { id: true, displayName: true } }) : null;
    const gameBTheme = gameBThemes[context.editionSnapshot.externalKey as keyof typeof gameBThemes];
    if (!gameBTheme) throw new BusinessError('EVENT_CONFIGURATION_MISSING', 'La configuration du Jeu B est absente pour ce Festival.');
    const attemptsUsed = participant ? daily?.gameBAttemptsUsed ?? 0 : 0;
    const remainingCodes = EVENT_GAME_B_CODES.filter((code) => !testedCodes.includes(code));
    const refreshAfterMs = computeEventRefreshAfterMs({
      now,
      nextBusinessResetAt: getNextBusinessResetAt(now),
      completedToday: gameA.completedToday,
      windows: gameA.windows.map(({ startAt, endAt }) => ({ startAt: new Date(startAt), endAt: new Date(endAt) })),
      cooldownEndsAt: daily?.gameALastAttemptAt ? new Date(daily.gameALastAttemptAt.getTime() + EVENT_GAME_A_COOLDOWN_MS) : null,
    });
    return {
      businessDate: context.period.businessDate,
      refreshAfterMs,
      festival: {
        key: context.editionSnapshot.externalKey,
        month: context.editionSnapshot.calendarMonth,
        title: context.editionSnapshot.displayName,
        emoji: context.editionSnapshot.config.emoji,
        currency: { key: context.editionSnapshot.currencyKey, ...context.editionSnapshot.config.currency },
        collection: context.editionSnapshot.config.collection,
      },
      edition: {
        id: context.edition.id,
        year: context.edition.year,
        startsAt: context.edition.startsAt.toISOString(),
        endsAt: context.edition.endsAt.toISOString(),
      },
      participation: {
        joined: Boolean(participant),
        joinedAt: participant?.joinedAt.toISOString() ?? null,
        points: participant?.points ?? 0,
      },
      currency: { amount: (balance?.amount ?? 0n).toString() },
      canJoin: !participant && now >= context.edition.startsAt && now < context.edition.endsAt,
      gameA,
      gameB: {
        available: Boolean(participant), theme: { key: context.editionSnapshot.externalKey, label: gameBTheme },
        solvedToday: global.solvedAt !== null, resolvedCode: global.solvedAt ? global.solutionCode : null, discoveredBy: discoverer,
        attemptsUsed, attemptsRemaining: participant ? Math.max(0, EVENT_GAME_B_MAX_ATTEMPTS - attemptsUsed) : 0,
        testedCodes, remainingCodes,
        canAttempt: Boolean(participant) && !global.solvedAt && attemptsUsed < EVENT_GAME_B_MAX_ATTEMPTS && remainingCodes.length > 0,
      },
    };
  }

  private async ensureDailyState(database: Database, editionId: string, playerId: string, businessDate: string, now: Date) {
    const key = { eventEditionId: editionId, playerId, businessDate: businessDateToDatabaseDate(businessDate) };
    const existing = await database.eventDailyPlayerState.findUnique({ where: { eventEditionId_playerId_businessDate: key } });
    if (existing) return existing;
    return database.eventDailyPlayerState.create({ data: { ...key, state: generateEventGameAState(this.random) as Prisma.InputJsonValue, updatedAt: now } });
  }

  private async ensureGameBState(editionId: string, businessDate: string, now: Date) {
    const key = { eventEditionId: editionId, businessDate: businessDateToDatabaseDate(businessDate) };
    const existing = await this.database.eventGameBDailyState.findUnique({ where: { eventEditionId_businessDate: key } });
    if (existing) return existing;
    const solutionCode = generateEventGameBSolution(this.random);
    try {
      return await this.database.eventGameBDailyState.create({ data: { ...key, solutionCode, testedCodes: [], updatedAt: now } });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
      const winner = await this.database.eventGameBDailyState.findUnique({ where: { eventEditionId_businessDate: key } });
      if (winner) return winner;
      throw error;
    }
  }

  private gameAProjection(externalKey: string, businessDate: string, daily: Awaited<ReturnType<EventService['ensureDailyState']>> | null, now: Date) {
    const theme = gameAThemes[externalKey as keyof typeof gameAThemes];
    if (!theme) throw new BusinessError('EVENT_CONFIGURATION_MISSING', 'La configuration du Jeu A est absente pour ce Festival.');
    if (!daily) return { available: false, theme, completedToday: false, attemptsToday: 0, windows: [], activeWindowIndex: null, canAttempt: false, cooldownRemainingMs: 0 };
    const state = parseEventGameAState(daily.state);
    const localMinute = parisMinuteOfDay(now);
    const activeWindowIndex = activeEventGameAWindow(state.gameA.windows, localMinute);
    const cooldownRemainingMs = daily.gameALastAttemptAt ? Math.max(0, EVENT_GAME_A_COOLDOWN_MS - (now.getTime() - daily.gameALastAttemptAt.getTime())) : 0;
    return {
      available: true, theme, completedToday: daily.gameASuccess, attemptsToday: daily.gameAAttempts,
      windows: state.gameA.windows.map(({ startMinute, endMinute }) => ({ startAt: getBusinessMinuteAt(businessDate, startMinute).toISOString(), endAt: getBusinessMinuteAt(businessDate, endMinute).toISOString(), state: now < getBusinessMinuteAt(businessDate, startMinute) ? 'FUTURE' : now >= getBusinessMinuteAt(businessDate, endMinute) ? 'PAST' : 'ACTIVE' })),
      activeWindowIndex, canAttempt: !daily.gameASuccess && activeWindowIndex !== null && cooldownRemainingMs === 0, cooldownRemainingMs,
    };
  }
}

function definitionSnapshot(definition: Definition, config: FestivalConfig): Prisma.InputJsonValue {
  return {
    externalKey: definition.externalKey,
    displayName: definition.displayName,
    calendarMonth: definition.calendarMonth,
    currencyKey: definition.currencyKey,
    config,
  };
}

function parseEditionSnapshot(value: unknown): EditionSnapshot {
  const record = readRecord(value);
  if (
    typeof record?.externalKey !== 'string'
    || typeof record.displayName !== 'string'
    || typeof record.calendarMonth !== 'number'
    || !Number.isInteger(record.calendarMonth)
    || record.calendarMonth < 1
    || record.calendarMonth > 12
    || typeof record.currencyKey !== 'string'
  ) throw new Error('Invalid Event edition snapshot.');
  return {
    externalKey: record.externalKey,
    displayName: record.displayName,
    calendarMonth: record.calendarMonth,
    currencyKey: record.currencyKey,
    config: parseConfig(record.config),
  };
}

function parseConfig(value: unknown): FestivalConfig {
  const record = readRecord(value);
  const currency = readRecord(record?.currency);
  const collection = readRecord(record?.collection);
  if (
    typeof record?.emoji !== 'string'
    || typeof currency?.label !== 'string'
    || typeof currency.emoji !== 'string'
    || typeof collection?.key !== 'string'
    || typeof collection.label !== 'string'
  ) throw new Error('Invalid Event definition config.');
  return { emoji: record.emoji, currency: { label: currency.label, emoji: currency.emoji }, collection: { key: collection.key, label: collection.label } };
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function parseGameBResultKind(value: unknown): 'ALREADY_TESTED' | 'INCORRECT' | 'CORRECT' {
  if (value === 'ALREADY_TESTED' || value === 'INCORRECT' || value === 'CORRECT') return value;
  throw new Error('Invalid Event Game B operation result.');
}

const parisTimeFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
function parisMinuteOfDay(now: Date): number {
  const parts = Object.fromEntries(parisTimeFormatter.formatToParts(now).filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value]));
  return Number(parts.hour) * 60 + Number(parts.minute);
}
