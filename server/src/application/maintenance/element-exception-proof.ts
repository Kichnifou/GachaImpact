import type { RowGraph } from '../migration/targeted-player-rows.js';

/** Compare only captured personal tables; do not round PostgreSQL int8 through
 * a JavaScript number. Node24's reviver context preserves numeric source text. */
export function stableElementExceptionProof(graph: RowGraph, playerId: string, operationId: string) {
  const parse = JSON.parse as (text: string, reviver: (key: string, value: unknown, context: { source?: string }) => unknown) => Record<string, unknown>;
  return Object.fromEntries(Object.entries(graph.tables).map(([table, rows]) => [table, rows.map(text => parse(text,
    (_key, value, context) => typeof value === 'number' ? { postgresNumeric: context.source } : value))
    .filter(row => !(table === 'resource_movements' && row.operation_id === operationId) && !(table === 'business_operations' && row.id === operationId))
    .map(row => {
      if (table === 'players' && row.id === playerId) { delete row.element_key; delete row.updated_at; }
      if (table === 'player_resource_balances' && row.player_id === playerId && ['particles_cryo','particles_electro'].includes(String(row.resource_key))) { delete row.amount; delete row.updated_at; }
      return JSON.stringify(row);
    }).sort()]));
}
