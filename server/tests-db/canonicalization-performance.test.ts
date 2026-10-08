import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { permanentMissionCatalog } from '../src/domain/missions/permanent-mission-catalog.js';
import { assessPlayerCanonicalizationSafety, type CanonicalizationMetric } from '../src/application/twitch/player-canonicalization-safety.js';
import { assessMaterializedCanonicalizationSafety } from './canonicalization-materialized-reference.js';
import { canonicalizationFixture } from './canonicalization-fixture.js';
import { observeCanonicalization, explainCanonicalization } from './canonicalization-observer.js';
import { canonicalizationBranchLimit } from '../src/application/twitch/canonicalization-graph.js';
import { TwitchAccountLink } from '../src/application/twitch/twitch-account-link.js';

const fixture = isolatedBatchDatabase(), db = fixture.database;
beforeAll(async () => {
  await fixture.setup({ prismaMigrations: true });
  await db.permanentMissionDefinition.createMany({ data: permanentMissionCatalog.map(entry => ({ ...entry })), skipDuplicates: true });
}, 180_000);
afterAll(async () => {
  await fixture.cleanup();
  const pool = fixture.poolSnapshot();
  expect(pool.total + pool.idle + pool.waiting).toBe(0); expect(pool.opened).toBe(pool.closed);
}, 60_000);

it.each([1, 4, 10])('compares every row, edge, safety and fingerprint at scale %i under the unchanged candidate deadlines', async scale => {
  const f = await canonicalizationFixture(db, scale);
  await db.$transaction(async tx => {
    // Diagnostic oracle only: bounded extra time to finish the old full-row work.
    // The candidate is measured separately with the production preflight 5s bound.
    await tx.$executeRaw`SET LOCAL statement_timeout='120000ms'`;
    const old = observeCanonicalization(tx), oldMetrics: CanonicalizationMetric[] = [];
    const expected = await assessMaterializedCanonicalizationSafety(old.tx, f.playerId, undefined, metric => oldMetrics.push(metric));
    const metrics: CanonicalizationMetric[] = [], candidate = observeCanonicalization(tx);
    await tx.$executeRaw`SET LOCAL statement_timeout='5000ms'`;
    const actual = await assessPlayerCanonicalizationSafety(candidate.tx, f.playerId, undefined, metric => metrics.push(metric));
    expect(actual).toEqual(expected); expect(candidate.tables()).toEqual(old.tables());
    expect(actual.safety.status).toBe('SAFE');
    expect(Object.keys(candidate.tables()).length).toBe(55);
    expect(metrics.filter(m => m.branches && m.stage !== 'metadata').every(m => m.branches! <= canonicalizationBranchLimit)).toBe(true);
    expect(metrics.find(m => m.stage === 'total')!.durationMs).toBeLessThan(15_000);
    const counts = { tables: Object.keys(candidate.tables()).length, rows: Object.values(candidate.tables()).reduce((n, rows) => n + rows.length, 0), graphBytes: Buffer.byteLength('{'+Object.entries(candidate.tables()).map(([table,rows])=>JSON.stringify(table)+':['+rows.join(',')+']').join(',')+'}') };
    const plans = [];
    if (scale === 1 || scale === 10) {
      await tx.$executeRaw`SET LOCAL statement_timeout='120000ms'`;
      plans.push({ engine: '52b5631', ...await explainCanonicalization(tx, old.queries.find(q => q.stage === 'evidence')!) });
      await tx.$executeRaw`SET LOCAL statement_timeout='5000ms'`;
      for (const query of candidate.queries) plans.push({ engine: 'candidate', ...await explainCanonicalization(tx, query) });
    }
    process.stdout.write('R1055_BENCHMARK ' + JSON.stringify({ scale, counts, oldMetrics, metrics, plans, statements: { old: old.queries.length, candidate: candidate.queries.length }, inputBytes: { old: old.queries.reduce((n, q) => n + Buffer.byteLength(q.args[0] as string), 0), candidate: candidate.queries.reduce((n, q) => n + Buffer.byteLength(q.args[0] as string), 0) } }) + '\n');
  }, { isolationLevel: 'RepeatableRead', timeout: 300_000 });
}, 360_000);

it('keeps the exact result as unrelated population and operation history grow', async () => {
  const f = await canonicalizationFixture(db), metrics: CanonicalizationMetric[][] = [];
  const assess = () => db.$transaction(async tx => {
    await tx.$executeRaw`SET LOCAL statement_timeout='5000ms'`;
    const stages: CanonicalizationMetric[] = []; metrics.push(stages);
    return assessPlayerCanonicalizationSafety(tx, f.playerId, undefined, metric => stages.push(metric));
  }, { isolationLevel: 'RepeatableRead', timeout: 30_000 });
  const before = await assess(), players = Array.from({ length: 250 }, () => randomUUID());
  await db.player.createMany({ data: players.map(id => ({ id, displayName: 'Unrelated synthetic' })) });
  for (const playerId of players) await db.businessOperation.createMany({ data: Array.from({ length: 100 }, () => ({ playerId, operationType: 'fixture.noise', sourceChannel: 'UI', status: 'COMPLETED', completedAt: new Date(), resultSummary: { synthetic: 'fixture'.repeat(128) } })) });
  expect(await assess()).toEqual(before);
  process.stdout.write('R1055_POPULATION ' + JSON.stringify({ addedPlayers: 250, addedOperations: 25_000, metrics }) + '\n');
}, 90_000);

it.each(['WEB', 'TWITCH'] as const)('finishes verified / pending / resolve for two large graphs, preserving the %s winner and archived loser', async choice => {
  const a = await canonicalizationFixture(db), b = await canonicalizationFixture(db, 4);
  await db.webIdentity.delete({ where: { id: b.identity.id } });
  await db.twitchIdentity.create({ data: { playerId: b.playerId, twitchUserId: b.twitchUserId, login: 'fixture', displayName: 'Synthetic' } });
  // Other players/operations are deliberately still present from prior fixtures.
  const link = new TwitchAccountLink(db), elapsed: Record<string, number> = {};
  let start = performance.now();
  expect(await link.verified(a.identity.id, a.playerId, b.twitchUserId, 'fixture', 'Synthetic')).toMatchObject({ resolutionRequired: true });
  elapsed.verified = performance.now() - start; start = performance.now();
  const pending = (await link.pending(a.identity.id))!;
  elapsed.pending = performance.now() - start;
  expect(pending.safety.WEB.status).toBe('SAFE'); expect(pending.safety.TWITCH.status).toBe('SAFE');
  const before = await db.$transaction(async tx => {
    const aGraph = observeCanonicalization(tx), bGraph = observeCanonicalization(tx);
    await assessPlayerCanonicalizationSafety(aGraph.tx, a.playerId); await assessPlayerCanonicalizationSafety(bGraph.tx, b.playerId);
    return [aGraph.tables(), bGraph.tables()];
  }, { isolationLevel: 'RepeatableRead', timeout: 30_000 });
  start = performance.now();
  const winner = choice === 'WEB' ? a.playerId : b.playerId, loser = choice === 'WEB' ? b.playerId : a.playerId;
  expect(await link.resolve(a.identity.id, pending.id, choice, pending.revision)).toMatchObject({ linked: true, playerId: winner });
  elapsed.resolve = performance.now() - start;
  expect((await db.webIdentity.findUniqueOrThrow({ where: { id: a.identity.id } })).playerId).toBe(winner);
  expect((await db.twitchIdentity.findUniqueOrThrow({ where: { twitchUserId: b.twitchUserId } })).playerId).toBe(winner);
  expect(await db.player.findUniqueOrThrow({ where: { id: loser } })).toMatchObject({ status: 'ARCHIVED' });
  await db.$transaction(async tx => {
    for (const [index, id] of [a.playerId, b.playerId].entries()) {
      const after = observeCanonicalization(tx); await assessPlayerCanonicalizationSafety(after.tx, id);
      const { players: _old, ...oldGameplay } = before[index]!;
      const { players: _new, ...newGameplay } = after.tables();
      expect(newGameplay).toEqual(oldGameplay);
    }
  }, { isolationLevel: 'RepeatableRead', timeout: 30_000 });
  expect(Object.values(elapsed).every(ms => ms < 30_000)).toBe(true);
  expect(await link.resolve(a.identity.id, pending.id, choice, pending.revision)).toMatchObject({ linked: true });
  process.stdout.write('R1055_WORKFLOW ' + JSON.stringify({ choice, elapsed }) + '\n');
}, 180_000);

it('fails closed before reading the graph without a stable snapshot', async () => {
  await expect(db.$transaction(tx => assessPlayerCanonicalizationSafety(tx, randomUUID()), { isolationLevel: 'ReadCommitted' })).rejects.toThrow('CANONICALIZATION_STABLE_SNAPSHOT_REQUIRED');
});
