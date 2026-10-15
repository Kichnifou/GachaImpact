import type { PrismaClient } from '../../../generated/prisma/client.js';
import { expirationSql, retentionPolicies, type ExclusionReason, type RetentionDomain } from './retention-policy.js';

type Rule = { domain: RetentionDomain; table: string; date: string; order?: string; filter?: string; terminal?: string; protection: string; reason: ExclusionReason; nonTerminalReason?:ExclusionReason; operation: string };
// Closed SQL vocabulary, never user input. Only metadata, dates and booleans leave PostgreSQL.
// A durable relation protects the row even when the display detail might later be separable.
export const retentionRules: readonly Rule[] = [
  { domain:'twitch_terminal',table:'twitch_event_receipts',date:'processed_at',filter:"r.payload_minimal ? 'commandPilot'",terminal:"r.state='PROCESSED' AND r.payload_minimal->'commandPilot'->>'stage'='RESPONSES' AND jsonb_typeof(r.payload_minimal->'commandPilot'->'responses')='array' AND jsonb_array_length(CASE WHEN jsonb_typeof(r.payload_minimal->'commandPilot'->'responses')='array' THEN r.payload_minimal->'commandPilot'->'responses' ELSE '[]'::jsonb END)>0 AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(r.payload_minimal->'commandPilot'->'responses')='array' THEN r.payload_minimal->'commandPilot'->'responses' ELSE '[]'::jsonb END) x WHERE x->>'status' IS DISTINCT FROM 'SENT')",protection:'TRUE',reason:'RECOVERY_EVENT_MIGRATION_PROOF',operation:'terminal detail compaction with durable proof' },
  { domain:'twitch_passive',table:'twitch_event_receipts',date:'received_at',filter:"r.event_type='channel.chat.message' AND r.state='RECEIVED' AND r.processed_at IS NULL AND NOT COALESCE(r.payload_minimal ? 'commandPilot',FALSE)",terminal:"r.event_type='channel.chat.message' AND r.state='RECEIVED' AND r.processed_at IS NULL AND r.external_reference IS NULL AND NOT EXISTS (SELECT 1 FROM favor_grants f WHERE f.twitch_event_receipt_id=r.id)",protection:'TRUE',reason:'EXISTING_TTL_OWNER',nonTerminalReason:'RECOVERY_EVENT_MIGRATION_PROOF',operation:'existing TTL owner only; no second cleaner' },
  { domain:'chat',table:'global_chat_messages',date:'created_at',protection:"r.operation_id IS NOT NULL OR r.external_message_id IS NOT NULL OR r.reply_to_message_id IS NOT NULL OR EXISTS (SELECT 1 FROM global_chat_messages x WHERE x.reply_to_message_id=r.id) OR EXISTS (SELECT 1 FROM global_chat_reports x WHERE x.message_id=r.id) OR EXISTS (SELECT 1 FROM global_chat_mentions x WHERE x.message_id=r.id) OR EXISTS (SELECT 1 FROM global_chat_read_states x WHERE x.last_read_message_id=r.id)",reason:'MODERATION_RELATION_PROOF',operation:'ordinary display detail removal if all relations qualified' },
  { domain:'bank',table:'bank_transactions',date:'created_at',protection:'TRUE',reason:'DURABLE_ECONOMIC_PROOF',operation:'display detail separation; retain transaction proof' },
  { domain:'shop',table:'shop_purchases',date:'purchased_at',protection:'TRUE',reason:'DURABLE_ECONOMIC_PROOF',operation:'display detail separation; retain replay/effects' },
  { domain:'trades',table:'trade_requests',date:'resolved_at',terminal:"r.state::text<>'PENDING'",protection:'TRUE',reason:'DURABLE_ECONOMIC_PROOF',operation:'resolved request detail separation; executions retained' },
  { domain:'gift_codes',table:'gift_code_claims',date:'claimed_at',order:'gift_code_edition_id,player_id',protection:'TRUE',reason:'DEDUPLICATION_PROOF',operation:'player detail separation; claim retained' },
  { domain:'event',table:'event_editions',date:'ends_at',terminal:"r.status::text='FINISHED'",protection:'TRUE',reason:'DURABLE_ECONOMIC_PROOF',operation:'edition detail summary; claims/points/draw retained' },
  { domain:'boss',table:'boss_attacks',date:'created_at',protection:'TRUE',reason:'DURABLE_ECONOMIC_PROOF',operation:'attack detail summary; rewards/stats retained' },
  { domain:'combat',table:'daily_combat_attempts',date:'created_at',protection:'TRUE',reason:'DURABLE_ECONOMIC_PROOF',operation:'attempt detail summary; results/stats retained' },
  { domain:'contest',table:'contests',date:'COALESCE(r.finished_at,r.cancelled_at)',terminal:"r.status::text IN ('FINISHED','CANCELLED')",protection:'TRUE',reason:'DURABLE_ECONOMIC_PROOF',operation:'terminal detail summary; ranking/rewards retained' },
  { domain:'notifications',table:'notifications',date:'resolved_at',terminal:"r.state::text='RESOLVED'",protection:"r.deduplication_key IS NOT NULL OR r.action_target_id IS NOT NULL",reason:'DEDUPLICATION_PROOF',operation:'resolved display detail separation; dedup retained' },
  { domain:'gacha',table:'pull_results',date:'created_at',protection:'TRUE',reason:'ORIGINAL_GACHA_PROOF',operation:'detail summary retaining last rarity and original Team/v2 summary' },
  { domain:'direct_messages',table:'direct_messages',date:'created_at',protection:'TRUE',reason:'MODERATION_RELATION_PROOF',operation:'content removal only after relations/moderation/recovery qualification' },
  { domain:'arcade',table:'arcade_receipts',date:'created_at',protection:'TRUE',reason:'DEDUPLICATION_PROOF',operation:'receipt compaction retaining fingerprint/result and claims' },
  { domain:'catalog',table:'catalog_attempts',date:'checked_at',protection:'TRUE',reason:'CATALOG_PROVENANCE',operation:'technical log separation; publication/provenance retained' },
];

export type DomainReport = { domain: RetentionDomain; table: string; policy: string; temporalReference: string; inspectedAt: string;
  scope: 'PRIMARY_DETAIL_TABLE'; eligibilityQualification: 'B2_UNQUALIFIED';
  inspected: number; withinRetention: number; expiredCalendar: number; expiredProtected: number; expiredUnqualified: number;
  unknownDate: number; nonTerminalProtected: number; expiredNonTerminalProtected:number; technicallyEligible: 0; coverage: 'EXHAUSTIVE'|'PARTIAL'|'ERROR';
  reasons: Partial<Record<ExclusionReason,number>>; futureOperation: string; durationMs: number; errorCode?: string;
  logicalCandidateBytes: null; physicalGainBytes: null };
export class RetentionInventory {
  constructor(private readonly database: PrismaClient, private readonly rowLimit = 10_000) {
    if (!Number.isInteger(rowLimit) || rowLimit < 1 || rowLimit > 10_000) throw new RangeError('Invalid retention scan budget');
  }
  async inspect(rule: Rule, now: Date): Promise<DomainReport> {
    const started=performance.now();
    const date=rule.date.includes('(')?rule.date:`r.${rule.date}`;
    const order=rule.order??'id';
    const base={ domain:rule.domain,table:rule.table,policy:retentionPolicies[rule.domain],temporalReference:rule.date,inspectedAt:now.toISOString(),
      scope:'PRIMARY_DETAIL_TABLE' as const,eligibilityQualification:'B2_UNQUALIFIED' as const,
      inspected:0,withinRetention:0,expiredCalendar:0,expiredProtected:0,expiredUnqualified:0,unknownDate:0,nonTerminalProtected:0,expiredNonTerminalProtected:0,
      technicallyEligible:0 as const,coverage:'ERROR' as DomainReport['coverage'],reasons:{},futureOperation:rule.operation,durationMs:0,logicalCandidateBytes:null,physicalGainBytes:null };
    try {
      const result = await this.database.$transaction(async tx => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
        await tx.$executeRawUnsafe("SET LOCAL statement_timeout='3000ms'");
        await tx.$executeRawUnsafe("SET LOCAL lock_timeout='250ms'");
        // LIMIT is inside materialized input, before aggregate/protection probes. UUID PK avoids a full date sort.
        // Partial scans are a measured prefix, never an extrapolated total or candidate population.
        return tx.$queryRawUnsafe<{inspected:number; within_retention:number;expired:number;protected:number;unqualified:number;unknown_date:number;non_terminal:number;expired_non_terminal:number;partial:boolean}[]>(`
          WITH bounded AS MATERIALIZED (SELECT * FROM ${rule.table} r WHERE ${rule.filter??'TRUE'} ORDER BY ${order} LIMIT ${this.rowLimit+1}),
          facts AS MATERIALIZED (SELECT ${date} IS NOT NULL AS known,
            COALESCE(${expirationSql(date,retentionPolicies[rule.domain])},FALSE) AS expired,
            COALESCE(${rule.terminal??'TRUE'},FALSE) AS terminal,
            (${rule.protection}) AS protected
            FROM (SELECT * FROM bounded ORDER BY ${order} LIMIT ${this.rowLimit}) r)
          SELECT count(*)::int AS inspected,
            count(*) FILTER(WHERE known AND terminal AND NOT expired)::int AS within_retention,
            count(*) FILTER(WHERE known AND expired)::int AS expired,
            count(*) FILTER(WHERE known AND expired AND (protected OR NOT terminal))::int AS protected,
            count(*) FILTER(WHERE known AND terminal AND expired AND NOT protected)::int AS unqualified,
            count(*) FILTER(WHERE NOT known AND terminal)::int AS unknown_date,
            count(*) FILTER(WHERE NOT terminal AND (NOT known OR NOT expired))::int AS non_terminal,
            count(*) FILTER(WHERE known AND expired AND NOT terminal)::int AS expired_non_terminal,
            (SELECT count(*)>${this.rowLimit} FROM bounded) AS partial FROM facts`,now);
      },{isolationLevel:'RepeatableRead',timeout:5_000,maxWait:10_000});
      const r=result[0]!;
      return {...base,inspected:r.inspected,withinRetention:r.within_retention,expiredCalendar:r.expired,expiredProtected:r.protected,
        expiredUnqualified:r.unqualified,unknownDate:r.unknown_date,nonTerminalProtected:r.non_terminal,expiredNonTerminalProtected:r.expired_non_terminal,coverage:r.partial?'PARTIAL':'EXHAUSTIVE',
        reasons:{[rule.reason]:r.protected-r.expired_non_terminal,UNKNOWN_DATE:r.unknown_date,
          [rule.nonTerminalReason??'TERMINATION_NOT_PROVEN']:r.non_terminal+r.expired_non_terminal,EQUIVALENT_PROOF_NOT_QUALIFIED:r.unqualified},durationMs:Math.round(performance.now()-started)};
    } catch {return {...base,errorCode:'DOMAIN_QUERY_FAILED',durationMs:Math.round(performance.now()-started)};}
  }
}
