import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { CurrentPlayerFavorService } from '../src/application/favor/current-player-favor-service.js';
import { FavorService } from '../src/application/favor/favor-service.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { GetOrProvisionCurrentPlayer } from '../src/application/player/get-or-provision-current-player.js';
import { PermanentMissionService } from '../src/application/missions/permanent-mission-service.js';
import { PrismaCurrentPlayerStore } from '../src/infrastructure/database/prisma-current-player-store.js';
import { PrismaEconomyService } from '../src/infrastructure/database/prisma-economy-service.js';
import { businessDateToDatabaseDate as date } from '../src/domain/time/business-date.js';
import { isolatedBatchDatabase } from './isolated-batch-database.js';

const fixture = isolatedBatchDatabase(), db = fixture.database;
let now = new Date('2026-09-29T12:00:00Z');
const clock = { now: () => now }, core = new FavorService(db, clock);
const store = new PrismaCurrentPlayerStore(db);
let app: FastifyInstance;
beforeAll(async () => {
  await fixture.setup({ seedPublicCatalog: true });
  app = await buildApp({ host: '127.0.0.1', port: 3001, supabase: {} }, {
    authIdentityVerifier: { verify: async subject => ({ subject }) },
    getOrProvisionCurrentPlayer: new GetOrProvisionCurrentPlayer(store),
    currentPlayerFavor: new CurrentPlayerFavorService(new GetCurrentPlayer(store), core),
  });
}, 60_000);
beforeEach(() => { now = new Date('2026-09-29T12:00:00Z'); });
afterAll(async () => {
  await app?.close(); await fixture.cleanup();
  const inspector = new pg.Client({ connectionString: process.env['DATABASE_URL'] });
  try {
    await inspector.connect();
    expect((await inspector.query('SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname = $1', [fixture.schema])).rows).toHaveLength(0);
    console.info('Standalone Favor private schema cleanup verified:', fixture.schema);
  } finally { await inspector.end(); }
}, 60_000);
async function player() {
  const subject = randomUUID();
  const p = await db.player.create({ data: { displayName: 'Private presence ' + subject.slice(0, 8), elementKey: 'pyro',
    resourceBalances: { create: { resourceKey: 'primogems', amount: 42n } },
    economyStats: { create: { totalPrimosEarned: 123n, totalPrimosSpent: 17n, totalMorasEarned: 456n } } } });
  await db.webIdentity.create({ data: { playerId: p.id, provider: 'supabase', providerSubject: subject } });
  await db.$transaction(tx => new PermanentMissionService(new PrismaEconomyService()).initializePlayer(tx, p.id, now, true));
  return { id: p.id, headers: { authorization: 'Bearer ' + subject } };
}
type PrivatePlayer = Awaited<ReturnType<typeof player>>;
async function period(p: PrivatePlayer, start = '2026-09-29', end = '2026-10-28') {
  await db.playerFavorState.create({ data: { playerId: p.id, activeFromDate: date(start), activeUntilDate: date(end) } });
}
async function get(p: PrivatePlayer) { return app.inject({ method: 'GET', url: '/api/v1/me/favor', headers: p.headers }); }
async function presence(p: PrivatePlayer) { return app.inject({ method: 'POST', url: '/api/v1/me/favor/presence', headers: p.headers }); }
async function snapshot(p: PrivatePlayer) {
  return { state: await db.playerFavorState.findUnique({ where: { playerId: p.id } }),
    claims: await db.favorDailyClaim.findMany({ where: { playerId: p.id } }),
    operations: await db.businessOperation.findMany({ where: { playerId: p.id } }),
    movements: await db.resourceMovement.findMany({ where: { playerId: p.id } }),
    wallet: await db.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId: p.id, resourceKey: 'primogems' } } }),
    stats: await db.playerEconomyStats.findUniqueOrThrow({ where: { playerId: p.id } }),
    missions: await db.playerPermanentMissionState.findUnique({ where: { playerId: p.id } }),
  };
}
async function assertSingleDaily(p: PrivatePlayer, sourceChannel: 'UI' | 'TWITCH') {
  const saved = await snapshot(p);
  expect(saved.wallet.amount).toBe(842n);
  expect(saved.stats).toMatchObject({ totalPrimosEarned: 923n, totalPrimosSpent: 17n, totalMorasEarned: 456n });
  expect(saved.claims).toHaveLength(1); expect(saved.claims[0]).toMatchObject({ businessDate: date('2026-09-29'), origin: 'NATIVE', sourceChannel, claimedAt: now });
  expect(saved.operations).toHaveLength(1); expect(saved.operations[0]).toMatchObject({ operationType: 'favor.daily-claim', status: 'COMPLETED', sourceChannel });
  expect(saved.movements).toHaveLength(1); expect(saved.movements[0]).toMatchObject({ delta: 800n, causeKey: 'favor.daily-claim', sourceChannel });
}

describe('private authenticated standalone Favor projection and presence', () => {
  it.each(['absent', 'null', 'expired'] as const)('GET/POST %s are inactive without any durable writes', async kind => {
    const p = await player();
    if (kind === 'null') await db.playerFavorState.create({ data: { playerId: p.id } });
    if (kind === 'expired') await period(p, '2026-08-01', '2026-08-30');
    const before = await snapshot(p);
    expect((await get(p)).json()).toEqual({ businessDate: '2026-09-29', active: false, daysRemaining: 0, maxDays: 180, dailyPrimogems: '800', claimedToday: false, claimStatus: 'UNAVAILABLE' });
    const result = await presence(p); expect(result.statusCode).toBe(200);
    expect(result.json()).toMatchObject({ status: 'INACTIVE', businessDate: '2026-09-29', creditedPrimogems: '0', favor: { active: false, claimedToday: false } });
    expect(await snapshot(p)).toEqual(before);
  });
  it('GET active available is exact and read-only, with no Twitch identity required', async () => {
    const p = await player(); await period(p); const before = await snapshot(p);
    const result = await get(p); expect(result.statusCode).toBe(200); expect(result.headers['cache-control']).toBe('no-store');
    expect(result.json()).toEqual({ businessDate: '2026-09-29', active: true, daysRemaining: 30, maxDays: 180, dailyPrimogems: '800', claimedToday: false, claimStatus: 'AVAILABLE' });
    expect(await snapshot(p)).toEqual(before); expect(await db.twitchIdentity.count()).toBe(0);
  });
  it('first POST alone pays 800 via Economy; second returns zero and no second animation permission', async () => {
    const p = await player(); await period(p);
    const first = await presence(p); expect(first.statusCode).toBe(200);
    expect(first.json()).toEqual({ status: 'CLAIMED', businessDate: '2026-09-29', creditedPrimogems: '800', favor: { businessDate: '2026-09-29', active: true, daysRemaining: 30, maxDays: 180, dailyPrimogems: '800', claimedToday: true, claimStatus: 'CLAIMED' } });
    await assertSingleDaily(p, 'UI'); const before = await snapshot(p);
    expect((await presence(p)).json()).toMatchObject({ status: 'ALREADY_CLAIMED', creditedPrimogems: '0' });
    expect((await get(p)).json()).toMatchObject({ claimedToday: true, claimStatus: 'CLAIMED' });
    expect(await snapshot(p)).toEqual(before);
  });
  it('Twitch before UI prevents payment/animation on UI presence', async () => {
    const p = await player(); await period(p); expect((await core.claimToday(p.id, 'TWITCH')).status).toBe('CLAIMED');
    const before = await snapshot(p);
    expect((await presence(p)).json()).toMatchObject({ status: 'ALREADY_CLAIMED', creditedPrimogems: '0', favor: { claimedToday: true } });
    expect(await snapshot(p)).toEqual(before); await assertSingleDaily(p, 'TWITCH');
  });
  it('UI before Twitch leaves the latter at zero', async () => {
    const p = await player(); await period(p); expect((await presence(p)).json().status).toBe('CLAIMED');
    expect(await core.claimToday(p.id, 'TWITCH')).toMatchObject({ status: 'ALREADY_CLAIMED', creditedPrimogems: '0' });
    await assertSingleDaily(p, 'UI');
  });
  it('two simultaneous HTTP presences expose exactly one CLAIMED and one zero replay', async () => {
    const p = await player(); await period(p);
    const results = await Promise.all([presence(p), presence(p)]);
    expect(results.map(r => r.statusCode)).toEqual([200, 200]);
    expect(results.map(r => r.json().status).sort()).toEqual(['ALREADY_CLAIMED', 'CLAIMED']);
    expect(results.map(r => r.json().creditedPrimogems).sort()).toEqual(['0', '800']);
    await assertSingleDaily(p, 'UI');
  });
  it('concurrent UI/Twitch share the durable Player/date claim', async () => {
    const p = await player(); await period(p);
    const [ui, twitch] = await Promise.all([presence(p), core.claimToday(p.id, 'TWITCH')]);
    expect(ui.statusCode).toBe(200); const results = [ui.json(), twitch];
    expect(results.map(r => r.status).sort()).toEqual(['ALREADY_CLAIMED', 'CLAIMED']);
    expect(results.map(r => r.creditedPrimogems).sort()).toEqual(['0', '800']);
    await assertSingleDaily(p, ui.json().status === 'CLAIMED' ? 'UI' : 'TWITCH');
  });
  it('honors an existing LEGACY daily proof without an operation or credit', async () => {
    const p = await player(); await period(p);
    await db.favorDailyClaim.create({ data: { playerId: p.id, businessDate: date('2026-09-29'), origin: 'LEGACY', legacyProvenance: { private: true } } });
    const before = await snapshot(p);
    expect((await presence(p)).json()).toMatchObject({ status: 'ALREADY_CLAIMED', creditedPrimogems: '0', favor: { claimedToday: true } });
    expect(await snapshot(p)).toEqual(before);
  });
  it('uses the next Paris business date at midnight, before UTC changes day', async () => {
    const p = await player(); await period(p); now = new Date('2026-09-29T21:59:59Z');
    expect((await presence(p)).json()).toMatchObject({ status: 'CLAIMED', businessDate: '2026-09-29' });
    now = new Date('2026-09-29T22:00:00Z');
    expect((await get(p)).json()).toMatchObject({ businessDate: '2026-09-30', claimedToday: false, claimStatus: 'AVAILABLE', daysRemaining: 29 });
    expect((await presence(p)).json()).toMatchObject({ status: 'CLAIMED', businessDate: '2026-09-30', creditedPrimogems: '800' });
    expect((await snapshot(p)).wallet.amount).toBe(1642n); expect(await db.favorDailyClaim.count({ where: { playerId: p.id } })).toBe(2);
  });
  it('never catches up missed days on the next presence', async () => {
    const p = await player(); await period(p); now = new Date('2026-10-03T12:00:00Z');
    expect((await presence(p)).json()).toMatchObject({ status: 'CLAIMED', businessDate: '2026-10-03', creditedPrimogems: '800' });
    const saved = await snapshot(p); expect(saved.wallet.amount).toBe(842n); expect(saved.claims).toHaveLength(1);
    expect(saved.claims[0]!.businessDate).toEqual(date('2026-10-03'));
  });
  it('a new grant starting J+1 stays inactive today, then first presence pays tomorrow', async () => {
    const p = await player(); await core.grant({ playerId: p.id, tier: 1, idempotencyKey: randomUUID() });
    const before = await snapshot(p);
    expect((await presence(p)).json()).toMatchObject({ status: 'INACTIVE', creditedPrimogems: '0', favor: { active: false, daysRemaining: 30 } });
    expect(await snapshot(p)).toEqual(before);
    now = new Date('2026-09-29T22:00:00Z');
    expect((await presence(p)).json()).toMatchObject({ status: 'CLAIMED', creditedPrimogems: '800', businessDate: '2026-09-30' });
    expect((await snapshot(p)).wallet.amount).toBe(2442n);
  });
  it('expiration after the inclusive final day does not pay or write', async () => {
    const p = await player(); await period(p, '2026-09-29', '2026-09-29');
    expect((await presence(p)).json().status).toBe('CLAIMED'); now = new Date('2026-09-29T22:00:00Z');
    const before = await snapshot(p);
    expect((await presence(p)).json()).toMatchObject({ status: 'INACTIVE', creditedPrimogems: '0', favor: { active: false, daysRemaining: 0, claimedToday: false } });
    expect(await snapshot(p)).toEqual(before);
  });
  it('authenticated identities isolate two Players and never pay the other account', async () => {
    const a = await player(), b = await player(); await period(a); await period(b); const beforeB = await snapshot(b);
    expect((await presence(a)).json().status).toBe('CLAIMED'); expect(await snapshot(b)).toEqual(beforeB);
    expect((await get(b)).json()).toMatchObject({ claimedToday: false, claimStatus: 'AVAILABLE' });
    expect((await presence(b)).json().status).toBe('CLAIMED'); await assertSingleDaily(a, 'UI'); await assertSingleDaily(b, 'UI');
  });
  it.each(['SUSPENDED', 'ARCHIVED'] as const)('rejects %s Players without claiming or provisioning', async status => {
    const p = await player(); await period(p); await db.player.update({ where: { id: p.id }, data: { status } });
    const before = await snapshot(p);
    expect((await get(p)).statusCode).toBe(404); expect((await presence(p)).statusCode).toBe(404);
    expect(await snapshot(p)).toEqual(before);
  });
});
