import { randomUUID } from 'node:crypto';
import type { PrismaClient, Prisma } from '../../../generated/prisma/client.js';
import type { Clock } from '../../domain/time/business-date.js';
import { capacityLevel, cycleDue, type RetentionMode } from './retention-policy.js';
import { RetentionInventory, retentionRules, type DomainReport } from './retention-inventory.js';

type Capacity = { at: string; bytes: number; mb: number; mib: number; deltaBytes: number|null; previousAt: string|null;
  alertLevel: number; relations: {table:string;bytes:number}[]; quota: 'NOT_VERIFIED'; };
export type RetentionLog = (event: Record<string,unknown>) => void;
const transactionOptions = { timeout:5_000,maxWait:10_000 };
async function bounded(tx: Prisma.TransactionClient) {
  await tx.$executeRawUnsafe("SET LOCAL statement_timeout='3000ms'");
  await tx.$executeRawUnsafe("SET LOCAL lock_timeout='250ms'");
}
/** The only writes in this module target retention_job / retention_runs. No B2 execution path. */
export class RetentionEngine {
  constructor(private readonly db: PrismaClient, readonly mode: RetentionMode, private readonly clock: Clock,
    private readonly log: RetentionLog = event => console.info(JSON.stringify(event)),
    private readonly inventory = new RetentionInventory(db)) {}

  async run(signal?: AbortSignal) {
    if (this.mode !== 'DRY_RUN') return {skipped:'DISABLED'};
    const now=this.clock.now(),cycleKey=cycleDue(now);
    if (!cycleKey || signal?.aborted) return {skipped:'NOT_DUE'};
    const token=randomUUID();
    const admitted=await this.db.$transaction(async tx => {
      await bounded(tx);
      const [job]=await tx.$queryRawUnsafe<{busy:boolean;has_token:boolean;cycle_key:string|null}[]>("SELECT token IS NOT NULL AND lease_until>clock_timestamp() AS busy,token IS NOT NULL AS has_token,cycle_key FROM retention_job WHERE id='retention-v1' FOR UPDATE");
      if (!job) throw new Error('RETENTION_REGISTRY_MISSING');
      if (job.busy) return false;
      if (job.has_token) await tx.$executeRawUnsafe("UPDATE retention_job SET token=NULL,lease_until=NULL WHERE id='retention-v1'");
      // An abandoned previous day is recorded as incomplete, never replayed as historical catch-up.
      if (job.cycle_key && job.cycle_key!==cycleKey) await tx.$executeRawUnsafe("UPDATE retention_runs SET status='CANCELLED',completed_at=clock_timestamp() WHERE cycle_key=$1 AND status='RUNNING'",job.cycle_key);
      const [previous]=await tx.$queryRawUnsafe<{status:string;attempts:number;backoff:boolean}[]>("SELECT status,attempts,next_attempt_at>clock_timestamp() AS backoff FROM retention_runs WHERE cycle_key=$1",cycleKey);
      if (previous?.status==='RUNNING') await tx.$executeRawUnsafe("UPDATE retention_runs SET status='FAILED',completed_at=clock_timestamp() WHERE cycle_key=$1",cycleKey);
      if (previous && (previous.status==='SUCCESS' || previous.attempts>=3 || previous.backoff)) return false;
      await tx.$executeRawUnsafe("INSERT INTO retention_runs(cycle_key,status) VALUES($1,'RUNNING') ON CONFLICT(cycle_key) DO UPDATE SET status='RUNNING',attempts=retention_runs.attempts+1,started_at=clock_timestamp(),completed_at=NULL,report='{}'",cycleKey);
      await tx.$executeRawUnsafe("UPDATE retention_job SET cycle_key=$1,token=$2::uuid,lease_until=clock_timestamp()+interval '2 minutes' WHERE id='retention-v1'",cycleKey,token);
      return true;
    },transactionOptions).catch((error:unknown)=>{
      // Short lock contention between instances is an ordinary skipped claim.
      // Other database failures must remain failures, never a successful cycle.
      const value=error as {code?:string;meta?:{code?:string}};
      if (value?.code==='55P03' || value?.meta?.code==='55P03') return false;
      throw error;
    });
    if (!admitted) return {skipped:'BUSY_COMPLETED_OR_BACKOFF'};
    const started=performance.now(),domains:DomainReport[]=[];
    let capacity:Capacity|undefined,status='FAILED';
    try {
      for (const rule of retentionRules) {
        if (signal?.aborted || performance.now()-started>90_000) break;
        if (!await this.renew(token)) return {skipped:'LEASE_LOST'};
        domains.push(await this.inventory.inspect(rule,now));
      }
      if (!signal?.aborted) {
        if (!await this.renew(token)) return {skipped:'LEASE_LOST'};
        capacity=await this.capacity(now);
      }
      status=signal?.aborted?'CANCELLED':domains.length!==retentionRules.length||domains.some(x=>x.coverage!=='EXHAUSTIVE')?'PARTIAL':'SUCCESS';
    } catch {status='FAILED';}
    const report={version:1,mode:'DRY_RUN',cycleKey,analyzedAt:now.toISOString(),durationMs:Math.round(performance.now()-started),domains,
      notInspectedDomains:retentionRules.slice(domains.length).map(rule=>rule.domain),
      capacity,destructiveActions:0,technicallyEligible:0,
      noAgePolicy:['business_operations','resource_movements','migration_proofs','player_state','player_statistics','identities','audit','daily_activity'],
      limits:['Per-domain snapshots; concurrent activity is normal','Primary detail tables only; auxiliary durable proofs retained','No payload byte estimate or physical saving claimed','B2 equivalence and restoration unqualified']};
    const saved=await this.db.$transaction(async tx => {
      await bounded(tx);
      const [owner]=await tx.$queryRawUnsafe<{alert_level:number;owned:boolean}[]>("SELECT alert_level,token=$1::uuid AND lease_until>clock_timestamp() AS owned FROM retention_job WHERE id='retention-v1' FOR UPDATE",token);
      if (!owner?.owned) return false;
      await tx.$executeRawUnsafe("UPDATE retention_runs SET status=$2,completed_at=clock_timestamp(),next_attempt_at=clock_timestamp()+interval '15 minutes',report=$3::jsonb WHERE cycle_key=$1",cycleKey,status,JSON.stringify(report));
      await tx.$executeRawUnsafe("UPDATE retention_job SET token=NULL,lease_until=NULL,last_capacity=COALESCE($1::jsonb,last_capacity),alert_level=COALESCE($2::int,alert_level) WHERE id='retention-v1'",capacity?JSON.stringify(capacity):null,capacity?.alertLevel??null);
      return {alert:capacity && capacity.alertLevel>owner.alert_level};
    },transactionOptions);
    if (!saved) return {skipped:'LEASE_LOST'};
    if (saved.alert) this.log({event:'RETENTION_CAPACITY_ALERT',cycleKey,levelMB:capacity!.alertLevel,bytes:capacity!.bytes});
    this.log({event:'RETENTION_CYCLE',cycleKey,mode:'DRY_RUN',status,domains:domains.length,durationMs:report.durationMs,destructiveActions:0});
    return {status,report};
  }
  private async renew(token:string) {
    return this.db.$transaction(async tx => {await bounded(tx);return (await tx.$executeRawUnsafe("UPDATE retention_job SET lease_until=clock_timestamp()+interval '2 minutes' WHERE id='retention-v1' AND token=$1::uuid AND lease_until>clock_timestamp()",token))===1;},transactionOptions);
  }
  private async capacity(now:Date):Promise<Capacity> {
    return this.db.$transaction(async tx => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');await bounded(tx);
      const [size]=await tx.$queryRawUnsafe<{bytes:bigint}[]>('SELECT pg_database_size(current_database()) AS bytes');
      const relations=await tx.$queryRawUnsafe<{table:string;bytes:bigint}[]>("SELECT c.relname AS table,pg_total_relation_size(c.oid) AS bytes FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=current_schema() AND c.relkind='r' ORDER BY bytes DESC,c.relname LIMIT 10");
      const [job]=await tx.$queryRawUnsafe<{last_capacity:{at:string;bytes:number}|null}[]>("SELECT last_capacity FROM retention_job WHERE id='retention-v1'");
      const bytes=Number(size!.bytes);return {at:now.toISOString(),bytes,mb:bytes/1_000_000,mib:bytes/1_048_576,deltaBytes:job?.last_capacity?bytes-job.last_capacity.bytes:null,
        previousAt:job?.last_capacity?.at??null,alertLevel:capacityLevel(bytes),relations:relations.map(x=>({table:x.table,bytes:Number(x.bytes)})),quota:'NOT_VERIFIED'};
    },transactionOptions);
  }
}
