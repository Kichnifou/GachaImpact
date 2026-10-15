import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { beforeAll,afterAll,afterEach,describe,it,expect,vi } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { RetentionInventory,retentionRules } from '../src/application/retention/retention-inventory.js';
import { RetentionEngine } from '../src/application/retention/retention-engine.js';
import { expirationSql } from '../src/application/retention/retention-policy.js';
import { encodeIntentReads } from '../src/application/twitch/twitch-intent-storage.js';
import { readGachaActiveTeam } from '../src/application/gacha/gacha-snapshot-storage.js';
import { Prisma } from '../generated/prisma/client.js';
const fixture=isolatedBatchDatabase(),db=fixture.database,at=new Date('2030-06-15T06:00:00Z'),old=new Date('2026-01-01T12:00:00Z');
const clock={now:()=>at};let playerId:string,otherId:string;
const fullMigrations=process.env['RETENTION_PRIVATE_MIGRATIONS']==='true';
beforeAll(async()=>{console.info(JSON.stringify({event:'RETENTION_PRIVATE_SCHEMA',schema:fixture.schema,fullMigrations}));await fixture.setup({prismaMigrations:fullMigrations,seedPublicCatalog:true});
  if(!fullMigrations){
    // Reuse the standard physical fixture for repeated engine scenarios. The
    // optional full path rehearses Prisma deploy/status through all migrations.
    // Apply the exact new DDL, rather than relying on schema diff's missing guards.
    await fixture.admin.query(`DROP TABLE "${fixture.schema}".retention_progress, "${fixture.schema}".retention_job, "${fixture.schema}".retention_runs`);
    await fixture.installMigrationOnlySql(new URL('../prisma/migrations/20261015180000_083_retention_simulation/migration.sql',import.meta.url));
    await fixture.installMigrationOnlySql(new URL('../prisma/migrations/20261015200000_084_retention_progress/migration.sql',import.meta.url));
  }
  playerId=(await db.player.create({data:{displayName:'Synthetic retention'}})).id;otherId=(await db.player.create({data:{displayName:'Synthetic relation'}})).id;
},180_000);
afterAll(()=>fixture.cleanup(),60_000);
afterEach(async()=>{vi.restoreAllMocks();await db.retentionProgress.deleteMany();await db.retentionRun.deleteMany();await db.retentionJob.update({where:{id:'retention-v1'},data:{token:null,leaseUntil:null,cycleKey:null,lastCapacity:Prisma.JsonNull,alertLevel:0,executionEnabled:false,enabledDomains:[]}});},20_000);
const operation=async()=>db.businessOperation.create({data:{playerId,operationType:'private.retention.fixture',sourceChannel:'UI',status:'COMPLETED',startedAt:old,completedAt:old}});
async function fingerprints(){
  const result:Record<string,string>={};
  for(const table of [...new Set(retentionRules.map(x=>x.table)),'business_operations','resource_movements','players']) {
    const [row]=await db.$queryRawUnsafe<{digest:string}[]>(`SELECT md5(COALESCE(string_agg(md5(to_jsonb(r)::text),'' ORDER BY to_jsonb(r)::text),'')) AS digest FROM ${table} r`);result[table]=row!.digest;
  }return result;
}
describe('B1 real private PostgreSQL, actual migrations and immutable business state',()=>{
  it('applies the additive registry with RLS and no browser grants',async()=>{
    if(fullMigrations) expect(fixture.migrationStatus).toContain('up to date');
    const rows=await db.$queryRawUnsafe<{relrowsecurity:boolean;anon:boolean;authenticated:boolean}[]>("SELECT c.relrowsecurity,has_table_privilege('anon',c.oid,'SELECT') AS anon,has_table_privilege('authenticated',c.oid,'SELECT') AS authenticated FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=current_schema() AND c.relname IN ('retention_job','retention_runs')");
    expect(rows).toHaveLength(2);expect(rows.every(x=>x.relrowsecurity&&!x.anon&&!x.authenticated)).toBe(true);
  });
  it('classifies old/new Twitch, ambiguity, Gacha inline/v2 and real economic/moderation relations without any business write',async()=>{
    const reads={large:['repeat '.repeat(2000)]};
    for(const encoded of [false,true]) await db.twitchEventReceipt.create({data:{externalEventId:randomUUID(),eventType:'channel.chat.message',state:'PROCESSED',processedAt:old,receivedAt:old,externalReference:'command-pilot:fixture',payloadHash:'proof',payloadMinimal:{commandPilot:{version:1,stage:'RESPONSES',intent:{reads:encoded?encodeIntentReads(reads):reads},responses:[{status:'SENT',text:'Synthetic',messageId:'synthetic-id'}]}}}});
    await db.twitchEventReceipt.create({data:{externalEventId:randomUUID(),eventType:'channel.chat.message',receivedAt:old,payloadMinimal:{commandPilot:{stage:'EXECUTING',responses:[{status:'AMBIGUOUS'}]}}}});
    const activeTeam={teamId:null,elements:[],effects:[]};
    const rotation=await db.bannerRotation.findFirstOrThrow(),character=await db.character.findFirstOrThrow();
    for(const v2 of [false,true]){const op=await operation();await db.businessOperation.update({where:{id:op.id},data:{resultSummary:v2?{gachaSnapshotVersion:2,activeTeam}:{}}});
      const pull=await db.pullOperation.create({data:{playerId,bannerRotationId:rotation.id,targetCharacterId:character.id,pullCount:v2?10:1,primogemCost:160n,sourceChannel:'UI',businessOperationId:op.id,createdAt:old}});
      const snapshot=v2?{snapshotVersion:2,activeTeamRef:'operation'}:{activeTeam};await db.pullResult.create({data:{pullOperationId:pull.id,resultIndex:1,resultType:'character',characterId:character.id,rarity:5,wasNewCharacter:true,constellationAfter:0,copiesAfter:1,snapshot,createdAt:old}});
      expect(readGachaActiveTeam(snapshot,v2?{gachaSnapshotVersion:2,activeTeam}:{})).toEqual(activeTeam);
    }
    await db.playerBankAccount.create({data:{playerId,balance:100n,lastInterestDate:old}});
    await db.bankTransaction.create({data:{playerId,operationId:(await operation()).id,transactionType:'DEPOSIT',amount:1n,bankBalanceBefore:99n,bankBalanceAfter:100n,walletBalanceBefore:10n,walletBalanceAfter:9n,createdAt:old}});
    const shop=await db.shopItemDefinition.findFirstOrThrow();await db.shopPurchase.create({data:{playerId,shopItemId:shop.id,quantity:1n,unitPrice:1n,totalPrice:1n,effectSnapshot:{},operationId:(await operation()).id,purchasedAt:old}});
    const chat=await db.globalChatMessage.create({data:{authorPlayerId:playerId,sourceChannel:'UI',messageType:'PLAYER',content:'Synthetic private test',createdAt:old}});
    await db.globalChatReport.create({data:{reporterPlayerId:otherId,reportedPlayerId:playerId,messageId:chat.id,messageSnapshot:{},contextSnapshot:{}}});
    await db.globalChatMessage.create({data:{authorPlayerId:otherId,sourceChannel:'UI',messageType:'PLAYER',content:'Synthetic reply',replyToMessageId:chat.id,createdAt:old}});
    const conversation=await db.directConversation.create({data:{playerAId:[playerId,otherId].sort()[0]!,playerBId:[playerId,otherId].sort()[1]!}});
    const dm=await db.directMessage.create({data:{conversationId:conversation.id,authorPlayerId:playerId,operationId:(await operation()).id,content:'Synthetic private',createdAt:old}});
    await db.directMessageReport.create({data:{reporterPlayerId:otherId,reportedPlayerId:playerId,conversationId:conversation.id,messageId:dm.id,messageSnapshot:{},contextSnapshot:{},snapshotFingerprint:'synthetic'}});
    await db.notification.createMany({data:[{playerId,domainKey:'TEST',typeKey:'TEST',state:'RESOLVED',resolvedAt:old,createdAt:old,payload:{},deduplicationKey:randomUUID()},{playerId,domainKey:'TEST',typeKey:'TEST',state:'UNREAD',createdAt:old,payload:{}}]});
    const arcadeOperation=await operation();const session=await db.arcadeSession.create({data:{playerId,game:'MEMORY',difficulty:'EASY',status:'FINISHED',firstSide:'PLAYER',privateState:{},randomState:1n,banterId:'synthetic',nextActionAt:old,finishedAt:old,outcome:'WIN',performancePoints:1,xpAwarded:1,businessDate:old,finishOperationId:arcadeOperation.id}});
    await db.arcadeReceipt.create({data:{playerId,sessionId:session.id,idempotencyKey:randomUUID(),fingerprint:'synthetic',operationId:arcadeOperation.id,response:{result:'gain-proof'},createdAt:old}});
    const run=await db.catalogRun.create({data:{cycleKey:randomUUID(),status:'COMPLETED',completedAt:old}});await db.catalogAttempt.create({data:{runId:run.id,provider:'synthetic',field:'identity',outcome:'PROTECTED',checkedAt:old}});
    const trade=await db.tradeRequest.create({data:{senderPlayerId:playerId,recipientPlayerId:otherId,senderResourceKey:'particles_pyro',recipientResourceKey:'particles_hydro',originalAmount:1n,currentAmount:1n,state:'ACCEPTED',sourceChannel:'UI',operationId:(await operation()).id,createdAt:old,expiresAt:new Date(old.getTime()+60_000),resolvedAt:old}});
    await db.tradeExecution.create({data:{tradeRequestId:trade.id,amount:1n,operationId:(await operation()).id,executedAt:old}});
    const code=await db.giftCode.create({data:{token:'SYNTHETIC_RETENTION',title:'Synthetic',description:'Private only',type:'ONE_OFF',startsAt:old,endsAt:new Date(old.getTime()+86400000)}});
    const edition=await db.giftCodeEdition.create({data:{giftCodeId:code.id,editionKey:'synthetic',startsAt:old,endsAt:new Date(old.getTime()+86400000)}});
    await db.giftCodeClaim.createMany({data:[{giftCodeEditionId:edition.id,playerId,sourceChannel:'UI',operationId:(await operation()).id,claimedAt:old},{giftCodeEditionId:edition.id,playerId:otherId,sourceChannel:'MIGRATION',claimedAt:null,origin:'LEGACY',legacyProvenance:{synthetic:true}}]});
    const definition=await db.eventDefinition.findFirstOrThrow();await db.eventEdition.create({data:{eventDefinitionId:definition.id,year:2020,startsAt:new Date('2020-01-01'),endsAt:new Date('2020-02-01'),status:'FINISHED',snapshot:{synthetic:true}}});
    const encounter=await db.dailyCombatEncounter.create({data:{businessDate:old}});await db.dailyCombatAttempt.create({data:{playerId,encounterId:encounter.id,mode:'MANUAL',chanceHalfPoints:100,won:true,rngRoll:1,operationId:(await operation()).id,createdAt:old}});
    const boss=await db.monthlyBoss.create({data:{monthStart:old,nameSnapshot:'Synthetic boss',baseHp:500000n,hpVariationPercent:0,maxHp:500000n,currentHp:0n,resistanceElementKey:'pyro',defeatedAt:old,finalBlowPlayerId:playerId}});
    await db.bossAttack.create({data:{bossId:boss.id,playerId,businessDate:old,damage:100n,operationId:(await operation()).id,createdAt:old}});
    await db.contestDailyTheme.create({data:{businessDate:old,theme:'STRENGTH'}});await db.contest.create({data:{businessDate:old,theme:'STRENGTH',status:'FINISHED',phase:'FINISHED',startedAt:old,winnerSlot:1,finishedAt:old,createdAt:old}});
    const before=await fingerprints();const result=await new RetentionEngine(db,'DRY_RUN',clock,()=>{}).run();
    expect(result.status).toBe('SUCCESS');expect(result.report?.domains).toHaveLength(16);expect(result.report?.destructiveActions).toBe(0);
    for (const row of result.report!.domains) expect(row.inspected,row.domain).toBe(row.withinRetention+row.expiredProtected+row.expiredUnqualified+row.unknownDate+row.nonTerminalProtected);
    for(const domain of ['twitch_terminal','gacha','bank','shop','chat','direct_messages','notifications','arcade','catalog','trades','gift_codes','event','combat','boss','contest']) {
      const row=result.report!.domains.find(x=>x.domain===domain)!;expect(row.coverage,domain).toBe('EXHAUSTIVE');expect(row.expiredProtected,domain).toBeGreaterThan(0);expect(row.technicallyEligible).toBe(0);
    }expect(result.report!.domains.find(x=>x.domain==='gift_codes')!.unknownDate).toBe(1);expect(await fingerprints()).toEqual(before);
  },90_000);
  it.each([
    ['2024-01-31T11:00:00Z','1 month','2024-02-29T11:00:00Z'],
    ['2024-02-29T11:00:00Z','1 year','2025-02-28T11:00:00Z'],
    ['2026-01-31T11:00:00Z','1 month','2026-02-28T11:00:00Z'],
    ['2026-02-28T11:00:00Z','1 month','2026-03-28T11:00:00Z'],
    ['2026-03-28T03:00:00Z','30 days','2026-04-27T02:00:00Z'],
    ['2026-09-25T02:00:00Z','1 month','2026-10-25T03:00:00Z'],
    ['2026-03-28T03:00:00Z','24 hours','2026-03-29T03:00:00Z'],
    ['2026-02-27T01:30:00Z','30 days','2026-03-29T01:30:00Z'],
    ['2026-09-25T00:30:00Z','1 month','2026-10-25T01:30:00Z'],
  ] as const)('calendar/DST bound %s +%s',async(stamp,policy,bound)=>{
    const sql=expirationSql('$2::timestamptz',policy);
    const [equal]=await db.$queryRawUnsafe<{expired:boolean}[]>(`SELECT ${sql} AS expired`,new Date(bound),new Date(stamp));expect(equal!.expired).toBe(false);
    const [after]=await db.$queryRawUnsafe<{expired:boolean}[]>(`SELECT ${sql} AS expired`,new Date(new Date(bound).getTime()+1),new Date(stamp));expect(after!.expired).toBe(true);
  });
  it('coordinates two instances and never replays a successful same-day cycle',async()=>{
    const engines=[new RetentionEngine(db,'DRY_RUN',clock,()=>{}),new RetentionEngine(db,'DRY_RUN',clock,()=>{})];
    const result=await Promise.all(engines.map(x=>x.run()));expect(result.filter(x=>x.status==='SUCCESS')).toHaveLength(1);
    expect(await db.retentionRun.count()).toBe(1);expect((await db.retentionRun.findFirstOrThrow()).attempts).toBe(1);
    expect((await engines[0]!.run()).skipped).toBeDefined();
  },60_000);
  it('recovers an expired lease, fences a superseded worker, and limits retries',async()=>{
    const inventory=new RetentionInventory(db);const inspect=vi.spyOn(inventory,'inspect');let stolen=false;
    inspect.mockImplementation(async rule=>{if(!stolen){stolen=true;await db.retentionJob.update({where:{id:'retention-v1'},data:{token:randomUUID(),leaseUntil:new Date(Date.now()+120_000)}});}return new RetentionInventory(db).inspect(rule,at);});
    expect((await new RetentionEngine(db,'DRY_RUN',clock,()=>{},inventory).run()).skipped).toBe('LEASE_LOST');
    expect((await db.retentionRun.findFirstOrThrow()).status).toBe('RUNNING');
    await db.retentionJob.update({where:{id:'retention-v1'},data:{leaseUntil:old}});
    expect((await new RetentionEngine(db,'DRY_RUN',clock,()=>{}).run()).status).toBe('SUCCESS');expect((await db.retentionRun.findFirstOrThrow()).attempts).toBe(2);
  },60_000);
  it('marks timeout partial, obeys backoff/three attempts, and preserves state',async()=>{
    const inventory=new RetentionInventory(db,1),real=inventory.inspect.bind(inventory);const before=await fingerprints();
    vi.spyOn(inventory,'inspect').mockImplementation((rule,now,cursor)=>real(rule.domain===retentionRules[0]!.domain?{...rule,protection:'(SELECT TRUE FROM pg_sleep(4))'}:rule,now,cursor));
    const result=await new RetentionEngine(db,'DRY_RUN',clock,()=>{},inventory).run();expect(result.status).toBe('PARTIAL');
    expect(result.report!.domains.some(x=>x.coverage==='ERROR'&&x.errorCode)).toBe(true);expect((await new RetentionEngine(db,'DRY_RUN',clock,()=>{}).run()).skipped).toBeDefined();
    await db.retentionRun.updateMany({data:{attempts:3,nextAttemptAt:old}});expect((await new RetentionEngine(db,'DRY_RUN',clock,()=>{}).run()).skipped).toBeDefined();
    const rule={...retentionRules[0]!,protection:'(SELECT TRUE FROM pg_sleep(4))'};
    expect((await inventory.inspect(rule,at)).coverage).toBe('ERROR');expect(await fingerprints()).toEqual(before);
  },60_000);
  it('catches only current missed night, retains unknown dates and aborts without business mutations',async()=>{
    await db.retentionRun.create({data:{cycleKey:'2029-01-01',status:'RUNNING'}});
    await db.retentionJob.update({where:{id:'retention-v1'},data:{cycleKey:'2029-01-01',token:randomUUID(),leaseUntil:old}});
    const before=await fingerprints();const controller=new AbortController();const inventory=new RetentionInventory(db);const real=inventory.inspect.bind(inventory);
    vi.spyOn(inventory,'inspect').mockImplementation(async(rule,now)=>{const row=await real(rule,now);controller.abort();return row;});
    const result=await new RetentionEngine(db,'DRY_RUN',clock,()=>{},inventory).run(controller.signal);expect(result.status).toBe('CANCELLED');
    expect((await db.retentionRun.findUniqueOrThrow({where:{cycleKey:'2029-01-01'}})).status).toBe('CANCELLED');expect(await db.retentionRun.count()).toBe(2);
    expect(await fingerprints()).toEqual(before);
  },60_000);
  it('handles a message becoming reported during an analysis without losing content or declaring eligibility',async()=>{
    const message=await db.globalChatMessage.create({data:{authorPlayerId:playerId,sourceChannel:'UI',messageType:'PLAYER',content:'Synthetic changing protection',createdAt:old}});
    const inventory=new RetentionInventory(db),rule=retentionRules.find(x=>x.domain==='chat')!;
    const pending=inventory.inspect({...rule,protection:`(${rule.protection}) OR (SELECT FALSE FROM pg_sleep(1))`},at);
    await new Promise(resolve=>setTimeout(resolve,250));
    await db.globalChatReport.create({data:{reporterPlayerId:otherId,reportedPlayerId:playerId,messageId:message.id,messageSnapshot:{synthetic:true},contextSnapshot:{}}});
    const during=await pending,after=await inventory.inspect(rule,at);
    expect(during.technicallyEligible).toBe(0);expect(after.expiredProtected).toBeGreaterThan(0);
    expect((await db.globalChatMessage.findUniqueOrThrow({where:{id:message.id}})).content).toBe('Synthetic changing protection');
  },30_000);
  it('retries an incomplete domain after backoff and records success only after all inventories succeed',async()=>{
    const inventory=new RetentionInventory(db),real=inventory.inspect.bind(inventory);let failed=false;
    vi.spyOn(inventory,'inspect').mockImplementation(async(rule,now)=>{const row=await real(rule,now);if(!failed){failed=true;return {...row,coverage:'ERROR',errorCode:'DOMAIN_QUERY_FAILED'};}return row;});
    expect((await new RetentionEngine(db,'DRY_RUN',clock,()=>{},inventory).run()).status).toBe('PARTIAL');
    await db.retentionRun.updateMany({data:{nextAttemptAt:old}});
    expect((await new RetentionEngine(db,'DRY_RUN',clock,()=>{}).run()).status).toBe('SUCCESS');
    expect((await db.retentionRun.findFirstOrThrow()).attempts).toBe(2);
  },60_000);
  it('reports consumed/provenance exclusions separately from the existing passive TTL owner',async()=>{
    await db.twitchEventReceipt.createMany({data:[{externalEventId:randomUUID(),eventType:'channel.chat.message',receivedAt:old},{externalEventId:randomUUID(),eventType:'channel.chat.message',receivedAt:old,externalReference:'durable-provenance'}]});
    const inventory=new RetentionInventory(db),rule=retentionRules.find(x=>x.domain==='twitch_passive')!;
    const row=await inventory.inspect(rule,at);expect(row.expiredNonTerminalProtected).toBe(1);
    expect(row.reasons.RECOVERY_EVENT_MIGRATION_PROOF).toBe(1);expect(row.reasons.EXISTING_TTL_OWNER).toBe(1);expect(row.technicallyEligible).toBe(0);
    const bank=await inventory.inspect({...retentionRules.find(x=>x.domain==='bank')!,terminal:'FALSE'},at);
    expect(bank.expiredNonTerminalProtected).toBe(1);expect(bank.reasons.TERMINATION_NOT_PROVEN).toBe(1);expect(bank.reasons.DURABLE_ECONOMIC_PROOF).toBe(0);
  },30_000);
});
