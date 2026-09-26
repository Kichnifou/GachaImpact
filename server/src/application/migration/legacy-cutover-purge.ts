import type { PrismaClient } from '../../../generated/prisma/client.js';

// The contract is deliberately exhaustive. A new table blocks cutover until assigned here.
export const referenceTables = [
  'elements', 'resource_definitions', 'characters', 'cosmetic_definitions', 'daily_challenge_definitions',
  'permanent_mission_definitions', 'item_definitions', 'event_definitions', 'shop_item_definitions',
  'element_combat_matchups',
] as const;
export const preservedTables = [
  '_prisma_migrations', 'players', 'web_identities', 'twitch_identities', 'player_preferences',
  'privacy_settings', 'player_role_assignments', 'player_sessions',
] as const;
export const clearTables = [
  'admin_audit_entries', 'trade_requests', 'trade_executions', 'player_cosmetics', 'player_permanent_mission_states',
  'player_permanent_mission_progress', 'player_daily_challenges', 'player_items', 'item_acquisitions',
  'banner_rotations', 'banner_featured_characters', 'banner_votes', 'player_gacha_states',
  'player_progression', 'twitch_link_states', 'migration_previews', 'migration_runs',
  'migration_batches', 'migration_source_files', 'migration_mappings', 'migration_issues',
  'boss_legacy_contributions', 'boss_legacy_aggregates', 'contest_legacy_daily_locks', 'friendship_legacy_heart_state', 'player_favor_states',
  'favor_grants', 'favor_daily_claims', 'giveaway_sessions', 'giveaway_participants',
  'giveaway_chat_stats', 'twitch_event_receipts', 'business_operations', 'event_editions',
  'event_calendar_claims', 'event_collection_acquisitions', 'player_event_currency_balances',
  'event_participants', 'event_milestone_claims', 'event_daily_player_states',
  'event_game_b_daily_states', 'friendships', 'friend_requests', 'friend_hearts',
  'player_social_stats', 'player_blocks', 'player_activity_state', 'direct_conversations',
  'direct_conversation_participants', 'direct_conversation_requests', 'direct_messages',
  'direct_message_reports', 'global_chat_messages', 'global_chat_state',
  'global_chat_read_states', 'global_chat_mentions', 'global_chat_reports',
  'event_social_messages', 'player_resource_balances', 'resource_movements',
  'player_economy_stats', 'player_bank_accounts', 'bank_transactions', 'shop_purchases',
  'player_wheel_stats', 'player_wheel_daily_states', 'player_daily_reward_state',
  'player_characters', 'c6_competition_progress', 'contest_daily_themes', 'contests',
  'contest_participants', 'contest_spectators', 'contest_daily_participations',
  'contest_lobby_removals', 'contest_events', 'contest_rewards', 'pull_operations',
  'pull_results', 'teams', 'team_members', 'daily_combat_encounters',
  'daily_combat_enemies', 'player_daily_combat_loadouts', 'player_daily_combat_loadout_slots',
  'player_daily_combat_states', 'player_daily_combat_kos', 'daily_combat_attempts',
  'daily_combat_attempt_members', 'player_combat_stats', 'player_character_combat_stats',
  'player_expeditions', 'notifications', 'gift_codes', 'gift_code_editions',
  'gift_code_rewards', 'gift_code_claims', 'monthly_bosses', 'player_boss_loadouts',
  'player_boss_loadout_slots', 'boss_attacks', 'boss_attack_members',
  'player_boss_participations', 'player_boss_stats', 'boss_rewards',
] as const;

export type PurgeTable = { table: string; rows: bigint };
export type CutoverPurgePlan = { schema: string; deleteOrder: PurgeTable[]; retainedPlayers: bigint;
  retainedWebIdentities: bigint; retainedRoles: bigint; retainedPreferences: bigint; retainedPrivacy: bigint;
  deletedRows: bigint; tablesWithRows: number };

export async function buildCutoverPurgePlan(db: PrismaClient, schema: string): Promise<CutoverPurgePlan> {
  if (!/^[a-z][a-z0-9_]*$/.test(schema)) throw new Error('Invalid cutover plan schema.');
  const [tables, fks] = await Promise.all([
    db.$queryRawUnsafe<{ tablename: string }[]>(`SELECT tablename FROM pg_tables WHERE schemaname = $1 ORDER BY tablename`, schema),
    db.$queryRawUnsafe<{ child: string; parent: string }[]>(`SELECT child.relname AS child, parent.relname AS parent
      FROM pg_constraint fk JOIN pg_class child ON child.oid=fk.conrelid JOIN pg_class parent ON parent.oid=fk.confrelid
      JOIN pg_namespace cn ON cn.oid=child.relnamespace JOIN pg_namespace pn ON pn.oid=parent.relnamespace
      WHERE fk.contype='f' AND cn.nspname=$1 AND pn.nspname=$1`, schema),
  ]);
  const known = new Set<string>([...referenceTables, ...preservedTables, ...clearTables]);
  const actual = new Set(tables.map(row => row.tablename));
  if (known.size !== referenceTables.length + preservedTables.length + clearTables.length) throw new Error('Duplicate cutover table classification.');
  const unexpected = [...actual].filter(table => !known.has(table));
  const missing = [...known].filter(table => table !== '_prisma_migrations' && !actual.has(table));
  if (unexpected.length || missing.length) throw new Error(`Cutover table contract differs: unexpected=${unexpected.join(',')}; missing=${missing.join(',')}`);
  const clear = new Set<string>(clearTables);
  for (const { child, parent } of fks) if (!clear.has(child) && clear.has(parent)) throw new Error(`Preserved table ${child} references cleared table ${parent}.`);
  const dependencies = new Map<string, Set<string>>(clearTables.map(table => [table, new Set<string>()]));
  for (const { child, parent } of fks) if (clear.has(child) && clear.has(parent) && child !== parent) dependencies.get(parent)!.add(child);
  const ordered: string[] = [];
  const remaining = new Set<string>(clearTables);
  while (remaining.size) {
    const ready = [...remaining].filter(table => [...dependencies.get(table)!].every(child => !remaining.has(child))).sort();
    if (!ready.length) throw new Error('Cutover clear tables contain an FK cycle.');
    for (const table of ready) { ordered.push(table); remaining.delete(table); }
  }
  const counts: PurgeTable[] = [];
  for (const table of ordered) {
    const result = await db.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*)::bigint AS count FROM "${schema}"."${table}"`);
    counts.push({ table, rows: result[0]?.count ?? 0n });
  }
  const preserved = async (table: string) => actual.has(table)
    ? (await db.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*)::bigint AS count FROM "${schema}"."${table}"`))[0]?.count ?? 0n : 0n;
  return { schema, deleteOrder: counts, retainedPlayers: await preserved('players'), retainedWebIdentities: await preserved('web_identities'),
    retainedRoles: await preserved('player_role_assignments'), retainedPreferences: await preserved('player_preferences'),
    retainedPrivacy: await preserved('privacy_settings'), deletedRows: counts.reduce((sum, row) => sum + row.rows, 0n),
    tablesWithRows: counts.filter(row => row.rows > 0n).length };
}

/** Private-schema rehearsal only. Public cutover has no callable apply path in this foundation lot. */
export async function applyPrivateCutoverPurge(db: PrismaClient, plan: CutoverPurgePlan): Promise<void> {
  if (!/^batch_test_[0-9a-f]{32}$/.test(plan.schema)) throw new Error('Public cutover mutation is unavailable.');
  for (const { table, rows } of plan.deleteOrder) {
    if (rows === 0n) continue;
    await db.$executeRawUnsafe(`DELETE FROM "${plan.schema}"."${table}"`);
  }
}
