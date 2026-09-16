import 'dotenv/config';

import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, describe, expect, it } from 'vitest';

import { EventService } from '../src/application/event/event-service.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { GetOrProvisionCurrentPlayer } from '../src/application/player/get-or-provision-current-player.js';
import { loadConfig } from '../src/config/environment.js';
import { PrismaCurrentPlayerStore } from '../src/infrastructure/database/prisma-current-player-store.js';
import { createDatabase } from '../src/infrastructure/database/prisma-database.js';

const config = loadConfig();
if (!config.databaseUrl) throw new Error('DATABASE_URL is required for Event Game B DB tests.');
const database = createDatabase(config.databaseUrl);
const store = new PrismaCurrentPlayerStore(database);
const provision = new GetOrProvisionCurrentPlayer(store);
const getPlayer = new GetCurrentPlayer(store);
const subjects: string[] = [];
const editionIds: string[] = [];
let year = 2180;
let now = new Date(`${year}-09-15T12:00:00.000Z`);
const clock = { now: () => now };
const random = { nextInt: () => 31 };
const service = new EventService(getPlayer, database, clock, random);

async function fixture() {
  const subject = `codex-game-b-${randomUUID()}`;
  const identity = { subject };
  const created = await provision.execute(identity, `Game B ${randomUUID().slice(0, 8)}`);
  subjects.push(subject);
  return { identity, playerId: created.player.id };
}

async function view(subject: Awaited<ReturnType<typeof fixture>>) {
  const result = await service.getCurrent(subject.identity);
  if (!editionIds.includes(result.edition.id)) editionIds.push(result.edition.id);
  return result;
}

async function join(subject: Awaited<ReturnType<typeof fixture>>, key = randomUUID()) {
  await view(subject);
  return service.join(subject.identity, key);
}

async function balance(playerId: string) {
  const value = await database.playerEventCurrencyBalance.findUniqueOrThrow({ where: { playerId_eventDefinitionId: { playerId, eventDefinitionId: '00000000-0000-4000-8000-000000000009' } } });
  return value.amount;
}

afterEach(async () => {
  if (editionIds.length) {
    const ids = editionIds.splice(0);
    await database.eventGameBDailyState.deleteMany({ where: { eventEditionId: { in: ids } } });
    await database.eventDailyPlayerState.deleteMany({ where: { eventEditionId: { in: ids } } });
    await database.eventParticipant.deleteMany({ where: { eventEditionId: { in: ids } } });
    await database.eventEdition.deleteMany({ where: { id: { in: ids }, participants: { none: {} } } });
  }
  for (const subject of subjects.splice(0)) {
    const identity = await database.webIdentity.findUnique({ where: { provider_providerSubject: { provider: 'supabase', providerSubject: subject } }, select: { playerId: true } });
    if (!identity) continue;
    await database.playerEventCurrencyBalance.deleteMany({ where: { playerId: identity.playerId } });
    await database.businessOperation.deleteMany({ where: { playerId: identity.playerId, operationType: { in: ['event.join', 'event.game-b.attempt'] } } });
    await database.webIdentity.deleteMany({ where: { playerId: identity.playerId, providerSubject: subject } });
    await database.player.delete({ where: { id: identity.playerId } });
  }
  year += 1;
  now = new Date(`${year}-09-15T12:00:00.000Z`);
});
afterAll(async () => database.$disconnect());

describe('Event Game B on isolated future editions', () => {
  it('materializes one global solution under concurrent GETs and resets on a new Paris day', async () => {
    const player = await fixture();
    const [first, second] = await Promise.all([view(player), view(player)]);
    expect(first.edition.id).toBe(second.edition.id);
    expect(first.gameB.remainingCodes).toHaveLength(32);
    expect(JSON.stringify(first)).not.toContain('solutionCode');
    expect(await database.eventGameBDailyState.count({ where: { eventEditionId: first.edition.id } })).toBe(1);
    const global = await database.eventGameBDailyState.findFirstOrThrow({ where: { eventEditionId: first.edition.id } });
    expect(global.solutionCode).toBe('11111');
    now = new Date(`${year}-09-16T12:00:00.000Z`);
    const nextDay = await view(player);
    expect(nextDay.businessDate).toBe(`${year}-09-16`);
    expect(await database.eventGameBDailyState.count({ where: { eventEditionId: first.edition.id } })).toBe(2);
  }, 30_000);

  it('charges only new global codes, consumes three personal attempts, and replays idempotently', async () => {
    const first = await fixture(); const second = await fixture();
    await join(first); await join(second);
    const key = randomUUID();
    const initial = await service.attemptGameB(first.identity, '00000', key);
    expect(initial).toMatchObject({ attempt: { kind: 'INCORRECT' }, gameB: { attemptsUsed: 1, attemptsRemaining: 2 } });
    expect((await service.attemptGameB(second.identity, '00000', randomUUID()))).toMatchObject({ attempt: { kind: 'ALREADY_TESTED' }, gameB: { attemptsUsed: 0 } });
    expect((await service.attemptGameB(first.identity, '00000', key))).toMatchObject({ operation: { id: initial.operation.id, alreadyProcessed: true }, gameB: { attemptsUsed: 1 } });
    await expect(service.attemptGameB(first.identity, '00001', key)).rejects.toMatchObject({ code: 'EVENT_GAME_B_IDEMPOTENCY_CONFLICT' });
    await service.attemptGameB(first.identity, '00001', randomUUID());
    await service.attemptGameB(first.identity, '00010', randomUUID());
    await expect(service.attemptGameB(first.identity, '00011', randomUUID())).rejects.toMatchObject({ code: 'EVENT_GAME_B_NO_ATTEMPTS' });
    const current = await view(first);
    expect(current.gameB).toMatchObject({ attemptsUsed: 3, attemptsRemaining: 0, canAttempt: false, testedCodes: ['00000', '00001', '00010'] });
    expect(current.gameB.remainingCodes).toHaveLength(29);
    expect(JSON.stringify(current)).not.toContain('solutionCode');
  }, 30_000);

  it('serializes equal and different concurrent wrong guesses across Players', async () => {
    const first = await fixture(); const second = await fixture();
    await join(first); await join(second);
    const same = await Promise.all([service.attemptGameB(first.identity, '00000', randomUUID()), service.attemptGameB(second.identity, '00000', randomUUID())]);
    expect(same.map(({ attempt }) => attempt.kind).sort()).toEqual(['ALREADY_TESTED', 'INCORRECT']);
    expect(same.reduce((sum, entry) => sum + entry.gameB.attemptsUsed, 0)).toBe(1);
    const different = await Promise.all([service.attemptGameB(first.identity, '00001', randomUUID()), service.attemptGameB(second.identity, '00010', randomUUID())]);
    expect(different.every(({ attempt }) => attempt.kind === 'INCORRECT')).toBe(true);
    const current = await view(first);
    expect(current.gameB.testedCodes).toHaveLength(3);
    expect(current.gameB.testedCodes).toEqual(expect.arrayContaining(['00000', '00001', '00010']));
  }, 30_000);

  it('resolves once, credits every enrolled Player equally, then catches up a late join exactly once', async () => {
    const first = await fixture(); const second = await fixture(); const late = await fixture();
    await join(first); await join(second);
    const resolved = await service.attemptGameB(first.identity, '11111', randomUUID());
    expect(resolved).toMatchObject({ attempt: { kind: 'CORRECT' }, gameB: { solvedToday: true, discoveredBy: { id: first.playerId }, canAttempt: false } });
    expect((await view(first)).participation.points).toBe(1);
    expect((await view(second)).participation.points).toBe(1);
    expect(await balance(first.playerId)).toBe(2n);
    expect(await balance(second.playerId)).toBe(2n);
    const key = randomUUID();
    const joinedLate = await join(late, key);
    expect(joinedLate).toMatchObject({ participation: { points: 1 }, currency: { amount: '2' } });
    expect((await service.join(late.identity, key)).operation.alreadyProcessed).toBe(true);
    expect(await balance(late.playerId)).toBe(2n);
    await expect(service.attemptGameB(second.identity, '00001', randomUUID())).rejects.toMatchObject({ code: 'EVENT_GAME_B_ALREADY_SOLVED' });
  }, 30_000);

  it('allows only one correct concurrent resolution and one collective distribution', async () => {
    const first = await fixture(); const second = await fixture();
    await join(first); await join(second);
    const outcomes = await Promise.allSettled([service.attemptGameB(first.identity, '11111', randomUUID()), service.attemptGameB(second.identity, '11111', randomUUID())]);
    expect(outcomes.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter(({ status }) => status === 'rejected')).toHaveLength(1);
    expect((await view(first)).participation.points).toBe(1);
    expect((await view(second)).participation.points).toBe(1);
    expect(await balance(first.playerId)).toBe(2n);
    expect(await balance(second.playerId)).toBe(2n);
  }, 30_000);

  it('credits a join racing with resolution exactly once regardless of lock winner', async () => {
    const discoverer = await fixture(); const racing = await fixture();
    await join(discoverer);
    const outcomes = await Promise.all([service.attemptGameB(discoverer.identity, '11111', randomUUID()), join(racing)]);
    expect(outcomes[0].attempt.kind).toBe('CORRECT');
    expect((await view(racing)).participation.points).toBe(1);
    expect(await balance(racing.playerId)).toBe(2n);
  }, 30_000);

  it('keeps a new edition independent from the previous year', async () => {
    const player = await fixture();
    const first = await join(player);
    await service.attemptGameB(player.identity, '00000', randomUUID());
    now = new Date(`${year + 1}-09-15T12:00:00.000Z`);
    const next = await view(player);
    expect(next.edition.id).not.toBe(first.edition.id);
    expect(next.gameB).toMatchObject({ solvedToday: false, testedCodes: [], attemptsUsed: 0, available: false });
    expect(next.gameB.remainingCodes).toHaveLength(32);
  }, 30_000);
});
