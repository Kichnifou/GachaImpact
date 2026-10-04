import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SourceChannel } from '../generated/prisma/client.js';
import { EventService } from '../src/application/event/event-service.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { GetOrProvisionCurrentPlayer } from '../src/application/player/get-or-provision-current-player.js';
import { PrismaCurrentPlayerStore } from '../src/infrastructure/database/prisma-current-player-store.js';
import { isolatedBatchDatabase } from './isolated-batch-database.js';

const isolated = isolatedBatchDatabase();
const database = isolated.database;
beforeAll(() => isolated.setup({ seedPublicCatalog: true }), 60_000);
afterAll(() => isolated.cleanup(), 60_000);
const store = new PrismaCurrentPlayerStore(database);
const getPlayer = new GetCurrentPlayer(store);
const provision = new GetOrProvisionCurrentPlayer(store);

describe('Chat Event committed results across calendar changes in a private schema', () => {
  it.each(['A', 'B', 'C', 'calendar'] as const)('keeps the %s result without new rewards, RNG or daily state after the month changes', async kind => {
    const year = 2800 + ['A', 'B', 'C', 'calendar'].indexOf(kind);
    let now = new Date(`${year}-${kind === 'calendar' ? '12' : '09'}-01T10:00:00.000Z`);
    let randomCalls = 0;
    const service = new EventService(getPlayer, database, { now: () => now }, { nextInt: () => { randomCalls += 1; return 0; } });
    const identity = { subject: `chat-event-replay-${randomUUID()}` };
    const created = await provision.execute(identity, `Replay ${kind} ${randomUUID().slice(0, 8)}`);
    await service.join(identity, randomUUID(), SourceChannel.INTERNAL_CHAT);
    const recipient = await provision.execute({ subject: `chat-event-recipient-${randomUUID()}` }, `Destinataire ${randomUUID().slice(0, 8)}`);
    const key = randomUUID();
    const invoke = () => kind === 'A' ? service.attemptGameA(identity, key, SourceChannel.INTERNAL_CHAT)
      : kind === 'B' ? service.attemptGameB(identity, '00000', key, SourceChannel.INTERNAL_CHAT)
        : kind === 'C' ? service.sendGameC(identity, recipient.player.id, 'Texte privé exact', key, SourceChannel.INTERNAL_CHAT)
          : service.claimCalendar(identity, key, SourceChannel.INTERNAL_CHAT);
    const first = await invoke();
    if (kind === 'A') expect(first).toMatchObject({ attempt: { succeeded: true, reward: { points: 1, currency: 1 } } });
    if (kind === 'B') expect(first).toMatchObject({ attempt: { kind: 'CORRECT', reward: { points: 1, currency: 1 } } });
    if (kind === 'C') expect(first).toMatchObject({ reward: { points: 1, currency: 1 } });
    if (kind === 'calendar') expect(first).toMatchObject({ calendarClaim: { day: 1, reward: 1 } });
    const snapshot = async () => ({
      balances: await database.playerEventCurrencyBalance.findMany({ where: { playerId: created.player.id }, orderBy: { eventDefinitionId: 'asc' } }),
      participants: await database.eventParticipant.findMany({ where: { playerId: created.player.id }, orderBy: { eventEditionId: 'asc' } }),
      dailyRows: await database.eventDailyPlayerState.count({ where: { playerId: created.player.id } }),
      operations: await database.businessOperation.count({ where: { playerId: created.player.id } }),
      messages: await database.eventSocialMessage.count({ where: { senderPlayerId: created.player.id } }),
      claims: await database.eventCalendarClaim.count({ where: { playerId: created.player.id } }),
      randomCalls,
    });
    const state = await snapshot();
    now = new Date(kind === 'calendar' ? `${year + 1}-01-01T12:00:00.000Z` : `${year}-10-01T12:00:00.000Z`);
    const replay = await invoke();
    expect(replay).toEqual({ ...first, operation: { id: first.operation.id, alreadyProcessed: true } });
    expect(await snapshot()).toEqual(state);
    const operation = await database.businessOperation.findUniqueOrThrow({ where: { id: first.operation.id } });
    expect(operation.sourceChannel).toBe(SourceChannel.INTERNAL_CHAT);
    if (kind === 'B') await expect(service.attemptGameB(identity, '00001', key, SourceChannel.INTERNAL_CHAT)).rejects.toMatchObject({ code: 'EVENT_IDEMPOTENCY_CONFLICT' });
    if (kind === 'C') await expect(service.sendGameC(identity, recipient.player.id, 'Autre texte', key, SourceChannel.INTERNAL_CHAT)).rejects.toMatchObject({ code: 'EVENT_IDEMPOTENCY_CONFLICT' });
    await expect(service.join(identity, key, SourceChannel.INTERNAL_CHAT)).rejects.toMatchObject({ code: 'EVENT_IDEMPOTENCY_CONFLICT' });
  });
});
