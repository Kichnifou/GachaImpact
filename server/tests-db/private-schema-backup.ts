import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import type pg from 'pg';
import type { Prisma } from '../generated/prisma/client.js';

type Backup = { schema: string; deleteOrder: string[]; tables: Record<string, string[]>; hash: string };
const guard = (schema: string) => {
  if (!/^batch_test_[0-9a-f]{32}$/.test(schema)) throw new Error('Backup/restore requires an isolated private schema.');
};
const identifier = (name: string) => {
  if (!/^[a-z][a-z0-9_]*$/.test(name)) throw new Error('Invalid backup identifier.');
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
  await writeFile(file, JSON.stringify(backup), { flag: 'wx', mode: 0o600 });
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
    for (const name of backup.deleteOrder) await client.query(`DELETE FROM ${identifier(schema)}.${identifier(name)}`);
    for (const name of [...backup.deleteOrder].reverse()) {
      const rows = backup.tables[name]!;
      if (rows.length) await client.query(`INSERT INTO ${identifier(schema)}.${identifier(name)} SELECT * FROM json_populate_recordset(NULL::${identifier(schema)}.${identifier(name)}, $1::json)`, [`[${rows.join(',')}]`]);
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  if ((await capturePrivateSchema(client, schema)).hash !== backup.hash) throw new Error('Private restore data differs.');
}
