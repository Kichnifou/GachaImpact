import { randomUUID } from 'node:crypto';
import type { PrismaClient, Prisma } from '../../../generated/prisma/client.js';
import type { Clock } from '../../domain/time/business-date.js';
import { capacityLevel, cycleDue, losslessRetentionDomains, type RetentionMode, type LosslessRetentionDomain } from './retention-policy.js';
import { RetentionTransformations } from './retention-transformations.js';
import { RetentionInventory, retentionRules, type DomainReport, type Rule, type ScanCursor } from './retention-inventory.js';

type Capacity = { at: string; bytes: number; mb: number; mib: number; deltaBytes: number|null; previousAt: string|null;
  alertLevel: number; relations: {table:string;bytes:number}[]; quota: 'NOT_VERIFIED'; };
export type RetentionLog = (event: Record<string,unknown>) => void;
const transactionOptions = { timeout:5_000,maxWait:10_000 };
async function bounded(tx: Prisma.TransactionClient) {
  await tx.$executeRawUnsafe("SET LOCAL statement_timeout='3000ms'");
  await tx.$executeRawUnsafe("SET LOCAL lock_timeout='250ms'");
}
/** Classified scans and explicitly authorized lossless detail transformations share the same lease. */
export class RetentionEngine {
  constructor(private readonly db: PrismaClient, readonly mode: RetentionMode, private readonly clock: Clock,
    private readonly log: RetentionLog = event => console.info(JSON.stringify(event)),
    private readonly inventory = new RetentionInventory(db),private readonly allowed:readonly LosslessRetentionDomain[]=[]) {}

  async run(signal?: AbortSignal) {
    if (this.mode === 'DISABLED') return {skipped:'DISABLED'};
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
      const [previous]=await tx.$queryRawUnsafe<{status:string;attempts:number;backoff:boolean;version:string|null;mode:string|null}[]>("SELECT status,attempts,next_attempt_at>clock_timestamp() AS backoff,report->>'version' AS version,report->>'mode' AS mode FROM retention_runs WHERE cycle_key=$1",cycleKey);
      if (previous?.status==='RUNNING') await tx.$executeRawUnsafe("UPDATE retention_runs SET status='FAILED',completed_at=clock_timestamp() WHERE cycle_key=$1",cycleKey);
      const samePhase=previous?.version==='2'&&previous.mode===this.mode;
      if (previous && samePhase && (previous.status==='SUCCESS' || previous.attempts>=3 || previous.backoff)) return false;
      // Preserve the phase on partial retries, so a crash cannot reset its admission budget.
      await tx.$executeRawUnsafe("INSERT INTO retention_runs(cycle_key,status,report) VALUES($1,'RUNNING',jsonb_build_object('version',2,'mode',$2::text)) ON CONFLICT(cycle_key) DO UPDATE SET status='RUNNING',attempts=CASE WHEN retention_runs.report->>'version'='2' AND retention_runs.report->>'mode'=$2 THEN retention_runs.attempts+1 ELSE 1 END,started_at=clock_timestamp(),completed_at=NULL,report=jsonb_build_object('version',2,'mode',$2::text)",cycleKey,this.mode);
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
    const inventoryDeadline=started+(this.mode==='EXECUTE'?35_000:90_000);
    let capacity:Capacity|undefined,status='FAILED';
    const transformations:Awaited<ReturnType<RetentionTransformations['run']>>[]=[];
    try {
      for (const rule of retentionRules) {
        if (signal?.aborted || performance.now()>inventoryDeadline) break;
        if (!await this.renew(token)) return {skipped:'LEASE_LOST'};
        domains.push(await this.inspectPaged(rule,now,cycleKey,token,signal,inventoryDeadline));
      }
      if(this.mode==='EXECUTE') {
        const operations=new RetentionTransformations(this.db,this.allowed);
        const [rotation]=await this.db.$queryRawUnsafe<{next:string}[]>("SELECT cursor->>'next' AS next FROM retention_progress WHERE domain='execute:rotation'");
        const first=Math.max(0,losslessRetentionDomains.indexOf(rotation?.next as LosslessRetentionDomain));
        const order=[...losslessRetentionDomains.slice(first),...losslessRetentionDomains.slice(0,first)].filter(domain=>this.allowed.includes(domain));
        for(const domain of order) {
          if(signal?.aborted||performance.now()-started>90_000)break;
          if(!await this.renew(token))return {skipped:'LEASE_LOST'};
          // Persist the next priority before entering a writer: a crash or an
          // exhausted cycle cannot keep restarting at the same first domain.
          if(!await this.rotate(token,cycleKey,now,domain))return {skipped:'LEASE_LOST'};
          transformations.push(await operations.run(domain,token,cycleKey,now,Math.min(started+90_000,performance.now()+15_000),signal));
        }
      }
      if (!signal?.aborted) {
        if (!await this.renew(token)) return {skipped:'LEASE_LOST'};
        capacity=await this.capacity(now);
      }
      status=signal?.aborted?'CANCELLED':domains.length!==retentionRules.length||domains.some(x=>x.coverage!=='EXHAUSTIVE')||(this.mode==='EXECUTE'&&(transformations.length!==this.allowed.length||transformations.some(row=>row.status!=='SUCCESS')))?'PARTIAL':'SUCCESS';
    } catch {status='FAILED';}
    const report={version:2,mode:this.mode,cycleKey,analyzedAt:now.toISOString(),durationMs:Math.round(performance.now()-started),domains,transformations,
      notInspectedDomains:retentionRules.slice(domains.length).map(rule=>rule.domain),
      capacity,destructiveActions:0,technicallyEligible:0,
      noAgePolicy:['business_operations','resource_movements','migration_proofs','player_state','player_statistics','identities','audit','daily_activity'],
      limits:['Resumable keyset sweep at fixed cutoff/upper UUID; concurrent inserts revisited next sweep','Primary detail tables only; auxiliary durable proofs retained','Lossless JSON compaction only; stored datum savings are not physical disk shrinkage','Irreversible deletion and content removal remain blocked']};
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
    this.log({event:'RETENTION_CYCLE',cycleKey,mode:this.mode,status,domains:domains.length,durationMs:report.durationMs,destructiveActions:0,compacted:transformations.reduce((sum,row)=>sum+row.compacted,0)});
    return {status,report};
  }
  private async renew(token:string) {
    return this.db.$transaction(async tx => {await bounded(tx);return (await tx.$executeRawUnsafe("UPDATE retention_job SET lease_until=clock_timestamp()+interval '2 minutes' WHERE id='retention-v1' AND token=$1::uuid AND lease_until>clock_timestamp()",token))===1;},transactionOptions);
  }
  private async rotate(token:string,cycleKey:string,now:Date,domain:LosslessRetentionDomain) {
    const next=losslessRetentionDomains[(losslessRetentionDomains.indexOf(domain)+1)%losslessRetentionDomains.length]!;
    return this.db.$transaction(async tx=>{
      await bounded(tx);
      const [owner]=await tx.$queryRawUnsafe<{owned:boolean}[]>("SELECT token=$1::uuid AND lease_until>clock_timestamp() AS owned FROM retention_job WHERE id='retention-v1' FOR UPDATE",token);
      if(!owner?.owned)return false;
      await tx.$executeRawUnsafe("INSERT INTO retention_progress(domain,cycle_key,cutoff,cursor) VALUES('execute:rotation',$1,$2,$3::jsonb) ON CONFLICT(domain) DO UPDATE SET cycle_key=$1,cutoff=$2,cursor=$3::jsonb",cycleKey,now,JSON.stringify({next}));
      return true;
    },transactionOptions);
  }
  private async inspectPaged(rule:Rule,now:Date,cycleKey:string,token:string,signal:AbortSignal|undefined,phaseDeadline:number):Promise<DomainReport> {
    const deadline=Math.min(phaseDeadline,performance.now()+5_000);
    let [checkpoint]=await this.db.$queryRawUnsafe<{cycle_key:string;cutoff:Date;cursor:ScanCursor|null;report:DomainReport;complete:boolean}[]>('SELECT cycle_key,cutoff,cursor,report,complete FROM retention_progress WHERE domain=$1',rule.domain);
    if(checkpoint?.complete && checkpoint.cycle_key===cycleKey) return checkpoint.report;
    if(checkpoint?.complete) checkpoint=undefined;
    let cursor=checkpoint?.cursor??undefined,aggregate=checkpoint?.report,cutoff=checkpoint?.cutoff??now;
    do {
      if(signal?.aborted||performance.now()>deadline) break;
      if(!await this.renew(token)) throw new Error('RETENTION_LEASE_LOST');
      const page=await this.inventory.inspect(rule,cutoff,cursor);
      const {cursor:next,...publicPage}=page;
      if(page.coverage==='ERROR') return {...(aggregate??publicPage),coverage:'ERROR',errorCode:page.errorCode};
      if(!aggregate) aggregate=publicPage;
      else {
        const sum={...aggregate,coverage:page.coverage,durationMs:aggregate.durationMs+page.durationMs};
        for(const key of ['inspected','withinRetention','expiredCalendar','expiredProtected','expiredUnqualified','unknownDate','nonTerminalProtected','expiredNonTerminalProtected'] as const) sum[key]+=page[key];
        const reasons={...aggregate.reasons};for(const [key,value] of Object.entries(page.reasons)) reasons[key as keyof typeof reasons]=(reasons[key as keyof typeof reasons]??0)+(value??0);
        aggregate={...sum,reasons};
      }
      const saved=await this.db.$transaction(async tx=>{
        await bounded(tx);
        const [owner]=await tx.$queryRawUnsafe<{owned:boolean}[]>("SELECT token=$1::uuid AND lease_until>clock_timestamp() AS owned FROM retention_job WHERE id='retention-v1' FOR UPDATE",token);
        if(!owner?.owned) return false;
        await tx.$executeRawUnsafe('INSERT INTO retention_progress(domain,cycle_key,cutoff,cursor,report,complete) VALUES($1,$2,$3,$4::jsonb,$5::jsonb,$6) ON CONFLICT(domain) DO UPDATE SET cycle_key=$2,cutoff=$3,cursor=$4::jsonb,report=$5::jsonb,complete=$6',rule.domain,cycleKey,cutoff,next?JSON.stringify(next):null,JSON.stringify(aggregate),page.coverage==='EXHAUSTIVE');
        return true;
      },transactionOptions);
      if(!saved) throw new Error('RETENTION_LEASE_LOST');
      cursor=next;
      if(page.coverage==='EXHAUSTIVE') return aggregate;
    } while(cursor);
    if(aggregate) return {...aggregate,coverage:'PARTIAL'};
    const {cursor:_cursor,...page}=await this.inventory.inspect(rule,cutoff,cursor);
    return {...page,coverage:'PARTIAL'};
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
