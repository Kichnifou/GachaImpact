import type { Prisma, PrismaClient } from '../../../generated/prisma/client.js';
import { captureTargetedPlayerRows, type RowGraph } from './targeted-player-rows.js';
import { assertLegacyCosmeticsClassified } from '../appearance/derived-player-cosmetics.js';
import { communityHash } from './legacy-community-proof.js';

// The contract is deliberately exhaustive. A new table blocks cutover until assigned here.
export const referenceTables = [
  'elements', 'resource_definitions', 'characters', 'cosmetic_definitions', 'daily_challenge_definitions',
  'permanent_mission_definitions', 'item_definitions', 'event_definitions', 'shop_item_definitions',
  'element_combat_matchups',
] as const;
export const preservedTables = [
  '_prisma_migrations', 'players', 'web_identities', 'twitch_identities', 'player_preferences',
  'privacy_settings', 'player_role_assignments', 'twitch_link_resolutions', 'twitch_canonicalization_plans', 'legacy_friendship_facts',
  // Operational authorizations are not gameplay; rehearsal never enables or refreshes them.
  'twitch_gift_supreme_credentials', 'twitch_giveaway_credentials',
  'twitch_native_authorities', 'twitch_native_targets', 'twitch_native_audit', 'twitch_canary_imports',
] as const;
export const clearTables = [
  'admin_audit_entries', 'player_sessions', 'trade_requests', 'trade_executions', 'player_cosmetics', 'player_permanent_mission_states',
  'player_permanent_mission_progress', 'player_daily_challenges', 'player_items', 'item_acquisitions',
  'banner_rotations', 'banner_featured_characters', 'banner_votes', 'player_gacha_states',
  'player_progression', 'twitch_link_states', 'migration_previews', 'migration_runs',
  'migration_batches', 'migration_source_files', 'migration_mappings', 'migration_issues',
  'boss_legacy_contributions', 'boss_legacy_aggregates', 'contest_legacy_daily_locks', 'friendship_legacy_heart_state', 'player_favor_states',
  'favor_grants', 'favor_daily_claims', 'giveaway_sessions', 'giveaway_participants',
  'giveaway_chat_stats', 'giveaway_wins', 'twitch_event_receipts', 'business_operations', 'event_editions',
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
  'giveaway_announcements', 'giveaway_command_receipts', 'giveaway_counted_messages',
  'giveaway_deferred_messages', 'giveaway_rewards',
  'arcade_daily_grants', 'arcade_invitations', 'arcade_receipts', 'arcade_sessions', 'arcade_stats',
] as const;

export type PurgeTable = { table: string; rows: bigint };
export type CutoverPurgePlan = { schema: string; deleteOrder: PurgeTable[]; retainedPlayers: bigint;
  retainedWebIdentities: bigint; retainedRoles: bigint; retainedPreferences: bigint; retainedPrivacy: bigint;
  deletedRows: bigint; tablesWithRows: number; retainedRows?: RowGraph; operatorProofFingerprint?: string };

async function operatorRelations(db: Prisma.TransactionClient) {
  const plans = await db.twitchCanonicalizationPlan.findMany({ orderBy: { id: 'asc' } });
  const resolutions = await db.twitchLinkResolution.findMany({ where: { completedAt: { not: null } }, orderBy: { id: 'asc' } });
  const relations = await db.friendship.findMany({ where: { legacyFactId: { not: null } }, orderBy: { id: 'asc' }, include: { legacyFact: true } });
  return { plans, resolutions, relations };
}

/** Review candidate, isolated schemas only. The public/default owner below keeps its
 * mandatory guard. This private path retains both operator graphs and every version
 * of legacy social relations; it authorizes neither shared imports nor public purge. */
export async function buildPrivateOperatorRetentionPurgePlan(db: PrismaClient, schema: string, protectedPlayerIds: string[] = []) {
  if (!/^batch_test_[0-9a-f]{32}$/.test(schema)) throw Error('CUTOVER_OPERATOR_REHEARSAL_PRIVATE_ONLY');
  const actual = (await db.$queryRaw<{ schema: string }[]>`SELECT current_schema() AS schema`)[0]?.schema;
  if (actual !== schema) throw Error('CUTOVER_OPERATOR_REHEARSAL_SCHEMA_MISMATCH');
  const proof = await operatorRelations(db);
  const ids = [...new Set([...protectedPlayerIds, ...proof.plans.flatMap(p => [p.webPlayerId, p.twitchPlayerId, p.operatorPlayerId]),
    ...proof.resolutions.flatMap(r => [r.webPlayerId, r.twitchPlayerId]), ...proof.relations.flatMap(r => [r.playerAId, r.playerBId])])];
  const plan = await buildPurgePlan(db, schema, ids, communityHash(proof));
  if (communityHash(await operatorRelations(db)) !== plan.operatorProofFingerprint) throw Error('CUTOVER_OPERATOR_RELATION_PROOFS_CHANGED');
  return plan;
}

export async function buildCutoverPurgePlan(db: PrismaClient, schema: string, protectedPlayerIds: string[] = []): Promise<CutoverPurgePlan> {
  return buildPurgePlan(db, schema, protectedPlayerIds);
}

async function buildPurgePlan(db: PrismaClient, schema: string, protectedPlayerIds: string[], operatorProofFingerprint?: string): Promise<CutoverPurgePlan> {
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
  // This older global owner has no reviewed compensation contract for operator
  // plans or versioned social materializations. Preserve their proof and fail
  // closed instead of clearing relations beneath it. Targeted migration is separate.
  if (!operatorProofFingerprint && (await db.twitchCanonicalizationPlan.count() || await db.friendship.count({ where: { legacyFactId: { not: null } } })))
    throw new Error('CUTOVER_OPERATOR_RELATION_PROOFS_PRESENT');
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
  // Native ownership is a mandatory guard even when a caller omitted its explicit preservation list.
  const nativeTargets = await db.twitchNativeTarget.findMany({ where: { dataAuthority: 'NATIVE', playerId: { not: null } }, select: { playerId: true } });
  const resolutions = await db.twitchLinkResolution.findMany({ where: { OR: [{ completedAt: { not: null } }, { webPlayer: { status: 'ARCHIVED' } }] }, select: { webPlayerId: true, twitchPlayerId: true } });
  const protectedIds = [...new Set([...protectedPlayerIds, ...nativeTargets.map(target => target.playerId!), ...resolutions.flatMap(record => [record.webPlayerId, record.twitchPlayerId])])];
  const retainedRows = protectedIds.length ? await captureTargetedPlayerRows(db, protectedIds, ['players', ...clearTables], true) : undefined;
  if (retainedRows && retainedRows.schema !== schema) throw new Error('Cutover protected rows escaped requested schema.');
  return { schema, deleteOrder: counts, retainedRows, operatorProofFingerprint, retainedPlayers: await preserved('players'), retainedWebIdentities: await preserved('web_identities'),
    retainedRoles: await preserved('player_role_assignments'), retainedPreferences: await preserved('player_preferences'),
    retainedPrivacy: await preserved('privacy_settings'), deletedRows: counts.reduce((sum, row) => sum + row.rows, 0n),
    tablesWithRows: counts.filter(row => row.rows > 0n).length };
}

/** Private-schema rehearsal only. Public cutover has no callable apply path in this foundation lot. */
export async function applyPrivateCutoverPurge(db: Prisma.TransactionClient, plan: CutoverPurgePlan): Promise<void> {
  if (!/^batch_test_[0-9a-f]{32}$/.test(plan.schema)) throw new Error('Public cutover mutation is unavailable.');
  const actual = (await db.$queryRaw<{ schema: string }[]>`SELECT current_schema() AS schema`)[0]?.schema;
  if (actual !== plan.schema) throw Error('CUTOVER_PRIVATE_SCHEMA_MISMATCH');
  if (plan.operatorProofFingerprint && communityHash(await operatorRelations(db)) !== plan.operatorProofFingerprint) throw Error('CUTOVER_OPERATOR_RELATION_PROOFS_CHANGED');
  if (plan.deleteOrder.some(row => row.table === 'player_cosmetics' && row.rows > 0n)) {
    const owners = await db.playerCosmetic.findMany({ where: { playerId: { notIn: plan.retainedRows?.playerIds ?? [] } }, select: { playerId: true }, distinct: ['playerId'] });
    await assertLegacyCosmeticsClassified(db, owners.map(row => row.playerId));
  }
  for (const { table, rows } of plan.deleteOrder) {
    if (rows === 0n) continue;
    const retained = plan.retainedRows?.tables[table];
    if (retained?.length) await db.$executeRawUnsafe(`DELETE FROM "${plan.schema}"."${table}" c WHERE NOT EXISTS
      (SELECT 1 FROM json_populate_recordset(NULL::"${plan.schema}"."${table}",$1::json) p WHERE to_jsonb(c)=to_jsonb(p))`, `[${retained.join(',')}]`);
    else await db.$executeRawUnsafe(`DELETE FROM "${plan.schema}"."${table}"`);
  }
}

/** Shared imports can add facts with a Native endpoint, but may never change any retained preimage row. */
export async function assertCutoverProtectedRows(db: Prisma.TransactionClient, plan: CutoverPurgePlan) {
  if (!plan.retainedRows) return;
  for (const [table, rows] of Object.entries(plan.retainedRows.tables)) {
    if (!rows.length) continue;
    const result = await db.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*)::bigint count
      FROM json_populate_recordset(NULL::"${plan.schema}"."${table}",$1::json) p WHERE EXISTS
      (SELECT 1 FROM "${plan.schema}"."${table}" c WHERE to_jsonb(c)=to_jsonb(p))`, `[${rows.join(',')}]`);
    if (result[0]!.count !== BigInt(rows.length)) throw new Error('CUTOVER_PROTECTED_PLAYER_CHANGED');
  }
}
