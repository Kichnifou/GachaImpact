import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { FavorService, type FavorGrantInput } from '../src/application/favor/favor-service.js';
import { PrismaEconomyService } from '../src/infrastructure/database/prisma-economy-service.js';
import { PermanentMissionService } from '../src/application/missions/permanent-mission-service.js';
import { addBusinessDays, businessDateToDatabaseDate as date } from '../src/domain/time/business-date.js';

const fixture = isolatedBatchDatabase(), db = fixture.database;
let now = new Date('2026-09-28T12:00:00Z');
const clock = { now: () => now };
const service = new FavorService(db, clock);
beforeAll(() => fixture.setup({ seedPublicCatalog: true }), 60_000);
afterAll(async () => {
  await fixture.cleanup();
  // Catalog-only observer: confirm this exact run's schema is gone, without
  // deleting unrelated residual schemas or reconnecting a mutable boundary.
  const inspector = new pg.Client({ connectionString: process.env['DATABASE_URL'] });
  try {
    await inspector.connect();
    const result = await inspector.query('SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname = $1', [fixture.schema]);
    expect(result.rows).toHaveLength(0);
    console.info('Faveur private schema cleanup verified:', fixture.schema);
  } finally { await inspector.end(); }
}, 60_000);
beforeEach(() => { now = new Date('2026-09-28T12:00:00Z'); });
const day = '2026-09-28';

async function player(elementKey: 'pyro' | null = 'pyro') {
  const row = await db.player.create({ data: { displayName: `Private Favor ${randomUUID().slice(0, 8)}`, elementKey,
    economyStats: { create: { totalPrimosEarned: 123n, totalPrimosSpent: 17n, totalMorasEarned: 456n } },
    resourceBalances: { create: { resourceKey: 'primogems', amount: 42n } } } });
  await db.$transaction(tx => new PermanentMissionService(new PrismaEconomyService()).initializePlayer(tx, row.id, now, true));
  return row.id;
}
async function setPeriod(playerId: string, days: number, start = day) {
  return db.playerFavorState.create({ data: { playerId, activeFromDate: date(start), activeUntilDate: date(addBusinessDays(start, days - 1)) } });
}
const input = (playerId: string, overrides: Partial<FavorGrantInput> = {}): FavorGrantInput => ({ playerId, idempotencyKey: randomUUID(), tier: 1, ...overrides });
async function snapshot(playerId: string) {
  return {
    state: await db.playerFavorState.findUnique({ where: { playerId } }),
    grants: await db.favorGrant.findMany({ where: { playerId } }), claims: await db.favorDailyClaim.findMany({ where: { playerId } }),
    operations: await db.businessOperation.findMany({ where: { playerId } }), movements: await db.resourceMovement.findMany({ where: { playerId } }),
    wallet: await db.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId, resourceKey: 'primogems' } } }),
    stats: await db.playerEconomyStats.findUniqueOrThrow({ where: { playerId } }),
    missionState: await db.playerPermanentMissionState.findUnique({ where: { playerId } }),
  };
}
async function assertCredit(playerId: string, amount: bigint, operations: number) {
  const current = await snapshot(playerId);
  expect(current.wallet.amount).toBe(42n + amount);
  expect(current.stats).toMatchObject({ totalPrimosEarned: 123n + amount, totalPrimosSpent: 17n, totalMorasEarned: 456n });
  expect(current.operations).toHaveLength(operations);
  expect(current.operations.every(op => op.status === 'COMPLETED')).toBe(true);
  expect(current.movements).toHaveLength(operations);
  expect(current.movements.reduce((sum, row) => sum + row.delta, 0n)).toBe(amount);
}

describe('Faveur private PostgreSQL core', () => {
  it('projects missing, null and expired state without effects or payment', async () => {
    for (const kind of ['absent', 'null', 'expired']) {
      const id = await player();
      if (kind === 'null') await db.playerFavorState.create({ data: { playerId: id } });
      if (kind === 'expired') await setPeriod(id, 30, '2026-08-01');
      const before = await snapshot(id);
      expect(await service.getCurrent(id)).toMatchObject({ active: false, daysRemaining: 0, claimedToday: false, claimStatus: 'UNAVAILABLE', maxDays: 180 });
      expect(await snapshot(id)).toEqual(before);
    }
  });
  it('projects active remaining days and a claim without changing the calendar', async () => {
    const id = await player(); const state = await setPeriod(id, 30);
    expect(await service.getCurrent(id)).toMatchObject({ active: true, daysRemaining: 30, claimStatus: 'AVAILABLE' });
    await service.claimToday(id);
    expect(await service.getCurrent(id)).toMatchObject({ active: true, daysRemaining: 30, claimStatus: 'CLAIMED', claimedToday: true });
    expect(await db.playerFavorState.findUnique({ where: { playerId: id } })).toEqual(state);
  });
  it.each([1, 2, 3] as const)('grants Tier %i tomorrow, credits via Economy and persists one durable grant', async tier => {
    const id = await player();
    const amount = ({ 1: 1600n, 2: 4800n, 3: 9600n })[tier];
    const result = await service.grant(input(id, { tier }));
    expect(result).toMatchObject({ tier, requestedDays: 30, addedDays: 30, blockedDays: 0, creditedPrimogems: amount.toString(), compensationPrimogems: '0', activeFromDate: '2026-09-29', activeUntilDate: '2026-10-28' });
    expect(await service.getCurrent(id)).toMatchObject({ active: false, daysRemaining: 30, claimStatus: 'UNAVAILABLE' });
    expect(await service.claimToday(id)).toMatchObject({ status: 'INACTIVE', creditedPrimogems: '0' });
    await assertCredit(id, amount, 1);
    const saved = await snapshot(id);
    expect(saved.grants).toHaveLength(1);
    expect(saved.grants[0]).toMatchObject({ subscriptionTier: String(tier), immediatePrimogems: amount, operationId: result.operationId });
    expect(saved.movements[0]).toMatchObject({ operationId: result.operationId, causeKey: 'favor.grant', domainKey: 'favor', sourceChannel: 'TWITCH' });
    expect(saved.claims).toHaveLength(0);
  });
  it('resets an expired interval to tomorrow', async () => {
    const id = await player(); await setPeriod(id, 30, '2026-08-01');
    expect(await service.grant(input(id))).toMatchObject({ activeFromDate: '2026-09-29', activeUntilDate: '2026-10-28', addedDays: 30 });
  });
  it.each([day, '2026-09-29'])('extends an active/future interval starting %s without moving its first day', async start => {
    const id = await player(); await setPeriod(id, 30, start);
    expect(await service.grant(input(id))).toMatchObject({ activeFromDate: start, activeUntilDate: addBusinessDays(start, 59), addedDays: 30 });
    expect(await service.getCurrent(id)).toMatchObject({ active: start === day, daysRemaining: 60 });
  });
  it.each([
    [170, 1, 10, 20, 1067n, 2667n], [180, 1, 0, 30, 1600n, 3200n],
    [170, 2, 10, 20, 1067n, 5867n], [180, 3, 0, 30, 1600n, 11200n],
    [151, 1, 29, 1, 53n, 1653n],
  ] as const)('caps %i days at Tier %i with one immediate + compensation operation', async (days, tier, added, blocked, compensation, amount) => {
    const id = await player(); await setPeriod(id, days);
    const result = await service.grant(input(id, { tier }));
    expect(result).toMatchObject({ addedDays: added, blockedDays: blocked, compensationPrimogems: compensation.toString(), creditedPrimogems: amount.toString() });
    expect(await service.getCurrent(id)).toMatchObject({ daysRemaining: 180 });
    await assertCredit(id, amount, 1);
  });
  it('rejects a Player without an element without any grant, calendar or economic effect', async () => {
    const id = await player(null), before = await snapshot(id);
    await expect(service.grant(input(id))).rejects.toMatchObject({ code: 'PLAYER_ELEMENT_REQUIRED' });
    expect(await snapshot(id)).toEqual(before);
  });
  it('never provisions a missing Player', async () => {
    const id = randomUUID(), before = await db.player.count();
    await expect(service.grant(input(id))).rejects.toMatchObject({ code: 'PLAYER_NOT_FOUND' });
    expect(await db.player.count()).toBe(before);
    expect(await db.businessOperation.count({ where: { playerId: id } })).toBe(0);
  });
  it('does not trigger standalone mission catch-up from a passive beneficiary grant', async () => {
    const id = await player();
    await db.playerPermanentMissionState.update({ where: { playerId: id }, data: { standaloneCatchupCompletedAt: null } });
    const before = (await snapshot(id)).missionState;
    await service.grant(input(id));
    expect((await snapshot(id)).missionState).toEqual(before);
    await assertCredit(id, 1600n, 1);
  });
  it('replays the same key across date changes without a second grant or credit', async () => {
    const id = await player(), grantInput = input(id);
    const first = await service.grant(grantInput); const before = await snapshot(id);
    now = new Date('2026-10-01T12:00:00Z');
    expect(await service.grant(grantInput)).toEqual(first);
    expect(await snapshot(id)).toEqual(before);
  });
  it('serializes concurrent grants of the same key', async () => {
    const id = await player(), grantInput = input(id);
    const results = await Promise.all([service.grant(grantInput), service.grant(grantInput)]);
    expect(results[0]).toEqual(results[1]);
    expect((await snapshot(id)).grants).toHaveLength(1);
    await assertCredit(id, 1600n, 1);
  });
  it('deduplicates a durable receipt even under different concurrent keys', async () => {
    const id = await player();
    const receipt = await db.twitchEventReceipt.create({ data: { externalEventId: randomUUID(), eventType: 'private.favor-proof' } });
    const results = await Promise.all([service.grant(input(id, { twitchEventReceiptId: receipt.id })), service.grant(input(id, { twitchEventReceiptId: receipt.id }))]);
    expect(results[0]).toEqual(results[1]);
    expect((await snapshot(id)).grants).toHaveLength(1);
    await assertCredit(id, 1600n, 1);
  });
  it('rejects conflicting tier, player or receipt under an existing key', async () => {
    const id = await player(), other = await player(), grantInput = input(id);
    await service.grant(grantInput); const before = await snapshot(id);
    for (const overrides of [{ tier: 2 as const }, { playerId: other }, { twitchEventReceiptId: randomUUID() }]) {
      await expect(service.grant({ ...grantInput, ...overrides })).rejects.toMatchObject({ code: 'FAVOR_IDEMPOTENCY_CONFLICT' });
    }
    expect(await snapshot(id)).toEqual(before);
    await assertCredit(other, 0n, 0);
  });
  it('rejects an absent receipt or invalid tier/key without effects', async () => {
    const id = await player(), before = await snapshot(id);
    await expect(service.grant(input(id, { twitchEventReceiptId: randomUUID() }))).rejects.toMatchObject({ code: 'FAVOR_PROOF_INVALID' });
    await expect(service.grant(input(id, { idempotencyKey: ' ' }))).rejects.toMatchObject({ code: 'FAVOR_PROOF_INVALID' });
    await expect(service.grant(input(id, { tier: 4 as 1 }))).rejects.toMatchObject({ code: 'FAVOR_PROOF_INVALID' });
    expect(await snapshot(id)).toEqual(before);
  });
  it.each(['key', 'receipt'] as const)('never attributes one concurrent %s proof to two different Players', async proof => {
    const first = await player(), second = await player();
    const key = randomUUID();
    const receipt = proof === 'receipt' ? await db.twitchEventReceipt.create({ data: { externalEventId: randomUUID(), eventType: 'private.favor-proof' } }) : null;
    const results = await Promise.allSettled([first, second].map(id => service.grant(input(id, {
      idempotencyKey: proof === 'key' ? key : randomUUID(), ...(receipt ? { twitchEventReceiptId: receipt.id } : {}),
    }))));
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find(result => result.status === 'rejected');
    expect(rejected?.status === 'rejected' && rejected.reason).toMatchObject({ code: 'FAVOR_IDEMPOTENCY_CONFLICT' });
    const snapshots = await Promise.all([snapshot(first), snapshot(second)]);
    expect(snapshots.reduce((sum, row) => sum + row.grants.length, 0)).toBe(1);
    expect(snapshots.reduce((sum, row) => sum + row.wallet.amount, 0n)).toBe(1684n);
    expect(snapshots.reduce((sum, row) => sum + row.stats.totalPrimosEarned, 0n)).toBe(1846n);
  });
  it('credits exactly +800 for an active day and stores native source/operation', async () => {
    const id = await player(); await setPeriod(id, 30);
    const result = await service.claimToday(id, 'TWITCH');
    expect(result).toMatchObject({ status: 'CLAIMED', businessDate: day, creditedPrimogems: '800' });
    expect((await snapshot(id)).claims[0]).toMatchObject({ origin: 'NATIVE', sourceChannel: 'TWITCH', claimedAt: now, operationId: result.operationId, legacyProvenance: null });
    await assertCredit(id, 800n, 1);
  });
  it('blocks same-day retries across all sources and concurrent claims pay once', async () => {
    const id = await player(); await setPeriod(id, 30);
    const results = await Promise.all([service.claimToday(id, 'UI'), service.claimToday(id, 'TWITCH')]);
    expect(results.map(result => result.status).sort()).toEqual(['ALREADY_CLAIMED', 'CLAIMED']);
    const before = await snapshot(id);
    expect(await service.claimToday(id, 'INTERNAL_CHAT')).toMatchObject({ status: 'ALREADY_CLAIMED', creditedPrimogems: '0' });
    expect(await snapshot(id)).toEqual(before);
    await assertCredit(id, 800n, 1);
  });
  it('does not pay outside an interval or catch up absent days', async () => {
    const id = await player(); await setPeriod(id, 3);
    now = new Date('2026-09-30T12:00:00Z');
    expect(await service.claimToday(id)).toMatchObject({ status: 'CLAIMED', businessDate: '2026-09-30' });
    now = new Date('2026-10-01T12:00:00Z');
    const before = await snapshot(id);
    expect(await service.claimToday(id)).toMatchObject({ status: 'INACTIVE', creditedPrimogems: '0' });
    expect(await snapshot(id)).toEqual(before);
    expect(before.claims.map(claim => claim.businessDate.toISOString().slice(0, 10))).toEqual(['2026-09-30']);
    await assertCredit(id, 800n, 1);
  });
  it('respects Paris rollover for grant tomorrow and daily claims', async () => {
    const id = await player(); now = new Date('2026-09-28T21:59:59.999Z');
    await service.grant(input(id));
    expect(await service.claimToday(id)).toMatchObject({ status: 'INACTIVE', businessDate: day });
    now = new Date('2026-09-28T22:00:00Z');
    expect(await service.claimToday(id)).toMatchObject({ status: 'CLAIMED', businessDate: '2026-09-29' });
    now = new Date('2026-09-29T22:00:00Z');
    expect(await service.claimToday(id)).toMatchObject({ status: 'CLAIMED', businessDate: '2026-09-30' });
    await assertCredit(id, 3200n, 3);
  });
  it('preserves imported provenance, legacy claim and all balances under plain reads', async () => {
    const id = await player(); await setPeriod(id, 30);
    const provenance = { source: 'private-legacy-snapshot', daysRemaining: 30 };
    await db.playerFavorState.update({ where: { playerId: id }, data: { legacyObtainedDate: date('2026-08-29'), legacyLastClaimDate: date(day), legacyProvenance: provenance } });
    await db.favorDailyClaim.create({ data: { playerId: id, businessDate: date(day), origin: 'LEGACY', legacyProvenance: provenance } });
    const before = await snapshot(id);
    expect(await service.getCurrent(id)).toMatchObject({ active: true, daysRemaining: 30, claimedToday: true });
    expect(await service.claimToday(id)).toMatchObject({ status: 'ALREADY_CLAIMED', operationId: null, creditedPrimogems: '0' });
    now = new Date('2026-10-29T12:00:00Z');
    expect(await service.getCurrent(id)).toMatchObject({ active: false, daysRemaining: 0 });
    expect(await snapshot(id)).toEqual(before);
  });
  it.each(['grant', 'claim'] as const)('rolls back %s together with Economy after a failure following credit', async action => {
    const id = await player(); if (action === 'claim') await setPeriod(id, 30);
    const economy = new PrismaEconomyService();
    const credit = economy.credit.bind(economy);
    vi.spyOn(economy, 'credit').mockImplementation(async (tx, args) => { await credit(tx, args); throw new Error('private injected post-credit failure'); });
    const failing = new FavorService(db, clock, economy), before = await snapshot(id);
    await expect(action === 'grant' ? failing.grant(input(id)) : failing.claimToday(id)).rejects.toThrow('private injected post-credit failure');
    expect(await snapshot(id)).toEqual(before);
  });
  it('serializes distinct concurrent grants and grant/claim without losing days or credit', async () => {
    const id = await player(); await setPeriod(id, 30);
    await Promise.all([service.grant(input(id)), service.grant(input(id)), service.claimToday(id)]);
    expect(await service.getCurrent(id)).toMatchObject({ active: true, daysRemaining: 90, claimedToday: true });
    await assertCredit(id, 4000n, 3);
  });
});
