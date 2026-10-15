import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';
import type { Prisma, PrismaClient } from '../../../generated/prisma/client.js';
import { isTerminalCommandStorage } from '../twitch/twitch-command-pilot.js';
import { encodeIntentReads, decodeIntentReads } from '../twitch/twitch-intent-storage.js';
import { readGachaActiveTeam } from '../gacha/gacha-snapshot-storage.js';
import { compactDetail, expandDetail } from './lossless-detail-storage.js';
import { expirationSql, retentionPolicies, type LosslessRetentionDomain } from './retention-policy.js';
import { retentionRules } from './retention-inventory.js';

const object=(value:unknown):Record<string,Prisma.JsonValue>|null=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,Prisma.JsonValue>:null;
const columns={twitch_terminal:'payload_minimal',gacha:'snapshot',arcade:'response'} as const;
const replayState=(value:unknown)=>{
  const state=object(value);return state!==null&&['pity5','pity4','captureProgress','fiftyFiftyLostStreak'].every(key=>Number.isSafeInteger(state[key])&&Number(state[key])>=0)
    &&['totalPulls','totalFiveStars','totalFourStars','fiftyFiftyWon','fiftyFiftyLost','capturesTriggered'].every(key=>typeof state[key]==='string'&&/^\d+$/.test(state[key] as string))&&typeof state.guaranteedFeatured5==='boolean';
};
export function transformDetail(domain:LosslessRetentionDomain,value:Prisma.JsonValue,summary:Prisma.JsonValue|null):Prisma.JsonValue {
  const row=object(value);if(!row)return value;
  if(domain==='twitch_terminal') {
    const pilot=object(row.commandPilot),intent=object(pilot?.intent),reads=object(intent?.reads);
    if(!pilot||!intent||!reads||!isTerminalCommandStorage(pilot)||Object.hasOwn(reads,'encoding'))return value;
    if(!Object.values(reads).every(Array.isArray))return value;
    const compressed=encodeIntentReads(reads as Record<string,Prisma.JsonValue[]>);
    if(!isDeepStrictEqual(decodeIntentReads(compressed),reads))throw Error('RETENTION_LOSSLESS_MISMATCH');
    return {...row,commandPilot:{...pilot,intent:{...intent,reads:compressed}}};
  }
  if(domain==='gacha') {
    const expanded=expandDetail(value),snapshot=object(expanded);
    if(!snapshot||!replayState(snapshot.stateBefore)||!replayState(snapshot.stateAfter))return value;
    try {readGachaActiveTeam(expanded,summary);}catch{return value;}
    const compressed=compactDetail(expanded!);
    if(!isDeepStrictEqual(expandDetail(compressed),expanded))throw Error('RETENTION_LOSSLESS_MISMATCH');
    return compressed;
  }
  const expanded=expandDetail(value),response=object(expanded);
  if(!response||typeof response.operationId!=='string'||typeof response.alreadyProcessed!=='boolean'||(object(summary)?.operationId&&object(summary)!.operationId!==response.operationId))return value;
  const compressed=compactDetail(expanded!);
  if(!isDeepStrictEqual(expandDetail(compressed),expanded))throw Error('RETENTION_LOSSLESS_MISMATCH');
  return compressed;
}
export function restoreDetail(domain:LosslessRetentionDomain,value:Prisma.JsonValue):Prisma.JsonValue {
  if(domain!=='twitch_terminal')return expandDetail(value)!;
  const payload=object(value),pilot=object(payload?.commandPilot),intent=object(pilot?.intent);
  if(!payload||!pilot||!intent)return value;
  return {...payload,commandPilot:{...pilot,intent:{...intent,reads:decodeIntentReads(intent.reads) as Prisma.JsonValue}}};
}
export const retentionStorageHash=(value:Prisma.JsonValue)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
/** Exact row/column CAS recovery, never a general database/player restore. */
export async function restoreStoredDetail(db:PrismaClient,domain:LosslessRetentionDomain,id:string,expectedHash:string) {
  if(!/^[0-9a-f-]{36}$/i.test(id)||!/^[0-9a-f]{64}$/.test(expectedHash)||!Object.hasOwn(columns,domain))throw Error('RETENTION_RESTORE_ARGUMENT');
  const table=retentionRules.find(row=>row.domain===domain)!.table,column=columns[domain];
  return db.$transaction(async tx=>{
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout='3000ms'");await tx.$executeRawUnsafe("SET LOCAL lock_timeout='250ms'");
    const [row]=await tx.$queryRawUnsafe<{value:Prisma.JsonValue}[]>(`SELECT ${column} AS value FROM ${table} WHERE id=$1::uuid FOR UPDATE`,id);
    if(!row||retentionStorageHash(row.value)!==expectedHash)throw Error('RETENTION_RESTORE_STALE');
    const restored=restoreDetail(domain,row.value);
    if(isDeepStrictEqual(restored,row.value))return {restored:false};
    await tx.$executeRawUnsafe(`UPDATE ${table} SET ${column}=$2::jsonb WHERE id=$1::uuid`,id,JSON.stringify(restored));
    return {restored:true};
  },{timeout:5000,maxWait:10000});
}
type Counts={scanned:number;expired:number;compacted:number;protected:number;logicalBytesBefore:number;logicalBytesAfter:number;storedBytesBefore:number;storedBytesAfter:number};
const empty=():Counts=>({scanned:0,expired:0,compacted:0,protected:0,logicalBytesBefore:0,logicalBytesAfter:0,storedBytesBefore:0,storedBytesAfter:0});
export class RetentionTransformations {
  constructor(private readonly db:PrismaClient,private readonly allowed:readonly LosslessRetentionDomain[]) {}
  async run(domain:LosslessRetentionDomain,token:string,cycleKey:string,now:Date,deadline:number,signal?:AbortSignal) {
    if(!this.allowed.includes(domain)) return {domain,status:'NOT_AUTHORIZED',...empty()};
    const key=`execute:${domain}`,rule=retentionRules.find(row=>row.domain===domain)!,column=columns[domain];
    let latest=empty();
    while(!signal?.aborted&&performance.now()<deadline) {
      const result=await this.db.$transaction(async tx=>{
        await tx.$executeRawUnsafe("SET LOCAL statement_timeout='3000ms'");await tx.$executeRawUnsafe("SET LOCAL lock_timeout='250ms'");
        const [gate]=await tx.$queryRawUnsafe<{owned:boolean;enabled:boolean}[]>("SELECT token=$1::uuid AND lease_until>clock_timestamp() AS owned,execution_enabled AND enabled_domains ? $2 AS enabled FROM retention_job WHERE id='retention-v1' FOR UPDATE",token,domain);
        let [progress]=await tx.$queryRawUnsafe<{cycle_key:string;cutoff:Date;cursor:{after:string;upper:string}|null;report:Counts;complete:boolean}[]>('SELECT * FROM retention_progress WHERE domain=$1',key);
        if(!gate?.owned||!gate.enabled||signal?.aborted)return {domain,status:'STOPPED',...(progress?.report??empty())};
        if(progress?.complete&&progress.cycle_key===cycleKey)return {domain,status:'SUCCESS',...progress.report};
        if(progress?.complete)progress=undefined;
        const cutoff=progress?.cutoff??now,counts=progress?.report??empty();
        const [last]=await tx.$queryRawUnsafe<{id:string}[]>(`SELECT id FROM ${rule.table} ORDER BY id DESC LIMIT 1`);
        const upper=progress?.cursor?.upper??last?.id;
        if(!upper)return {domain,status:'SUCCESS',...counts};
        const rows=await tx.$queryRawUnsafe<{id:string;eligible:boolean}[]>(`SELECT r.id,COALESCE(${expirationSql(`r.${rule.date}`,retentionPolicies[domain])},FALSE) AND COALESCE(${rule.terminal??'TRUE'},FALSE) AS eligible FROM ${rule.table} r WHERE ($2::uuid IS NULL OR r.id>$2::uuid) AND r.id<=$3::uuid ORDER BY r.id LIMIT 50`,cutoff,progress?.cursor?.after??null,upper);
        let lastProcessed:string|undefined,expiredInBatch=0;
        for(const row of rows) {
          if(expiredInBatch>=5)break;
          lastProcessed=row.id;
          counts.scanned++;if(!row.eligible)continue;counts.expired++;
          expiredInBatch++;
          const business=domain==='twitch_terminal'?'TRUE':domain==='gacha'?"EXISTS(SELECT 1 FROM pull_operations p JOIN business_operations b ON b.id=p.business_operation_id JOIN players a ON a.id=p.player_id WHERE p.id=r.pull_operation_id AND b.status::text='COMPLETED' AND b.operation_type='gacha.pull' AND a.status::text='ACTIVE' AND p.pull_count IN (1,10) AND (SELECT count(*) FROM pull_results x WHERE x.pull_operation_id=p.id)=p.pull_count AND NOT EXISTS(SELECT 1 FROM pull_results x WHERE x.pull_operation_id=p.id AND (x.result_index<1 OR x.result_index>p.pull_count)))":"EXISTS(SELECT 1 FROM business_operations b JOIN players a ON a.id=b.player_id WHERE b.id=r.operation_id AND b.status::text='COMPLETED' AND a.status::text='ACTIVE' AND (r.session_id IS NULL OR EXISTS(SELECT 1 FROM arcade_sessions s WHERE s.id=r.session_id AND s.status='FINISHED')) AND (r.invitation_id IS NULL OR EXISTS(SELECT 1 FROM arcade_invitations i WHERE i.id=r.invitation_id AND i.status IN ('FINISHED','REFUSED','CANCELLED','EXPIRED'))))";
          const [current]=await tx.$queryRawUnsafe<{value:Prisma.JsonValue;stored:number;summary:Prisma.JsonValue|null}[]>(`SELECT r.${column} AS value,pg_column_size(r.${column}) AS stored,${domain==='gacha'?'(SELECT b.result_summary FROM pull_operations p JOIN business_operations b ON b.id=p.business_operation_id WHERE p.id=r.pull_operation_id)':domain==='arcade'?"jsonb_build_object('operationId',r.operation_id::text)":'NULL::jsonb'} AS summary FROM ${rule.table} r WHERE r.id=$2::uuid AND COALESCE(${expirationSql(`r.${rule.date}`,retentionPolicies[domain])},FALSE) AND COALESCE(${rule.terminal??'TRUE'},FALSE) AND (${business}) AND octet_length(r.${column}::text)<=1048576 FOR UPDATE OF r`,cutoff,row.id);
          if(!current){counts.protected++;continue;}
          let transformed:Prisma.JsonValue;try{transformed=transformDetail(domain,current.value,current.summary);}catch{counts.protected++;continue;}
          if(isDeepStrictEqual(transformed,current.value)){counts.protected++;continue;}
          // Prisma/JSON numbers may exceed JS precision. Compare the reconstructed
          // original directly with PostgreSQL JSONB before accepting any rewrite.
          const [equivalent]=await tx.$queryRawUnsafe<{same:boolean}[]>(`SELECT ${column}=$2::jsonb AS same FROM ${rule.table} WHERE id=$1::uuid`,row.id,JSON.stringify(restoreDetail(domain,transformed)));
          if(!equivalent?.same){counts.protected++;continue;}
          await tx.$executeRawUnsafe('SAVEPOINT retention_gain');
          await tx.$executeRawUnsafe(`UPDATE ${rule.table} SET ${column}=$2::jsonb WHERE id=$1::uuid`,row.id,JSON.stringify(transformed));
          const [after]=await tx.$queryRawUnsafe<{stored:number}[]>(`SELECT pg_column_size(${column}) AS stored FROM ${rule.table} WHERE id=$1::uuid`,row.id);
          if(!after||after.stored>=current.stored){await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT retention_gain');counts.protected++;continue;}
          counts.compacted++;counts.logicalBytesBefore+=Buffer.byteLength(JSON.stringify(current.value));counts.logicalBytesAfter+=Buffer.byteLength(JSON.stringify(transformed));counts.storedBytesBefore+=current.stored;counts.storedBytesAfter+=after.stored;
        }
        if(signal?.aborted)throw Error('RETENTION_STOPPED');
        const cursor={after:lastProcessed??progress?.cursor?.after??upper,upper},complete=rows.length<50&&lastProcessed===rows.at(-1)?.id;
        await tx.$executeRawUnsafe('INSERT INTO retention_progress(domain,cycle_key,cutoff,cursor,report,complete) VALUES($1,$2,$3,$4::jsonb,$5::jsonb,$6) ON CONFLICT(domain) DO UPDATE SET cycle_key=$2,cutoff=$3,cursor=$4::jsonb,report=$5::jsonb,complete=$6',key,cycleKey,cutoff,JSON.stringify(cursor),JSON.stringify(counts),complete);
        const renewed=await tx.$executeRawUnsafe("UPDATE retention_job SET lease_until=clock_timestamp()+interval '2 minutes' WHERE id='retention-v1' AND token=$1::uuid AND lease_until>clock_timestamp()",token);
        if(renewed!==1)throw Error('RETENTION_LEASE_LOST');
        return {domain,status:complete?'SUCCESS':'PARTIAL',...counts};
      },{timeout:5000,maxWait:10000}).catch(()=>({...latest,domain,status:'ERROR',errorCode:'DOMAIN_TRANSACTION_FAILED'}));
      latest=result;
      if(result.status!=='PARTIAL')return result;
    }
    return {...latest,domain,status:signal?.aborted?'STOPPED':'PARTIAL'};
  }
}
