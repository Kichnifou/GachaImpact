// Frozen R1055 baseline (0af5827): independent DB oracle for safety and fingerprint equality.
import { createHash } from 'node:crypto';
import type { Prisma } from '../generated/prisma/client.js';
import { personalReplacementTables, rowGraphIdentifier as ident, targetedRowMetadata, type ForeignKey } from '../src/application/migration/targeted-player-rows.js';

type Tx = Prisma.TransactionClient;
type Metadata = Awaited<ReturnType<typeof targetedRowMetadata>>;
export type CanonicalizationSafety = { status: 'SAFE' | 'OPERATOR_REQUIRED'; reason: 'TWITCH_PROGRESSION_SHARED_STATE_REQUIRES_OPERATOR' | 'TWITCH_PROGRESSION_NATIVE_AUTHORITY_REQUIRES_OPERATOR' | null };
type Classification = 'OWNED_PERSONAL' | 'SAFE_HISTORICAL' | 'SHARED_ACTIVE';

// Reuse the replacement owner's personal domains. Everything not explicitly owned or
// proven historical is unsafe when referenced, including future FK tables/columns.
const owned = new Set<string>([...personalReplacementTables, 'players', 'player_preferences', 'privacy_settings', 'player_role_assignments',
  'banner_votes', 'notifications', 'gift_code_claims', 'event_calendar_claims', 'event_collection_acquisitions',
  'player_event_currency_balances', 'event_participants', 'event_milestone_claims', 'event_daily_player_states',
  'boss_legacy_contributions', 'contest_legacy_daily_locks', 'contest_daily_participations', 'contest_rewards',
  'boss_attacks', 'boss_attack_members', 'player_boss_participations', 'boss_rewards',
  'giveaway_chat_stats', 'giveaway_wins', 'giveaway_rewards', 'arcade_sessions', 'arcade_receipts', 'arcade_daily_grants', 'arcade_stats']);
const housekeeping = new Set(['web_identities', 'twitch_identities', 'player_sessions', 'twitch_link_states', 'twitch_link_resolutions',
  'migration_previews', 'global_chat_read_states']);
const historical = new Set(['admin_audit_entries', 'twitch_native_audit', 'twitch_canary_imports', 'global_chat_messages']);
const join = (fk: ForeignKey) => fk.child_columns.map((column,i) => `c.${ident(column)}=p.${ident(fk.parent_columns[i]!)}`).join(' AND ');
const records = (schema: string, table: string) => `json_populate_recordset(NULL::${ident(schema)}.${ident(table)},($1::jsonb->'${table}')::json)`;
const graphJson = (tables: Record<string,string[]>) => `{${Object.entries(tables).map(([table,rows])=>`${JSON.stringify(table)}:[${rows.join(',')}]`).join(',')}}`;
const signature = (fk: ForeignKey) => `${fk.child}(${fk.child_columns.join(',')})->${fk.parent}(${fk.parent_columns.join(',')})`;

/** Canonical JSONB text preserves int8 precision. No raw graph is persisted or returned. */
async function personalProjection(tx: Tx, playerId: string, meta: Metadata) {
  const tables: Record<string,string[]> = { players: (await tx.$queryRawUnsafe<{row:string}[]>(`SELECT to_jsonb(p)::text row FROM ${ident(meta.schema)}.players p WHERE id=$1::uuid`,playerId)).map(r=>r.row) };
  const rootColumns = new Map<string,string[]>();
  for(const fk of meta.fks.filter(fk=>fk.parent==='players')) rootColumns.set(fk.child,[...(rootColumns.get(fk.child)??[]),...fk.child_columns]);
  // Same downward row closure as targeted-player-rows, batched to avoid one round-trip
  // per FK. A child with its own player_id can never be pulled from another Player.
  for (;;) {
    const queries = meta.fks.filter(fk=>owned.has(fk.child)&&fk.child!=='players'&&tables[fk.parent]?.length)
      .filter(fk=>fk.parent!=='players'||fk.child_columns.length===1&&fk.child_columns[0]==='player_id')
      .map(fk=>`SELECT '${fk.child}'::text table_name,to_jsonb(c)::text row FROM ${ident(meta.schema)}.${ident(fk.child)} c JOIN ${records(meta.schema,fk.parent)} p ON ${join(fk)} WHERE $2::uuid IS NOT NULL${fk.parent!=='players'&&rootColumns.get(fk.child)?.includes('player_id')?' AND c.player_id=$2::uuid':''}`);
    if(!queries.length) break;
    const rows = await tx.$queryRawUnsafe<{table_name:string;row:string}[]>(queries.join(' UNION '),graphJson(tables),playerId);
    let changed=false;
    for(const row of rows) { const previous=tables[row.table_name]??=[]; if(!previous.includes(row.row)) { previous.push(row.row);changed=true; } }
    if(!changed) break;
  }
  return Object.fromEntries(Object.entries(tables).sort(([a],[b])=>a.localeCompare(b)).map(([table,rows])=>[table,[...rows].sort()]));
}

/** SQL classification for existing rows; unknown tables/FKs always fail closed. */
function classification(fk: ForeignKey, meta: Metadata): string {
  const {schema}=meta, table=fk.child;
  if(housekeeping.has(table)||historical.has(table)) return "'SAFE_HISTORICAL'";
  // Native targets are retargeted under the existing authority/identity guard; they
  // are not abandoned relational ownership. Credentials/authority operators remain unsafe.
  if(table==='twitch_native_targets') return "'SAFE_HISTORICAL'";
  if(table==='player_role_assignments'&&fk.child_columns.includes('granted_by_player_id')) return "'SAFE_HISTORICAL'";
  const closedContest=`EXISTS(SELECT 1 FROM ${ident(schema)}.contests t WHERE t.id=c.contest_id AND t.status IN ('FINISHED','CANCELLED'))`;
  if(['contest_participants','contest_spectators','contest_lobby_removals','contest_events'].includes(table)) return `CASE WHEN ${closedContest} THEN 'SAFE_HISTORICAL' ELSE 'SHARED_ACTIVE' END`;
  if(table==='contests') return "CASE WHEN c.status IN ('FINISHED','CANCELLED') THEN 'SAFE_HISTORICAL' ELSE 'SHARED_ACTIVE' END";
  if(table==='trade_requests') return "CASE WHEN c.state IN ('ACCEPTED','REFUSED','CANCELLED','EXPIRED') THEN 'SAFE_HISTORICAL' ELSE 'SHARED_ACTIVE' END";
  if(table==='trade_executions') return "'SAFE_HISTORICAL'";
  if(table==='monthly_bosses') return "CASE WHEN c.defeated_at IS NOT NULL THEN 'SAFE_HISTORICAL' ELSE 'SHARED_ACTIVE' END";
  if(!owned.has(table)) return "'SHARED_ACTIVE'";
  // A new cross-player FK on an owned table must not inherit its old ownership policy.
  const playerFks=meta.fks.filter(edge=>edge.child===table&&edge.parent==='players');
  const expected=new Set(table==='player_role_assignments'?['player_id','granted_by_player_id']:table==='arcade_sessions'?['player_id','opponent_player_id']:['player_id']);
  if(playerFks.some(edge=>edge.child_columns.some(column=>!expected.has(column)))) return "'SHARED_ACTIVE'";
  const captured=`EXISTS(SELECT 1 FROM ${records(schema,table)} mine WHERE to_jsonb(mine)=to_jsonb(c))`;
  let admissible='TRUE';
  if(table==='player_role_assignments') admissible="NOT(c.revoked_at IS NULL AND c.role IN ('ADMIN','MODERATOR'))";
  if(table==='player_expeditions') admissible="c.state='IDLE'";
  if(table==='business_operations') admissible="c.status IN ('COMPLETED','FAILED')";
  if(table==='arcade_sessions') return "CASE WHEN c.status IN ('FINISHED','ABANDONED') THEN 'SAFE_HISTORICAL' ELSE 'SHARED_ACTIVE' END";
  if(table==='event_participants') admissible=`EXISTS(SELECT 1 FROM ${ident(schema)}.event_editions e WHERE e.id=c.event_edition_id AND e.ends_at<CURRENT_TIMESTAMP)`;
  if(['player_boss_participations','boss_legacy_contributions','boss_attacks','boss_rewards'].includes(table)) admissible=`EXISTS(SELECT 1 FROM ${ident(schema)}.monthly_bosses b WHERE b.id=c.boss_id AND b.defeated_at IS NOT NULL)`;
  return `CASE WHEN ${captured} AND (${admissible}) THEN 'OWNED_PERSONAL' ELSE 'SHARED_ACTIVE' END`;
}

export async function assessBaselineCanonicalizationSafety(tx: Tx, playerId: string, metadata?: Metadata) {
  const meta=metadata??await targetedRowMetadata(tx);
  const tables=await personalProjection(tx,playerId,meta);
  const evidenceQueries:string[]=[];
  for(const fk of meta.fks) {
    ident(fk.child);ident(fk.parent);fk.child_columns.forEach(ident);fk.parent_columns.forEach(ident);
    if(tables[fk.parent]?.length) evidenceQueries.push(`SELECT '${signature(fk)}'::text edge,${classification(fk,meta)} classification,count(*)::text count FROM ${ident(meta.schema)}.${ident(fk.child)} c JOIN ${records(meta.schema,fk.parent)} p ON ${join(fk)} GROUP BY 2`);
    // Also reject a known owned row pointing outside its captured personal graph.
    // This catches future cross-owner references through Teams/items/etc, without
    // treating catalog/global parents as personal data or capturing another Player.
    if(tables[fk.child]?.length&&owned.has(fk.parent)&&!housekeeping.has(fk.child)&&!historical.has(fk.child)
      &&!(fk.child==='player_role_assignments'&&fk.child_columns.includes('granted_by_player_id'))
      &&!(fk.child==='arcade_sessions'&&fk.child_columns.includes('opponent_player_id')))
      evidenceQueries.push(`SELECT '${signature(fk)}:external'::text edge,'SHARED_ACTIVE'::text classification,count(*)::text count FROM ${records(meta.schema,fk.child)} c JOIN ${ident(meta.schema)}.${ident(fk.parent)} p ON ${join(fk)} WHERE NOT EXISTS(SELECT 1 FROM ${records(meta.schema,fk.parent)} mine WHERE to_jsonb(mine)=to_jsonb(p)) HAVING count(*)>0`);
  }
  const evidence=await tx.$queryRawUnsafe<{edge:string;classification:Classification;count:string}[]>(evidenceQueries.join(' UNION ALL '),graphJson(tables));
  evidence.sort((a,b)=>a.edge.localeCompare(b.edge)||a.classification.localeCompare(b.classification));
  // Technical polling/OAuth challenges are excluded from consent stability and do
  // not hash credentials. Existing operators/credentials still appear as unsafe counts.
  const stableEvidence=evidence.filter(row=>!housekeeping.has(row.edge.split('(')[0]!));
  const safety:CanonicalizationSafety={status:stableEvidence.some(row=>row.classification==='SHARED_ACTIVE'&&row.count!=='0')?'OPERATOR_REQUIRED':'SAFE',reason:null};
  if(safety.status==='OPERATOR_REQUIRED') safety.reason='TWITCH_PROGRESSION_SHARED_STATE_REQUIRES_OPERATOR';
  const fingerprint=createHash('sha256').update(JSON.stringify({version:1,tables,foreignKeys:meta.fks.filter(fk=>!housekeeping.has(fk.child)).map(signature).sort(),safety:stableEvidence})).digest('hex');
  return {fingerprint,safety, classifications:stableEvidence};
}
