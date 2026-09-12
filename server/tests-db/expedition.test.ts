import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ExpeditionService } from '../src/application/expedition/expedition-service.js';
import { NotificationService } from '../src/application/notification/notification-service.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { loadConfig } from '../src/config/environment.js';
import { resourceKeys } from '../src/domain/economy/resources.js';
import { createDatabase } from '../src/infrastructure/database/prisma-database.js';

const config = loadConfig(); if (!config.databaseUrl) throw new Error('DATABASE_URL is required for Expedition database tests.');
const database = createDatabase(config.databaseUrl); const playerIds = new Set<string>(); const characterIds = new Set<string>();
let now = new Date('2099-08-01T10:00:00.000Z'); let randomCalls = 0; let nextRoll = 0;
const clock = { now: () => now }; const random = { nextInt: () => { randomCalls += 1; return nextRoll; } };
const identity = { subject: 'expedition-fixture' } as const;

beforeAll(cleanup); afterAll(async () => { try { await cleanup(); } finally { await database.$disconnect(); } });

async function fixture() {
  const character = await database.character.findFirstOrThrow({ where: { isActive: true }, orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }] });
  const id = randomUUID(); playerIds.add(id);
  await database.player.create({ data: { id, displayName: `Expedition Fixture ${id.slice(0, 8)}`, elementKey: 'hydro', resourceBalances: { create: resourceKeys.map(resourceKey => ({ resourceKey, amount: 0n })) }, economyStats: { create: {} }, characters: { create: { characterId: character.id, constellation: 0, copies: 1, firstObtainedAt: now } } } });
  const current = new GetCurrentPlayer({ findByIdentity: async () => ({ id, displayName: 'Expedition Fixture', elementKey: 'hydro', status: 'ACTIVE' as const }), provision: async () => { throw new Error('not used'); } });
  return { id, character, current, service: new ExpeditionService(current, database, clock, random) };
}
async function fixtureWithDedicatedCharacter() {
  const id = randomUUID(); const characterId = randomUUID(); playerIds.add(id); characterIds.add(characterId);
  const fallback = await database.character.findFirstOrThrow({ where: { isActive: true }, orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }] });
  const character = await database.character.create({ data: { id: characterId, externalKey: `expedition-fixture-${characterId}`, name: `Expedition Character ${characterId.slice(0, 8)}`, rarity: 4, elementKey: 'hydro', isActive: true } });
  await database.player.create({ data: { id, displayName: `Expedition Fixture ${id.slice(0, 8)}`, elementKey: 'hydro', resourceBalances: { create: resourceKeys.map(resourceKey => ({ resourceKey, amount: 0n })) }, economyStats: { create: {} }, characters: { create: [{ characterId, constellation: 0, copies: 1, firstObtainedAt: now }, { characterId: fallback.id, constellation: 0, copies: 1, firstObtainedAt: now }] } } });
  const current = new GetCurrentPlayer({ findByIdentity: async () => ({ id, displayName: 'Expedition Fixture', elementKey: 'hydro', status: 'ACTIVE' as const }), provision: async () => { throw new Error('not used'); } });
  return { id, character, fallback, current, service: new ExpeditionService(current, database, clock, random) };
}
async function cleanup() { const ids = [...playerIds]; if (ids.length) { await database.notification.deleteMany({ where: { playerId: { in: ids } } }); await database.resourceMovement.deleteMany({ where: { playerId: { in: ids } } }); await database.businessOperation.deleteMany({ where: { playerId: { in: ids } } }); await database.player.deleteMany({ where: { id: { in: ids } } }); } const characters = [...characterIds]; if (characters.length) await database.character.deleteMany({ where: { id: { in: characters } } }); playerIds.clear(); characterIds.clear(); }

describe('Expedition persistence', () => {
  it('enables RLS and revokes browser roles on both private tables', async () => {
    const tables = ['notifications', 'player_expeditions'];
    const rls = await database.$queryRawUnsafe<{ relname: string; relrowsecurity: boolean }[]>(`SELECT relname, relrowsecurity FROM pg_class WHERE relname = ANY($1::text[]) ORDER BY relname`, tables);
    expect(rls).toHaveLength(2); expect(rls.every(row => row.relrowsecurity)).toBe(true);
    const grants = await database.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*)::bigint AS count FROM information_schema.role_table_grants WHERE table_name = ANY($1::text[]) AND grantee IN ('anon','authenticated')`, tables);
    expect(grants[0]?.count).toBe(0n);
  });

  it('starts for exactly 20h without RNG, becomes READY once, and claims once under retry', async () => {
    now = new Date('2099-08-01T10:00:00.000Z'); randomCalls = 0; nextRoll = 0;
    const { id, character, service } = await fixture(); const startKey = randomUUID();
    const started = await service.start(identity, character.id, startKey); const retriedStart = await service.start(identity, character.id, startKey);
    expect(started.operation.alreadyProcessed).toBe(false); expect(retriedStart.operation).toEqual({ id: started.operation.id, alreadyProcessed: true });
    expect(started.view.operationalStatus).toBe('RUNNING'); expect(Date.parse(started.view.readyAt!.toISOString()) - Date.parse(started.view.departedAt!.toISOString())).toBe(20 * 60 * 60 * 1_000); expect(randomCalls).toBe(0);
    await expect(service.claim(identity, randomUUID())).rejects.toMatchObject({ code: 'EXPEDITION_NOT_READY', message: 'Cette expédition n’est pas encore terminée.' });
    now = new Date('2099-08-02T06:00:01.000Z'); expect((await service.getState(identity)).operationalStatus).toBe('READY'); expect((await service.getState(identity)).operationalStatus).toBe('READY');
    expect(await database.notification.count({ where: { playerId: id, typeKey: 'ready' } })).toBe(1);
    const claimKey = randomUUID(); const [left, right] = await Promise.all([service.claim(identity, claimKey), service.claim(identity, claimKey)]);
    expect([left.operation.alreadyProcessed, right.operation.alreadyProcessed].sort()).toEqual([false, true]); expect(randomCalls).toBe(1);
    expect(left.reward).toMatchObject({ kind: 'primogems', amount: 1_600n }); expect(left.view.operationalStatus).toBe('IDLE'); expect(left.view.totalCompleted).toBe(1n);
    expect(await database.resourceMovement.count({ where: { playerId: id, causeKey: 'expedition.claim' } })).toBe(1);
    expect((await database.notification.findFirstOrThrow({ where: { playerId: id } })).state).toBe('RESOLVED');
    expect((await database.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId: id, resourceKey: 'primogems' } } })).amount).toBe(1_600n);
  }, 20_000);

  it('retains the daily departure date after claim and permits the next business day', async () => {
    now = new Date('2099-08-03T08:00:00.000Z'); randomCalls = 0; nextRoll = 9;
    const { character, service } = await fixture(); await service.start(identity, character.id, randomUUID()); now = new Date('2099-08-04T04:00:01.000Z'); await service.claim(identity, randomUUID());
    expect((await service.getState(identity)).canStartToday).toBe(true);
    await service.start(identity, character.id, randomUUID());
    await expect(service.start(identity, character.id, randomUUID())).rejects.toMatchObject({ code: 'EXPEDITION_ALREADY_ACTIVE' });
  });

  it('keeps a claimed same-day departure consumed', async () => {
    now = new Date('2099-08-05T08:00:00.000Z'); randomCalls = 0; nextRoll = 4;
    const { id, character, service } = await fixture(); await service.start(identity, character.id, randomUUID());
    await database.playerExpedition.update({ where: { playerId: id }, data: { readyAt: new Date(now.getTime() - 1) } });
    await service.claim(identity, randomUUID());
    await expect(service.start(identity, character.id, randomUUID())).rejects.toMatchObject({ code: 'EXPEDITION_DEPARTURE_ALREADY_USED' });
    expect(randomCalls).toBe(1);
  });

  it('deduplicates concurrent starts and rejects a reused key with another character', async () => {
    now = new Date('2099-08-05T12:00:00.000Z'); randomCalls = 0;
    const { character, fallback, service } = await fixtureWithDedicatedCharacter(); const key = randomUUID();
    const [left, right] = await Promise.all([service.start(identity, character.id, key), service.start(identity, character.id, key)]);
    expect([left.operation.alreadyProcessed, right.operation.alreadyProcessed].sort()).toEqual([false, true]);
    expect(left.view.readyAt).toEqual(right.view.readyAt); expect(randomCalls).toBe(0);
    await expect(service.start(identity, fallback.id, key)).rejects.toMatchObject({ code: 'EXPEDITION_IDEMPOTENCY_CONFLICT' });
  });

  it('cancels a disabled catalog character without reward, statistic, or consumed departure', async () => {
    now = new Date('2099-08-06T08:00:00.000Z'); randomCalls = 0;
    const { id, character, fallback, service } = await fixtureWithDedicatedCharacter();
    await service.start(identity, character.id, randomUUID()); now = new Date('2099-08-07T04:00:01.000Z'); await service.getState(identity);
    await database.character.update({ where: { id: character.id }, data: { isActive: false } });
    const cancelled = await service.getState(identity);
    expect(cancelled).toMatchObject({ operationalStatus: 'IDLE', canStartToday: true, departureUsedToday: false, totalCompleted: 0n });
    expect(randomCalls).toBe(0);
    expect(await database.resourceMovement.count({ where: { playerId: id, causeKey: 'expedition.claim' } })).toBe(0);
    expect((await database.notification.findFirstOrThrow({ where: { playerId: id } })).state).toBe('RESOLVED');
    expect((await service.start(identity, fallback.id, randomUUID())).view.operationalStatus).toBe('RUNNING');
  });

  it('serializes concurrent claims with different keys into one business mutation', async () => {
    now = new Date('2099-08-08T08:00:00.000Z'); randomCalls = 0; nextRoll = 1;
    const { id, character, service } = await fixture(); await service.start(identity, character.id, randomUUID());
    now = new Date('2099-08-09T04:00:01.000Z'); const results = await Promise.allSettled([service.claim(identity, randomUUID()), service.claim(identity, randomUUID())]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1); expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
    expect(randomCalls).toBe(1); expect(await database.resourceMovement.count({ where: { playerId: id, causeKey: 'expedition.claim' } })).toBe(1);
    expect((await database.playerExpedition.findUniqueOrThrow({ where: { playerId: id } })).totalCompleted).toBe(1n);
  }, 20_000);

  it('supports the real unread, read, read-all, and archive lifecycle', async () => {
    now = new Date('2099-08-10T08:00:00.000Z'); const { id, character, current, service } = await fixture(); const notifications = new NotificationService(current, database, clock, service);
    expect(await notifications.list(identity)).toMatchObject({ unreadCount: 0, notifications: [] });
    await service.start(identity, character.id, randomUUID()); now = new Date('2099-08-11T04:00:01.000Z');
    const ready = await notifications.list(identity); expect(ready.unreadCount).toBe(1); expect(ready.notifications).toHaveLength(1);
    const notificationId = ready.notifications[0]!.id; expect((await notifications.readOne(identity, notificationId)).unreadCount).toBe(0);
    await database.notification.update({ where: { id: notificationId }, data: { state: 'UNREAD', readAt: null } });
    expect((await notifications.readAll(identity)).unreadCount).toBe(0);
    expect((await notifications.archiveRead(identity)).notifications).toHaveLength(0);
    expect((await database.notification.findUniqueOrThrow({ where: { id: notificationId } })).state).toBe('ARCHIVED');
    expect(await database.notification.count({ where: { playerId: id } })).toBe(1);
  });
});
