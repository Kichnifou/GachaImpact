import type { Prisma } from '../generated/prisma/client.js';

/** Test-only observer; records no SQL/parameters or graph in logs. Frozen engines are unmodified. */
export function observeCanonicalization(tx: Prisma.TransactionClient) {
  const graph = new Map<string, Set<string>>();
  const queries: { sql: string; args: unknown[]; stage: string; elapsedMs: number }[] = [];
  const wrapped = new Proxy(tx, { get(target, key) {
    if (key !== '$queryRawUnsafe') return Reflect.get(target, key);
    return async (sql: string, ...args: unknown[]) => {
      const start = performance.now(), result = await tx.$queryRawUnsafe(sql, ...args);
      const stage = sql.includes(' table_name,to_jsonb') ? 'projection' : sql.includes('::text edge,') ? 'evidence' : null;
      if (stage) queries.push({ sql, args, stage, elapsedMs: performance.now() - start });
      if (stage === 'projection' || sql.startsWith('SELECT to_jsonb(p)::text row')) {
        for (const row of result as { table_name?: string; row: string }[]) {
          const table = row.table_name ?? 'players', rows = graph.get(table) ?? new Set<string>();
          rows.add(row.row); graph.set(table, rows);
        }
      }
      return result;
    };
  } });
  return { tx: wrapped, queries, tables: () => Object.fromEntries([...graph].sort(([a], [b]) => a.localeCompare(b)).map(([name, rows]) => [name, [...rows].sort()])) };
}

export async function explainCanonicalization(tx: Prisma.TransactionClient, query: { sql: string; args: unknown[]; stage: string }) {
  type Plan = { 'Node Type': string; 'Actual Loops'?: number; 'Actual Rows'?: number; 'Rows Removed by Filter'?: number; Plans?: Plan[] };
  type Explain = { Plan: Plan; 'Planning Time': number; 'Execution Time': number; JIT?: { Functions: number; Timing?: { Total: number } } };
  const plans = await tx.$queryRawUnsafe<{ 'QUERY PLAN': Explain[] }[]>('EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON, TIMING OFF) ' + query.sql, ...query.args);
  const plan = plans[0]!['QUERY PLAN'][0]!, counts = { nodes: 0, maxLoops: 0, filteredRows: 0 };
  const walk = (node: Plan) => {
    counts.nodes++; counts.maxLoops = Math.max(counts.maxLoops, node['Actual Loops'] ?? 0);
    counts.filteredRows += (node['Rows Removed by Filter'] ?? 0) * (node['Actual Loops'] ?? 0);
    node.Plans?.forEach(walk);
  };
  walk(plan.Plan);
  return { stage: query.stage, planningMs: plan['Planning Time'], executionMs: plan['Execution Time'], jitFunctions: plan.JIT?.Functions ?? 0, jitMs: plan.JIT?.Timing?.Total ?? 0, inputBytes: Buffer.byteLength(query.args[0] as string), ...counts };
}
