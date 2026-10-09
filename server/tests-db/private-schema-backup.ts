import { createHash } from 'node:crypto';
import { mkdir, open, readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import type pg from 'pg';
import type { Prisma } from '../generated/prisma/client.js';

type Backup = { schema: string; deleteOrder: string[]; tables: Record<string, string[]>; hash: string };
const guard = (schema: string) => {
  if (!/^batch_test_[0-9a-f]{32}$/.test(schema)) throw new Error('Backup/restore requires an isolated private schema.');
};
const identifier = (name: string) => {
  if (name !== '_prisma_migrations' && !/^[a-z][a-z0-9_]*$/.test(name)) throw new Error('Invalid backup identifier.');
  return `"${name}"`;
};
const digest = (tables: Backup['tables']) => createHash('sha256').update(JSON.stringify(tables)).digest('hex');

/** Counts and exact numeric sums compare logical state independently of generated UUIDs/timestamps. */
export async function privateNumericStateHash(db: Prisma.TransactionClient, schema: string): Promise<string> {
  guard(schema);
  const columns = await db.$queryRawUnsafe<{ table_name: string; column_name: string }[]>(
    `SELECT table_name,column_name FROM information_schema.columns WHERE table_schema=$1
     AND data_type IN ('bigint','integer','smallint','numeric') ORDER BY table_name,column_name`, schema);
  const byTable = new Map<string, string[]>();
  for (const column of columns) byTable.set(column.table_name, [...(byTable.get(column.table_name) ?? []), column.column_name]);
  const aggregates: Record<string, unknown> = {};
  for (const [table, names] of byTable) {
    const entries = names.map(name => `'${name}',COALESCE(sum(${identifier(name)})::text,'0')`);
    const rows = await db.$queryRawUnsafe<{ totals: unknown }[]>(`SELECT jsonb_build_object('rows',count(*)::text,${entries.join(',')}) AS totals FROM ${identifier(schema)}.${identifier(table)}`);
    aggregates[table] = rows[0]!.totals;
  }
  return createHash('sha256').update(JSON.stringify(aggregates)).digest('hex');
}

/** JSON stays textual so PostgreSQL int8 values never pass through JavaScript Number. */
export async function capturePrivateSchema(client: pg.Client, schema: string): Promise<Backup> {
  guard(schema);
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    const names = (await client.query<{ tablename: string }>('SELECT tablename FROM pg_tables WHERE schemaname=$1 ORDER BY tablename', [schema])).rows.map(row => row.tablename);
    const fks = (await client.query<{ child: string; parent: string; parent_schema: string }>(`
      SELECT c.relname AS child, p.relname AS parent, pn.nspname AS parent_schema
      FROM pg_constraint fk JOIN pg_class c ON c.oid=fk.conrelid JOIN pg_class p ON p.oid=fk.confrelid
      JOIN pg_namespace cn ON cn.oid=c.relnamespace JOIN pg_namespace pn ON pn.oid=p.relnamespace
      WHERE fk.contype='f' AND cn.nspname=$1`, [schema])).rows;
    if (fks.some(fk => fk.parent_schema !== schema)) throw new Error('Private backup has an external FK.');
    const remaining = new Set(names), deleteOrder: string[] = [];
    while (remaining.size) {
      const ready = [...remaining].filter(parent => !fks.some(fk => fk.parent === parent && fk.child !== parent && remaining.has(fk.child))).sort();
      if (!ready.length) throw new Error('Private backup FK cycle.');
      for (const name of ready) { deleteOrder.push(name); remaining.delete(name); }
    }
    const tables: Backup['tables'] = {};
    for (const name of names) tables[name] = (await client.query<{ row: string }>(
      `SELECT row_to_json(t)::text AS row FROM ${identifier(schema)}.${identifier(name)} t ORDER BY row_to_json(t)::text COLLATE "C"`)).rows.map(row => row.row);
    await client.query('COMMIT');
    return { schema, deleteOrder, tables, hash: digest(tables) };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
}

export async function writePrivateBackup(backup: Backup, label: string): Promise<string> {
  guard(backup.schema); identifier(label);
  const root = resolve('..', 'local-data', 'migration-backups');
  await mkdir(root, { recursive: true });
  const file = resolve(root, `${backup.schema}_${label}.json`);
  const handle = await open(file, 'wx', 0o600);
  try { await handle.writeFile(JSON.stringify(backup)); await handle.sync(); } finally { await handle.close(); }
  return file;
}

/** Intentionally has no public restoration path. Restore is atomic and follows actual FKs. */
export async function restorePrivateBackup(client: pg.Client, schema: string, file: string): Promise<void> {
  guard(schema);
  const root = resolve('..', 'local-data', 'migration-backups');
  if (!resolve(file).startsWith(root + sep)) throw new Error('Backup must remain under ignored local-data.');
  const backup = JSON.parse(await readFile(file, 'utf8')) as Backup;
  if (backup.schema !== schema || digest(backup.tables) !== backup.hash) throw new Error('Private backup schema/hash mismatch.');
  const current = await capturePrivateSchema(client, schema);
  if (JSON.stringify(current.deleteOrder) !== JSON.stringify(backup.deleteOrder) ||
      JSON.stringify(Object.keys(current.tables)) !== JSON.stringify(Object.keys(backup.tables))) throw new Error('Private backup DDL differs.');
  await client.query('BEGIN');
  try {
    // A physical rehearsal restore must also restore archived preimages. This
    // narrow exception exists only in this test helper, on loopback PostgreSQL,
    // and names only archive guards and the immutable ballot guard. FK/CHECK stay on.
    const archiveGuards = (await client.query<{ table_name: string; trigger_name: string; enabled: string }>(`
      SELECT c.relname AS table_name,t.tgname AS trigger_name,t.tgenabled AS enabled FROM pg_trigger t
      JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname=$1 AND (t.tgname='archived_player_write_guard'
        OR (c.relname='external_banner_votes' AND t.tgname='external_banner_vote_guard'))
        AND NOT t.tgisinternal ORDER BY c.relname,t.tgname`, [schema])).rows;
    if (archiveGuards.length) {
      const host = (await client.query<{ host: string | null }>('SELECT host(inet_server_addr()) AS host')).rows[0]?.host;
      if (host !== '127.0.0.1' && host !== '::1') throw new Error('Archived fixture restore requires loopback PostgreSQL.');
      for (const trigger of archiveGuards) await client.query(`ALTER TABLE ${identifier(schema)}.${identifier(trigger.table_name)} DISABLE TRIGGER ${identifier(trigger.trigger_name)}`);
    }
    for (const name of backup.deleteOrder) await client.query(`DELETE FROM ${identifier(schema)}.${identifier(name)}`);
    for (const name of [...backup.deleteOrder].reverse()) {
      const rows = backup.tables[name]!;
      if (rows.length) await client.query(`INSERT INTO ${identifier(schema)}.${identifier(name)} SELECT * FROM json_populate_recordset(NULL::${identifier(schema)}.${identifier(name)}, $1::json)`, [`[${rows.join(',')}]`]);
    }
    const modes: Record<string, string> = { O: 'ENABLE', A: 'ENABLE ALWAYS', R: 'ENABLE REPLICA', D: 'DISABLE' };
    for (const trigger of archiveGuards) {
      if (!modes[trigger.enabled]) throw new Error('Unknown archived trigger mode.');
      await client.query(`ALTER TABLE ${identifier(schema)}.${identifier(trigger.table_name)} ${modes[trigger.enabled]} TRIGGER ${identifier(trigger.trigger_name)}`);
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  if ((await capturePrivateSchema(client, schema)).hash !== backup.hash) throw new Error('Private restore data differs.');
}
