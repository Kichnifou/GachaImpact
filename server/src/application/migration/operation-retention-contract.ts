import type { ForeignKey } from './targeted-player-rows.js';

/** Explicit schema-owner contract. A new/changed/duplicate/missing FK fails closed. */
export const operationReferenceContract = [
  ['admin_audit_entries', 'operation_id', 'CONSERVED'],
  ['arcade_daily_grants', 'operation_id', 'CONSERVED'],
  ['arcade_receipts', 'operation_id', 'CONSERVED'],
  ['arcade_sessions', 'finish_operation_id', 'CONSERVED'],
  ['bank_transactions', 'operation_id', 'REPLACED'],
  ['boss_attacks', 'operation_id', 'CONSERVED'],
  ['boss_rewards', 'operation_id', 'CONSERVED'],
  ['contest_rewards', 'operation_id', 'CONSERVED'],
  ['daily_combat_attempts', 'operation_id', 'REPLACED'],
  ['direct_messages', 'operation_id', 'CONSERVED'],
  ['event_calendar_claims', 'operation_id', 'CONSERVED'],
  ['event_collection_acquisitions', 'operation_id', 'CONSERVED'],
  ['event_milestone_claims', 'operation_id', 'CONSERVED'],
  ['favor_daily_claims', 'operation_id', 'REPLACED'],
  ['favor_grants', 'operation_id', 'REPLACED'],
  ['friend_hearts', 'operation_id', 'CONSERVED'],
  ['gift_code_claims', 'operation_id', 'CONSERVED'],
  ['giveaway_rewards', 'operation_id', 'CONSERVED'],
  ['giveaway_wins', 'operation_id', 'CONSERVED'],
  ['global_chat_messages', 'operation_id', 'CONSERVED'],
  ['item_acquisitions', 'operation_id', 'REPLACED'],
  ['player_daily_reward_state', 'last_operation_id', 'REPLACED'],
  ['player_permanent_mission_progress', 'completion_trigger_operation_id', 'REPLACED'],
  ['player_permanent_mission_progress', 'reward_operation_id', 'REPLACED'],
  ['player_wheel_daily_states', 'operation_id', 'REPLACED'],
  ['pull_operations', 'business_operation_id', 'REPLACED'],
  ['resource_movements', 'operation_id', 'REPLACED'],
  ['shop_purchases', 'operation_id', 'REPLACED'],
  ['trade_executions', 'operation_id', 'CONSERVED'],
  ['trade_requests', 'operation_id', 'CONSERVED'],
] as const;
export const operationForeignKeySignature = (fk: ForeignKey) => `${fk.child}(${fk.child_columns.join(',')})->${fk.parent}(${fk.parent_columns.join(',')})`;
export function classifyOperationForeignKeys(fks: ForeignKey[], replacing: ReadonlySet<string>) {
  const expected = operationReferenceContract.map(([child, column]) => `${child}(${column})->business_operations(id)`).sort();
  const actual = fks.filter(fk => fk.parent === 'business_operations').map(operationForeignKeySignature).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)
    || operationReferenceContract.some(([child, , category]) => replacing.has(child) !== (category === 'REPLACED')))
    throw new Error('CANARY_OPERATION_FK_UNCLASSIFIED');
  return actual;
}
