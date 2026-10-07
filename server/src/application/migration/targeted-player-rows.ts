import { createHash } from 'node:crypto';
import type { Prisma } from '../../../generated/prisma/client.js';
import { classifyOperationForeignKeys, operationReferenceContract, operationForeignKeySignature } from './operation-retention-contract.js';

export const personalReplacementTables = [
  'player_resource_balances', 'resource_movements', 'player_economy_stats', 'player_bank_accounts', 'bank_transactions',
  'shop_purchases', 'player_wheel_stats', 'player_wheel_daily_states', 'player_daily_reward_state', 'player_progression',
  'player_gacha_states', 'player_characters', 'c6_competition_progress', 'pull_operations', 'pull_results', 'teams', 'team_members',
  'player_items', 'item_acquisitions', 'player_cosmetics', 'player_permanent_mission_states', 'player_permanent_mission_progress',
  'player_daily_challenges', 'player_expeditions', 'player_combat_stats', 'player_character_combat_stats',
  'player_daily_combat_loadouts', 'player_daily_combat_loadout_slots', 'player_daily_combat_states', 'player_daily_combat_kos',
  'daily_combat_attempts', 'daily_combat_attempt_members', 'player_boss_loadouts', 'player_boss_loadout_slots', 'player_boss_stats',
  'player_favor_states', 'favor_grants', 'favor_daily_claims', 'player_social_stats', 'player_activity_state',
  'business_operations', 'migration_runs', 'migration_issues',
] as const;
export const targetedBackupTables = [...personalReplacementTables, 'players', 'web_identities', 'twitch_identities',
  'player_preferences', 'privacy_settings', 'player_role_assignments'] as const;
export type RowGraph = { schema: string; playerIds: string[]; tables: Record<string, string[]>; order: string[]; hash: string };
export type ForeignKey = { child: string; parent: string; child_columns: string[]; parent_columns: string[] };
export type TargetedRetention = { version: 1; foreignKeys: string[]; operations: string[];
  references: { foreignKey: string; rows: string[] }[] };
export const rowGraphIdentifier = (value: string) => {
  if (!/^[a-z][a-z0-9_]*$/.test(value)) throw new Error('TARGETED_ROWS_IDENTIFIER_INVALID');
  return `"${value}"`;
};
export const rowGraphHash = (tables: RowGraph['tables']) => createHash('sha256').update(JSON.stringify(tables)).digest('hex');

export async function targetedRowMetadata(tx: Prisma.TransactionClient) {
  const schema = (await tx.$queryRaw<{ schema: string }[]>`SELECT current_schema() AS schema`)[0]!.schema;
  if (schema !== 'public' && !/^batch_test_[0-9a-f]{32}$/.test(schema)) throw new Error('TARGETED_ROWS_SCHEMA_INVALID');
  const fks = await tx.$queryRawUnsafe<ForeignKey[]>(`SELECT c.relname child,p.relname parent,
    array_agg(ca.attname ORDER BY key.ord)::text[] child_columns,array_agg(pa.attname ORDER BY key.ord)::text[] parent_columns
    FROM pg_constraint fk JOIN pg_class c ON c.oid=fk.conrelid JOIN pg_class p ON p.oid=fk.confrelid
    JOIN pg_namespace cn ON cn.oid=c.relnamespace JOIN pg_namespace pn ON pn.oid=p.relnamespace
    CROSS JOIN LATERAL unnest(fk.conkey,fk.confkey) WITH ORDINALITY key(child_col,parent_col,ord)
    JOIN pg_attribute ca ON ca.attrelid=c.oid AND ca.attnum=key.child_col JOIN pg_attribute pa ON pa.attrelid=p.oid AND pa.attnum=key.parent_col
    WHERE fk.contype='f' AND cn.nspname=$1 AND pn.nspname=$1 GROUP BY fk.oid,c.relname,p.relname ORDER BY c.relname,p.relname,fk.oid`, schema);
  return { schema, fks };
}
const recordset = (schema: string, table: string) => `json_populate_recordset(NULL::${rowGraphIdentifier(schema)}.${rowGraphIdentifier(table)},$1::json)`;
const match = (fk: ForeignKey) => fk.child_columns.map((column, i) => `c.${rowGraphIdentifier(column)}=p.${rowGraphIdentifier(fk.parent_columns[i]!)}`).join(' AND ');

/** Read-only row-level exception, solely for terminal parents of explicitly conserved facts. */
export async function planTargetedRetention(tx: Prisma.TransactionClient, graph: RowGraph): Promise<TargetedRetention> {
  const { schema, fks } = await targetedRowMetadata(tx);
  if (schema !== graph.schema) throw new Error('TARGETED_ROWS_SCHEMA_MISMATCH');
  const foreignKeys = classifyOperationForeignKeys(fks, new Set(personalReplacementTables));
  const outside = await tx.$queryRawUnsafe<{ count: string }[]>(`SELECT count(*)::text count FROM pg_constraint fk
    JOIN pg_class p ON p.oid=fk.confrelid JOIN pg_namespace pn ON pn.oid=p.relnamespace
    JOIN pg_class c ON c.oid=fk.conrelid JOIN pg_namespace cn ON cn.oid=c.relnamespace
    WHERE fk.contype='f' AND pn.nspname=$1 AND p.relname='business_operations' AND cn.nspname<>$1`, schema);
  if (outside[0]!.count !== '0') throw new Error('CANARY_OPERATION_FK_UNCLASSIFIED');
  const captured = graph.tables.business_operations ?? [], operations = new Set<string>();
  const references: TargetedRetention['references'] = [];
  const categoryOf = (fk: ForeignKey) => operationReferenceContract.find(([child, column]) => child === fk.child && column === fk.child_columns[0])![2];
  // Establish conserved-parent exceptions first. A different Player's personal
  // child never creates an exception, but must survive if its parent is already retained.
  for (const fk of fks.filter(edge => edge.parent === 'business_operations').sort((a, b) => categoryOf(a).localeCompare(categoryOf(b)))) {
    if (!captured.length) continue;
    const category = categoryOf(fk);
    const rows = await tx.$queryRawUnsafe<{ child: string; parent: string }[]>(`SELECT row_to_json(c)::text child,row_to_json(p)::text parent
      FROM ${rowGraphIdentifier(schema)}.${rowGraphIdentifier(fk.child)} c JOIN ${recordset(schema, fk.parent)} p ON ${match(fk)} ORDER BY 1,2`, `[${captured.join(',')}]`);
    if (category === 'REPLACED') {
      const outside = rows.filter(row => !graph.tables[fk.child]?.includes(row.child));
      if (outside.some(row => {
        const child = JSON.parse(row.child) as { player_id?: string | null };
        return !operations.has(row.parent) || !child.player_id || graph.playerIds.includes(child.player_id);
      })) throw new Error('CANARY_SHARED_REFERENCE_REQUIRES_OPERATOR');
      if (outside.length) references.push({ foreignKey: operationForeignKeySignature(fk), rows: [...new Set(outside.map(row => row.child))].sort() });
      continue;
    }
    for (const row of rows) {
      const op = JSON.parse(row.parent) as { player_id: string | null; status: string };
      if (!captured.includes(row.parent) || !op.player_id || !graph.playerIds.includes(op.player_id)
        || !['COMPLETED', 'FAILED'].includes(op.status)) throw new Error('CANARY_OPERATION_RETENTION_NOT_TERMINAL_OR_OWNED');
      operations.add(row.parent);
    }
    if (rows.length) references.push({ foreignKey: operationForeignKeySignature(fk), rows: [...new Set(rows.map(row => row.child))].sort() });
  }
  return { version: 1, foreignKeys, operations: [...operations].sort(), references: references.sort((a, b) => a.foreignKey.localeCompare(b.foreignKey)) };
}

async function deletionGraph(tx: Prisma.TransactionClient, graph: RowGraph, retention?: TargetedRetention): Promise<RowGraph> {
  if (!retention) return graph; // Legacy/default guard never acquires an implicit exception.
  if (JSON.stringify(await planTargetedRetention(tx, graph)) !== JSON.stringify(retention)) throw new Error('CANARY_RETENTION_CHANGED');
  const tables = { ...graph.tables, business_operations: (graph.tables.business_operations ?? []).filter(row => !retention.operations.includes(row)) };
  return { ...graph, tables, hash: rowGraphHash(tables) };
}

/** Target rows and their owned descendants only. Values remain PostgreSQL JSON text (int8/timestamps lossless). */
export async function captureTargetedPlayerRows(tx: Prisma.TransactionClient, playerIds: string[], allowedTables: readonly string[] = targetedBackupTables,
  includeRequiredParents = false): Promise<RowGraph> {
  if (!playerIds.length || playerIds.some(id => !/^[0-9a-f-]{36}$/.test(id))) throw new Error('TARGETED_ROWS_PLAYER_INVALID');
  const { schema, fks } = await targetedRowMetadata(tx), allowed = new Set(allowedTables);
  const playerOwned = new Set(fks.filter(fk => fk.parent === 'players' && fk.child_columns.length === 1 && fk.child_columns[0] === 'player_id').map(fk => fk.child));
  const tables: Record<string, string[]> = Object.fromEntries([...allowed].sort().map(table => [table, []]));
  tables.players = (await tx.$queryRawUnsafe<{ row: string }[]>(`SELECT row_to_json(t)::text row FROM ${rowGraphIdentifier(schema)}.players t WHERE id=ANY($1::uuid[]) ORDER BY id`, playerIds)).map(row => row.row);
  // Downward closure never includes another Player's children merely because that Player is a relation endpoint.
  for (;;) {
    let changed = false;
    for (const fk of fks) {
      if (!allowed.has(fk.child) || !tables[fk.parent]?.length || fk.child === 'players') continue;
      if (fk.parent === 'players' && fk.child === 'player_role_assignments' && !fk.child_columns.includes('player_id')) continue;
      const rows = await tx.$queryRawUnsafe<{ row: string }[]>(`SELECT DISTINCT row_to_json(c)::text row FROM ${rowGraphIdentifier(schema)}.${rowGraphIdentifier(fk.child)} c
        JOIN ${recordset(schema, fk.parent)} p ON ${match(fk)}${playerOwned.has(fk.child) ? ' WHERE c.player_id=ANY($2::uuid[])' : ''} ORDER BY 1`,
      `[${tables[fk.parent]!.join(',')}]`, ...(playerOwned.has(fk.child) ? [playerIds] : []));
      const previous = new Set(tables[fk.child]);
      for (const row of rows) if (!previous.has(row.row)) { previous.add(row.row); changed = true; }
      tables[fk.child] = [...previous].sort();
    }
    if (!changed) break;
  }
  if (includeRequiredParents) for (;;) {
    let changed = false;
    for (const fk of fks) {
      if (!allowed.has(fk.parent) || fk.parent === 'players' || !tables[fk.child]?.length) continue;
      const rows = await tx.$queryRawUnsafe<{ row: string }[]>(`SELECT DISTINCT row_to_json(p)::text row FROM ${recordset(schema, fk.child)} c
        JOIN ${rowGraphIdentifier(schema)}.${rowGraphIdentifier(fk.parent)} p ON ${match(fk)} ORDER BY 1`, `[${tables[fk.child]!.join(',')}]`);
      const previous = new Set(tables[fk.parent]);
      for (const row of rows) if (!previous.has(row.row)) { previous.add(row.row); changed = true; }
      tables[fk.parent] = [...previous].sort();
    }
    if (!changed) break;
  }
  const remaining = new Set(Object.keys(tables)), order: string[] = [];
  while (remaining.size) {
    const ready = [...remaining].filter(parent => !fks.some(fk => fk.parent === parent && fk.child !== parent && remaining.has(fk.child))).sort();
    if (!ready.length) throw new Error('TARGETED_ROWS_FK_CYCLE');
    ready.forEach(table => { order.push(table); remaining.delete(table); });
  }
  return { schema, playerIds, tables, order, hash: rowGraphHash(tables) };
}

/** Reject unowned references before deletion. A canary never cascades into another domain/Player. */
export async function assertTargetedDeletionSafe(tx: Prisma.TransactionClient, graph: RowGraph, deleting: ReadonlySet<string>, retention?: TargetedRetention) {
  graph = await deletionGraph(tx, graph, retention);
  const { schema, fks } = await targetedRowMetadata(tx);
  if (schema !== graph.schema) throw new Error('TARGETED_ROWS_SCHEMA_MISMATCH');
  for (const fk of fks) {
    if (!deleting.has(fk.parent) || !graph.tables[fk.parent]?.length) continue;
    const rows = await tx.$queryRawUnsafe<{ row: string }[]>(`SELECT row_to_json(c)::text row FROM ${rowGraphIdentifier(schema)}.${rowGraphIdentifier(fk.child)} c
      JOIN ${recordset(schema, fk.parent)} p ON ${match(fk)}`, `[${graph.tables[fk.parent]!.join(',')}]`);
    if (rows.some(row => !deleting.has(fk.child) || !graph.tables[fk.child]?.includes(row.row))) throw new Error('CANARY_SHARED_REFERENCE_REQUIRES_OPERATOR');
  }
  return graph;
}

export async function deleteTargetedRows(tx: Prisma.TransactionClient, graph: RowGraph, deleting: ReadonlySet<string>, retention?: TargetedRetention) {
  graph = await assertTargetedDeletionSafe(tx, graph, deleting, retention);
  for (const table of graph.order) {
    if (!deleting.has(table) || !graph.tables[table]?.length) continue;
    await tx.$executeRawUnsafe(`DELETE FROM ${rowGraphIdentifier(graph.schema)}.${rowGraphIdentifier(table)} c USING ${recordset(graph.schema, table)} p WHERE to_jsonb(c)=to_jsonb(p)`, `[${graph.tables[table]!.join(',')}]`);
  }
}

export async function restoreTargetedRows(tx: Prisma.TransactionClient, backup: RowGraph, retention?: TargetedRetention) {
  if (rowGraphHash(backup.tables) !== backup.hash) throw new Error('CANARY_BACKUP_HASH_MISMATCH');
  const current = await captureTargetedPlayerRows(tx, backup.playerIds, Object.keys(backup.tables));
  if (current.schema !== backup.schema || JSON.stringify(current.order) !== JSON.stringify(backup.order)) throw new Error('CANARY_BACKUP_DDL_MISMATCH');
  // Kept identities/roles/preferences/privacy and Player ID can have external references: restore in place.
  const replacing = new Set<string>(personalReplacementTables);
  if (retention?.operations.some(row => !backup.tables.business_operations?.includes(row) || !current.tables.business_operations?.includes(row)))
    throw new Error('CANARY_RETAINED_OPERATION_CHANGED');
  await deleteTargetedRows(tx, current, replacing, retention);
  for (const table of [...backup.order].reverse()) {
    const rows = table === 'business_operations' && retention ? backup.tables[table]!.filter(row => !retention.operations.includes(row)) : backup.tables[table]!;
    if (replacing.has(table)) {
      if (rows.length) await tx.$executeRawUnsafe(`INSERT INTO ${rowGraphIdentifier(backup.schema)}.${rowGraphIdentifier(table)} SELECT * FROM ${recordset(backup.schema, table)}`, `[${rows.join(',')}]`);
    } else if (table === 'players' || table === 'twitch_identities' || table === 'player_preferences') {
      const columns = await tx.$queryRawUnsafe<{ column_name: string }[]>(`SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 ORDER BY ordinal_position`, backup.schema, table);
      const keys = table === 'players' ? ['id'] : table === 'twitch_identities' ? ['player_id'] : ['player_id', 'preference_key'];
      // Remove newly introduced preference/Twitch identity rows (absence is part of the preimage).
      if (table !== 'players') await tx.$executeRawUnsafe(`DELETE FROM ${rowGraphIdentifier(backup.schema)}.${rowGraphIdentifier(table)} WHERE player_id=ANY($1::uuid[])`, backup.playerIds);
      if (!rows.length) continue;
      const updates = columns.map(row => row.column_name).filter(column => !keys.includes(column)).map(column => `${rowGraphIdentifier(column)}=EXCLUDED.${rowGraphIdentifier(column)}`).join(',');
      await tx.$executeRawUnsafe(`INSERT INTO ${rowGraphIdentifier(backup.schema)}.${rowGraphIdentifier(table)} SELECT * FROM ${recordset(backup.schema, table)} ON CONFLICT (${keys.map(rowGraphIdentifier).join(',')}) DO UPDATE SET ${updates}`, `[${rows.join(',')}]`);
    }
  }
  if (!backup.tables.players?.length) await tx.player.deleteMany({ where: { id: { in: backup.playerIds } } });
  const after = await captureTargetedPlayerRows(tx, backup.playerIds, Object.keys(backup.tables));
  if (after.hash !== backup.hash) throw new Error('CANARY_ROLLBACK_PREIMAGE_MISMATCH');
}
