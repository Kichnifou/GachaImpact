import { EventEditionStatus, OperationStatus, Prisma, SourceChannel, type PrismaClient } from '../../../generated/prisma/client.js';
import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import { getBusinessDate, getBusinessDayStartAt, type Clock } from '../../domain/time/business-date.js';
import { isPrismaConcurrencyCollision } from '../../infrastructure/database/prisma-concurrency.js';
import { BusinessError } from '../errors.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';

type Database = PrismaClient | Prisma.TransactionClient;

type FestivalConfig = Readonly<{
  emoji: string;
  currency: Readonly<{ label: string; emoji: string }>;
  collection: Readonly<{ key: string; label: string }>;
}>;

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
  ) {}

  public async getCurrent(identity: AuthenticatedIdentity) {
    const player = await this.getPlayer.execute(identity);
    const now = this.clock.now();
    const context = await this.resolveCurrentEdition(this.database, now);
    return this.snapshot(this.database, player.id, context, now);
  }

  public async join(identity: AuthenticatedIdentity, idempotencyKey: string) {
    const player = await this.getPlayer.execute(identity);
    const now = this.clock.now();
    const context = await this.resolveCurrentEdition(this.database, now);
    let operationId = '';
    let alreadyProcessed = false;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const result = await this.database.$transaction(async (tx) => {
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
            return { operationId: existingOperation.id, alreadyProcessed: true };
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
            await tx.eventParticipant.create({
              data: { eventEditionId: context.edition.id, playerId: player.id, points: 0, joinedAt: now },
            });
            await tx.playerEventCurrencyBalance.upsert({
              where: { playerId_eventDefinitionId: { playerId: player.id, eventDefinitionId: context.definition.id } },
              create: { playerId: player.id, eventDefinitionId: context.definition.id, amount: 1n, updatedAt: now },
              update: { amount: { increment: 1n }, updatedAt: now },
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
          return { operationId: operation.id, alreadyProcessed: false };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

        operationId = result.operationId;
        alreadyProcessed = result.alreadyProcessed;
        break;
      } catch (error) {
        if (attempt < 2 && isPrismaConcurrencyCollision(error)) continue;
        throw error;
      }
    }

    return {
      ...await this.snapshot(this.database, player.id, context, now),
      operation: { id: operationId, alreadyProcessed },
    };
  }

  public async resolveCurrentEdition(database: Database, now: Date) {
    const period = resolveCurrentEventPeriod(now);
    const definition = await database.eventDefinition.findFirst({
      where: { calendarMonth: period.month, isActive: true },
    });
    if (!definition) throw new BusinessError('EVENT_CONFIGURATION_MISSING', 'Le Festival du mois courant n’est pas configuré.');
    const config = parseConfig(definition.config);
    const edition = await database.eventEdition.upsert({
      where: { eventDefinitionId_year: { eventDefinitionId: definition.id, year: period.year } },
      create: {
        eventDefinitionId: definition.id,
        year: period.year,
        startsAt: period.startsAt,
        endsAt: period.endsAt,
        status: EventEditionStatus.ACTIVE,
        snapshot: definitionSnapshot(definition, config),
      },
      update: {},
    });
    return { period, definition, config, edition };
  }

  private async snapshot(
    database: Database,
    playerId: string,
    context: Awaited<ReturnType<EventService['resolveCurrentEdition']>>,
    now: Date,
  ) {
    const [participant, balance] = await Promise.all([
      database.eventParticipant.findUnique({
        where: { eventEditionId_playerId: { eventEditionId: context.edition.id, playerId } },
      }),
      database.playerEventCurrencyBalance.findUnique({
        where: { playerId_eventDefinitionId: { playerId, eventDefinitionId: context.definition.id } },
      }),
    ]);
    return {
      businessDate: context.period.businessDate,
      festival: {
        key: context.definition.externalKey,
        month: context.definition.calendarMonth,
        title: context.definition.displayName,
        emoji: context.config.emoji,
        currency: { key: context.definition.currencyKey, ...context.config.currency },
        collection: context.config.collection,
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
