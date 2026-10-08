import { createHash } from 'node:crypto';
import type { Prisma } from '../../../generated/prisma/client.js';
import { personalReplacementTables, rowGraphIdentifier as ident, targetedRowMetadata, type ForeignKey } from '../migration/targeted-player-rows.js';

import { captureCanonicalizationGraph, graphRecordsets, groups, join, measure, rootColumns, type Diagnostic } from './canonicalization-graph.js';
export type { CanonicalizationMetric } from './canonicalization-graph.js';

type Tx = Prisma.TransactionClient;
type Metadata = Awaited<ReturnType<typeof targetedRowMetadata>>;
export type CanonicalizationSafety = { status: 'SAFE' | 'OPERATOR_REQUIRED'; reason: 'TWITCH_PROGRESSION_SHARED_STATE_REQUIRES_OPERATOR' | 'TWITCH_PROGRESSION_NATIVE_AUTHORITY_REQUIRES_OPERATOR' | null };
type Classification = 'OWNED_PERSONAL' | 'SAFE_HISTORICAL' | 'SHARED_ACTIVE';
// Reuse the replacement owner's personal domains. Everything not explicitly owned or
// proven historical is unsafe when referenced, including future FK tables/columns.
export const canonicalizationOwnedTables = new Set<string>([...personalReplacementTables, 'players', 'player_preferences', 'privacy_settings', 'player_role_assignments',
  'banner_votes', 'notifications', 'gift_code_claims', 'event_calendar_claims', 'event_collection_acquisitions',
  'player_event_currency_balances', 'event_participants', 'event_milestone_claims', 'event_daily_player_states',
  'boss_legacy_contributions', 'contest_legacy_daily_locks', 'contest_daily_participations', 'contest_rewards',
  'boss_attacks', 'boss_attack_members', 'player_boss_participations', 'boss_rewards',
  'giveaway_chat_stats', 'giveaway_wins', 'giveaway_rewards', 'arcade_sessions', 'arcade_receipts', 'arcade_daily_grants', 'arcade_stats']);
const owned = canonicalizationOwnedTables;
const housekeeping = new Set(['web_identities', 'twitch_identities', 'player_sessions', 'twitch_link_states', 'twitch_link_resolutions', 'twitch_canonicalization_plans',
  'migration_previews', 'global_chat_read_states']);
const historical = new Set(['admin_audit_entries', 'twitch_native_audit', 'twitch_canary_imports', 'global_chat_messages']);
const signature = (fk: ForeignKey) => `${fk.child}(${fk.child_columns.join(',')})->${fk.parent}(${fk.parent_columns.join(',')})`;

/** SQL classification for existing rows; unknown tables/FKs always fail closed. */
function classification(fk: ForeignKey, meta: Metadata, ownership: ReturnType<typeof rootColumns>): string {
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
  // This incoming row is reached from a captured parent. At the completed fixed
  // point it belongs to the graph iff the same downward ownership guard allows it.
  // players is the only owned table never descended into; only its root may match.
  // Unknown cross-player columns have already failed closed above.
  const captured=table==='players'?'c.id=$2::uuid':ownership.get(table)?.has('player_id')?'c.player_id=$2::uuid':'TRUE';
  let admissible='TRUE';
  if(table==='player_role_assignments') admissible="NOT(c.revoked_at IS NULL AND c.role IN ('ADMIN','MODERATOR'))";
  if(table==='player_expeditions') admissible="c.state='IDLE'";
  if(table==='business_operations') admissible="c.status IN ('COMPLETED','FAILED')";
  if(table==='arcade_sessions') return "CASE WHEN c.status IN ('FINISHED','ABANDONED') THEN 'SAFE_HISTORICAL' ELSE 'SHARED_ACTIVE' END";
  if(table==='event_participants') admissible=`EXISTS(SELECT 1 FROM ${ident(schema)}.event_editions e WHERE e.id=c.event_edition_id AND e.ends_at<CURRENT_TIMESTAMP)`;
  if(['player_boss_participations','boss_legacy_contributions','boss_attacks','boss_rewards'].includes(table)) admissible=`EXISTS(SELECT 1 FROM ${ident(schema)}.monthly_bosses b WHERE b.id=c.boss_id AND b.defeated_at IS NOT NULL)`;
  return `CASE WHEN ${captured} AND (${admissible}) THEN 'OWNED_PERSONAL' ELSE 'SHARED_ACTIVE' END`;
}

export async function assessPlayerCanonicalizationSafety(tx: Tx, playerId: string, metadata?: Metadata, diagnostic?: Diagnostic) {
  const totalStart=performance.now(),snapshotStart=performance.now();
  // Key equality replaces row-image equality only within a stable MVCC snapshot.
  // R1055 owners use Serializable; read-only preflights use RepeatableRead.
  const isolation=await tx.$queryRawUnsafe<{transaction_isolation:string}[]>('SHOW transaction_isolation');
  if(!['repeatable read','serializable'].includes(isolation[0]?.transaction_isolation??'')) throw new Error('CANONICALIZATION_STABLE_SNAPSHOT_REQUIRED');
  measure(diagnostic,'snapshot',snapshotStart);
  const metadataStart=performance.now(),meta=metadata??await targetedRowMetadata(tx);
  measure(diagnostic,'metadata',metadataStart,{branches:meta.fks.length});
  const {graph,tables}=await captureCanonicalizationGraph(tx,playerId,meta,owned,diagnostic);
  const ownership=rootColumns(meta);
  type Records=ReturnType<typeof graphRecordsets>;
  const branches:{parent:string;render:(records:Records)=>string}[]=[];
  for(const fk of meta.fks) {
    ident(fk.child);ident(fk.parent);fk.child_columns.forEach(ident);fk.parent_columns.forEach(ident);
    if(tables[fk.parent]?.length) branches.push({parent:fk.parent,render:records=>`SELECT '${signature(fk)}'::text edge,${classification(fk,meta,ownership)} classification,count(*)::text count FROM ${ident(meta.schema)}.${ident(fk.child)} c JOIN ${records.table(fk.parent)} p ON ${join(fk)} WHERE $2::uuid IS NOT NULL GROUP BY 2`});
    if(tables[fk.child]?.length&&owned.has(fk.parent)&&!housekeeping.has(fk.child)&&!historical.has(fk.child)
      &&!(fk.child==='player_role_assignments'&&fk.child_columns.includes('granted_by_player_id'))
      &&!(fk.child==='arcade_sessions'&&fk.child_columns.includes('opponent_player_id')))
      // A FK targets a unique key. Under this snapshot, matching its non-null
      // referenced tuple identifies exactly the same full row as the old engine.
      branches.push({parent:fk.parent,render:records=>`SELECT '${signature(fk)}:external'::text edge,'SHARED_ACTIVE'::text classification,count(*)::text count FROM ${records.table(fk.child)} c JOIN ${ident(meta.schema)}.${ident(fk.parent)} p ON ${join(fk)} WHERE $2::uuid IS NOT NULL AND NOT EXISTS(SELECT 1 FROM ${records.table(fk.parent)} mine WHERE ${fk.parent_columns.map(column=>`mine.${ident(column)}=p.${ident(column)}`).join(' AND ')}) HAVING count(*)>0`});
  }
  const evidence:{edge:string;classification:Classification;count:string}[]=[];
  for(const [batch,group] of groups(branches.sort((a,b)=>a.parent.localeCompare(b.parent))).entries()) {
    const buildStart=performance.now(),records=graphRecordsets(meta.schema,graph);
    const {sql,input}=records.query(group.map(branch=>branch.render(records)).join(' UNION ALL '));
    measure(diagnostic,'evidence-build',buildStart,{batch,branches:group.length,inputBytes:Buffer.byteLength(input)});
    const executeStart=performance.now();
    const rows=await tx.$queryRawUnsafe<typeof evidence>(sql,input,playerId);
    evidence.push(...rows);
    measure(diagnostic,'evidence-execute',executeStart,{batch,rows:rows.length});
  }
  const fingerprintStart=performance.now();
  evidence.sort((a,b)=>a.edge.localeCompare(b.edge)||a.classification.localeCompare(b.classification));
  // Technical polling/OAuth challenges are excluded from consent stability and do
  // not hash credentials. Existing operators/credentials still appear as unsafe counts.
  const stableEvidence=evidence.filter(row=>!housekeeping.has(row.edge.split('(')[0]!));
  const safety:CanonicalizationSafety={status:stableEvidence.some(row=>row.classification==='SHARED_ACTIVE'&&row.count!=='0')?'OPERATOR_REQUIRED':'SAFE',reason:null};
  if(safety.status==='OPERATOR_REQUIRED') safety.reason='TWITCH_PROGRESSION_SHARED_STATE_REQUIRES_OPERATOR';
  const fingerprint=createHash('sha256').update(JSON.stringify({version:1,tables,foreignKeys:meta.fks.filter(fk=>!housekeeping.has(fk.child)).map(signature).sort(),safety:stableEvidence})).digest('hex');
  measure(diagnostic,'fingerprint',fingerprintStart,{tables:Object.keys(tables).length,rows:Object.values(tables).reduce((n,rows)=>n+rows.length,0)});
  measure(diagnostic,'total',totalStart);
  return {fingerprint,safety, classifications:stableEvidence};
}
