import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { PlayerActivityRecorder, type PlayerActivityCategory } from '../src/application/player/player-activity-recorder.js';
import { PlayerActivityService } from '../src/application/player/player-activity-service.js';
import { PresenceService } from '../src/application/social/presence-service.js';
import { GlobalChatService } from '../src/application/chat/global-chat-service.js';
import type { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { getBusinessDayStartAt, getNextBusinessResetAt } from '../src/domain/time/business-date.js';
import { randomUUID } from 'node:crypto';

const fixture = isolatedBatchDatabase(), { database } = fixture;
const recorder = new PlayerActivityRecorder();
let now = new Date('2026-10-13T10:00:00Z');
const service = () => new PlayerActivityService(database, { now: () => now });
let alice: string, bob: string, privateId: string, friendsId: string;
const record = (player: string, category: PlayerActivityCategory, at = now) => database.$transaction(tx => recorder.record(tx, player, at, category));
beforeAll(async () => {
  // Explicit normal Prisma deploy/status in this run's private schema only.
  await fixture.setup({ prismaMigrations: true });
  alice = (await database.player.create({ data: { displayName: 'Éloïse 🌙' } })).id;
  bob = (await database.player.create({ data: { displayName: '長い名前' } })).id;
  privateId = (await database.player.create({ data: { displayName: 'Privée' } })).id;
  friendsId = (await database.player.create({ data: { displayName: 'Amis' } })).id;
  await database.privacySetting.createMany({ data: [
    { playerId: privateId, categoryKey: 'LAST_ACTIVITY', level: 'PRIVATE' },
    { playerId: friendsId, categoryKey: 'LAST_ACTIVITY', level: 'FRIENDS' },
  ] });
}, 120_000);
beforeEach(async () => {
  now = new Date('2026-10-13T10:00:00Z');
  await database.playerDailyActivity.deleteMany({ where: { player: { status: 'ACTIVE' } } });
  await database.playerActivityState.deleteMany({ where: { player: { status: 'ACTIVE' } } });
  await database.playerBlock.deleteMany();
  await database.playerSession.deleteMany();
  await database.activityCoverage.update({ where: { id: 'daily-v1' }, data: { startedAt: new Date('2026-10-12T08:00:00Z') } });
});
afterAll(() => fixture.cleanup(), 60_000);

describe('Daily activity on isolated PostgreSQL', () => {
  it('has 81 normal finished migrations, private tables, checks and indexed uniqueness', async () => {
    expect(fixture.migrationStatus).toContain('up to date');
    const rows = await database.$queryRaw<{ n: bigint }[]>`SELECT count(*) n FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    expect(Number(rows[0]!.n)).toBe(81);
    const protections = await database.$queryRaw<{ relname: string; relrowsecurity: boolean; anon: boolean; authenticated: boolean }[]>`SELECT c.relname, c.relrowsecurity,
      has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE') anon,
      has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE') authenticated
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname=current_schema() AND c.relname IN ('player_daily_activity','activity_coverage')`;
    expect(protections).toHaveLength(2);
    expect(protections.every(row => row.relrowsecurity && !row.anon && !row.authenticated)).toBe(true);
  });
  it('counts one Player once across channels, tabs, concurrent actions and replay', async () => {
    await Promise.all([record(alice, 'APPLICATION'), record(alice, 'TWITCH')]);
    await record(alice, 'INTERNAL_CHAT'); await record(alice, 'GAMEPLAY'); await record(alice, 'TWITCH');
    expect(await database.playerDailyActivity.count()).toBe(1);
    expect((await database.playerDailyActivity.findFirst())!).toMatchObject({ application: true, twitch: true, internalChat: true, gameplay: true });
    await record(bob, 'GAMEPLAY');
    expect((await service().history(1)).entries[0]).toMatchObject({ count: 2, today: true, status: 'COVERED' });
  });
  it('rolls the daily witness back with the owning transaction', async () => {
    await expect(database.$transaction(async tx => { await recorder.record(tx, alice, now, 'TWITCH'); throw Error('rollback'); })).rejects.toThrow('rollback');
    expect(await database.playerDailyActivity.count()).toBe(0);
  });
  it('keeps Paris midnight and both DST boundaries calendar based', async () => {
    for (const at of ['2026-10-12T21:59:59Z', '2026-10-12T22:00:00Z', '2026-03-28T23:30:00Z', '2026-03-29T21:30:00Z', '2026-10-24T22:30:00Z', '2026-10-25T22:30:00Z']) {
      await record(alice, 'TWITCH', new Date(at));
    }
    const dates = (await database.playerDailyActivity.findMany({ orderBy: { businessDate: 'asc' } })).map(row => row.businessDate.toISOString().slice(0, 10));
    expect(dates).toEqual(['2026-03-29', '2026-10-12', '2026-10-13', '2026-10-25']);
    expect(+getNextBusinessResetAt(new Date('2026-03-29T00:00:00Z')) - +getBusinessDayStartAt('2026-03-29')).toBe(23 * 3_600_000);
    expect(+getNextBusinessResetAt(new Date('2026-10-25T00:00:00Z')) - +getBusinessDayStartAt('2026-10-25')).toBe(25 * 3_600_000);
  });
  it('distinguishes unknown, real zero and partial collection and survives a new service', async () => {
    const history = await service().history(1);
    expect(history.entries.slice(0, 3)).toEqual([
      { date: '2026-10-13', today: true, status: 'COVERED', count: 0 },
      { date: '2026-10-12', today: false, status: 'PARTIAL', count: 0 },
    ]);
    await record(alice, 'APPLICATION');
    expect((await service().history(1)).entries[0]!.count).toBe(1);
    expect(await service().history(1_000_000)).toMatchObject({ page: 1, total: 2, totalPages: 1 });
    expect((await service().history(1_000_000)).entries).toHaveLength(2);
  });
  it('counts protected activity in aggregates without exposing names or web usage to Twitch', async () => {
    await record(alice, 'APPLICATION'); await record(bob, 'TWITCH');
    await record(privateId, 'TWITCH'); await record(friendsId, 'TWITCH');
    expect((await service().history(1)).entries[0]!.count).toBe(4);
    expect(await service().todayNames(alice, 'INTERNAL_CHAT')).toEqual(['Éloïse 🌙', '長い名前']);
    expect(await service().todayNames(alice, 'TWITCH')).toEqual(['長い名前']);
    expect(await service().todayNames(privateId, 'TWITCH')).not.toContain('Privée');
    await database.playerBlock.create({ data: { blockerPlayerId: bob, blockedPlayerId: alice } });
    expect(await service().todayNames(alice, 'TWITCH')).toEqual([]);
  });
  it('never records heartbeat or read projections, and does record interactions across midnight throttle', async () => {
    const presence = new PresenceService(database, { now: () => now });
    await presence.touch(alice, 'tab', false, true);
    await presence.touch(alice, 'tab', false);
    await service().history(1); await service().todayNames(alice, 'TWITCH');
    expect(await database.playerDailyActivity.count()).toBe(0);
    now = new Date('2026-10-13T21:59:59Z'); await presence.touch(alice, 'tab', true);
    now = new Date('2026-10-13T22:00:01Z'); await presence.touch(alice, 'tab', true);
    expect(await database.playerDailyActivity.count()).toBe(2);
  });
  it('reads more than one bounded name batch without loss or duplicate', async () => {
    const players = Array.from({ length: 205 }, (_, index) => ({ id: randomUUID(), displayName: 'Joueur Unicode_' + String(index).padStart(3, '0') + '_🌙' }));
    await database.player.createMany({ data: players });
    await database.playerDailyActivity.createMany({ data: players.map(player => ({ playerId: player.id, businessDate: new Date('2026-10-13T00:00:00Z'), twitch: true })) });
    const names = await service().todayNames(alice, 'TWITCH');
    expect(names).toEqual(players.map(player => player.displayName));
    expect(new Set(names).size).toBe(205);
  });
  it('starts exactly at actual collection, clamps pagination and retains the first partial day', async () => {
    await database.activityCoverage.update({ where: { id: 'daily-v1' }, data: { startedAt: new Date('2026-10-13T07:21:41.282Z') } });
    expect(await service().history(99)).toMatchObject({ page: 1, total: 1, totalPages: 1, entries: [{ date: '2026-10-13', status: 'PARTIAL', count: 0 }] });
    for (const range of ['5d', '10d', '1m', '3m', '6m', '1y', '2y', '5y', 'all'] as const) {
      expect((await service().statistics(range)).entries).toEqual([{ date: '2026-10-13', today: true, count: 0 }]);
    }
    await expect(service().dayNames(alice, '2026-10-12')).rejects.toMatchObject({ code: 'ACTIVITY_DATE_INVALID' });
    await expect(service().dayNames(alice, '2026-10-14')).rejects.toMatchObject({ code: 'ACTIVITY_DATE_INVALID' });
  });
  it('keeps covered zeroes and exact all-channel aggregates across calendar pages and statistics', async () => {
    await database.activityCoverage.update({ where: { id: 'daily-v1' }, data: { startedAt: new Date('2026-09-20T22:00:00Z') } });
    await record(alice, 'TWITCH'); await record(alice, 'APPLICATION'); await record(bob, 'INTERNAL_CHAT');
    const last = await service().history(500);
    expect(last).toMatchObject({ page: 3, total: 23, totalPages: 3 });
    expect(last.entries).toHaveLength(3);
    expect(last.entries.at(-1)?.date).toBe('2026-09-21');
    const stats = await service().statistics('all');
    expect(stats.entries).toHaveLength(23);
    expect(stats.entries.at(-1)?.count).toBe(2);
    expect(stats.entries.slice(0, -1).every(day => day.count === 0)).toBe(true);
  });
  it('filters historical names while keeping global aggregate totals and no mutation on reads', async () => {
    await record(alice, 'APPLICATION'); await record(bob, 'TWITCH'); await record(privateId, 'TWITCH'); await record(friendsId, 'TWITCH');
    expect(await service().dayNames(alice, '2026-10-13')).toMatchObject({ total: 4, visibleTotal: 2, nextCursor: null });
    expect((await service().dayNames(alice, '2026-10-13')).names.sort()).toEqual(['Éloïse 🌙', '長い名前'].sort());
    await database.playerBlock.create({ data: { blockerPlayerId: bob, blockedPlayerId: alice } });
    expect((await service().dayNames(alice, '2026-10-13')).names).toEqual(['Éloïse 🌙']);
    expect((await service().statistics('10d')).entries.at(-1)?.count).toBe(4);
    expect(await database.playerDailyActivity.count()).toBe(4);
  });
  it('does not repeat Players when a name changes or activity arrives between bounded name batches', async () => {
    const players = Array.from({ length: 101 }, (_, i) => ({ id: `11111111-1111-4111-8111-${(i + 1).toString(16).padStart(12, '0')}`, displayName: `Joueur ${i}` }));
    await database.player.createMany({ data: players });
    await database.playerDailyActivity.createMany({ data: players.map(p => ({ playerId: p.id, businessDate: new Date('2026-10-13T00:00:00Z'), twitch: true })) });
    const first = await service().dayNames(alice, '2026-10-13');
    expect(first.names).toHaveLength(100);
    await database.player.update({ where: { id: players[0]!.id }, data: { displayName: 'ZZZ renommé' } });
    const late = await database.player.create({ data: { id: '11111111-1111-4111-8111-000000000102', displayName: 'AAA arrivé' } });
    await record(late.id, 'TWITCH');
    const second = await service().dayNames(alice, '2026-10-13', first.nextCursor!);
    expect(second.names).toEqual(['Joueur 100', 'AAA arrivé']);
    expect(second.nextCursor).toBeNull();
    expect(new Set([...first.names, ...second.names]).size).toBe(102);
  });
  it('excludes archived names while retaining historical anonymous counts', async () => {
    await record(bob, 'TWITCH');
    await database.player.update({ where: { id: bob }, data: { status: 'ARCHIVED' } });
      expect(await service().todayNames(alice, 'TWITCH')).toEqual([]);
      expect((await service().history(1)).entries[0]!.count).toBe(1);
      await expect(record(bob, 'TWITCH')).rejects.toThrow('PLAYER_ARCHIVED');
  });
  it('projects a public reply author and removes target text and identity on deletion', async () => {
    const target = await database.globalChatMessage.create({ data: { authorPlayerId: alice, messageType: 'PLAYER', sourceChannel: 'INTERNAL_CHAT', content: 'Cible publique' } });
    const reply = await database.globalChatMessage.create({ data: { messageType: 'GAME_RESULT', sourceChannel: 'SYSTEM', content: 'Réponse système', replyToMessageId: target.id } });
    const current = { execute: async () => ({ id: alice, status: 'ACTIVE' }) } as unknown as GetCurrentPlayer;
    const chat = new GlobalChatService(database, current, { now: () => now }, { nextInt: () => 0 });
    expect((await chat.list({ subject: 'fixture' })).messages.find(row => row.id === reply.id)).toMatchObject({ replyAuthor: { id: alice, displayName: 'Éloïse 🌙' }, replyPreview: 'Cible publique' });
    await database.globalChatMessage.update({ where: { id: target.id }, data: { deletionState: 'AUTHOR', deletedAt: now } });
    expect((await chat.list({ subject: 'fixture' })).messages.find(row => row.id === reply.id)).toMatchObject({ replyAuthor: null, replyPreview: 'Message supprimé' });
  });
});
