import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { ExpeditionService } from '../src/application/expedition/expedition-service.js';
import { NotificationService } from '../src/application/notification/notification-service.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { loadConfig } from '../src/config/environment.js';
import { resourceKeys } from '../src/domain/economy/resources.js';
import { PermanentMissionService } from '../src/application/missions/permanent-mission-service.js';
import { SourceChannel } from '../generated/prisma/client.js';
import { PrismaEconomyService } from '../src/infrastructure/database/prisma-economy-service.js';

const config = loadConfig(); if (!config.databaseUrl) throw new Error('DATABASE_URL is required for Expedition database tests.');
const isolated = isolatedBatchDatabase();
const database = isolated.database;
beforeAll(() => isolated.setup({ seedPublicCatalog: true }), 60_000);
afterAll(() => isolated.cleanup(), 60_000); const playerIds = new Set<string>(); const characterIds = new Set<string>();
let now = new Date('2099-08-01T10:00:00.000Z'); let randomCalls = 0; let nextRoll = 0;
const clock = { now: () => now }; const random = { nextInt: () => { randomCalls += 1; return nextRoll; } };
const identity = { subject: 'expedition-fixture' } as const;

beforeAll(cleanup); afterAll(async () => { try { await cleanup(); } finally { await database.$disconnect(); } });

async function fixture() {
  const character = await database.character.findFirstOrThrow({ where: { isActive: true }, orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }] });
  const id = randomUUID(); playerIds.add(id);
  await database.player.create({ data: { id, displayName: `Expedition Fixture ${id.slice(0, 8)}`, elementKey: 'hydro', resourceBalances: { create: resourceKeys.map(resourceKey => ({ resourceKey, amount: 0n })) }, economyStats: { create: {} }, characters: { create: { characterId: character.id, constellation: 0, copies: 1, firstObtainedAt: now } } } });
  await database.$transaction(tx => new PermanentMissionService().initializePlayer(tx, id, now, true));
  const current = new GetCurrentPlayer({ findByIdentity: async () => ({ id, displayName: 'Expedition Fixture', elementKey: 'hydro', status: 'ACTIVE' as const }), provision: async () => { throw new Error('not used'); } });
  const economy = new PrismaEconomyService(); const missions = new PermanentMissionService(economy);
  return { id, character, current, missions, service: new ExpeditionService(current, database, clock, random, economy, missions) };
}
async function fixtureWithDedicatedCharacter() {
  const id = randomUUID(); const characterId = randomUUID(); playerIds.add(id); characterIds.add(characterId);
  const fallback = await database.character.findFirstOrThrow({ where: { isActive: true }, orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }] });
  const character = await database.character.create({ data: { id: characterId, externalKey: `expedition-fixture-${characterId}`, name: `Expedition Character ${characterId.slice(0, 8)}`, rarity: 4, elementKey: 'hydro', isActive: true } });
  await database.player.create({ data: { id, displayName: `Expedition Fixture ${id.slice(0, 8)}`, elementKey: 'hydro', resourceBalances: { create: resourceKeys.map(resourceKey => ({ resourceKey, amount: 0n })) }, economyStats: { create: {} }, characters: { create: [{ characterId, constellation: 0, copies: 1, firstObtainedAt: now }, { characterId: fallback.id, constellation: 0, copies: 1, firstObtainedAt: now }] } } });
  await database.$transaction(tx => new PermanentMissionService().initializePlayer(tx, id, now, true));
  const current = new GetCurrentPlayer({ findByIdentity: async () => ({ id, displayName: 'Expedition Fixture', elementKey: 'hydro', status: 'ACTIVE' as const }), provision: async () => { throw new Error('not used'); } });
  return { id, character, fallback, current, service: new ExpeditionService(current, database, clock, random) };
}
async function cleanup() { const ids = [...playerIds]; if (ids.length) { await database.notification.deleteMany({ where: { playerId: { in: ids } } }); await database.playerPermanentMissionProgress.deleteMany({ where: { playerId: { in: ids } } }); await database.playerPermanentMissionState.deleteMany({ where: { playerId: { in: ids } } }); await database.resourceMovement.deleteMany({ where: { playerId: { in: ids } } }); await database.businessOperation.deleteMany({ where: { playerId: { in: ids } } }); await database.player.deleteMany({ where: { id: { in: ids } } }); } const characters = [...characterIds]; if (characters.length) await database.character.deleteMany({ where: { id: { in: characters } } }); playerIds.clear(); characterIds.clear(); }

describe('Expedition persistence', () => {
  it('enables RLS and revokes browser roles on both private tables', async () => {
    const tables = ['notifications', 'player_expeditions'];
    const rls = await database.$queryRawUnsafe<{ relname: string; relrowsecurity: boolean }[]>(`SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = ANY($1::text[]) ORDER BY c.relname`, tables);
    expect(rls).toHaveLength(2); expect(rls.every(row => row.relrowsecurity)).toBe(true);
    const grants = await database.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*)::bigint AS count FROM information_schema.role_table_grants WHERE table_name = ANY($1::text[]) AND grantee IN ('anon','authenticated')`, tables);
    expect(grants[0]?.count).toBe(0n);
  });

  it('starts for exactly 20h without RNG, becomes READY once, and claims once under retry', async () => {
    now = new Date('2099-08-01T10:00:00.000Z'); randomCalls = 0; nextRoll = 0;
    const { id, character, service, missions } = await fixture(); const startKey = randomUUID();
    const catchUp = vi.spyOn(missions, 'catchUpStandalone'); const reconcile = vi.spyOn(missions, 'reconcileMetrics');
    const started = await service.start(identity, character.id, startKey); const retriedStart = await service.start(identity, character.id, startKey);
    expect(started.operation.alreadyProcessed).toBe(false); expect(retriedStart.operation).toEqual({ id: started.operation.id, alreadyProcessed: true });
    expect(started.view.operationalStatus).toBe('RUNNING'); expect(Date.parse(started.view.readyAt!.toISOString()) - Date.parse(started.view.departedAt!.toISOString())).toBe(20 * 60 * 60 * 1_000); expect(randomCalls).toBe(0);
    expect(catchUp).not.toHaveBeenCalled(); expect(reconcile).not.toHaveBeenCalled();
    await expect(service.claim(identity, randomUUID())).rejects.toMatchObject({ code: 'EXPEDITION_NOT_READY', message: 'Cette expédition n’est pas encore terminée.' });
    expect(catchUp).not.toHaveBeenCalled(); expect(reconcile).not.toHaveBeenCalled();
    now = new Date('2099-08-02T06:00:01.000Z'); expect((await service.getState(identity)).operationalStatus).toBe('READY'); expect((await service.getState(identity)).operationalStatus).toBe('READY');
    expect(await database.notification.count({ where: { playerId: id, typeKey: 'ready' } })).toBe(1);
    const giftNotification = await database.notification.create({ data: { playerId: id, domainKey: 'gift-codes', typeKey: 'GIFT_CODE_AVAILABLE', payload: { title: 'Fixture code', token: 'FIXTURE' }, actionKey: 'OPEN_GIFT_CODE', actionTargetId: randomUUID(), deduplicationKey: `expedition-isolation-gift:${id}` } });
    const claimKey = randomUUID(); const [left, right] = await Promise.all([service.claim(identity, claimKey), service.claim(identity, claimKey)]);
    expect([left.operation.alreadyProcessed, right.operation.alreadyProcessed].sort()).toEqual([false, true]); expect(randomCalls).toBe(1);
    expect(left.reward).toMatchObject({ kind: 'primogems', amount: 1_600n }); expect(left.view.operationalStatus).toBe('IDLE'); expect(left.view.totalCompleted).toBe(1n);
    expect(await database.resourceMovement.count({ where: { playerId: id, causeKey: 'expedition.claim' } })).toBe(1);
    expect((await database.notification.findFirstOrThrow({ where: { playerId: id, domainKey: 'expedition' } })).state).toBe('RESOLVED');
    expect((await database.notification.findUniqueOrThrow({ where: { id: giftNotification.id } })).state).toBe('UNREAD');
    expect((await database.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId: id, resourceKey: 'primogems' } } })).amount).toBe(1_600n);
    expect(catchUp).toHaveBeenCalledTimes(1); expect(reconcile).toHaveBeenCalledTimes(1);
    expect((await database.playerPermanentMissionProgress.findFirstOrThrow({ where: { playerId: id, definition: { externalKey: 'expeditions_b' } } })).progress).toBe(1n);
    expect((await database.businessOperation.findUniqueOrThrow({ where: { id: left.operation.id } })).sourceChannel).toBe(SourceChannel.UI);
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

  it('reconciles Expedition and Moras B/A/S once from a Chat claim and keeps replay stable', async () => {
    now = new Date('2099-08-09T08:00:00.000Z'); randomCalls = 0; nextRoll = 9;
    const { id, character, service } = await fixture();
    await service.start(identity, character.id, randomUUID(), SourceChannel.INTERNAL_CHAT);
    await database.playerExpedition.update({ where: { playerId: id }, data: { totalCompleted: 29n, readyAt: new Date(now.getTime() - 1) } });
    await database.playerEconomyStats.update({ where: { playerId: id }, data: { totalMorasEarned: 970_000n } });
    const key = randomUUID();
    const first = await service.claim(identity, key, SourceChannel.INTERNAL_CHAT);
    const replay = await service.claim(identity, key, SourceChannel.INTERNAL_CHAT);
    expect(first.reward).toMatchObject({ kind: 'moras', amount: 30_000n });
    expect(replay.operation).toEqual({ id: first.operation.id, alreadyProcessed: true });
    const completed = await database.playerPermanentMissionProgress.findMany({
      where: { playerId: id, status: 'COMPLETED', definition: { externalKey: { in: ['expeditions_b', 'expeditions_a', 'expeditions_s', 'moras_b', 'moras_a', 'moras_s'] } } },
      include: { definition: true, rewardOperation: true },
    });
    expect(completed.map(row => row.definition.externalKey).sort()).toEqual(['expeditions_a', 'expeditions_b', 'expeditions_s', 'moras_a', 'moras_b', 'moras_s']);
    expect(completed.every(row => row.completionTriggerOperationId === first.operation.id)).toBe(true);
    expect(completed.every(row => row.rewardOperation?.sourceChannel === SourceChannel.INTERNAL_CHAT)).toBe(true);
    expect(await database.businessOperation.count({ where: { playerId: id, operationType: 'expedition.claim' } })).toBe(1);
  }, 20_000);

  it('reconciles main-element particle B/A/S from the authoritative Expedition reward', async () => {
    now = new Date('2099-08-09T10:00:00.000Z'); randomCalls = 0; nextRoll = 1;
    const { id, character, service } = await fixture();
    await service.start(identity, character.id, randomUUID());
    await database.playerExpedition.update({ where: { playerId: id }, data: { readyAt: new Date(now.getTime() - 1) } });
    await database.playerEconomyStats.update({ where: { playerId: id }, data: { totalMainElementParticlesEarned: 9_200n } });
    const result = await service.claim(identity, randomUUID());
    expect(result.reward).toMatchObject({ kind: 'particles', amount: 800n });
    const completed = await database.playerPermanentMissionProgress.findMany({ where: { playerId: id, status: 'COMPLETED', definition: { metric: 'MAIN_ELEMENT_PARTICLES_EARNED' } }, include: { definition: true } });
    expect(completed.map(row => row.definition.externalKey).sort()).toEqual(['main_particles_a', 'main_particles_b', 'main_particles_s']);
    expect(completed.every(row => row.completionTriggerOperationId === result.operation.id)).toBe(true);
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

  it('archives one owned notification and lazily cleans only READ notifications from a previous Paris day', async () => {
    now = new Date('2099-08-12T10:00:00.000Z');
    const actor = await fixture(); const other = await fixture();
    const notifications = new NotificationService(actor.current, database, clock, actor.service);
    const rows = await Promise.all([
      database.notification.create({ data: { playerId: actor.id, domainKey: 'fixture', typeKey: 'unread-current', payload: {}, state: 'UNREAD', createdAt: now } }),
      database.notification.create({ data: { playerId: actor.id, domainKey: 'fixture', typeKey: 'read-current', payload: {}, state: 'READ', createdAt: now, readAt: now } }),
      database.notification.create({ data: { playerId: actor.id, domainKey: 'fixture', typeKey: 'read-old', payload: {}, state: 'READ', createdAt: new Date('2099-08-10T10:00:00.000Z'), readAt: new Date('2099-08-10T10:00:00.000Z') } }),
      database.notification.create({ data: { playerId: actor.id, domainKey: 'fixture', typeKey: 'unread-old', payload: {}, state: 'UNREAD', createdAt: new Date('2099-08-10T10:00:00.000Z') } }),
      database.notification.create({ data: { playerId: other.id, domainKey: 'fixture', typeKey: 'other-player', payload: {}, state: 'UNREAD', createdAt: now } }),
    ]);

    const initial = await notifications.list(identity);
    expect(initial.notifications.map(({ id }) => id)).toEqual(expect.arrayContaining([rows[0]!.id, rows[1]!.id, rows[3]!.id]));
    expect(initial.notifications).toHaveLength(3);
    expect(initial.unreadCount).toBe(2);
    expect((await database.notification.findUniqueOrThrow({ where: { id: rows[2]!.id } }))).toMatchObject({ state: 'ARCHIVED', archivedAt: now });

    const afterUnreadArchive = await notifications.archiveOne(identity, rows[0]!.id);
    expect(afterUnreadArchive.unreadCount).toBe(1);
    expect(afterUnreadArchive.notifications.map(({ id }) => id)).toEqual(expect.arrayContaining([rows[1]!.id, rows[3]!.id]));
    await notifications.archiveOne(identity, rows[1]!.id);
    await expect(notifications.archiveOne(identity, rows[1]!.id)).resolves.toMatchObject({ unreadCount: 1 });
    await expect(notifications.archiveOne(identity, rows[4]!.id)).rejects.toMatchObject({ code: 'NOTIFICATION_NOT_FOUND' });
    expect((await database.notification.findUniqueOrThrow({ where: { id: rows[3]!.id } })).state).toBe('UNREAD');
    expect((await database.notification.findUniqueOrThrow({ where: { id: rows[4]!.id } })).state).toBe('UNREAD');
  });
});
