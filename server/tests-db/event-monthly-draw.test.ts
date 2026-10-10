import 'dotenv/config';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Prisma } from '../generated/prisma/client.js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { EventMonthlyDrawService } from '../src/application/event/event-monthly-draw-service.js';
import { eventDrawWinner } from '../src/domain/event/monthly-draw.js';
import { resolveCurrentEventPeriod, EventService } from '../src/application/event/event-service.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { PrismaCurrentPlayerStore } from '../src/infrastructure/database/prisma-current-player-store.js';
import { verifiedPlayerActor } from '../src/application/player/player-execution-actor.js';
import { withPlayerCommandExecution } from '../src/application/player/player-command-execution.js';
import { NotificationService } from '../src/application/notification/notification-service.js';

const fixture = isolatedBatchDatabase(), db = fixture.database;
beforeAll(() => fixture.setup({ prismaMigrations: true, seedPublicCatalog: true }), 180_000);
afterAll(() => fixture.cleanup(), 60_000);
let year = 2110;
const seed = 'ab'.repeat(32);
async function setup(points: number[] = [], month = 10) {
  const period = resolveCurrentEventPeriod(new Date(`${year++}-${String(month).padStart(2, '0')}-15T12:00:00Z`));
  const definition = await db.eventDefinition.findUniqueOrThrow({ where: { calendarMonth: month } });
  const edition = await db.eventEdition.create({ data: { eventDefinitionId: definition.id, year: period.year, startsAt: period.startsAt, endsAt: period.endsAt, status: 'ACTIVE', snapshot: { externalKey: definition.externalKey, displayName: definition.displayName, calendarMonth: month, currencyKey: definition.currencyKey, config: definition.config } } });
  const players = [];
  for (const amount of points) {
    const player = await db.player.create({ data: { displayName: 'Private draw ' + randomUUID().slice(0, 8), elementKey: 'hydro', eventParticipations: { create: { eventEditionId: edition.id, points: amount } } } });
    players.push(player);
  }
  const now = new Date(period.endsAt.getTime() + 1000), entropy = vi.fn(() => seed);
  const service = new EventMonthlyDrawService(db, { now: () => now }, entropy);
  return { edition, players, service, entropy, now, period };
}
const acquisitions = (editionId: string) => db.itemAcquisition.findMany({ where: { sourceKey: 'EVENT_MONTHLY_DRAW', provenance: { path: ['editionId'], equals: editionId } } });

describe('private migrated Event monthly draw', () => {
  it('applies all migrations with Prisma registry/checksums and backend-only table access', async () => {
    expect(fixture.migrationStatus).toContain('Database schema is up to date');
    const migrations = await fixture.admin.query(`SELECT migration_name, checksum, finished_at, rolled_back_at FROM "${fixture.schema}"._prisma_migrations ORDER BY migration_name`);
    expect(migrations.rows).toHaveLength(69); expect(migrations.rows.at(-1).migration_name).toContain('069_add_event_monthly_draw');
    expect(migrations.rows.every(row => row.finished_at && !row.rolled_back_at && /^[a-f0-9]{64}$/.test(row.checksum))).toBe(true);
    expect(migrations.rows.at(-1).checksum).toBe(createHash('sha256').update(readFileSync('prisma/migrations/20261010110000_069_add_event_monthly_draw/migration.sql')).digest('hex'));
    for (const table of ['event_draw_activation', 'event_monthly_draws']) {
      const result = await fixture.admin.query('SELECT c.relrowsecurity AS rls, has_table_privilege($1, c.oid, $2) AS readable, has_table_privilege($1, c.oid, $3) AS writable FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$4 AND c.relname=$5', ['authenticated', 'SELECT', 'INSERT', fixture.schema, table]);
      expect(result.rows[0]).toEqual({ rls: true, readable: false, writable: false });
    }
  });
  it.each([{ points: [] }, { points: [0, 0] }])('closes no-eligible populations $points without credit and never redraws', async ({ points }) => {
    const f = await setup(points), first = await f.service.processEdition(f.edition.id);
    expect(first.status).toBe('NO_ELIGIBLE'); expect(first.population).toEqual([]); expect(first.winnerPlayerId).toBeNull();
    expect(first.totalTickets?.toFixed(0)).toBe('0'); expect(await acquisitions(f.edition.id)).toEqual([]);
    expect(await f.service.processEdition(f.edition.id)).toEqual(first); expect(f.entropy).toHaveBeenCalledOnce();
  });
  it('credits a single eligible player once, preserving all older stock', async () => {
    const f = await setup([0, 25]); const winner = f.players[1]!;
    const item = await db.itemDefinition.findUniqueOrThrow({ where: { externalKey: 'masterless-stella-fortuna' } });
    await db.playerItem.create({ data: { playerId: winner.id, itemId: item.id, quantity: 7n } });
    const first = await f.service.processEdition(f.edition.id);
    expect(first.winnerPlayerId).toBe(winner.id); expect(first.status).toBe('COMPLETED');
    expect((await db.playerItem.findUniqueOrThrow({ where: { playerId_itemId: { playerId: winner.id, itemId: item.id } } })).quantity).toBe(8n);
    const replay = await new EventMonthlyDrawService(db, { now: () => f.now }, () => { throw Error('NO_REPLAY_RNG'); }).processEdition(f.edition.id);
    expect(replay).toEqual(first); expect(await acquisitions(f.edition.id)).toHaveLength(1);
    expect(await db.notification.count({ where: { typeKey: 'EVENT_MONTHLY_DRAW_WON', playerId: winner.id } })).toBe(1);
  });
  it('freezes exact large weights, selects one winner, excludes only archived identities and pays no loser', async () => {
    const f = await setup([2_147_483_647, 2_147_483_647, 1, 100]);
    await db.player.update({ where: { id: f.players[3]!.id }, data: { status: 'ARCHIVED' } });
    const draw = await f.service.processEdition(f.edition.id), population = draw.population as { playerId: string; points: string }[];
    expect(draw.totalTickets?.toFixed(0)).toBe('4294967295'); expect(population).toHaveLength(3);
    expect(population.map(p => p.playerId)).toEqual(population.map(p => p.playerId).sort());
    expect(draw.winnerPlayerId).toBe(eventDrawWinner(population, BigInt(draw.ticketIndex!.toFixed(0))));
    const rewards = await acquisitions(f.edition.id); expect(rewards).toHaveLength(1); expect(rewards[0]?.playerId).toBe(draw.winnerPlayerId); expect(rewards[0]?.quantity).toBe(1n);
    expect(await db.playerItem.count({ where: { playerId: { in: f.players.filter(p => p.id !== draw.winnerPlayerId).map(p => p.id) } } })).toBe(0);
  });
  it('serializes two schedulers and concurrent deliveries of one edition', async () => {
    const f = await setup([1, 10, 25]);
    const other = new EventMonthlyDrawService(db, { now: () => f.now }, () => 'cd'.repeat(32));
    const results = await Promise.all([f.service.processEdition(f.edition.id), other.processEdition(f.edition.id), f.service.processEdition(f.edition.id)]);
    expect(new Set(results.map(r => r.winnerPlayerId)).size).toBe(1); expect(await acquisitions(f.edition.id)).toHaveLength(1);
    expect(await db.businessOperation.count({ where: { idempotencyKey: `event-monthly-draw:${f.edition.id}` } })).toBe(1);
  });
  it('keeps a sealed choice after failed Stella credit, retries after restart and never rerolls', async () => {
    const f = await setup([1, 10]);
    await db.itemDefinition.update({ where: { externalKey: 'masterless-stella-fortuna' }, data: { isActive: false } });
    try { await expect(f.service.processEdition(f.edition.id)).rejects.toMatchObject({ code: 'STELLA_UNAVAILABLE' }); }
    finally { await db.itemDefinition.update({ where: { externalKey: 'masterless-stella-fortuna' }, data: { isActive: true } }); }
    const frozen = await db.eventMonthlyDraw.findUniqueOrThrow({ where: { eventEditionId: f.edition.id } });
    expect(frozen.status).toBe('FROZEN'); expect(frozen.winnerPlayerId).toBeNull(); expect(frozen.operationId).toBeNull(); expect(await acquisitions(f.edition.id)).toEqual([]);
    const recovered = await new EventMonthlyDrawService(db, { now: () => f.now }, () => { throw Error('REROLL'); }).processEdition(f.edition.id);
    expect(recovered.ticketIndex).toEqual(frozen.ticketIndex); expect(recovered.population).toEqual(frozen.population); expect(recovered.status).toBe('COMPLETED');
    expect(f.entropy).toHaveBeenCalledOnce(); expect(await acquisitions(f.edition.id)).toHaveLength(1);
  });
  it('rolls back credit/result/operation when notification creation fails', async () => {
    const f = await setup([1]);
    await fixture.admin.query(`CREATE FUNCTION fail_draw_notification() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'PRIVATE_NOTIFICATION_FAILURE'; END $$; CREATE TRIGGER fail_draw_notification BEFORE INSERT ON notifications FOR EACH ROW WHEN (NEW.type_key = 'EVENT_MONTHLY_DRAW_WON') EXECUTE FUNCTION fail_draw_notification()`);
    try { await expect(f.service.processEdition(f.edition.id)).rejects.toThrow(); }
    finally { await fixture.admin.query('DROP TRIGGER fail_draw_notification ON notifications; DROP FUNCTION fail_draw_notification()'); }
    expect(await acquisitions(f.edition.id)).toEqual([]); expect(await db.playerItem.count({ where: { playerId: f.players[0]!.id } })).toBe(0);
    expect(await db.businessOperation.count({ where: { idempotencyKey: `event-monthly-draw:${f.edition.id}` } })).toBe(0);
    expect((await db.eventMonthlyDraw.findUniqueOrThrow({ where: { eventEditionId: f.edition.id } })).status).toBe('FROZEN');
    await f.service.processEdition(f.edition.id); expect(await acquisitions(f.edition.id)).toHaveLength(1); expect(f.entropy).toHaveBeenCalledOnce();
  });
  it('preserves reserved entropy across a failed freeze transaction and rejects malformed no-eligible states', async () => {
    const f = await setup([1, 10]);
    await fixture.admin.query(`CREATE FUNCTION fail_draw_freeze() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'PRIVATE_FREEZE_FAILURE'; END $$; CREATE TRIGGER fail_draw_freeze BEFORE UPDATE ON event_monthly_draws FOR EACH ROW WHEN (NEW.status = 'FROZEN') EXECUTE FUNCTION fail_draw_freeze()`);
    try { await expect(f.service.processEdition(f.edition.id)).rejects.toThrow(); }
    finally { await fixture.admin.query('DROP TRIGGER fail_draw_freeze ON event_monthly_draws; DROP FUNCTION fail_draw_freeze()'); }
    const reserved = await db.eventMonthlyDraw.findUniqueOrThrow({ where: { eventEditionId: f.edition.id } });
    expect(reserved.status).toBe('PENDING'); expect(reserved.entropySeed).toBe(seed); expect(reserved.population).toBeNull();
    await expect(db.eventMonthlyDraw.update({ where: { eventEditionId: f.edition.id }, data: { status: 'NO_ELIGIBLE', frozenAt: f.now, completedAt: f.now } })).rejects.toThrow();
    expect((await new EventMonthlyDrawService(db, { now: () => f.now }, () => { throw Error('NO_NEW_RNG'); }).processEdition(f.edition.id)).status).toBe('COMPLETED');
    expect(f.entropy).toHaveBeenCalledOnce(); expect(await acquisitions(f.edition.id)).toHaveLength(1);
  });
  it('catches up a missed eligible month while leaving all pre-activation editions untouched', async () => {
    const f = await setup([1]);
    const definition = await db.eventDefinition.findUniqueOrThrow({ where: { calendarMonth: 10 } });
    const old = await db.eventEdition.create({ data: { eventDefinitionId: definition.id, year: 2001, startsAt: new Date('2001-09-30T22:00:00Z'), endsAt: new Date('2001-10-31T23:00:00Z'), status: 'FINISHED', snapshot: definition.config as Prisma.InputJsonValue } });
    await f.service.catchUp(); expect((await db.eventMonthlyDraw.findUniqueOrThrow({ where: { eventEditionId: f.edition.id } })).status).toBe('COMPLETED');
    expect(await db.eventMonthlyDraw.findUnique({ where: { eventEditionId: old.id } })).toBeNull();
    await expect(f.service.processEdition(old.id)).rejects.toThrow('EVENT_DRAW_EDITION_NOT_ELIGIBLE');
    const live = await setup([1]); await expect(new EventMonthlyDrawService(db, { now: () => live.period.startsAt }).processEdition(live.edition.id)).rejects.toThrow('EVENT_DRAW_EDITION_NOT_ELIGIBLE');
  });
  it('waits for an admitted point transaction and prevents any later population mutation', async () => {
    const f = await setup([1]); let admitted!: () => void, release!: () => void;
    const locked = new Promise<void>(resolve => { admitted = resolve; }), proceed = new Promise<void>(resolve => { release = resolve; });
    const writer = db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM event_editions WHERE id = ${f.edition.id}::uuid FOR SHARE`;
      await tx.eventParticipant.update({ where: { eventEditionId_playerId: { eventEditionId: f.edition.id, playerId: f.players[0]!.id } }, data: { points: { increment: 5 } } });
      admitted(); await proceed;
    });
    await locked; const draw = f.service.processEdition(f.edition.id); release(); await writer;
    expect((await draw).totalTickets?.toFixed(0)).toBe('6');
    await expect(db.eventParticipant.update({ where: { eventEditionId_playerId: { eventEditionId: f.edition.id, playerId: f.players[0]!.id } }, data: { points: 99 } })).rejects.toThrow();
    await expect(db.eventParticipant.create({ data: { eventEditionId: f.edition.id, playerId: (await db.player.create({ data: { displayName: 'Late private join' } })).id, points: 10 } })).rejects.toThrow();
    await expect(db.eventMonthlyDraw.update({ where: { eventEditionId: f.edition.id }, data: { entropySeed: '00'.repeat(32) } })).rejects.toThrow();
  });
  it('refuses a late frozen Game B command atomically and Codes cannot credit the closed month', async () => {
    const f = await setup([1]); await f.service.processEdition(f.edition.id);
    const events = new EventService(new GetCurrentPlayer(new PrismaCurrentPlayerStore(db)), db, { now: () => f.now }, { nextInt: () => 0 });
    const actor = verifiedPlayerActor({ ...f.players[0]!, elementKey: 'hydro' } as never);
    await expect(withPlayerCommandExecution({ now: new Date(f.period.endsAt.getTime() - 1000), source: 'TWITCH', eventEditionId: f.edition.id }, () => events.attemptGameB(actor, '00000', randomUUID(), 'TWITCH'))).rejects.toMatchObject({ code: 'EVENT_EDITION_CLOSED' });
    const result = await db.$transaction(tx => events.creditGiftCodeRewards(tx, f.players[0]!.id, 30, 30n));
    expect(result.granted).toBe(false); expect((await db.eventParticipant.findUniqueOrThrow({ where: { eventEditionId_playerId: { eventEditionId: f.edition.id, playerId: f.players[0]!.id } } })).points).toBe(1);
  });
  it('sends one private ADMIN notification with audit facts and one winner notification', async () => {
    const f = await setup([1]); const admin = await db.player.create({ data: { displayName: 'Private draw administrator', rolesGranted: { create: { role: 'ADMIN' } } } });
    const result = await f.service.processEdition(f.edition.id);
    const notice = await db.notification.findUniqueOrThrow({ where: { deduplicationKey: `event-draw-admin:${f.edition.id}:${admin.id}` } });
    expect(notice.payload).toMatchObject({ editionId: f.edition.id, winnerPlayerId: result.winnerPlayerId, stellaGranted: true, operationId: result.operationId });
    expect(await db.notification.count({ where: { playerId: f.players[0]!.id, typeKey: 'EVENT_MONTHLY_DRAW_ADMIN' } })).toBe(0);
    await f.service.processEdition(f.edition.id); expect(await db.notification.count({ where: { deduplicationKey: notice.deduplicationKey } })).toBe(1);
    const getPlayer = { execute: async () => admin } as unknown as GetCurrentPlayer;
    const notifications = new NotificationService(getPlayer, db, { now: () => f.now }, { getState: async () => ({}) } as never);
    expect((await notifications.list({ subject: 'private-admin' })).notifications.some(row => row.id === notice.id)).toBe(true);
    await db.playerRoleAssignment.updateMany({ where: { playerId: admin.id, role: 'ADMIN' }, data: { revokedAt: f.now } });
    expect((await notifications.list({ subject: 'private-admin' })).notifications.some(row => row.id === notice.id)).toBe(false);
    expect(await db.notification.findUnique({ where: { id: notice.id } })).not.toBeNull();
  });
});
