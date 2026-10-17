import { randomUUID, randomInt } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { applyElementException, elementExceptionKey, type ElementExceptionScope } from '../src/application/maintenance/element-exception.js';
import { PrismaEconomyService } from '../src/infrastructure/database/prisma-economy-service.js';
import { PrismaDailyChallengeStore } from '../src/infrastructure/database/prisma-daily-challenge-store.js';
import { TradeService } from '../src/application/trades/trade-service.js';
import { resourceKeys, type ElementKey } from '../src/domain/economy/resources.js';
import { captureTargetedPlayerRows, type RowGraph } from '../src/application/migration/targeted-player-rows.js';
import { stableElementExceptionProof } from '../src/application/maintenance/element-exception-proof.js';
const fixture = isolatedBatchDatabase(), db = fixture.database;
const trades = new TradeService(db, { now: () => new Date() });
let actorPlayerId: string;
beforeAll(async () => {
  await fixture.setup({ seedPublicCatalog: true, prismaMigrations: true });
  actorPlayerId = await player('electro');
  await db.playerRoleAssignment.create({ data: { playerId: actorPlayerId, role: 'ADMIN' } });
  await db.twitchNativeAuthority.create({ data: { id: 'twitch-commands', operatorPlayerId: actorPlayerId } });
}, 180_000);
afterAll(() => fixture.cleanup(), 60_000);
beforeEach(async () => {
  const op = await db.businessOperation.findFirst({ where: { sourceChannel: 'ADMIN', idempotencyKey: elementExceptionKey } });
  if (op) {
    await db.adminAuditEntry.deleteMany({ where: { operationId: op.id } });
    await db.resourceMovement.deleteMany({ where: { operationId: op.id } });
    await db.businessOperation.delete({ where: { id: op.id } });
  }
});
async function player(elementKey: ElementKey = 'cryo') {
  const p = await db.player.create({ data: { displayName: `Synthetic ${randomUUID().slice(0,8)}`, elementKey } });
  await db.playerResourceBalance.createMany({ data: resourceKeys.map(resourceKey => ({ playerId: p.id, resourceKey, amount: 500n })) });
  await db.playerEconomyStats.create({ data: { playerId: p.id, totalMainElementParticlesEarned: 987n } });
  return p.id;
}
async function scope(cryo = 23n, electro = 77n): Promise<ElementExceptionScope> {
  const playerId = await player();
  const twitchUserId = `9${randomInt(1_000_000_000, 9_999_999_999)}`, login = `synthetic_${randomUUID().slice(0,8)}`;
  await db.twitchIdentity.create({ data: { playerId, twitchUserId, login, displayName: login } });
  for (const [resourceKey, amount] of [['particles_cryo', cryo], ['particles_electro', electro]] as const) await db.playerResourceBalance.update({ where: { playerId_resourceKey: { playerId, resourceKey } }, data: { amount } });
  return { playerId, twitchUserId, login, actorPlayerId };
}
const balances = (playerId: string) => db.playerResourceBalance.findMany({ where: { playerId }, orderBy: { resourceKey: 'asc' } });
const balance = async (playerId: string, resourceKey: string) => (await db.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId, resourceKey } } })).amount;
it.each([[23n, 77n], [0n, 77n], [23n, 0n], [0n, 0n], [17n, 17n]])('swaps exact stocks without historical stats; retry never swaps twice (%s/%s)', async (cryo, electro) => {
  const s = await scope(cryo, electro), before = await balances(s.playerId);
  const stats = await db.playerEconomyStats.findUniqueOrThrow({ where: { playerId: s.playerId } });
  const result = await applyElementException(db, s);
  expect(result).toMatchObject({ alreadyProcessed: false, cryo: cryo.toString(), electro: electro.toString(), sentClosed: 0, receivedClosed: 0 });
  expect(await balance(s.playerId, 'particles_cryo')).toBe(electro);
  expect(await balance(s.playerId, 'particles_electro')).toBe(cryo);
  expect((await db.player.findUniqueOrThrow({ where: { id: s.playerId } })).elementKey).toBe('electro');
  expect(await db.playerEconomyStats.findUniqueOrThrow({ where: { playerId: s.playerId } })).toEqual(stats);
  expect((await balances(s.playerId)).filter(b => !['particles_cryo','particles_electro'].includes(b.resourceKey))).toEqual(before.filter(b => !['particles_cryo','particles_electro'].includes(b.resourceKey)));
  expect(await applyElementException(db, s)).toEqual({ ...result, alreadyProcessed: true });
  expect(await balance(s.playerId, 'particles_electro')).toBe(cryo);
  expect(await db.resourceMovement.count({ where: { operationId: result.operationId } })).toBe(2);
  expect(await db.adminAuditEntry.count({ where: { operationId: result.operationId } })).toBe(1);
});
it('closes only target pending sent/received, preserves accepted and unrelated expired pending requests and peers', async () => {
  const s = await scope(), a = await player('pyro'), b = await player('hydro'), c = await player('geo');
  const executed = await trades.create(s.playerId, a, 2n, randomUUID());
  await trades.mutate(a, executed.requestId, 'accept', randomUUID());
  const sent = await trades.create(s.playerId, b, 3n, randomUUID());
  const received = await trades.create(c, s.playerId, 4n, randomUUID());
  const unrelated = await trades.create(a, b, 5n, randomUUID());
  await db.tradeRequest.update({ where: { id: unrelated.requestId }, data: { createdAt: new Date(0), expiresAt: new Date(1) } });
  const otherBefore = await db.tradeRequest.findUniqueOrThrow({ where: { id: unrelated.requestId } });
  const acceptedBefore = await db.tradeRequest.findUniqueOrThrow({ where: { id: executed.requestId } });
  const peersBefore = await Promise.all([a,b,c].map(balances));
  const targetBefore = await balances(s.playerId);
  let preimage: RowGraph | undefined, operationId = '';
  const r = await applyElementException(db, s, undefined, async tx => {
    const after = await captureTargetedPlayerRows(tx, preimage!.playerIds);
    expect(stableElementExceptionProof(after, s.playerId, operationId)).toEqual(stableElementExceptionProof(preimage!, s.playerId, operationId));
  }, async (tx, ids, op) => { operationId = op; preimage = await captureTargetedPlayerRows(tx, ids); });
  expect(r).toMatchObject({ sentClosed: 1, receivedClosed: 1 });
  expect((await db.tradeRequest.findUniqueOrThrow({ where: { id: sent.requestId } })).state).toBe('CANCELLED');
  expect((await db.tradeRequest.findUniqueOrThrow({ where: { id: received.requestId } })).state).toBe('REFUSED');
  expect(await db.tradeRequest.findUniqueOrThrow({ where: { id: unrelated.requestId } })).toEqual(otherBefore);
  expect(await db.tradeRequest.findUniqueOrThrow({ where: { id: executed.requestId } })).toEqual(acceptedBefore);
  expect(await Promise.all([a,b,c].map(balances))).toEqual(peersBefore);
  expect(await balance(s.playerId, 'particles_electro')).toBe(targetBefore.find(b => b.resourceKey === 'particles_cryo')!.amount);
  expect(await db.tradeRequest.count({ where: { state: 'PENDING', OR: [{ senderPlayerId: s.playerId }, { recipientPlayerId: s.playerId }] } })).toBe(0);
  expect(await db.notification.findUnique({ where: { deduplicationKey: `trades:pending:${s.playerId}` } })).toMatchObject({ state: 'RESOLVED', payload: { count: 0 } });
  expect(await db.notification.findUnique({ where: { deduplicationKey: `trades:pending:${b}` } })).toMatchObject({ payload: { count: 1 } });
}, 60_000);
it.each(['identity', 'status', 'element', 'recovery', 'authority'] as const)('fails closed on %s', async reason => {
  const s = await scope();
  if (reason === 'identity') s.twitchUserId = 'wrong';
  if (reason === 'status') await db.player.update({ where: { id: s.playerId }, data: { status: 'SUSPENDED' } });
  if (reason === 'element') await db.player.update({ where: { id: s.playerId }, data: { elementKey: 'pyro' } });
  if (reason === 'recovery') await db.player.update({ where: { id: s.playerId }, data: { legacyRecovery: { version: 1, operationId: randomUUID(), importId: randomUUID(),
    snapshotHash: 'a'.repeat(64), populationHash: 'b'.repeat(64), backupHash: 'c'.repeat(64), restrictedDomains: ['EVENT'] } } });
  if (reason === 'authority') s.actorPlayerId = await player();
  const before = await balances(s.playerId);
  await expect(applyElementException(db, s)).rejects.toThrow();
  expect(await balances(s.playerId)).toEqual(before);
  expect(await db.businessOperation.count({ where: { idempotencyKey: elementExceptionKey } })).toBe(0);
});
it('rolls back cancellations, notifications, actual swap, element and audits on failure after all writes', async () => {
  const s = await scope(), peer = await player('pyro');
  const sent = await trades.create(s.playerId, peer, 3n, randomUUID());
  const rows = await balances(s.playerId), notification = await db.notification.findUnique({ where: { deduplicationKey: `trades:pending:${peer}` } });
  await expect(applyElementException(db, s, undefined, async () => { throw new Error('synthetic rollback'); })).rejects.toThrow('synthetic rollback');
  expect(await balances(s.playerId)).toEqual(rows);
  expect((await db.player.findUniqueOrThrow({ where: { id: s.playerId } })).elementKey).toBe('cryo');
  expect((await db.tradeRequest.findUniqueOrThrow({ where: { id: sent.requestId } })).state).toBe('PENDING');
  expect(await db.notification.findUnique({ where: { deduplicationKey: `trades:pending:${peer}` } })).toEqual(notification);
  expect(await db.businessOperation.count({ where: { idempotencyKey: elementExceptionKey } })).toBe(0);
});
it('serializes duplicate executions and rejects reuse for another identity', async () => {
  const s = await scope();
  const results = await Promise.all([applyElementException(db, s), applyElementException(db, s)]);
  expect(new Set(results.map(r => r.operationId)).size).toBe(1);
  expect(results.filter(r => !r.alreadyProcessed)).toHaveLength(1);
  await expect(applyElementException(db, await scope())).rejects.toThrow();
});
it('allows a slow private preimage past the ordinary 30s budget and still swaps only once', async () => {
  const s = await scope();
  const r = await applyElementException(db, s, undefined, undefined, async tx => {
    // Mirror two captures: each statement stays below the fixture's 30s SQL
    // deadline while their total exceeds an ordinary interactive transaction.
    await tx.$queryRaw`SELECT 1::int AS ready FROM pg_sleep(16)`;
    await tx.$queryRaw`SELECT 1::int AS ready FROM pg_sleep(16)`;
  });
  expect(r.alreadyProcessed).toBe(false);
  expect(await balance(s.playerId, 'particles_cryo')).toBe(77n);
  expect(await balance(s.playerId, 'particles_electro')).toBe(23n);
  expect((await applyElementException(db, s)).alreadyProcessed).toBe(true);
  expect(await balance(s.playerId, 'particles_electro')).toBe(23n);
}, 60_000);
it('blocks a concurrent accept until cancellation commits; stale conversion fails and fresh Electro conversion succeeds', async () => {
  const s = await scope(), peer = await player('pyro');
  const sent = await trades.create(s.playerId, peer, 3n, randomUUID());
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>(r => { release = r; }), ready = new Promise<void>(r => { entered = r; });
  const applying = applyElementException(db, s, new PrismaEconomyService(), async () => { entered(); await gate; });
  await ready;
  const accepting = trades.mutate(peer, sent.requestId, 'accept', randomUUID());
  const conversions = new PrismaDailyChallengeStore(db);
  const input = { playerId: s.playerId, playerElementKey: 'cryo' as const, businessDate: new Date().toISOString().slice(0,10), now: new Date(), amount: 1n, idempotencyKey: randomUUID() };
  const converting = conversions.convertParticles(input).then(value => ({ value }), error => ({ error }));
  release();
  await applying;
  expect((await accepting).state).toBe('UNAVAILABLE');
  expect(await converting).toMatchObject({ error: { code: 'PLAYER_ELEMENT_CHANGED' } });
  expect(await balance(s.playerId, 'particles_cryo')).toBe(77n);
  expect(await balance(s.playerId, 'particles_electro')).toBe(23n);
  await conversions.convertParticles({ ...input, idempotencyKey: randomUUID(), playerElementKey: 'electro' });
  expect(await balance(s.playerId, 'particles_cryo')).toBe(77n);
  expect(await balance(s.playerId, 'particles_electro')).toBe(22n);
}, 60_000);
