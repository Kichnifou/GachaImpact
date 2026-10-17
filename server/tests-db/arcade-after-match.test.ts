import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { Prisma } from '../generated/prisma/client.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { PrismaCurrentPlayerStore } from '../src/infrastructure/database/prisma-current-player-store.js';
import { ArcadeService } from '../src/application/arcade/arcade-service.js';
import { createArcadeSession } from '../src/application/arcade/arcade-session-factory.js';
import { lockArcadePlayers } from '../src/application/arcade/arcade-transaction.js';
import { readAfterMatch, afterMatchTabKey } from '../src/application/arcade/arcade-after-match-state.js';
import { createLineGame } from '../src/domain/arcade/line-games.js';
import type { ArcadeGame, ArcadeDifficulty, ArcadeState, MemoryState } from '../src/domain/arcade/types.js';
import { resourceKeys } from '../src/domain/economy/resources.js';
const isolated = isolatedBatchDatabase(), db = isolated.database;
let now = new Date('2099-10-17T12:00:00Z');
const clock = { now: () => new Date(now) }, service = new ArcadeService(db, new GetCurrentPlayer(new PrismaCurrentPlayerStore(db)), clock, undefined, () => 42);
beforeAll(() => isolated.setup({ prismaMigrations: true, seedPublicCatalog: true }), 180000);
afterAll(() => isolated.cleanup(), 60000);
async function player() { const subject = randomUUID(), id = randomUUID(); await db.player.create({ data: { id, displayName: 'Après-match privé', elementKey: 'hydro', webIdentity: { create: { provider: 'supabase', providerSubject: subject } }, progression: { create: { xp: 299n } }, economyStats: { create: {} }, resourceBalances: { create: resourceKeys.map(resourceKey => ({ resourceKey, amount: 0n })) } } }); return { id, identity: { subject }, tab: randomUUID() } }
type Player = Awaited<ReturnType<typeof player>>;
const advance = (ms: number) => { now = new Date(+now + ms) };
async function finished(game: ArcadeGame = 'TIC_TAC_TOE', difficulty: ArcadeDifficulty = 'MEDIUM') {
  const a = await player(), b = await player(); advance(1000);
  const source = await db.$transaction(async tx => { await lockArcadePlayers(tx, [a.id, b.id]); return createArcadeSession(tx, a.id, game, difficulty, 42, now, b.id) });
  let state: ArcadeState, move: number;
  if (game === 'MEMORY') {
    const memory = source.privateState as unknown as MemoryState, face = memory.cards.find(Boolean)!, cards = memory.cards.map(card => card ? face : null), remaining = cards.flatMap((card, i) => card ? [i] : []).slice(-2);
    const matched = cards.map((card, i) => card && !remaining.includes(i) ? 'PLAYER' as const : null);
    state = { ...memory, cards, matched, revealed: [remaining[0]!], playerPairs: memory.layout!.totalPairs - 1, aiPairs: 0, phase: 'PICK', turn: 'PLAYER', outcome: null }; move = remaining[1]!;
  } else {
    const line = createLineGame(game, 'PLAYER');
    if (game === 'TIC_TAC_TOE') { line.cells = ['PLAYER', 'PLAYER', null, 'AI', 'AI', null, null, null, null]; move = 2 }
    else { line.cells[35] = 'PLAYER'; line.cells[36] = 'PLAYER'; line.cells[37] = 'PLAYER'; line.cells[28] = 'AI'; line.cells[29] = 'AI'; move = 3 }
    state = line;
  }
  advance(1000); await db.arcadeSession.update({ where: { id: source.id }, data: { privateState: state as unknown as Prisma.InputJsonValue, nextActionAt: now } });
  const result = await service.act(a.identity, source.id, { kind: 'MOVE', position: move, expectedVersion: source.version, idempotencyKey: randomUUID() });
  expect(result.session.status).toBe('FINISHED'); expect(result.session.afterMatch?.status).toBe('WAITING');
  return { a, b, id: source.id, result: result.session.result, game, difficulty };
}
const presence = (p: Player, id: string, sequence = 1, visible = true, tabKey = p.tab) => service.afterMatchPresence(p.identity, id, { tabKey, sequence, visible });
const input = (p: Player, kind: 'REPLAY' | 'SOLO', sequence = 2) => ({ kind, tabKey: p.tab, sequence, idempotencyKey: randomUUID() });
const activeFor = (ids: string[]) => db.arcadeSession.findMany({ where: { status: 'ACTIVE', OR: [{ playerId: { in: ids } }, { opponentPlayerId: { in: ids } }] } });
async function assertNoNewEconomy(ids: string[]) {
  for (const id of ids) expect(await db.playerProgression.findUniqueOrThrow({ where: { playerId: id } })).toMatchObject({ xp: 299n });
  expect(await db.arcadeDailyGrant.count({ where: { playerId: { in: ids } } })).toBe(0);
  expect(await db.resourceMovement.count({ where: { playerId: { in: ids } } })).toBe(0);
  expect(await db.notification.count({ where: { playerId: { in: ids } } })).toBe(0);
}
describe('Arcade after-match private PostgreSQL / migration088', () => {
  it.each((['MEMORY', 'CONNECT_FOUR', 'TIC_TAC_TOE'] as const).flatMap(game => (['EASY', 'MEDIUM', 'HARD'] as const).map(difficulty => ({ game, difficulty }))))('requires both requests and starts a fresh $game $difficulty PvP without XP', async ({ game, difficulty }) => {
    const f = await finished(game, difficulty); await presence(f.a, f.id); await presence(f.b, f.id);
    const request = input(f.a, 'REPLAY'), first = await service.requestAfterMatch(f.a.identity, f.id, request);
    expect(first.session).toMatchObject({ id: f.id, status: 'FINISHED', afterMatch: { status: 'WAITING', requested: true, opponentRequested: false } });
    expect(await activeFor([f.a.id, f.b.id])).toHaveLength(0);
    expect((await service.session(f.b.identity, f.id)).afterMatch).toMatchObject({ requested: false, opponentRequested: true });
    const second = await service.requestAfterMatch(f.b.identity, f.id, input(f.b, 'REPLAY'));
    expect(second.session).toMatchObject({ mode: 'MULTIPLAYER', status: 'ACTIVE', game, difficulty, result: null }); expect(second.session.id).not.toBe(f.id);
    expect(['PLAYER', 'AI']).toContain(second.session.firstSide); expect(second.session.board.outcome).toBeNull();
    expect(await activeFor([f.a.id, f.b.id])).toHaveLength(1);
    const replay = await service.requestAfterMatch(f.a.identity, f.id, request); expect(replay).toEqual({ ...first, alreadyProcessed: true });
    expect((await presence(f.a, f.id, 3)).nextSession?.id).toBe(second.session.id);
    expect((await service.session(f.a.identity, f.id)).result).toEqual(f.result);
    expect(await db.arcadeStat.count({ where: { playerId: { in: [f.a.id, f.b.id] }, played: 1n } })).toBe(2);
    await assertNoNewEconomy([f.a.id, f.b.id]);
  });
  it('deduplicates simultaneous same-key requests and concurrent second consents', async () => {
    const f = await finished(), a = input(f.a, 'REPLAY');
    const [one, duplicate] = await Promise.all([service.requestAfterMatch(f.a.identity, f.id, a), service.requestAfterMatch(f.a.identity, f.id, a)]);
    expect(one.operationId).toBe(duplicate.operationId);
    const [b, repeat] = await Promise.all([service.requestAfterMatch(f.b.identity, f.id, input(f.b, 'REPLAY')), service.requestAfterMatch(f.b.identity, f.id, input(f.b, 'REPLAY', 3))]);
    expect(b.session.id).toBe(repeat.session.id); expect(await activeFor([f.a.id, f.b.id])).toHaveLength(1);
    await assertNoNewEconomy([f.a.id, f.b.id]);
  });
  it.each([false, true])('solo cancels both sides and keeps context, requested=%s; each can choose solo', async requested => {
    const f = await finished('TIC_TAC_TOE', 'HARD'); if (requested) await service.requestAfterMatch(f.a.identity, f.id, input(f.a, 'REPLAY'));
    const request = input(f.a, 'SOLO', 3), a = await service.requestAfterMatch(f.a.identity, f.id, request);
    expect(a.session).toMatchObject({ mode: 'SOLO', game: f.game, difficulty: f.difficulty, opponent: null, result: null });
    expect((await service.requestAfterMatch(f.a.identity, f.id, request)).session).toEqual(a.session);
    expect((await presence(f.b, f.id)).afterMatch?.status).toBe('CANCELLED');
    const b = await service.requestAfterMatch(f.b.identity, f.id, input(f.b, 'SOLO')); expect(b.session.mode).toBe('SOLO'); expect(b.session.id).not.toBe(a.session.id);
    expect(await activeFor([f.a.id, f.b.id])).toHaveLength(2);
    expect((await service.session(f.a.identity, f.id)).result).toEqual(f.result); await assertNoNewEconomy([f.a.id, f.b.id]);
  });
  it('resolves Replay versus Solo atomically with at most one active session per player', async () => {
    const f = await finished(); await service.requestAfterMatch(f.a.identity, f.id, input(f.a, 'REPLAY'));
    const results = await Promise.allSettled([service.requestAfterMatch(f.b.identity, f.id, input(f.b, 'REPLAY')), service.requestAfterMatch(f.a.identity, f.id, input(f.a, 'SOLO', 3))]);
    expect(results.some(r => r.status === 'fulfilled')).toBe(true);
    const rows = await activeFor([f.a.id, f.b.id]);
    for (const p of [f.a, f.b]) expect(rows.filter(r => r.playerId === p.id || r.opponentPlayerId === p.id).length).toBeLessThanOrEqual(1);
    expect(rows.some(r => r.mode === 'MULTIPLAYER') && rows.some(r => r.mode === 'SOLO')).toBe(false);
    await assertNoNewEconomy([f.a.id, f.b.id]);
  });
  it('allows a brief hidden/reloaded tab to return within five seconds and ignores late sequence packets', async () => {
    const f = await finished(); await presence(f.a, f.id); await presence(f.b, f.id);
    await presence(f.a, f.id, 4, false); advance(4000); await presence(f.b, f.id, 2);
    await presence(f.a, f.id, 3, true);
    const stored = readAfterMatch((await db.arcadeSession.findUniqueOrThrow({ where: { id: f.id } })).afterMatch)!;
    expect(stored.tabs[afterMatchTabKey(f.a.id, f.a.tab)]?.visible).toBe(false);
    expect((await presence(f.a, f.id, 1, true, randomUUID())).afterMatch?.status).toBe('WAITING');
  });
  it('expires network/closed/hidden absence after five seconds and never revives on reconnect or Replay', async () => {
    const f = await finished(); await presence(f.a, f.id); await presence(f.b, f.id); await service.requestAfterMatch(f.a.identity, f.id, input(f.a, 'REPLAY'));
    advance(4000); await presence(f.b, f.id, 2); advance(1001);
    expect((await service.session(f.b.identity, f.id)).afterMatch?.status).toBe('CANCELLED');
    expect((await service.overview(f.b.identity)).sessions.find(r => r.id === f.id)?.afterMatch?.status).toBe('CANCELLED');
    expect((await presence(f.a, f.id, 1, true, randomUUID())).afterMatch?.status).toBe('CANCELLED');
    expect((await service.requestAfterMatch(f.b.identity, f.id, input(f.b, 'REPLAY', 3))).session.afterMatch?.status).toBe('CANCELLED');
    expect(await activeFor([f.a.id, f.b.id])).toHaveLength(0); expect((await service.session(f.a.identity, f.id)).result).toEqual(f.result);
  });
  it('keeps one visible tab sufficient without allowing another hidden tab to cancel it', async () => {
    const f = await finished(), second = randomUUID(); await presence(f.a, f.id); await presence(f.a, f.id, 1, true, second); await presence(f.b, f.id);
    await presence(f.a, f.id, 2, false); advance(4000); await presence(f.a, f.id, 2, true, second); await presence(f.b, f.id, 2); advance(4000);
    expect((await presence(f.a, f.id, 3, true, second)).afterMatch?.status).toBe('WAITING'); await presence(f.b, f.id, 3);
    await presence(f.a, f.id, 4, false, second); advance(4000); await presence(f.b, f.id, 4); advance(1001);
    expect((await presence(f.b, f.id, 5)).afterMatch?.status).toBe('CANCELLED');
  });
  it('rejects stale eligibility exactly during a second consent and never mutates an abandoned/foreign session', async () => {
    const f = await finished(); await service.requestAfterMatch(f.a.identity, f.id, input(f.a, 'REPLAY')); advance(5001);
    expect((await service.requestAfterMatch(f.b.identity, f.id, input(f.b, 'REPLAY'))).session.afterMatch?.status).toBe('CANCELLED');
    expect(await activeFor([f.a.id, f.b.id])).toHaveLength(0);
    const outsider = await player(); await expect(presence(outsider, f.id)).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.requestAfterMatch(outsider.identity, f.id, input(outsider, 'REPLAY'))).rejects.toMatchObject({ statusCode: 404 });
    const row = await db.$transaction(tx => createArcadeSession(tx, f.a.id, 'TIC_TAC_TOE', 'EASY', 42, now, f.b.id));
    await service.act(f.a.identity, row.id, { kind: 'QUIT', expectedVersion: 0, idempotencyKey: randomUUID() });
    await expect(service.requestAfterMatch(f.a.identity, row.id, input(f.a, 'REPLAY'))).rejects.toMatchObject({ code: 'ARCADE_AFTER_MATCH_UNAVAILABLE' });
  });
  it.each(['ARCHIVED', 'BLOCKED'])('keeps normal invitations unavailable during a valid after-match and cancels a %s peer', async reason => {
    const f = await finished(), c = await player();
    await expect(db.arcadeSession.update({where:{id:f.id},data:{afterMatch:{}}})).rejects.toThrow();
    await expect(db.arcadeSession.update({where:{id:f.id},data:{afterMatch:{status:'CANCELLED'}}})).rejects.toThrow();
    await expect(service.invite(f.a.identity, { opponentPlayerId: c.id, game: 'MEMORY', difficulty: 'EASY', friendsOnly: false, idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'ARCADE_OPPONENT_UNAVAILABLE' });
    if (reason === 'ARCHIVED') await db.player.update({ where: { id: f.b.id }, data: { status: 'ARCHIVED' } });
    else await db.playerBlock.create({data:{blockerPlayerId:f.a.id,blockedPlayerId:f.b.id}});
    expect((await presence(f.a, f.id)).afterMatch?.status).toBe('CANCELLED'); expect(await activeFor([f.a.id, f.b.id])).toHaveLength(0);
  });
});
