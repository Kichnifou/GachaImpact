import type { Prisma } from '../../../generated/prisma/client.js';
import { rowGraphIdentifier as ident, type targetedRowMetadata, type ForeignKey } from '../migration/targeted-player-rows.js';

type Metadata = Awaited<ReturnType<typeof targetedRowMetadata>>;
export type CanonicalizationMetric = {
  stage: 'snapshot' | 'metadata' | 'root' | 'projection-build' | 'projection-execute' | 'projection-merge' | 'projection-sort' | 'evidence-build' | 'evidence-execute' | 'fingerprint' | 'total';
  durationMs: number; iteration?: number; batch?: number; branches?: number; rows?: number; tables?: number; inputBytes?: number;
};
export type Diagnostic = (metric: CanonicalizationMetric) => void;
export function measure(diagnostic: Diagnostic | undefined, stage: CanonicalizationMetric['stage'], start: number, counts: Omit<CanonicalizationMetric, 'stage' | 'durationMs'> = {}) {
  if (diagnostic) { try { diagnostic({ stage, durationMs: performance.now() - start, ...counts }); } catch { /* observer only */ } }
}

// Bound plan size, not graph coverage. Every group is awaited on the same transaction.
export const canonicalizationBranchLimit = 64;
export function groups<T>(values: T[]) {
  const result: T[][] = [];
  for (let i = 0; i < values.length; i += canonicalizationBranchLimit) result.push(values.slice(i, i + canonicalizationBranchLimit));
  return result;
}
export const join = (fk: ForeignKey) => fk.child_columns.map((column, i) => `c.${ident(column)}=p.${ident(fk.parent_columns[i]!)}`).join(' AND ');
// Full JSONB text remains the canonical identity for de-duplication/fingerprinting.
// Key JSON is produced by PostgreSQL, never parsed as JS numbers (int8 precision).
// Do not de-duplicate key JSON: different leaf rows may share all their FK values.
type Graph = Map<string, Map<string, string>>;
type CapturedRow = { table_name: string; row: string; keys: string };
export function rootColumns(meta: Metadata) {
  const result = new Map<string, Set<string>>();
  for (const fk of meta.fks.filter(fk => fk.parent === 'players')) {
    const columns = result.get(fk.child) ?? new Set<string>();
    fk.child_columns.forEach(column => columns.add(column)); result.set(fk.child, columns);
  }
  return result;
}
function keyExpressions(meta: Metadata) {
  const columns = new Map<string, Set<string>>();
  for (const fk of meta.fks) for (const [table, names] of [[fk.child, fk.child_columns], [fk.parent, fk.parent_columns]] as const) {
    ident(table); const set = columns.get(table) ?? new Set<string>();
    names.forEach(name => { ident(name); set.add(name); }); columns.set(table, set);
  }
  return (table: string, alias: string) => {
    const names = [...(columns.get(table) ?? [])].sort(), chunks: string[] = [];
    // PostgreSQL functions accept at most 100 arguments; future wide keys stay safe.
    for (let i = 0; i < names.length; i += 32) chunks.push(`jsonb_build_object(${names.slice(i, i + 32).map(name => `'${name}',${alias}.${ident(name)}`).join(',')})`);
    return `(${chunks.join(' || ') || "'{}'::jsonb"})::text`;
  };
}

export function graphRecordsets(schema: string, graph: Graph) {
  const required = new Set<string>();
  return {
    table(table: string) { ident(table); required.add(table); return ident(`canonical_rows_${table}`); },
    query(sql: string) {
      const recordsets = [...required].map(table => `${ident(`canonical_rows_${table}`)} AS MATERIALIZED (SELECT r.* FROM canonical_graph g CROSS JOIN LATERAL json_populate_recordset(NULL::${ident(schema)}.${ident(table)},(g.value->'${table}')::json) r)`);
      const input = `{${[...required].map(table => `${JSON.stringify(table)}:[${[...(graph.get(table)?.values() ?? [])].join(',')}]`).join(',')}}`;
      return { sql: `WITH canonical_graph AS MATERIALIZED (SELECT $1::jsonb AS value), ${recordsets.join(', ')} ${sql}`, input };
    },
  };
}

export async function captureCanonicalizationGraph(tx: Prisma.TransactionClient, playerId: string, meta: Metadata, owned: Set<string>, diagnostic?: Diagnostic) {
  const rootStart = performance.now(), keyExpression = keyExpressions(meta);
  const roots = await tx.$queryRawUnsafe<{ row: string; keys: string }[]>(`SELECT to_jsonb(p)::text row,${keyExpression('players', 'p')} keys FROM ${ident(meta.schema)}.players p WHERE id=$1::uuid`, playerId);
  if (roots.length !== 1) throw new Error('CANONICALIZATION_PLAYER_NOT_FOUND');
  const graph: Graph = new Map([['players', new Map(roots.map(row => [row.row, row.keys]))]]);
  measure(diagnostic, 'root', rootStart, { rows: roots.length });
  const ownership = rootColumns(meta);
  const directlyRooted = new Set(meta.fks.filter(fk => fk.parent === 'players' && fk.child_columns.length === 1 && fk.child_columns[0] === 'player_id').map(fk => fk.child));
  let frontier: Graph = new Map(graph);
  // Semi-naive fixed point: only newly captured parents need following. The complete
  // rows stay in graph, including leaves, even when no further edge is reachable.
  for (let iteration = 1; frontier.size; iteration++) {
    const edges = meta.fks.filter(fk => owned.has(fk.child) && fk.child !== 'players' && frontier.get(fk.parent)?.size)
      .filter(fk => fk.parent !== 'players' || fk.child_columns.length === 1 && fk.child_columns[0] === 'player_id')
      // The root pass already captures ALL c.player_id rows of these tables. Every
      // indirect path has that same ownership guard and can only return duplicates.
      .filter(fk => fk.parent === 'players' || !directlyRooted.has(fk.child))
      .sort((a, b) => a.parent.localeCompare(b.parent));
    const next: Graph = new Map();
    for (const [batch, edgesInGroup] of groups(edges).entries()) {
      const buildStart = performance.now(), records = graphRecordsets(meta.schema, frontier);
      const queries = edgesInGroup.map(fk => `SELECT '${fk.child}'::text table_name,to_jsonb(c)::text row,${keyExpression(fk.child, 'c')} keys FROM ${ident(meta.schema)}.${ident(fk.child)} c JOIN ${records.table(fk.parent)} p ON ${join(fk)} WHERE $2::uuid IS NOT NULL${fk.parent !== 'players' && ownership.get(fk.child)?.has('player_id') ? ' AND c.player_id=$2::uuid' : ''}`);
      const { sql, input } = records.query(queries.join(' UNION ALL '));
      measure(diagnostic, 'projection-build', buildStart, { iteration, batch, branches: queries.length, inputBytes: Buffer.byteLength(input) });
      const executeStart = performance.now();
      const rows = await tx.$queryRawUnsafe<CapturedRow[]>(sql, input, playerId);
      measure(diagnostic, 'projection-execute', executeStart, { iteration, batch, rows: rows.length });
      const mergeStart = performance.now();
      for (const row of rows) {
        const previous = graph.get(row.table_name) ?? new Map<string, string>();
        if (previous.has(row.row)) continue;
        previous.set(row.row, row.keys); graph.set(row.table_name, previous);
        const added = next.get(row.table_name) ?? new Map<string, string>();
        added.set(row.row, row.keys); next.set(row.table_name, added);
      }
      measure(diagnostic, 'projection-merge', mergeStart, { iteration, batch, tables: graph.size, rows: [...graph.values()].reduce((n, rows) => n + rows.size, 0) });
    }
    frontier = next;
  }
  const sortStart = performance.now();
  const tables = Object.fromEntries([...graph].sort(([a], [b]) => a.localeCompare(b)).map(([table, rows]) => [table, [...rows.keys()].sort()]));
  measure(diagnostic, 'projection-sort', sortStart, { tables: graph.size, rows: [...graph.values()].reduce((n, rows) => n + rows.size, 0) });
  return { graph, tables };
}
