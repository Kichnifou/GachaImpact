import { expect, it } from 'vitest';
import { stableElementExceptionProof } from '../src/application/maintenance/element-exception-proof.js';
import type { RowGraph } from '../src/application/migration/targeted-player-rows.js';
const graph = (row: string, table = 'player_economy_stats'): RowGraph => ({ schema: 'public', playerIds: ['target'], order: [table], hash: '', tables: { [table]: [row] } });
it('detects a one-unit int8 change beyond the JavaScript safe integer limit', () => {
  expect(stableElementExceptionProof(graph('{"total":9223372036854775806}'), 'target', 'op'))
    .not.toEqual(stableElementExceptionProof(graph('{"total":9223372036854775807}'), 'target', 'op'));
});
it('normalizes permitted target changes, preserves peer and unrelated resource values', () => {
  const proof = (row: string) => stableElementExceptionProof(graph(row, 'player_resource_balances'), 'target', 'op');
  expect(proof('{"player_id":"target","resource_key":"particles_cryo","amount":1}')).toEqual(proof('{"player_id":"target","resource_key":"particles_cryo","amount":2}'));
  expect(proof('{"player_id":"peer","resource_key":"particles_cryo","amount":1}')).not.toEqual(proof('{"player_id":"peer","resource_key":"particles_cryo","amount":2}'));
  expect(proof('{"player_id":"target","resource_key":"moras","amount":1}')).not.toEqual(proof('{"player_id":"target","resource_key":"moras","amount":2}'));
});
