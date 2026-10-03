import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { PrismaCurrentPlayerStore } from '../src/infrastructure/database/prisma-current-player-store.js';
import { PrismaPlayerXpService } from '../src/infrastructure/database/prisma-player-xp-service.js';
import { PermanentMissionService } from '../src/application/missions/permanent-mission-service.js';
import { permanentMissionCatalog } from '../src/domain/missions/permanent-mission-catalog.js';
import { resourceKeys } from '../src/domain/economy/resources.js';
import { ArcadeService, type ArcadeMutation } from '../src/application/arcade/arcade-service.js';
import { ArcadeRecords } from '../src/application/arcade/arcade-records.js';
import { createLineGame } from '../src/domain/arcade/line-games.js';
import { createMemory } from '../src/domain/arcade/memory.js';
import { ArcadeRandom } from '../src/domain/arcade/types.js';
import type { ArcadeGame, ArcadeDifficulty, ArcadeState } from '../src/domain/arcade/types.js';
import { Prisma } from '../generated/prisma/client.js';

const isolated = isolatedBatchDatabase(), db = isolated.database;
let now = new Date('2099-10-01T12:00:00Z');
const clock = { now: () => new Date(now) };
const getPlayer = new GetCurrentPlayer(new PrismaCurrentPlayerStore(db));
const xp = new PrismaPlayerXpService();
const service = new ArcadeService(db, getPlayer, clock, xp, () => 42);
const records = new ArcadeRecords(db);
beforeAll(async () => {
  await isolated.setup({ prismaMigrations: true });
  await isolated.admin.query('INSERT INTO characters SELECT * FROM public.characters');
  await db.permanentMissionDefinition.createMany({ data: permanentMissionCatalog.map(row => ({ ...row })), skipDuplicates: true });
}, 180000);
afterAll(() => isolated.cleanup(), 60000);
async function player(initialXp = 0n) {
  const identity = { subject: 'arcade-private-' + randomUUID() };
  const row = await db.player.create({ data: { displayName: 'Arcade fixture ' + randomUUID().slice(0, 6), elementKey: 'hydro',
    webIdentity: { create: { provider: 'supabase', providerSubject: identity.subject } },
    progression: { create: { xp: initialXp, totalMessages: 9n, countedMessages: 3n, lastXpMessageAt: new Date('2099-09-01T12:00:00Z') } },
    economyStats: { create: {} }, resourceBalances: { create: resourceKeys.map(resourceKey => ({ resourceKey, amount: 0n })) } } });
  await db.$transaction(tx => new PermanentMissionService().initializePlayer(tx, row.id, now, true));
  return { id: row.id, identity };
}
type Player = Awaited<ReturnType<typeof player>>;
async function start(p: Player, game: ArcadeGame = 'TIC_TAC_TOE', difficulty: ArcadeDifficulty = 'HARD') {
  now = new Date(now.getTime() + 1000);
  const latest = await db.arcadeSession.findFirst({ where: { playerId: p.id, game }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
  return service.start(p.identity, { game, difficulty, expectedVersion: 0, previousSessionId: latest?.id ?? null, idempotencyKey: randomUUID() });
}
/** Private fixtures stop one legal player move before a natural terminal state. */
async function terminalFixture(p: Player, game: ArcadeGame = 'TIC_TAC_TOE', difficulty: ArcadeDifficulty = 'HARD', outcome: 'WIN' | 'DRAW' | 'LOSS' = 'WIN') {
  const begun = await start(p, game, difficulty), row = await db.arcadeSession.findUniqueOrThrow({ where: { id: begun.session.id } });
  let state: ArcadeState; let position = 2;
  if (game === 'MEMORY') {
    state = row.privateState as unknown as ArcadeState;
    if (state.kind !== 'MEMORY') throw Error('Expected Memory');
    const cards = state.cards;
    const positions = cards.flatMap((face, index) => face?.id === cards[0]!.id ? [index] : []);
    const total = state.layout?.totalPairs ?? 18;
    const playerPairs = outcome === 'WIN' ? total - 1 : outcome === 'DRAW' ? total / 2 - 1 : 0;
    const otherIds = [...new Set(cards.filter(face => face?.id !== cards[0]!.id).map(face => face?.id))];
    state.matched = cards.map(face => face?.id === cards[0]!.id ? null : otherIds.indexOf(face?.id) < playerPairs ? 'PLAYER' : 'AI');
    state.playerPairs = playerPairs; state.aiPairs = total - 1 - playerPairs; state.revealed = [positions[0]!]; state.turn = 'PLAYER'; state.phase = 'PICK'; position = positions[1]!;
  } else {
    state = createLineGame(game, 'PLAYER');
    if (game === 'CONNECT_FOUR') { state.cells.splice(35, 3, 'PLAYER', 'PLAYER', 'PLAYER'); state.cells[41] = 'AI'; state.cells[40] = 'AI'; position = 3; }
    else if (outcome === 'WIN') state.cells = ['PLAYER', 'PLAYER', null, 'AI', 'AI', null, null, null, null];
    else if (outcome === 'DRAW') { state.cells = ['PLAYER', 'AI', 'PLAYER', 'PLAYER', 'AI', 'AI', 'AI', 'PLAYER', null]; position = 8; }
    else { state.cells = ['AI', 'AI', null, 'PLAYER', 'PLAYER', null, null, null, null]; state.turn = 'AI'; }
  }
  await db.arcadeSession.update({ where: { id: row.id }, data: { privateState: state as unknown as Prisma.InputJsonValue, nextActionAt: now } });
  return { sessionId: row.id, input: state.turn === 'AI' ? { kind: 'ADVANCE' as const, expectedVersion: 0, idempotencyKey: randomUUID() }
    : { kind: 'MOVE' as const, position, expectedVersion: 0, idempotencyKey: randomUUID() } };
}
async function finish(p: Player, game?: ArcadeGame, difficulty?: ArcadeDifficulty, outcome?: 'WIN' | 'DRAW' | 'LOSS') {
  const ready = await terminalFixture(p, game, difficulty, outcome);
  return service.act(p.identity, ready.sessionId, ready.input);
}
async function stateSnapshot(playerId: string) {
  return {
    progression: await db.playerProgression.findUniqueOrThrow({ where: { playerId } }),
    balances: await db.playerResourceBalance.findMany({ where: { playerId }, orderBy: { resourceKey: 'asc' } }),
    missions: await db.playerPermanentMissionProgress.findMany({ where: { playerId }, orderBy: { definitionId: 'asc' } }),
    notifications: await db.notification.findMany({ where: { playerId }, orderBy: { id: 'asc' } }),
    movements: await db.resourceMovement.count({ where: { playerId } }),
  };
}
describe('Arcade — fully migrated private PostgreSQL', () => {
  it('deploys all 59 migrations privately with active-session, terminal, RLS and browser-grant guards', async () => {
    expect(isolated.migrationStatus).toContain('up to date');
    const migrations = await isolated.admin.query('SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY migration_name');
    expect(migrations.rows).toHaveLength(59);
    expect(migrations.rows.at(-1).migration_name).toBe('20261003160000_059_add_profile_level_titles');
    const guards = await isolated.admin.query("SELECT relname, relrowsecurity, has_table_privilege('anon', oid, 'SELECT') AS anon_read, has_table_privilege('authenticated', oid, 'SELECT') AS user_read FROM pg_class WHERE relnamespace = $1::regnamespace AND relname = ANY($2::text[])", [isolated.schema, ['arcade_sessions','arcade_receipts','arcade_daily_grants','arcade_stats']]);
    expect(guards.rows).toHaveLength(4); guards.rows.forEach(row => expect(row).toMatchObject({ relrowsecurity: true, anon_read: false, user_read: false }));
    const p = await player(), begun = await start(p);
    const row = await db.arcadeSession.findUniqueOrThrow({ where: { id: begun.session.id } });
    const { id: _id, ...copy } = row;
    await expect(db.arcadeSession.create({ data: { ...copy, privateState: copy.privateState as Prisma.InputJsonValue } })).rejects.toThrow();
    await expect(db.arcadeSession.create({ data: { ...copy, game: 'MEMORY', privateState: copy.privateState as Prisma.InputJsonValue } })).rejects.toThrow();
    await expect(db.arcadeSession.update({ where: { id: row.id }, data: { status: 'FINISHED' } })).rejects.toThrow();
    await expect(db.arcadeSession.update({ where: { id: row.id }, data: { status: 'ABANDONED' } })).rejects.toThrow();
    await expect(db.arcadeSession.update({ where: { id: row.id }, data: { rulesVersion: 3 } })).rejects.toThrow();
    await expect(db.arcadeSession.update({ where: { id: row.id }, data: { rulesVersion: 1, scoringVersion: 2 } })).rejects.toThrow();
  }, 30000);
  it('abandons exactly once with no rewards, quota or aggregate effects and releases every game', async () => {
    const p = await player(3029n), outsider = await player(), begun = await start(p, 'MEMORY', 'MEDIUM');
    const before = await stateSnapshot(p.id), spy = vi.spyOn(xp, 'grant');
    for (const game of ['CONNECT_FOUR', 'TIC_TAC_TOE'] as const) await expect(start(p, game)).rejects.toMatchObject({ code: 'ARCADE_ACTIVE_EXISTS' });
    const input = { kind: 'QUIT' as const, expectedVersion: 0, idempotencyKey: randomUUID() };
    await expect(service.act(outsider.identity, begun.session.id, input)).rejects.toMatchObject({ statusCode: 404 });
    const quit = await service.act(p.identity, begun.session.id, input);
    expect(quit.session).toMatchObject({ status: 'ABANDONED', version: 1, result: null }); expect(quit.award).toBeNull();
    expect(await service.act(p.identity, begun.session.id, input)).toEqual({ ...quit, alreadyProcessed: true });
    await expect(service.act(p.identity, begun.session.id, { ...input, expectedVersion: 1, idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'ARCADE_FINISHED' });
    await expect(service.act(p.identity, begun.session.id, { kind: 'MOVE', position: 0, expectedVersion: 1, idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'ARCADE_FINISHED' });
    expect(spy).not.toHaveBeenCalled(); spy.mockRestore();
    expect(await stateSnapshot(p.id)).toEqual(before);
    expect(await db.arcadeStat.count({ where: { playerId: p.id } })).toBe(0);
    expect(await db.arcadeDailyGrant.count({ where: { playerId: p.id } })).toBe(0);
    expect(await db.arcadeReceipt.count({ where: { playerId: p.id } })).toBe(2);
    const row = await db.arcadeSession.findUniqueOrThrow({ where: { id: begun.session.id } });
    expect(row).toMatchObject({ outcome: null, performancePoints: null, xpAwarded: null, businessDate: null, finishOperationId: null });
    expect(row.finishedAt).not.toBeNull();
    for (const data of [{ xpAwarded: 0 }, { performancePoints: 1 }, { outcome: 'LOSS' }, { businessDate: now }, { finishOperationId: quit.operationId }]) {
      await expect(db.arcadeSession.update({ where: { id: row.id }, data })).rejects.toThrow();
    }
    const next = await start(p, 'MEMORY', 'EASY'); expect(next.session.id).not.toBe(row.id);
    await service.act(p.identity, next.session.id, { ...input, idempotencyKey: randomUUID() });
    expect((await start(p, 'CONNECT_FOUR')).session.status).toBe('ACTIVE');
  }, 60000);
  it('serializes concurrent starts of different games into one global ACTIVE session', async () => {
    const p = await player();
    const results = await Promise.allSettled((['MEMORY', 'CONNECT_FOUR'] as const).map(game => service.start(p.identity, { game, difficulty: 'MEDIUM', expectedVersion: 0, previousSessionId: null, idempotencyKey: randomUUID() })));
    expect(results.filter(value => value.status === 'fulfilled')).toHaveLength(1);
    expect(results.find(value => value.status === 'rejected')).toMatchObject({ reason: { code: 'ARCADE_ACTIVE_EXISTS' } });
    expect(await db.arcadeSession.count({ where: { playerId: p.id, status: 'ACTIVE' } })).toBe(1);
  }, 30000);
  it('fails the 058 unique-index change without rewriting conflicting historical sessions', async () => {
    const p = await player(), begun = await start(p);
    // Simulate the prior physical index inside a transaction confined to this private schema.
    await isolated.admin.query('BEGIN');
    try {
      await isolated.admin.query('DROP INDEX arcade_sessions_one_active_idx');
      await isolated.admin.query("CREATE UNIQUE INDEX arcade_sessions_one_active_idx ON arcade_sessions(player_id, game) WHERE status = 'ACTIVE'");
      await isolated.admin.query("INSERT INTO arcade_sessions (player_id, game, difficulty, first_side, private_state, random_state, banter_id, next_action_at) SELECT player_id, 'CONNECT_FOUR', difficulty, first_side, private_state, random_state, banter_id, next_action_at FROM arcade_sessions WHERE id = $1", [begun.session.id]);
      const sql = readFileSync(new URL('../prisma/migrations/20261001120000_058_harden_arcade_session_lifecycle/migration.sql', import.meta.url), 'utf8').replace(/^BEGIN;|^COMMIT;/gm, '');
      await expect(isolated.admin.query(sql)).rejects.toMatchObject({ code: '23505' });
    } finally { await isolated.admin.query('ROLLBACK'); }
    expect((await service.session(p.identity, begun.session.id))).toEqual(begun.session);
    expect(await db.arcadeSession.count({ where: { playerId: p.id } })).toBe(1);
    const definition = await isolated.admin.query('SELECT indexdef FROM pg_indexes WHERE schemaname = $1 AND indexname = $2', [isolated.schema, 'arcade_sessions_one_active_idx']);
    expect(definition.rows[0].indexdef).toContain('(player_id)');
  }, 30000);
  it('projects untouched V1 Memory and ranks V1/V2 ties by points with the best-session denominator', async () => {
    const old = await player(), modern = await player();
    const begun = await start(old, 'MEMORY', 'MEDIUM');
    const catalog = Array.from({ length: 18 }, (_, i) => ({ id: `historical-${i}`, name: `Historical ${i}`, elementKey: 'hydro', assetPaths: ['/historical.png'] }));
    const state = createMemory(catalog, 'PLAYER', new ArcadeRandom(4), 'MEDIUM', 1);
    state.playerPairs = 1; state.aiPairs = 16; state.revealed = [0];
    const pair = state.cards.findIndex((face, i) => i > 0 && face?.id === state.cards[0]!.id);
    state.matched = state.cards.map((_, i) => i === 0 || i === pair ? null : 'AI');
    const jsonState = JSON.parse(JSON.stringify(state));
    await db.arcadeSession.update({ where: { id: begun.session.id }, data: { rulesVersion: 1, scoringVersion: 1, privateState: jsonState } });
    expect((await service.session(old.identity, begun.session.id)).board).toMatchObject({ columns: 6, totalPairs: 18 });
    expect((await db.arcadeSession.findUniqueOrThrow({ where: { id: begun.session.id } })).privateState).toEqual(jsonState);
    const historical = await service.act(old.identity, begun.session.id, { kind: 'MOVE', position: pair, expectedVersion: 0, idempotencyKey: randomUUID() });
    expect(historical.session.result).toMatchObject({ performancePoints: 1, xpAwarded: 1 });
    expect(historical.records[0]?.best).toMatchObject({ points: 1, pairs: 2, totalPairs: 18 });
    await finish(modern, 'MEMORY', 'MEDIUM', 'LOSS');
    const ranking = await records.list(old.id, { kind: 'GLOBAL', game: 'MEMORY', difficulty: 'MEDIUM', page: 1 });
    const entries = ranking.entries.filter(row => [old.id, modern.id].includes(row.playerId));
    expect(entries).toHaveLength(2); expect(entries[0]!.rank).toBe(entries[1]!.rank);
    expect(entries.map(row => row.playerId)).toEqual([old.id, modern.id].sort());
    expect(entries.find(row => row.playerId === old.id)).toMatchObject({ pairs: 2, totalPairs: 18 });
    expect(entries.find(row => row.playerId === modern.id)).toMatchObject({ pairs: 1, totalPairs: 12 });
    const finished = await db.arcadeSession.findUniqueOrThrow({ where: { id: begun.session.id } });
    const samePoints = await finish(old, 'MEMORY', 'MEDIUM', 'LOSS');
    expect(samePoints.records[0]?.best).toMatchObject({ points: 1, pairs: 2, totalPairs: 18 });
    expect(await db.arcadeSession.findUniqueOrThrow({ where: { id: begun.session.id } })).toEqual(finished);
  }, 60000);
  it('starts without consuming a quota, resumes exactly, locks difficulty, rejects outsiders and duplicate starts', async () => {
    const p = await player(), other = await player();
    const key = randomUUID(), input = { game: 'MEMORY' as const, difficulty: 'MEDIUM' as const, expectedVersion: 0 as const, previousSessionId: null, idempotencyKey: key };
    const begun = await service.start(p.identity, input);
    expect((await service.overview(p.identity)).sessions[0]).toEqual(begun.session);
    expect((await service.session(p.identity, begun.session.id))).toEqual(begun.session);
    expect((await service.start(p.identity, input)).session).toEqual(begun.session);
    await expect(service.start(p.identity, { ...input, difficulty: 'EASY' })).rejects.toMatchObject({ code: 'ARCADE_IDEMPOTENCY_CONFLICT' });
    await expect(service.start(p.identity, { ...input, idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'ARCADE_ACTIVE_EXISTS' });
    await expect(service.session(other.identity, begun.session.id)).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.act(other.identity, begun.session.id, { kind: 'MOVE', position: 0, expectedVersion: 0, idempotencyKey: randomUUID() })).rejects.toMatchObject({ statusCode: 404 });
    expect(await db.arcadeDailyGrant.count({ where: { playerId: p.id } })).toBe(0);
    expect((await db.playerProgression.findUniqueOrThrow({ where: { playerId: p.id } })).xp).toBe(0n);
    const receipt = await db.arcadeReceipt.findFirstOrThrow({ where: { playerId: p.id } });
    expect(JSON.stringify(receipt.response)).not.toMatch(/privateState|observations|randomState|assetPaths|portrait|seed/);
    const privateRow = await db.arcadeSession.findUniqueOrThrow({ where: { id: begun.session.id } });
    expect((privateRow.privateState as unknown as { cards: unknown[] }).cards).toHaveLength(25);
    const frozen = privateRow.privateState as unknown as { cards: { id: string; name: string }[] };
    const original = await db.character.findUniqueOrThrow({ where: { id: frozen.cards[0]!.id } });
    await db.character.update({ where: { id: original.id }, data: { name: 'Private changed catalog', isActive: false } });
    expect((await db.arcadeSession.findUniqueOrThrow({ where: { id: begun.session.id } })).privateState).toEqual(privateRow.privateState);
    await db.character.update({ where: { id: original.id }, data: { name: original.name, isActive: original.isActive } });
  }, 30000);
  it('does not advance the AI twice on retry and refuses stale/illegal moves without changing the session', async () => {
    const p = await player(), begun = await start(p, 'MEMORY');
    const row = await db.arcadeSession.findUniqueOrThrow({ where: { id: begun.session.id } });
    const privateState = row.privateState as unknown as ArcadeState; privateState.turn = 'AI';
    await db.arcadeSession.update({ where: { id: row.id }, data: { privateState: privateState as unknown as Prisma.InputJsonValue } });
    const action = { kind: 'ADVANCE' as const, expectedVersion: 0, idempotencyKey: randomUUID() };
    const first = await service.act(p.identity, row.id, action);
    const replay = await service.act(p.identity, row.id, action);
    expect(replay).toEqual({ ...first, alreadyProcessed: true });
    expect(first.session.board.kind === 'MEMORY' && first.session.board.cards.filter(card => card.status === 'VISIBLE')).toHaveLength(1);
    await expect(service.act(p.identity, row.id, { ...action, idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'ARCADE_STALE_VERSION' });
    await expect(service.act(p.identity, row.id, { kind: 'MOVE', position: 2, expectedVersion: 1, idempotencyKey: randomUUID() })).rejects.toThrow();
    expect((await service.session(p.identity, row.id)).version).toBe(1);
  }, 30000);
  it('credits at most 30 XP across games, consumes losing/drawn games, and gives free games only score', async () => {
    const p = await player(29n), spy = vi.spyOn(xp, 'grant');
    const first = await finish(p);
    expect(first.session.result).toMatchObject({ performancePoints: 10, scoreAwarded: 10, xpAwarded: 10 });
    expect(first.award).toMatchObject({ levelsReached: [1], rewards: [{ resourceKey: 'primogems', amount: '800' }, { resourceKey: 'moras', amount: '10000' }] });
    const beforeFree = await stateSnapshot(p.id), calls = spy.mock.calls.length;
    const free = await finish(p, 'TIC_TAC_TOE', 'EASY', 'DRAW');
    expect(free.session.result).toMatchObject({ scoreAwarded: 3, xpAwarded: 0 });
    expect(free.award).toBeNull(); expect(spy).toHaveBeenCalledTimes(calls);
    expect(await stateSnapshot(p.id)).toEqual(beforeFree);
    expect(free.scores.TIC_TAC_TOE).toBe('13');
    await finish(p, 'CONNECT_FOUR'); const all = await finish(p, 'MEMORY');
    expect(all.daily.reduce((sum, row) => sum + row.xpAwarded, 0)).toBe(30); expect(all.totalScore).toBe('33');
    expect((await db.playerProgression.findUniqueOrThrow({ where: { playerId: p.id } })).xp).toBe(59n);
    const loser = await player(); const lost = await finish(loser, 'MEMORY', 'MEDIUM', 'LOSS');
    expect(lost.session.result).toMatchObject({ outcome: 'LOSS', xpAwarded: 1 });
    expect((await finish(loser, 'MEMORY', 'HARD')).session.result?.xpAwarded).toBe(0);
    const drawPlayer = await player(); expect((await finish(drawPlayer, 'TIC_TAC_TOE', 'MEDIUM', 'DRAW')).session.result?.xpAwarded).toBe(5);
    spy.mockRestore();
  }, 60000);
  it('uses the finish date in Paris and freezes it for a replay after midnight', async () => {
    const p = await player();
    now = new Date('2099-10-24T21:59:55Z'); // Still summer time: midnight is 22:00 UTC.
    const ready = await terminalFixture(p);
    now = new Date('2099-10-24T22:00:05Z');
    const final = await service.act(p.identity, ready.sessionId, ready.input);
    expect(final.session.result?.businessDate).toBe('2099-10-25');
    now = new Date('2099-10-26T12:00:00Z');
    expect((await service.act(p.identity, ready.sessionId, ready.input)).session.result).toEqual(final.session.result);
    expect(await db.arcadeDailyGrant.count({ where: { playerId: p.id } })).toBe(1);
  }, 30000);
  it('serializes two tabs, rejects changed keys and rolls back terminal score, quota, XP and resources together', async () => {
    const p = await player(29n), ready = await terminalFixture(p);
    const concurrent = await Promise.allSettled([service.act(p.identity, ready.sessionId, ready.input), service.act(p.identity, ready.sessionId, { ...ready.input, idempotencyKey: randomUUID() })]);
    expect(concurrent.filter(row => row.status === 'fulfilled')).toHaveLength(1);
    expect(await db.arcadeDailyGrant.count({ where: { playerId: p.id } })).toBe(1);
    expect((await db.arcadeStat.findMany({ where: { playerId: p.id } }))[0]?.score).toBe(10n);
    const winner = concurrent.find(row => row.status === 'fulfilled') as PromiseFulfilledResult<ArcadeMutation>;
    const winningReceipt = await db.arcadeReceipt.findUniqueOrThrow({ where: { operationId: winner.value.operationId } });
    await expect(service.act(p.identity, ready.sessionId, { kind: 'MOVE', position: 8, expectedVersion: 0, idempotencyKey: winningReceipt.idempotencyKey })).rejects.toMatchObject({ code: 'ARCADE_IDEMPOTENCY_CONFLICT' });
    const rollbackPlayer = await player(29n), rollback = await terminalFixture(rollbackPlayer), before = await stateSnapshot(rollbackPlayer.id);
    await isolated.admin.query("CREATE FUNCTION arcade_test_fail_terminal() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.status = 'FINISHED' THEN RAISE EXCEPTION 'private terminal failure'; END IF; RETURN NEW; END $$");
    await isolated.admin.query('CREATE TRIGGER arcade_test_fail_terminal BEFORE UPDATE ON arcade_sessions FOR EACH ROW EXECUTE FUNCTION arcade_test_fail_terminal()');
    try { await expect(service.act(rollbackPlayer.identity, rollback.sessionId, rollback.input)).rejects.toThrow(); }
    finally { await isolated.admin.query('DROP TRIGGER arcade_test_fail_terminal ON arcade_sessions'); await isolated.admin.query('DROP FUNCTION arcade_test_fail_terminal()'); }
    expect(await stateSnapshot(rollbackPlayer.id)).toEqual(before);
    expect(await db.arcadeStat.count({ where: { playerId: rollbackPlayer.id } })).toBe(0);
    expect(await db.arcadeDailyGrant.count({ where: { playerId: rollbackPlayer.id } })).toBe(0);
    expect(await db.arcadeReceipt.count({ where: { playerId: rollbackPlayer.id } })).toBe(1);
    expect((await service.session(rollbackPlayer.identity, rollback.sessionId))).toMatchObject({ version: 0, status: 'ACTIVE', result: null });
    expect((await service.act(rollbackPlayer.identity, rollback.sessionId, rollback.input)).session.result?.xpAwarded).toBe(10);
  }, 60000);
  it('keeps level 100 overflow and normal Mission notifications through the XP owner', async () => {
    const p = await player(2999n);
    await db.playerPermanentMissionState.update({ where: { playerId: p.id }, data: { zUnlockedAt: now } });
    await db.playerPermanentMissionProgress.updateMany({ where: { playerId: p.id, definition: { rank: 'Z' } }, data: { status: 'ACTIVE', startedAt: now } });
    const finish100 = await finish(p);
    expect(finish100.award?.levelsReached).toEqual([100]);
    const notifications = await db.notification.findMany({ where: { playerId: p.id } });
    expect(notifications.length).toBeGreaterThan(0);
    expect(notifications.some(row => row.domainKey === 'missions')).toBe(true);
    expect(notifications.filter(row => row.domainKey === 'appearance')).toMatchObject([{ typeKey: 'COSMETIC_UNLOCKED' }]);
    expect(notifications.every(row => row.domainKey === 'missions' || row.domainKey === 'appearance')).toBe(true);
    await db.playerProgression.update({ where: { playerId: p.id }, data: { xp: 3029n } });
    const overflow = await finish(p, 'CONNECT_FOUR');
    expect(overflow.award).toMatchObject({ levelsReached: [], overflowRewardsGranted: 1 });
    expect(overflow.award?.rewards).toEqual(expect.arrayContaining([{ resourceKey: 'primogems', amount: '800' }, { resourceKey: 'moras', amount: '10000' }, { resourceKey: 'particles_hydro', amount: '80' }]));
    const progression = await db.playerProgression.findUniqueOrThrow({ where: { playerId: p.id } });
    expect(progression).toMatchObject({ totalMessages: 9n, countedMessages: 3n, lastXpMessageAt: new Date('2099-09-01T12:00:00Z') });
  }, 60000);
  it('preserves records, exact large scores, privacy, competition ranks and personal pages among >10 ties', async () => {
    const owner = await player(); await finish(owner);
    const stat = await db.arcadeStat.findFirstOrThrow({ where: { playerId: owner.id } });
    await finish(owner, 'TIC_TAC_TOE', 'HARD', 'DRAW');
    expect((await db.arcadeStat.findFirstOrThrow({ where: { playerId: owner.id } })).bestSessionId).toBe(stat.bestSessionId);
    const huge = 9007199254740993n, tied: Player[] = [];
    await db.arcadeStat.update({ where: { playerId_game_difficulty: { playerId: owner.id, game: 'TIC_TAC_TOE', difficulty: 'HARD' } }, data: { score: huge } });
    for (let index = 0; index < 12; index++) {
      const p = await player(); tied.push(p);
      await db.arcadeStat.create({ data: { ...stat, playerId: p.id, score: huge } });
    }
    const ordered = [owner, ...tied].sort((a, b) => a.id.localeCompare(b.id)), last = ordered.at(-1)!;
    const page = await records.list(last.id, { kind: 'SCORE', game: 'TOTAL', difficulty: 'HARD' });
    expect(page.selfPage).toBe(2); expect(page.page).toBe(2); expect(page.entries.find(row => row.isSelf)).toMatchObject({ rank: 1, position: 13, value: huge.toString() });
    expect((await records.list(last.id, { kind: 'SCORE', game: 'TOTAL', difficulty: 'HARD', page: 1 })).entries).toHaveLength(10);
    await db.privacySetting.create({ data: { playerId: last.id, categoryKey: 'GENERAL_STATISTICS', level: 'PRIVATE' } });
    expect((await records.list(last.id, { kind: 'SCORE', game: 'TOTAL', difficulty: 'HARD' })).selfStatus).toBe('NOT_PUBLIC');
    const global = await records.list(owner.id, { kind: 'GLOBAL', game: 'TIC_TAC_TOE', difficulty: 'HARD' });
    expect(global.entries.filter(row => row.playerId === owner.id).length).toBeLessThanOrEqual(1);
    expect(JSON.stringify(global)).not.toMatch(/subject|privateState|receipt|providerSubject|email/);
    const personal = await service.overview(owner.identity); expect(personal.totalScore).toBe(huge.toString());
    expect(personal.totalScore).toBe(Object.values(personal.scores).reduce((sum, value) => sum + BigInt(value), 0n).toString());
    const podium = ordered.filter(p => p.id !== last.id).slice(0, 3);
    for (const [index, p] of podium.entries()) await db.arcadeStat.create({ data: { ...stat, playerId: p.id, game: 'CONNECT_FOUR', score: index === 2 ? 90n : 100n } });
    const ranks = await records.list(podium[0]!.id, { kind: 'SCORE', game: 'CONNECT_FOUR', difficulty: 'HARD', page: 1 });
    expect(ranks.entries.slice(0, 3).map(row => row.rank)).toEqual([1, 1, 3]);
  }, 60000);
});
