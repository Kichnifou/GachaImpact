import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { EventService } from '../src/application/event/event-service.js';
import type { GetCurrentPlayer } from '../src/application/player/get-current-player.js';

// No fictional editions of real definitions: all mutations use this run's private schema.
const schema = `calendar_test_${randomUUID().replaceAll('-', '')}`;
const connectionString = process.env['DATABASE_URL'];
if (!connectionString) throw new Error('DATABASE_URL required.');
const admin = new pg.Client({ connectionString });
const database = new PrismaClient({ adapter: new PrismaPg({ connectionString, options: `-c search_path=${schema},public` }, { schema }) });
const migration = readFileSync('prisma/migrations/20260919120000_026_add_event_christmas_calendar/migration.sql', 'utf8');
let now = new Date('2026-12-01T12:00:00Z');
const nextInt = vi.fn(() => 2);
const getPlayer = { execute: async (identity: { subject: string }) => ({ id: identity.subject, displayName: 'Calendar fixture', elementKey: null, status: 'ACTIVE' }) } as unknown as GetCurrentPlayer;
const service = new EventService(getPlayer, database, { now: () => now }, { nextInt });
let created = false;

beforeAll(async () => {
  await admin.connect();
  await admin.query(`CREATE SCHEMA "${schema}"`);
  created = true;
  await admin.query(`REVOKE ALL ON SCHEMA "${schema}" FROM PUBLIC, anon, authenticated`);
  await admin.query(`SET search_path TO "${schema}", public`);
  const fixtureSchema = execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'diff', '--from-empty', '--to-schema', 'prisma/schema.prisma', '--script'], { encoding: 'utf8' }).replace('CREATE SCHEMA IF NOT EXISTS "public";', '');
  if (/"public"\.|\bpublic\./.test(fixtureSchema)) throw new Error('Fixture DDL must not target public.');
  await admin.query(fixtureSchema);
  await admin.query(`DROP TABLE "${schema}".event_calendar_claims`);
  await admin.query(migration);
  const originals = (await admin.query("SELECT * FROM public.event_definitions WHERE calendar_month IN (1,11,12)")).rows;
  for (const row of originals) await database.eventDefinition.create({ data: { id: randomUUID(), externalKey: row.external_key, displayName: row.display_name, calendarMonth: row.calendar_month, currencyKey: row.currency_key, config: row.config } });
}, 60_000);

afterAll(async () => {
  await database.$disconnect();
  // Exact schema generated and created by this run, never a shared prefix cleanup.
  if (created && /^calendar_test_[0-9a-f]{32}$/.test(schema)) await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
  await admin.end();
}, 60_000);

async function fixture(date = '2026-12-01T12:00:00Z') {
  now = new Date(date);
  const player = await database.player.create({ data: { displayName: `Calendar ${randomUUID().slice(0, 8)}` } });
  const identity = { subject: player.id };
  return { identity, playerId: player.id };
}

describe('Christmas calendar isolated PostgreSQL', () => {
  it('rejects nonparticipants and credits exactly one persisted random reward with zero points', async () => {
    const { identity, playerId } = await fixture();
    expect((await service.getCurrent(identity)).calendar?.canClaimToday).toBe(false);
    await expect(service.claimCalendar(identity, randomUUID())).rejects.toMatchObject({ code: 'EVENT_NOT_JOINED' });
    await service.join(identity, randomUUID());
    const key = randomUUID(); nextInt.mockClear();
    const result = await service.claimCalendar(identity, key);
    expect(result).toMatchObject({ calendarClaim: { day: 1, reward: 3 }, currency: { amount: '4' }, participation: { points: 0 }, calendar: { canClaimToday: false } });
    expect(result.calendar?.days[0]).toEqual({ day: 1, state: 'OPENED', reward: 3 });
    expect(nextInt).toHaveBeenCalledTimes(1);
    expect((await service.claimCalendar(identity, key)).calendarClaim).toEqual(result.calendarClaim);
    expect(nextInt).toHaveBeenCalledTimes(1);
    await expect(service.claimCalendar(identity, randomUUID())).rejects.toMatchObject({ code: 'EVENT_CALENDAR_ALREADY_CLAIMED' });
    expect(await database.eventMilestoneClaim.count({ where: { playerId } })).toBe(0);
    expect(await database.eventCalendarClaim.count({ where: { playerId } })).toBe(1);
    now = new Date('2026-12-02T12:00:00Z');
    expect((await service.claimCalendar(identity, key)).calendarClaim.day).toBe(1);
    expect((await service.getCurrent(identity)).calendar?.canClaimToday).toBe(true);
    expect((await service.claimCalendar(identity, randomUUID())).calendarClaim.day).toBe(2);
  }, 60_000);

  it('serializes different concurrent UUIDs and same-key retries', async () => {
    const { identity, playerId } = await fixture('2026-12-03T12:00:00Z');
    await service.join(identity, randomUUID());
    const results = await Promise.allSettled([service.claimCalendar(identity, randomUUID()), service.claimCalendar(identity, randomUUID())]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await database.eventCalendarClaim.count({ where: { playerId } })).toBe(1);
    expect((await service.getCurrent(identity)).currency.amount).toBe('4');
    now = new Date('2026-12-04T12:00:00Z');
    const key = randomUUID();
    const replay = await Promise.all([service.claimCalendar(identity, key), service.claimCalendar(identity, key)]);
    expect(replay[0].operation.id).toBe(replay[1].operation.id);
    expect((await service.getCurrent(identity)).currency.amount).toBe('7');
  }, 60_000);

  it('guarantees 50 on day 25, recap only on 26–31, no calendar outside December', async () => {
    const { identity } = await fixture('2026-12-25T12:00:00Z');
    await service.join(identity, randomUUID()); nextInt.mockClear();
    const key = randomUUID();
    const result = await service.claimCalendar(identity, key);
    expect(result.calendarClaim.reward).toBe(50);
    expect(result.participation.points).toBe(0);
    expect(nextInt).not.toHaveBeenCalled();
    for (const day of [26, 31]) {
      now = new Date(`2026-12-${day}T12:00:00Z`);
      expect((await service.getCurrent(identity)).calendar).toMatchObject({ recap: true, canClaimToday: false });
      await expect(service.claimCalendar(identity, randomUUID())).rejects.toMatchObject({ code: 'EVENT_CALENDAR_UNAVAILABLE' });
    }
    for (const date of ['2026-11-30T12:00:00Z', '2027-01-01T12:00:00Z']) {
      now = new Date(date);
      expect((await service.getCurrent(identity)).calendar).toBeNull();
      await expect(service.claimCalendar(identity, randomUUID())).rejects.toMatchObject({ code: 'EVENT_CALENDAR_UNAVAILABLE' });
    }
    expect((await service.claimCalendar(identity, key)).calendarClaim.reward).toBe(50);
  }, 60_000);

  it('rolls back the opening and operation if the currency update fails', async () => {
    const { identity, playerId } = await fixture('2026-12-05T12:00:00Z');
    await service.join(identity, randomUUID());
    await database.playerEventCurrencyBalance.updateMany({ where: { playerId }, data: { amount: 9223372036854775807n } });
    const key = randomUUID();
    await expect(service.claimCalendar(identity, key)).rejects.toThrow();
    expect(await database.eventCalendarClaim.count({ where: { playerId } })).toBe(0);
    expect(await database.businessOperation.count({ where: { idempotencyKey: key } })).toBe(0);
  }, 60_000);

  it('enforces day/reward/operation/FKs and denies browser grants', async () => {
    const { identity, playerId } = await fixture('2026-12-06T12:00:00Z');
    await service.join(identity, randomUUID());
    const result = await service.claimCalendar(identity, randomUUID());
    const claim = await database.eventCalendarClaim.findUniqueOrThrow({ where: { operationId: result.operation.id } });
    await expect(database.eventCalendarClaim.create({ data: claim })).rejects.toThrow();
    await expect(database.eventCalendarClaim.create({ data: { ...claim, calendarDay: 7 } })).rejects.toThrow();
    for (const data of [{ calendarDay: 0 }, { calendarDay: 26 }, { rewardAmount: 6 }, { calendarDay: 25, rewardAmount: 5 }, { playerId: randomUUID() }, { operationId: randomUUID() }, { eventEditionId: randomUUID() }]) {
      await expect(database.eventCalendarClaim.update({ where: { operationId: claim.operationId }, data })).rejects.toThrow();
    }
    const security = (await admin.query(`SELECT relrowsecurity AS rls, has_table_privilege('anon',oid,'SELECT,INSERT,UPDATE,DELETE') AS anon, has_table_privilege('authenticated',oid,'SELECT,INSERT,UPDATE,DELETE') AS authenticated FROM pg_class WHERE oid = '"${schema}".event_calendar_claims'::regclass`)).rows;
    expect(security).toEqual([{ rls: true, anon: false, authenticated: false }]);
    expect(await database.eventCalendarClaim.count({ where: { playerId } })).toBe(1);
  }, 60_000);
});
