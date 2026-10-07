import { describe, expect, it } from 'vitest';
import { classifyOperationForeignKeys, operationReferenceContract } from '../src/application/migration/operation-retention-contract.js';
import { personalReplacementTables, type ForeignKey } from '../src/application/migration/targeted-player-rows.js';

const current: ForeignKey[] = operationReferenceContract.map(([child, column]) => ({ child, parent: 'business_operations', child_columns: [column], parent_columns: ['id'] }));
const replacing = new Set<string>(personalReplacementTables);
describe('explicit complete operation FK contract', () => {
  it('is deterministic regardless of PostgreSQL constraint order', () => {
    expect(classifyOperationForeignKeys([...current].reverse(), replacing)).toEqual(classifyOperationForeignKeys(current, replacing));
    expect(operationReferenceContract.filter(([, , c]) => c === 'REPLACED')).toHaveLength(12);
  });
  it.each(['added', 'removed', 'duplicate', 'renamed column', 'composite', 'changed parent column'] as const)('rejects %s DDL', change => {
    const fks = structuredClone(current);
    if (change === 'added') fks.push({ child: 'new_history', parent: 'business_operations', child_columns: ['operation_id'], parent_columns: ['id'] });
    if (change === 'removed') fks.pop();
    if (change === 'duplicate') fks.push({ ...fks[0]! });
    if (change === 'renamed column') fks[0]!.child_columns = ['other_operation'];
    if (change === 'composite') { fks[0]!.child_columns.push('owner'); fks[0]!.parent_columns.push('player_id'); }
    if (change === 'changed parent column') fks[0]!.parent_columns = ['player_id'];
    expect(() => classifyOperationForeignKeys(fks, replacing)).toThrow('CANARY_OPERATION_FK_UNCLASSIFIED');
  });
  it('rejects replacement ownership drift instead of implicitly classifying a table', () => {
    expect(() => classifyOperationForeignKeys(current, new Set([...replacing, 'global_chat_messages']))).toThrow('CANARY_OPERATION_FK_UNCLASSIFIED');
    expect(() => classifyOperationForeignKeys(current, new Set([...replacing].filter(t => t !== 'resource_movements')))).toThrow('CANARY_OPERATION_FK_UNCLASSIFIED');
  });
});
