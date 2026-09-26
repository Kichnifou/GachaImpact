import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../generated/prisma/client.js';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { PlayerActivityRecorder } from '../src/application/player/player-activity-recorder.js';
import { TradeService } from '../src/application/trades/trade-service.js';
import { PrismaEconomyService } from '../src/infrastructure/database/prisma-economy-service.js';
import { isPrismaConcurrencyCollision } from '../src/infrastructure/database/prisma-concurrency.js';
import { elementKeys, type ElementKey, type ResourceKey } from '../src/domain/economy/resources.js';
import { getNextBusinessResetAt } from '../src/domain/time/business-date.js';
import { buildApp } from '../src/app.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import type { GetOrProvisionCurrentPlayer } from '../src/application/player/get-or-provision-current-player.js';

const fixture = isolatedBatchDatabase(), db = fixture.database;
let now = new Date('2026-09-21T12:00:00Z');
const clock = { now: () => now }, economy = new PrismaEconomyService(() => now), service = new TradeService(db, clock, economy);
beforeAll(async () => {
  await fixture.setup();
  const sql = readFileSync('prisma/migrations/20260921100000_031_add_particle_trades/migration.sql', 'utf8');
  await fixture.admin.query(sql.slice(sql.indexOf('-- Additional invariants')));
  await db.element.createMany({ data: elementKeys.map((key, displayOrder) => ({ key, displayName: key, displayOrder })) });
  await db.resourceDefinition.createMany({ data: elementKeys.map(key => ({ key: `particles_${key}`, displayName: key, category: 'particle', elementKey: key })) });
}, 60_000);
afterAll(() => fixture.cleanup(), 60_000);
async function player(elementKey: ElementKey | null = 'cryo', stock = 500n) {
  const p = await db.player.create({ data: { displayName: `Trade ${randomUUID()}`, elementKey } });
  await db.playerEconomyStats.create({ data: { playerId: p.id } });
  await db.playerResourceBalance.createMany({ data: elementKeys.map(e => ({ playerId: p.id, resourceKey: `particles_${e}`, amount: stock })) });
  return p.id;
}
const request = (a: string, b: string, amount: bigint | undefined = 300n, key = randomUUID()) => service.create(a, b, amount, key);
const balance = async (id: string, resourceKey: string) => (await db.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId: id, resourceKey } } })).amount;
const stock = async (id: string, resourceKey = 'particles_pyro') => (await service.snapshot(id)).stocks.find(s => s.resourceKey === resourceKey)!;
const notification = (id: string) => db.notification.findUniqueOrThrow({ where: { deduplicationKey: `trades:pending:${id}` } });
async function change(id: string, amount: bigint, resourceKey: ResourceKey = 'particles_cryo') {
  await db.$transaction(async tx => {
    const op = await tx.businessOperation.create({ data: { playerId: id, operationType: 'test', sourceChannel: 'SYSTEM' } });
    const input = { playerId: id, playerElementKey: null, resourceKey, amount: amount < 0n ? -amount : amount, causeKey: 'test', domainKey: 'test', operationId: op.id, sourceChannel: 'SYSTEM' as const };
    if (amount < 0n) await economy.debit(tx, input); else await economy.credit(tx, input);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 });
}
function deferred() {
  let resolve!: () => void;
  return { promise: new Promise<void>(done => { resolve = done; }), resolve };
}
async function debitWithRetry(id: string, amount: bigint, resourceKey: ResourceKey, operationId: string) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await db.$transaction(tx => economy.debit(tx, {
        playerId: id, playerElementKey: null, resourceKey, amount,
        causeKey: 'test', domainKey: 'test', operationId, sourceChannel: 'SYSTEM',
      }), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 });
    }
    catch (error) { if (!isPrismaConcurrencyCollision(error) || attempt === 3) throw error; }
  }
}
describe('Particle trades isolated PostgreSQL', () => {
  it('resolves the recipient pending aggregate immediately when its sender cancels the last request', async () => {
    const a = await player(), b = await player('pyro'), r = await request(a, b);
    expect(await notification(b)).toMatchObject({ state: 'UNREAD', payload: { count: 1 } });
    await service.mutate(a, r.requestId, 'cancel', randomUUID());
    expect(await db.tradeRequest.findUniqueOrThrow({ where: { id: r.requestId } })).toMatchObject({ state: 'CANCELLED' });
    expect(await notification(b)).toMatchObject({ state: 'RESOLVED', payload: { count: 0 } });
    expect(await db.notification.count({ where: { typeKey: 'TRADE_ACCEPTED', playerId: { in: [a, b] } } })).toBe(0);
  }, 30_000);
  it('notifies only the sender after acceptance and deduplicates both kinds of replay', async () => {
    const a = await player(), b = await player('pyro'), r = await request(a, b, 100n), key = randomUUID();
    await db.player.update({ where: { id: b }, data: { displayName: 'Céo' } });
    const accepted = await service.mutate(b, r.requestId, 'accept', key);
    expect(accepted.state).toBe('ACCEPTED');
    expect(await balance(a, 'particles_pyro')).toBe(400n);
    expect(await balance(b, 'particles_cryo')).toBe(400n);
    expect(await balance(a, 'particles_cryo')).toBe(600n);
    expect(await balance(b, 'particles_pyro')).toBe(600n);
    expect(await notification(b)).toMatchObject({ state: 'RESOLVED', payload: { count: 0 } });
    const where = { deduplicationKey: `trade-accepted:${r.requestId}` };
    expect(await db.notification.findUniqueOrThrow({ where })).toMatchObject({
      playerId: a, typeKey: 'TRADE_ACCEPTED', state: 'UNREAD', actionKey: 'OPEN_TRADES_HISTORY',
      payload: { requestId: r.requestId, accepterPlayerId: b, accepterDisplayName: 'Céo', amount: '100', senderResourceKey: 'particles_pyro', recipientResourceKey: 'particles_cryo' },
    });
    expect(await service.mutate(b, r.requestId, 'accept', key)).toEqual(accepted);
    expect((await service.mutate(b, r.requestId, 'accept', randomUUID())).state).toBe('UNAVAILABLE');
    expect(await db.notification.count({ where })).toBe(1);
    expect(await db.notification.count({ where: { playerId: b, typeKey: 'TRADE_ACCEPTED' } })).toBe(0);
  }, 30_000);
  it('authenticates the API, rejects forged ownership/invalid amounts and returns private string projections', async () => {
    const a = await player(), b = await player('pyro');
    const getPlayer = new GetCurrentPlayer({ findByIdentity: async (_provider, id) => { const p = await db.player.findUnique({ where: { id } }); return p ? { id: p.id, displayName: p.displayName, elementKey: null, status: p.status } : null; }, provision: async () => { throw Error('No provisioning'); } });
    const app = await buildApp({ host: '127.0.0.1', port: 3001, supabase: {} }, { authIdentityVerifier: { verify: async subject => ({ subject }) }, getOrProvisionCurrentPlayer: {} as GetOrProvisionCurrentPlayer, tradePlayer: getPlayer, tradeService: service });
    try {
      const post = (url: string, actor: string, payload: object) => app.inject({ method: 'POST', url, headers: { authorization: `Bearer ${actor}` }, payload });
      expect((await app.inject({ url: '/api/v1/me/trades' })).statusCode).toBe(401);
      const input = { recipientPlayerId: b, amount: '100', idempotencyKey: randomUUID() };
      expect((await post('/api/v1/me/trades', a, { ...input, playerId: b })).statusCode).toBe(400);
      for (const amount of ['0', '-1', '1.5', '9223372036854775808']) expect((await post('/api/v1/me/trades', a, { ...input, amount })).statusCode).toBe(400);
      const created = await post('/api/v1/me/trades', a, input); expect(created.statusCode).toBe(200);
      const accepted = await post(`/api/v1/me/trades/${created.json().requestId}/accept`, b, { idempotencyKey: randomUUID() }); expect(accepted.statusCode).toBe(200);
      const view = await app.inject({ url: '/api/v1/me/trades', headers: { authorization: `Bearer ${a}` } });
      expect(view.headers['cache-control']).toBe('no-store'); expect(view.json().history[0].amount).toBe('100');
    } finally { await app.close(); }
  }, 30_000);
  it('enforces private SQL tables and amount/pair constraints and executes a concurrent acceptance once', async () => {
    const security = await fixture.admin.query('SELECT relname, relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND relname IN (\'trade_requests\',\'trade_executions\')', [fixture.schema]);
    expect(security.rows).toHaveLength(2); expect(security.rows.every(row => row.relrowsecurity)).toBe(true);
    const grants = await fixture.admin.query('SELECT grantee FROM information_schema.role_table_grants WHERE table_schema=$1 AND table_name IN (\'trade_requests\',\'trade_executions\') AND grantee IN (\'anon\',\'authenticated\',\'PUBLIC\')', [fixture.schema]); expect(grants.rows).toEqual([]);
    const a = await player(), b = await player('pyro'), r = await request(a, b, 100n);
    await expect(db.tradeRequest.update({ where: { id: r.requestId }, data: { currentAmount: -1n } })).rejects.toThrow();
    await expect(db.tradeRequest.update({ where: { id: r.requestId }, data: { senderResourceKey: 'particles_cryo' } })).rejects.toThrow();
    const results = await Promise.all([service.mutate(b, r.requestId, 'accept', randomUUID()), service.mutate(b, r.requestId, 'accept', randomUUID())]);
    expect(results.filter(result => result.state === 'ACCEPTED')).toHaveLength(1);
    expect(await db.tradeExecution.count({ where: { tradeRequestId: r.requestId } })).toBe(1);
    expect(await balance(b, 'particles_cryo')).toBe(400n);
  }, 30_000);
  it('rejects self, same element, missing element, missing/inactive/blocked target and invalid amounts', async () => {
    const a = await player(), b = await player(), c = await player(null), d = await player('pyro');
    for (const target of [a, b, c, randomUUID()]) await expect(request(a, target)).rejects.toThrow();
    for (const amount of [0n, -1n]) await expect(request(a, d, amount)).rejects.toThrow();
    await db.player.update({ where: { id: d }, data: { status: 'SUSPENDED' } });
    await expect(request(a, d)).rejects.toThrow();
    await db.player.update({ where: { id: d }, data: { status: 'ACTIVE' } });
    await db.playerBlock.create({ data: { blockerPlayerId: d, blockedPlayerId: a } });
    await expect(request(a, d)).rejects.toThrow();
  }, 30_000);
  it('validates both stocks, computes MAX, reserves only sender, rejects either direction of a pending pair', async () => {
    const a = await player('cryo', 500n), b = await player('pyro', 200n);
    await expect(request(a, b, 501n)).rejects.toThrow();
    await expect(request(a, b, 201n)).rejects.toThrow();
    const result = await service.create(a, b, undefined, randomUUID()); expect(result.amount).toBe('200');
    expect(await stock(a)).toEqual({ resourceKey: 'particles_pyro', total: '500', reserved: '200', available: '300' });
    expect((await stock(b, 'particles_cryo')).reserved).toBe('0');
    await expect(request(a, b, 1n)).rejects.toThrow(); await expect(request(b, a, 1n)).rejects.toThrow();
  }, 30_000);
  it('discovers only eligible partners with accent/case search and bounded server pagination', async () => {
    const a = await player(), b = await player('pyro');
    const name = `Élise ${randomUUID()}`; await db.player.update({ where: { id: b }, data: { displayName: name } });
    const cosmetic = await db.cosmeticDefinition.create({ data: { externalKey: `test-trade-avatar-${randomUUID()}`, type: 'AVATAR', displayName: 'Fixture avatar', assetPath: '/assets/fixture/trade.png' } });
    await db.playerCosmetic.create({ data: { playerId: b, cosmeticId: cosmetic.id, unlockSource: 'TEST' } });
    await db.player.update({ where: { id: b }, data: { equippedAvatarCosmeticId: cosmetic.id } });
    const result = await service.partners(a, name.replace('Élise', 'ELISE'));
    expect(result.partners.map(p => p.id)).toEqual([b]); expect(result.partners[0]).toMatchObject({ maximum: '500', avatarAssetPath: '/assets/fixture/trade.png' });
    await request(a, b); expect((await service.partners(a, name)).partners).toEqual([]);
  }, 30_000);
  it('concurrent creations cannot over-reserve sender stock', async () => {
    const a = await player(), b = await player('pyro'), c = await player('pyro');
    const outcomes = await Promise.allSettled([request(a, b, 400n), request(a, c, 400n)]);
    expect(outcomes.filter(o => o.status === 'fulfilled')).toHaveLength(1);
    expect((await stock(a)).reserved).toBe('400');
    await expect(change(a, -101n, 'particles_pyro')).rejects.toThrow();
    await change(a, -100n, 'particles_pyro'); expect((await stock(a)).available).toBe('0');
  }, 30_000);
  it('serializes a particle debit with a concurrent trade reservation in deterministic lock order', async () => {
    const a = await player('cryo', 500n), b = await player('pyro', 500n);
    const reservationService = new TradeService(db, clock, economy);
    const privateTrade = reservationService as unknown as { lockResources: (tx: Prisma.TransactionClient, ids: string[], resources: string[]) => Promise<void> };
    const privateEconomy = economy as unknown as { lockBalance: (tx: Prisma.TransactionClient, playerId: string, resourceKey: ResourceKey) => Promise<bigint> };
    const originalTradeLock = privateTrade.lockResources.bind(reservationService);
    const originalDebitLock = privateEconomy.lockBalance.bind(economy);
    const reservationLocked = deferred(), releaseReservation = deferred(), debitStarted = deferred();
    const debitOperation = await db.businessOperation.create({ data: { playerId: a, operationType: 'test', sourceChannel: 'SYSTEM' } });
    privateTrade.lockResources = async (tx, ids, resources) => { await originalTradeLock(tx, ids, resources); reservationLocked.resolve(); await releaseReservation.promise; };
    privateEconomy.lockBalance = async (tx, playerId, resourceKey) => { debitStarted.resolve(); return originalDebitLock(tx, playerId, resourceKey); };
    try {
      const pendingReservation = reservationService.create(a, b, 500n, randomUUID());
      await reservationLocked.promise;
      const pendingDebit = debitWithRetry(a, 500n, 'particles_pyro', debitOperation.id);
      await debitStarted.promise;
      releaseReservation.resolve();
      await pendingReservation;
      await expect(pendingDebit).rejects.toMatchObject({ code: 'INSUFFICIENT_AVAILABLE_PARTICLES' });
    } finally {
      privateTrade.lockResources = originalTradeLock;
      privateEconomy.lockBalance = originalDebitLock;
    }
    expect(await stock(a)).toEqual({ resourceKey: 'particles_pyro', total: '500', reserved: '500', available: '0' });
    expect(await db.resourceMovement.count({ where: { playerId: a, resourceKey: 'particles_pyro', causeKey: 'test' } })).toBe(0);

    const c = await player('cryo', 500n), d = await player('pyro', 500n);
    const consumptionEconomy = new PrismaEconomyService(() => now);
    const consumptionTrade = new TradeService(db, clock, consumptionEconomy);
    const privateConsumptionEconomy = consumptionEconomy as unknown as { lockBalance: (tx: Prisma.TransactionClient, playerId: string, resourceKey: ResourceKey) => Promise<bigint> };
    const originalConsumptionLock = privateConsumptionEconomy.lockBalance.bind(consumptionEconomy);
    const consumptionLocked = deferred(), releaseConsumption = deferred();
    privateConsumptionEconomy.lockBalance = async (tx, playerId, resourceKey) => {
      const value = await originalConsumptionLock(tx, playerId, resourceKey);
      consumptionLocked.resolve(); await releaseConsumption.promise;
      return value;
    };
    try {
      const pendingDebit = db.$transaction(async tx => {
        const operation = await tx.businessOperation.create({ data: { playerId: c, operationType: 'test', sourceChannel: 'SYSTEM' } });
        await consumptionEconomy.debit(tx, { playerId: c, playerElementKey: null, resourceKey: 'particles_pyro', amount: 500n, causeKey: 'test', domainKey: 'test', operationId: operation.id, sourceChannel: 'SYSTEM' });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 });
      await consumptionLocked.promise;
      const pendingReservation = consumptionTrade.create(c, d, 500n, randomUUID());
      releaseConsumption.resolve();
      await pendingDebit;
      await expect(pendingReservation).rejects.toThrow();
    } finally { privateConsumptionEconomy.lockBalance = originalConsumptionLock; }
    expect(await balance(c, 'particles_pyro')).toBe(0n);
    expect(await db.tradeRequest.count({ where: { OR: [{ senderPlayerId: c }, { recipientPlayerId: c }] } })).toBe(0);
  }, 30_000);
  it('accepts atomically with four movements, unchanged stats, exact retries and one execution', async () => {
    const a = await player(), b = await player('pyro'), key = randomUUID();
    const r = await request(a, b, 100n, key);
    expect(await request(a, b, 100n, key)).toEqual(r);
    await expect(request(a, b, 101n, key)).rejects.toThrow();
    const stats = await db.playerEconomyStats.findMany({ where: { playerId: { in: [a, b] } }, orderBy: { playerId: 'asc' } });
    const acceptKey = randomUUID(); const result = await service.mutate(b, r.requestId, 'accept', acceptKey);
    expect(await service.mutate(b, r.requestId, 'accept', acceptKey)).toEqual(result);
    expect((await service.mutate(b, r.requestId, 'accept', randomUUID())).state).toBe('UNAVAILABLE');
    expect(await balance(a, 'particles_pyro')).toBe(400n); expect(await balance(a, 'particles_cryo')).toBe(600n);
    expect(await balance(b, 'particles_pyro')).toBe(600n); expect(await balance(b, 'particles_cryo')).toBe(400n);
    expect(await db.playerEconomyStats.findMany({ where: { playerId: { in: [a, b] } }, orderBy: { playerId: 'asc' } })).toEqual(stats);
    const execution = await db.tradeExecution.findUniqueOrThrow({ where: { tradeRequestId: r.requestId } });
    const moves = await db.resourceMovement.findMany({ where: { operationId: execution.operationId } });
    expect(moves).toHaveLength(4); expect(moves.reduce((sum, m) => sum + m.delta, 0n)).toBe(0n);
    expect(moves.every(m => m.balanceAfter === m.balanceBefore + m.delta && m.domainKey === 'trades')).toBe(true);
    expect((await stock(a)).reserved).toBe('0'); expect((await service.snapshot(a)).history).toHaveLength(1);
  }, 30_000);
  it('rolls back all transfer legs and reservation release after an injected failure', async () => {
    const a = await player(), b = await player('pyro'), r = await request(a, b);
    const failing = new PrismaEconomyService(() => now);
    const transfer = failing.exchangeParticlesWithoutStats.bind(failing);
    vi.spyOn(failing, 'exchangeParticlesWithoutStats').mockImplementation(async (tx, input) => { await transfer(tx, input); throw Error('injected'); });
    await expect(new TradeService(db, clock, failing).mutate(b, r.requestId, 'accept', randomUUID())).rejects.toThrow('injected');
    expect(await balance(a, 'particles_pyro')).toBe(500n); expect(await balance(b, 'particles_cryo')).toBe(500n);
    expect((await stock(a)).reserved).toBe('300'); expect(await db.tradeExecution.count({ where: { tradeRequestId: r.requestId } })).toBe(0);
    expect(await db.notification.count({ where: { deduplicationKey: `trade-accepted:${r.requestId}` } })).toBe(0);
    const activity = new PlayerActivityRecorder();
    vi.spyOn(activity, 'record').mockRejectedValueOnce(Error('after notification'));
    await expect(new TradeService(db, clock, economy, activity).mutate(b, r.requestId, 'accept', randomUUID())).rejects.toThrow('after notification');
    expect(await db.notification.count({ where: { deduplicationKey: `trade-accepted:${r.requestId}` } })).toBe(0);
    expect(await db.tradeExecution.count({ where: { tradeRequestId: r.requestId } })).toBe(0);
    expect(await balance(a, 'particles_pyro')).toBe(500n);
    expect((await stock(a)).reserved).toBe('300');
  }, 30_000);
  it('reduces 500 to 200, releases 300 immediately, never grows back, resolves silently at zero', async () => {
    const a = await player(), b = await player('pyro'); const r = await request(a, b, 500n);
    await change(b, -300n); expect((await stock(a)).reserved).toBe('200');
    await change(b, 300n); expect((await stock(a)).reserved).toBe('200');
    await change(b, -500n); expect((await stock(a)).reserved).toBe('0');
    const row = await db.tradeRequest.findUniqueOrThrow({ where: { id: r.requestId } });
    expect(row.currentAmount).toBe(0n); expect(row.state).toBe('CANCELLED');
    expect((await notification(b)).state).toBe('RESOLVED'); expect(await db.notification.count({ where: { playerId: b } })).toBe(1);
  }, 30_000);
  it('allows incoming 300 + 300 on 500 and accept-all executes oldest then reduced newer independently', async () => {
    const a = await player(), b = await player('pyro'), c = await player();
    const first = await request(a, b); now = new Date(now.getTime() + 1000); const second = await request(c, b);
    expect((await service.snapshot(b)).received.map(r => r.currentAmount)).toEqual(['300', '300']);
    const key = randomUUID(), result = await service.all(b, 'accept', key);
    expect(result.results.map(r => [r.requestId, r.amount])).toEqual([[first.requestId, '300'], [second.requestId, '200']]);
    expect(await service.all(b, 'accept', key)).toEqual(result); expect(await balance(b, 'particles_cryo')).toBe(0n);
    const notifications = await db.notification.findMany({ where: { playerId: { in: [a, c] }, typeKey: 'TRADE_ACCEPTED' } });
    expect(notifications).toHaveLength(2);
    expect(notifications.map(n => [n.playerId, (n.payload as { amount: string }).amount]).sort()).toEqual([[a, '300'], [c, '200']].sort());
  }, 30_000);
  it('accept-all continues past an unavailable contact and does not capture later arrivals on retry', async () => {
    const a = await player(), b = await player('pyro'), c = await player();
    const first = await request(a, b, 100n); now = new Date(now.getTime() + 1000); const second = await request(c, b, 100n);
    await db.playerBlock.create({ data: { blockerPlayerId: a, blockedPlayerId: b } });
    const key = randomUUID(), result = await service.all(b, 'accept', key);
    expect(result.results).toEqual([{ requestId: first.requestId, state: 'UNAVAILABLE', amount: '0' }, { requestId: second.requestId, state: 'ACCEPTED', amount: '100' }]);
    const d = await player(); const later = await request(d, b, 100n);
    expect(await service.all(b, 'accept', key)).toEqual(result);
    expect((await db.tradeRequest.findUniqueOrThrow({ where: { id: later.requestId } })).state).toBe('PENDING');
    expect(await db.notification.findMany({ where: { typeKey: 'TRADE_ACCEPTED', playerId: { in: [a, b, c, d] } } })).toMatchObject([{ playerId: c, deduplicationKey: `trade-accepted:${second.requestId}` }]);
  }, 30_000);
  it('refuses, cancels, refuses all idempotently and restricts actions to their owner', async () => {
    const a = await player(), b = await player('pyro'), c = await player(); const r = await request(a, b);
    await expect(service.mutate(c, r.requestId, 'accept', randomUUID())).rejects.toThrow();
    await expect(service.mutate(a, r.requestId, 'refuse', randomUUID())).rejects.toThrow();
    await service.mutate(a, r.requestId, 'cancel', randomUUID()); expect((await stock(a)).reserved).toBe('0');
    await request(a, b); await request(c, b); const key = randomUUID(); const result = await service.all(b, 'refuse', key);
    expect(result.results).toHaveLength(2); expect(await service.all(b, 'refuse', key)).toEqual(result);
    expect((await stock(a)).reserved).toBe('0'); expect((await stock(c)).reserved).toBe('0');
  }, 30_000);
  it('continues independent exchanges after infrastructure failure and retries without duplicating successful children', async () => {
    const a = await player(), b = await player('pyro'), c = await player(), d = await player();
    await request(a, b, 100n); now = new Date(now.getTime() + 1000); await request(c, b, 100n); now = new Date(now.getTime() + 1000); await request(d, b, 100n);
    const failing = new PrismaEconomyService(() => now), transfer = failing.exchangeParticlesWithoutStats.bind(failing); let failed = false;
    vi.spyOn(failing, 'exchangeParticlesWithoutStats').mockImplementation(async (tx, input) => { await transfer(tx, input); if (input.senderId === c && !failed) { failed = true; throw Error('temporary failure'); } });
    const retryService = new TradeService(db, clock, failing), key = randomUUID();
    await expect(retryService.all(b, 'accept', key)).rejects.toThrow('temporary failure');
    expect(await db.tradeExecution.count({ where: { request: { recipientPlayerId: b } } })).toBe(2);
    const result = await retryService.all(b, 'accept', key); expect(result.results.filter(r => r.state === 'ACCEPTED')).toHaveLength(3);
    expect(await db.tradeExecution.count({ where: { request: { recipientPlayerId: b } } })).toBe(3);
    expect(await balance(b, 'particles_cryo')).toBe(200n);
  }, 30_000);
  it('reconciles incoming offers immediately when the recipient reserves their stock in a new outgoing request', async () => {
    const a = await player(), b = await player('pyro'), c = await player();
    await request(a, b, 500n); await request(b, c, 400n);
    expect((await stock(a)).reserved).toBe('100');
    expect(await stock(b, 'particles_cryo')).toEqual({ resourceKey: 'particles_cryo', total: '500', reserved: '400', available: '100' });
  }, 30_000);
  it('central moderation adjustments remain stat-neutral, respect reservations and reconcile received requests', async () => {
    const a = await player(), b = await player('pyro'); await request(a, b, 500n);
    const adjust = (id: string, resourceKey: ResourceKey, delta: bigint) => db.$transaction(async tx => {
      const op = await tx.businessOperation.create({ data: { playerId: id, operationType: 'moderation.resources.adjust-resource', sourceChannel: 'ADMIN' } });
      await economy.adjustWithoutStats(tx, { playerId: id, resourceKey, delta, operationId: op.id, domainKey: 'moderation', causeKey: 'moderation.test-tool', sourceChannel: 'ADMIN' });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    const before = await db.playerEconomyStats.findUniqueOrThrow({ where: { playerId: b } });
    await expect(adjust(a, 'particles_pyro', -1n)).rejects.toThrow();
    await adjust(b, 'particles_cryo', -300n); expect((await stock(a)).reserved).toBe('200');
    await adjust(b, 'particles_cryo', 300n); expect((await stock(a)).reserved).toBe('200');
    expect(await db.playerEconomyStats.findUniqueOrThrow({ where: { playerId: b } })).toEqual(before);
  }, 30_000);
  it('keeps one aggregate, preserves READ/archive on reductions, resurfaces on NEW requests and resolves at zero', async () => {
    const a = await player(), b = await player('pyro'), c = await player(); const first = await request(a, b);
    await db.notification.update({ where: { id: (await notification(b)).id }, data: { state: 'READ', readAt: now } });
    await change(b, -300n); expect((await notification(b)).state).toBe('READ');
    await db.notification.update({ where: { id: (await notification(b)).id }, data: { state: 'ARCHIVED', archivedAt: now } });
    await change(b, -50n); expect((await notification(b)).state).toBe('ARCHIVED');
    await request(c, b, 100n); expect((await notification(b)).state).toBe('UNREAD'); expect((await notification(b)).payload).toEqual({ count: 2 });
    await service.mutate(a, first.requestId, 'cancel', randomUUID()); expect((await notification(b)).payload).toEqual({ count: 1 });
    await service.all(b, 'refuse', randomUUID()); expect((await notification(b)).state).toBe('RESOLVED');
    expect(await db.notification.count({ where: { playerId: b } })).toBe(1);
  }, 30_000);
  it('expires at Paris midnight offline with startup catchup, releases reservations and is idempotent across DST', async () => {
    for (const instant of ['2026-03-29T00:30:00Z', '2026-10-25T00:30:00Z']) {
      now = new Date(instant); const a = await player(), b = await player('pyro'); const r = await request(a, b);
      const row = await db.tradeRequest.findUniqueOrThrow({ where: { id: r.requestId } }); expect(row.expiresAt).toEqual(getNextBusinessResetAt(now));
      now = new Date(row.expiresAt.getTime() + 3 * 86_400_000); await new TradeService(db, clock).expire(); await service.expire();
      expect((await stock(a)).reserved).toBe('0'); expect((await notification(b)).state).toBe('RESOLVED');
      expect((await db.tradeRequest.findUniqueOrThrow({ where: { id: r.requestId } })).state).toBe('EXPIRED');
    }
    now = new Date('2026-11-01T12:00:00Z');
  }, 30_000);
  it('records only the voluntary actor, never reads, passive participants, reductions or expiry', async () => {
    const a = await player(), b = await player('pyro'); const r = await request(a, b);
    const created = await db.playerActivityState.findUniqueOrThrow({ where: { playerId: a } });
    expect(await db.playerActivityState.findUnique({ where: { playerId: b } })).toBeNull();
    now = new Date(now.getTime() + 1000); await service.snapshot(a); await service.partners(a, 'no-match'); await change(b, -300n);
    expect(await db.playerActivityState.findUniqueOrThrow({ where: { playerId: a } })).toEqual(created);
    await service.mutate(b, r.requestId, 'accept', randomUUID());
    expect(await db.playerActivityState.findUniqueOrThrow({ where: { playerId: a } })).toEqual(created);
    expect((await db.playerActivityState.findUniqueOrThrow({ where: { playerId: b } })).lastAppActivityAt).toEqual(now);
  }, 30_000);
});
