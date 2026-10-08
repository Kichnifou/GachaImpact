import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { Prisma } from '../generated/prisma/client.js';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { bootstrapPlayer } from '../src/infrastructure/database/player-bootstrap.js';
import { permanentMissionCatalog } from '../src/domain/missions/permanent-mission-catalog.js';
import { assessPlayerCanonicalizationSafety } from '../src/application/twitch/player-canonicalization-safety.js';
import { assessBaselineCanonicalizationSafety } from './canonicalization-safety-reference.js';
import { assessMaterializedCanonicalizationSafety } from './canonicalization-materialized-reference.js';
import { observeCanonicalization } from './canonicalization-observer.js';

const fixture = isolatedBatchDatabase(), db = fixture.database;
beforeAll(async () => {
  await fixture.setup({ prismaMigrations: true });
  await db.permanentMissionDefinition.createMany({ data: permanentMissionCatalog.map(entry => ({ ...entry })), skipDuplicates: true });
}, 180_000);
afterAll(async () => {
  await fixture.cleanup(); const pool = fixture.poolSnapshot();
  expect(pool.total + pool.idle + pool.waiting).toBe(0); expect(pool.opened).toBe(pool.closed);
}, 60_000);
const player = () => db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Synthetic safety' }));
async function equivalent(tx: Prisma.TransactionClient, playerId: string) {
  const candidate = observeCanonicalization(tx), frozen = observeCanonicalization(tx), original = observeCanonicalization(tx);
  const actual = await assessPlayerCanonicalizationSafety(candidate.tx, playerId);
  expect(actual).toEqual(await assessMaterializedCanonicalizationSafety(frozen.tx, playerId));
  expect(actual).toEqual(await assessBaselineCanonicalizationSafety(original.tx, playerId));
  expect(candidate.tables()).toEqual(frozen.tables()); expect(candidate.tables()).toEqual(original.tables());
  return actual;
}
const compare = (id: string) => db.$transaction(tx => equivalent(tx, id), { isolationLevel: 'RepeatableRead', timeout: 30_000 });

it('preserves composite nullable bigint keys, duplicate child key tuples, cycles and cross-owner closure', async () => {
  const a = await player(), b = await player();
  const aTeam = await db.team.create({ data: { playerId: a.id, displayPosition: 1 } }), bTeam = await db.team.create({ data: { playerId: b.id, displayPosition: 1 } });
  const op = await db.businessOperation.create({ data: { playerId: a.id, operationType: 'fixture', sourceChannel: 'UI', status: 'COMPLETED', completedAt: new Date() } });
  const movement = { playerId: a.id, resourceKey: 'primogems', balanceBefore: 0n, delta: 1n, balanceAfter: 1n, causeKey: 'fixture', domainKey: 'fixture', operationId: op.id, sourceChannel: 'UI' as const };
  await db.resourceMovement.createMany({ data: [movement, { ...movement, delta: 2n, balanceAfter: 2n }] });
  const schema = `"${fixture.schema}"`;
  await fixture.admin.query(`ALTER TABLE ${schema}.teams ADD COLUMN fixture_bigint bigint, ADD COLUMN fixture_text text, ADD CONSTRAINT fixture_tuple UNIQUE(fixture_bigint,fixture_text), ADD COLUMN fixture_operation uuid REFERENCES ${schema}.business_operations(id)`);
  await fixture.admin.query(`ALTER TABLE ${schema}.resource_movements ADD COLUMN fixture_bigint bigint, ADD COLUMN fixture_text text, ADD CONSTRAINT fixture_composite FOREIGN KEY(fixture_bigint,fixture_text) REFERENCES ${schema}.teams(fixture_bigint,fixture_text)`);
  try {
    await fixture.admin.query(`UPDATE ${schema}.teams SET fixture_bigint=9007199254740992,fixture_text='same',fixture_operation=$1 WHERE id=$2`, [op.id, aTeam.id]);
    await fixture.admin.query(`UPDATE ${schema}.teams SET fixture_bigint=9007199254740993,fixture_text='same',fixture_operation=$1 WHERE id=$2`, [op.id, bTeam.id]);
    // Root ownership prevents the other team's downward capture, despite the cycle.
    const thirdBefore = await db.team.findUniqueOrThrow({ where: { id: bTeam.id } });
    await fixture.admin.query(`UPDATE ${schema}.resource_movements SET fixture_bigint=9007199254740992,fixture_text='same' WHERE player_id=$1`, [a.id]);
    const own = await compare(a.id);
    expect(own.classifications.find(row => row.edge.startsWith('resource_movements(fixture_bigint') && row.edge.endsWith(':external'))).toBeUndefined();
    await fixture.admin.query(`UPDATE ${schema}.resource_movements SET fixture_bigint=9007199254740993 WHERE player_id=$1`, [a.id]);
    const foreign = await compare(a.id);
    expect(foreign.safety.status).toBe('OPERATOR_REQUIRED');
    expect(foreign.classifications.find(row => row.edge.startsWith('resource_movements(fixture_bigint') && row.edge.endsWith(':external'))?.count).toBe('2');
    expect(foreign.fingerprint).not.toBe(own.fingerprint);
    await fixture.admin.query(`UPDATE ${schema}.resource_movements SET fixture_text=NULL WHERE player_id=$1`, [a.id]);
    expect((await compare(a.id)).classifications.find(row => row.edge.startsWith('resource_movements(fixture_bigint') && row.edge.endsWith(':external'))).toBeUndefined();
    expect(await db.team.findUniqueOrThrow({ where: { id: bTeam.id } })).toEqual(thirdBefore);
  } finally {
    await fixture.admin.query(`ALTER TABLE ${schema}.resource_movements DROP COLUMN fixture_bigint, DROP COLUMN fixture_text`);
    await fixture.admin.query(`ALTER TABLE ${schema}.teams DROP COLUMN fixture_bigint, DROP COLUMN fixture_text, DROP COLUMN fixture_operation`);
  }
});

it('covers every future FK across additional batches and keeps an unknown last-edge reference fail closed', async () => {
  const a = await player(), schema = `"${fixture.schema}"`, names = Array.from({ length: 96 }, (_, i) => `future_relation_${i}`);
  try {
    for (const name of names) await fixture.admin.query(`CREATE TABLE ${schema}."${name}"(id uuid PRIMARY KEY, player_id uuid REFERENCES ${schema}.players(id))`);
    await fixture.admin.query(`INSERT INTO ${schema}."${names.at(-1)}" VALUES($1,$2)`, [randomUUID(), a.id]);
    const result = await compare(a.id);
    expect(result.safety.status).toBe('OPERATOR_REQUIRED');
    expect(result.classifications.find(row => row.edge.startsWith(names.at(-1)! + '('))).toMatchObject({ classification: 'SHARED_ACTIVE', count: '1' });
  } finally { for (const name of names.reverse()) await fixture.admin.query(`DROP TABLE IF EXISTS ${schema}."${name}"`); }
});

it('handles more than 50 FK key columns without truncation and never captures a second Player through a future reverse edge', async () => {
  const a = await player(), b = await player(), schema = `"${fixture.schema}"`;
  const team = await db.team.create({ data: { playerId: a.id, displayPosition: 1 } });
  const operation = await db.businessOperation.create({ data: { playerId: a.id, operationType: 'fixture', sourceChannel: 'UI', status: 'COMPLETED', completedAt: new Date() } });
  const columns = Array.from({ length: 65 }, (_, i) => `fixture_operation_${i}`);
  await fixture.admin.query(`ALTER TABLE ${schema}.teams ${columns.map(name => `ADD COLUMN ${name} uuid REFERENCES ${schema}.business_operations(id)`).join(',')}`);
  await fixture.admin.query(`ALTER TABLE ${schema}.players ADD COLUMN fixture_team uuid REFERENCES ${schema}.teams(id)`);
  try {
    await fixture.admin.query(`UPDATE ${schema}.teams SET ${columns.map(name => `${name}=$1`).join(',')} WHERE id=$2`, [operation.id, team.id]);
    await fixture.admin.query(`UPDATE ${schema}.players SET fixture_team=$1 WHERE id IN ($2,$3)`, [team.id, a.id, b.id]);
    const result = await compare(a.id);
    expect(result.classifications.filter(row => row.edge === 'players(fixture_team)->teams(id)')).toEqual([
      { edge: 'players(fixture_team)->teams(id)', classification: 'OWNED_PERSONAL', count: '1' },
      { edge: 'players(fixture_team)->teams(id)', classification: 'SHARED_ACTIVE', count: '1' },
    ]);
    expect(result.safety.status).toBe('OPERATOR_REQUIRED');
  } finally {
    await fixture.admin.query(`ALTER TABLE ${schema}.players DROP COLUMN fixture_team`);
    await fixture.admin.query(`ALTER TABLE ${schema}.teams ${columns.map(name => `DROP COLUMN ${name}`).join(',')}`);
  }
});

it('runs entirely read only in the same RepeatableRead preflight boundary', async () => {
  const a = await player();
  const result = await db.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    await tx.$executeRaw`SET LOCAL statement_timeout='5000ms'`;
    return equivalent(tx, a.id);
  }, { isolationLevel: 'RepeatableRead', timeout: 30_000 });
  expect(result.safety.status).toBe('SAFE');
});

it('retains one snapshot while a concurrent writer changes a non-key payload, then changes consent on the next snapshot', async () => {
  const a = await player();
  const operation = await db.businessOperation.create({ data: { playerId: a.id, operationType: 'fixture', sourceChannel: 'UI', status: 'COMPLETED', completedAt: new Date(), resultSummary: { value: 'before' } } });
  const before = await db.$transaction(async tx => {
    let changed = false;
    const concurrent = new Proxy(tx, { get(target, key) {
      if (key !== '$queryRawUnsafe') return Reflect.get(target, key);
      return async (sql: string, ...args: unknown[]) => {
        const rows = await tx.$queryRawUnsafe(sql, ...args);
        if (!changed && sql.startsWith('SELECT to_jsonb(p)::text row')) {
          changed = true;
          await fixture.admin.query(`UPDATE "${fixture.schema}".business_operations SET result_summary='{"value":"after"}' WHERE id=$1`, [operation.id]);
        }
        return rows;
      };
    } });
    const candidate = await assessPlayerCanonicalizationSafety(concurrent, a.id);
    expect(candidate).toEqual(await assessBaselineCanonicalizationSafety(tx, a.id));
    return candidate;
  }, { isolationLevel: 'RepeatableRead', timeout: 30_000 });
  expect((await compare(a.id)).fingerprint).not.toBe(before.fingerprint);
});

it('cancels SQL at the existing statement bound, aborts the entire assessment and releases the connection', async () => {
  const a = await player(), stages: string[] = [];
  await expect(db.$transaction(async tx => {
    await tx.$executeRaw`SET LOCAL statement_timeout='50ms'`;
    const stalled = new Proxy(tx, { get(target, key) {
      if (key !== '$queryRawUnsafe') return Reflect.get(target, key);
      return async (sql: string, ...args: unknown[]) => {
        if (sql.includes('::text edge,')) await tx.$queryRawUnsafe('SELECT pg_sleep(1)');
        return tx.$queryRawUnsafe(sql, ...args);
      };
    } });
    await assessPlayerCanonicalizationSafety(stalled, a.id, undefined, metric => stages.push(metric.stage));
  }, { isolationLevel: 'RepeatableRead', timeout: 30_000 })).rejects.toMatchObject({ code: 'P2010', meta: { driverAdapterError: { cause: { originalCode: '57014' } } } });
  expect(stages).not.toContain('fingerprint'); expect(stages).not.toContain('total');
  const active = await fixture.admin.query<{ count: string }>("SELECT count(*)::text count FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND datname=current_database() AND (state='idle in transaction' OR (state='active' AND query LIKE '%pg_sleep%'))");
  expect(active.rows[0]!.count).toBe('0');
  expect((await compare(a.id)).safety.status).toBe('SAFE');
  expect(fixture.poolSnapshot().waiting).toBe(0);
});
