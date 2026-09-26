import 'dotenv/config';

import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, afterEach, describe, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';

import { EventService } from '../src/application/event/event-service.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { GetOrProvisionCurrentPlayer } from '../src/application/player/get-or-provision-current-player.js';
import { loadConfig } from '../src/config/environment.js';
import { PrismaCurrentPlayerStore } from '../src/infrastructure/database/prisma-current-player-store.js';

const config = loadConfig();
if (!config.databaseUrl) throw new Error('DATABASE_URL is required for Event integration tests.');
const isolated = isolatedBatchDatabase();
const database = isolated.database;
beforeAll(() => isolated.setup({ seedPublicCatalog: true }), 60_000);
afterAll(() => isolated.cleanup(), 60_000);
const store = new PrismaCurrentPlayerStore(database);
const provision = new GetOrProvisionCurrentPlayer(store);
const getPlayer = new GetCurrentPlayer(store);
let now = new Date('2026-09-15T12:00:00.000Z');
const clock = { now: () => now };
const random = { nextInt: () => 0 };
const subjects: string[] = [];
const futureEditionIds: string[] = [];

async function createFixture() {
  const subject = `codex-event-${randomUUID()}`;
  subjects.push(subject);
  const identity = { subject };
  const created = await provision.execute(identity, `Codex Event ${randomUUID().slice(0, 8)}`);
  return { identity, playerId: created.player.id };
}

async function cleanupSubject(subject: string) {
  const identity = await database.webIdentity.findUnique({ where: { provider_providerSubject: { provider: 'supabase', providerSubject: subject } }, select: { playerId: true } });
  if (!identity) return;
  await database.eventDailyPlayerState.deleteMany({ where: { playerId: identity.playerId } });
  await database.eventParticipant.deleteMany({ where: { playerId: identity.playerId } });
  await database.playerEventCurrencyBalance.deleteMany({ where: { playerId: identity.playerId } });
  await database.businessOperation.deleteMany({ where: { playerId: identity.playerId, operationType: { in: ['event.join', 'event.game-a.attempt'] } } });
  await database.webIdentity.deleteMany({ where: { playerId: identity.playerId, providerSubject: subject } });
  await database.player.delete({ where: { id: identity.playerId } });
}

afterEach(async () => {
  for (const subject of subjects.splice(0)) await cleanupSubject(subject);
  if (futureEditionIds.length) await database.eventEdition.deleteMany({ where: { id: { in: futureEditionIds.splice(0) }, participants: { none: {} } } });
  now = new Date('2026-09-15T12:00:00.000Z');
});
afterAll(async () => database.$disconnect());

describe('EventService on Supabase DEV', () => {
  it('contains exactly the twelve fixed Festival definitions with no seeded player state', async () => {
    const definitions = await database.eventDefinition.findMany({ orderBy: { calendarMonth: 'asc' } });
    expect(definitions).toHaveLength(12);
    const config = (value: unknown) => value as { currency: { label: string; emoji: string }; collection: { label: string } };
    expect(definitions.map(({ calendarMonth, displayName, config: raw }) => [calendarMonth, displayName, config(raw).currency.label, config(raw).currency.emoji, config(raw).collection.label])).toEqual([
      [1, 'Festival du Nouvel An', 'Éclats de Fortune', '🎆', 'Lanterne du Nouvel An'], [2, 'Festival des Cœurs', 'Cœurs Étincelants', '💖', 'Cœur Cristallin'],
      [3, 'Festival du Printemps', 'Bourgeons Mystiques', '🌱', 'Bourgeon Éternel'], [4, 'Festival des Cloches', 'Œufs Enchantés', '🥚', 'Œuf Enchanté'],
      [5, 'Festival des Fleurs', 'Pétales Magiques', '🌸', 'Fleur de Printemps'], [6, 'Festival de l’Été', 'Coquillages Dorés', '🏝️', 'Coquillage Doré'],
      [7, 'Festival des Étoiles', 'Étoiles Tombées', '⭐', 'Étoile Filante'], [8, 'Festival des Aventuriers', 'Reliques d’Exploration', '🧭', 'Boussole Antique'],
      [9, 'Festival des Récoltes', 'Jetons de Récolte', '🌾', 'Gerbe de Récolte'], [10, 'Festival des Ombres', 'Bonbons Maudits', '🎃', 'Citrouille Hantée'],
      [11, 'Festival des Brumes', 'Feuilles Anciennes', '🍁', 'Feuille Ancienne'], [12, 'Festival de Noël', 'Étoiles de Noël', '🎄', 'Flocon Enchanté'],
    ]);
    expect(new Set(definitions.map(({ calendarMonth }) => calendarMonth))).toEqual(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]));
    expect(definitions.every(({ config }) => typeof config === 'object' && config !== null)).toBe(true);
  });

  it('materializes September idempotently and joins exactly once under concurrent keys', async () => {
    const fixture = await createFixture();
    const service = new EventService(getPlayer, database, clock, random);
    const [before, sameBefore] = await Promise.all([service.getCurrent(fixture.identity), service.getCurrent(fixture.identity)]);
    expect(before).toMatchObject({ businessDate: '2026-09-15', festival: { key: 'harvest', title: 'Festival des Récoltes', currency: { label: 'Jetons de Récolte', emoji: '🌾' }, collection: { label: 'Gerbe de Récolte' } }, participation: { joined: false, points: 0 }, currency: { amount: '0' }, canJoin: true });
    expect(sameBefore.edition.id).toBe(before.edition.id);

    const leftKey = randomUUID(); const rightKey = randomUUID();
    const [left, right] = await Promise.all([service.join(fixture.identity, leftKey), service.join(fixture.identity, rightKey)]);
    expect(left.currency.amount).toBe('1'); expect(right.currency.amount).toBe('1');
    expect(await database.eventParticipant.count({ where: { playerId: fixture.playerId, eventEditionId: before.edition.id } })).toBe(1);
    expect((await database.playerEventCurrencyBalance.findUniqueOrThrow({ where: { playerId_eventDefinitionId: { playerId: fixture.playerId, eventDefinitionId: '00000000-0000-4000-8000-000000000009' } } })).amount).toBe(1n);
    const replay = await service.join(fixture.identity, leftKey);
    expect(replay.operation).toEqual({ id: left.operation.id, alreadyProcessed: true });
    expect(replay.currency.amount).toBe('1');
  }, 20_000);

  it('carries one Festival balance across years while keeping other Festivals isolated', async () => {
    const fixture = await createFixture();
    await database.playerEventCurrencyBalance.createMany({ data: [
      { playerId: fixture.playerId, eventDefinitionId: '00000000-0000-4000-8000-000000000009', amount: 7n },
      { playerId: fixture.playerId, eventDefinitionId: '00000000-0000-4000-8000-000000000010', amount: 3n },
    ] });
    const service = new EventService(getPlayer, database, clock, random);
    expect((await service.join(fixture.identity, randomUUID())).currency.amount).toBe('8');
    now = new Date('2027-09-15T12:00:00.000Z');
    const before2027 = await service.getCurrent(fixture.identity);
    futureEditionIds.push(before2027.edition.id);
    expect(before2027).toMatchObject({ edition: { year: 2027 }, participation: { joined: false, points: 0 }, currency: { amount: '8' } });
    expect((await service.join(fixture.identity, randomUUID())).currency.amount).toBe('9');
    expect(await database.eventDailyPlayerState.count({ where: { playerId: fixture.playerId } })).toBe(2);
    const shadow = await database.playerEventCurrencyBalance.findUniqueOrThrow({ where: { playerId_eventDefinitionId: { playerId: fixture.playerId, eventDefinitionId: '00000000-0000-4000-8000-000000000010' } } });
    expect(shadow.amount).toBe(3n);
  }, 20_000);

  it('keeps snapshots isolated between authenticated Players and enforces nonnegative checks', async () => {
    const first = await createFixture(); const second = await createFixture();
    const service = new EventService(getPlayer, database, clock, random);
    const joined = await service.join(first.identity, randomUUID());
    expect((await service.getCurrent(second.identity))).toMatchObject({ participation: { joined: false }, currency: { amount: '0' } });
    await expect(database.eventParticipant.create({ data: { eventEditionId: joined.edition.id, playerId: second.playerId, points: -1 } })).rejects.toBeDefined();
    await expect(database.playerEventCurrencyBalance.create({ data: { playerId: second.playerId, eventDefinitionId: '00000000-0000-4000-8000-000000000010', amount: -1n } })).rejects.toBeDefined();
  });

  it('rejects non-participants and out-of-window attempts without consuming an attempt roll', async () => {
    const fixture = await createFixture(); let randomCalls = 0;
    const service = new EventService(getPlayer, database, clock, { nextInt: () => { randomCalls += 1; return 0 } });
    await expect(service.attemptGameA(fixture.identity, randomUUID())).rejects.toMatchObject({ code: 'EVENT_NOT_JOINED' });
    expect(randomCalls).toBe(0);
    await service.join(fixture.identity, randomUUID());
    expect(randomCalls).toBe(3);
    await expect(service.attemptGameA(fixture.identity, randomUUID())).rejects.toMatchObject({ code: 'EVENT_GAME_A_OUTSIDE_WINDOW' });
    expect(randomCalls).toBe(3);
    expect((await database.eventDailyPlayerState.findFirstOrThrow({ where: { playerId: fixture.playerId } })).gameAAttempts).toBe(0);
  });

  it('materializes one stable daily state and creates a distinct row on the next business day', async () => {
    const fixture = await createFixture();
    const rolls = [1, 2, 3, 4, 5, 6];
    const service = new EventService(getPlayer, database, clock, { nextInt: () => rolls.shift() ?? 0 });
    await service.join(fixture.identity, randomUUID());
    await database.eventDailyPlayerState.deleteMany({ where: { playerId: fixture.playerId } });
    const [first, repeated] = await Promise.all([service.getCurrent(fixture.identity), service.getCurrent(fixture.identity)]);
    expect(repeated.gameA.windows).toEqual(first.gameA.windows);
    expect(await database.eventDailyPlayerState.count({ where: { playerId: fixture.playerId } })).toBe(1);
    now = new Date('2026-09-16T12:00:00.000Z');
    const nextDay = await service.getCurrent(fixture.identity);
    expect(nextDay.businessDate).toBe('2026-09-16');
    expect(nextDay.gameA).toMatchObject({ completedToday: false, attemptsToday: 0 });
    expect(nextDay.gameA.windows).not.toEqual(first.gameA.windows);
    expect(await database.eventDailyPlayerState.count({ where: { playerId: fixture.playerId } })).toBe(2);
  });

  it('enforces cooldown, replay and one RNG result per valid attempt', async () => {
    now = new Date('2026-09-15T10:00:00.000Z');
    const fixture = await createFixture(); const rolls = [0, 0, 0, 99, 99];
    const nextInt = () => rolls.shift() ?? 99;
    const service = new EventService(getPlayer, database, clock, { nextInt });
    await service.join(fixture.identity, randomUUID());
    const key = randomUUID(); const failed = await service.attemptGameA(fixture.identity, key);
    expect(failed).toMatchObject({ attempt: { succeeded: false }, gameA: { attemptsToday: 1, cooldownRemainingMs: 3000 } });
    now = new Date('2026-09-15T10:00:02.999Z');
    await expect(service.attemptGameA(fixture.identity, randomUUID())).rejects.toMatchObject({ code: 'EVENT_GAME_A_COOLDOWN' });
    const replay = await service.attemptGameA(fixture.identity, key);
    expect(replay).toMatchObject({ operation: { id: failed.operation.id, alreadyProcessed: true }, attempt: { succeeded: false }, gameA: { attemptsToday: 1 } });
    now = new Date('2026-09-15T10:00:03.000Z');
    expect((await service.attemptGameA(fixture.identity, randomUUID())).gameA.attemptsToday).toBe(2);
    expect(rolls).toHaveLength(0);
  });

  it('rewards the first success atomically and rejects concurrent follow-up intentions', async () => {
    now = new Date('2026-09-15T10:00:00.000Z');
    const fixture = await createFixture(); const service = new EventService(getPlayer, database, clock, { nextInt: () => 0 });
    const joined = await service.join(fixture.identity, randomUUID());
    const results = await Promise.allSettled([service.attemptGameA(fixture.identity, randomUUID()), service.attemptGameA(fixture.identity, randomUUID())]);
    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(1);
    const view = await service.getCurrent(fixture.identity);
    expect(view).toMatchObject({ participation: { points: 1 }, currency: { amount: '2' }, gameA: { completedToday: true, attemptsToday: 1, canAttempt: false } });
    expect(await database.eventDailyPlayerState.count({ where: { playerId: fixture.playerId, eventEditionId: joined.edition.id } })).toBe(1);
  }, 20_000);
});
