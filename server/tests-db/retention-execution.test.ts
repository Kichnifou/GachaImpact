import 'dotenv/config';
import {randomUUID,createHash} from 'node:crypto';
import {beforeAll,afterAll,beforeEach,describe,it,expect,vi} from 'vitest';
import {isolatedBatchDatabase} from './isolated-batch-database.js';
import {Prisma} from '../generated/prisma/client.js';
import {RetentionEngine} from '../src/application/retention/retention-engine.js';
import {RetentionInventory,retentionRules} from '../src/application/retention/retention-inventory.js';
import {RetentionTransformations,retentionStorageHash,restoreStoredDetail} from '../src/application/retention/retention-transformations.js';
import {retentionVisiblePage} from '../src/application/retention/retention-visible-history.js';
import {decodeIntentReads} from '../src/application/twitch/twitch-intent-storage.js';
import {expandDetail} from '../src/application/retention/lossless-detail-storage.js';
import {readGachaActiveTeam} from '../src/application/gacha/gacha-snapshot-storage.js';
import {arcadeTransaction} from '../src/application/arcade/arcade-transaction.js';
const fixture=isolatedBatchDatabase(),db=fixture.database,old=new Date('2024-01-31T11:00:00Z'),now=new Date('2030-06-15T06:00:00Z');
let playerId:string;
beforeAll(async()=>{console.info(JSON.stringify({event:'RETENTION_EXECUTION_PRIVATE_SCHEMA',schema:fixture.schema}));await fixture.setup({prismaMigrations:true,seedPublicCatalog:true});playerId=(await db.player.create({data:{displayName:'Synthetic retention B2',elementKey:'pyro'}})).id;},180000);
afterAll(()=>fixture.cleanup(),60000);
beforeEach(async()=>{vi.restoreAllMocks();await db.retentionProgress.deleteMany();await db.retentionRun.deleteMany();await db.retentionJob.update({where:{id:'retention-v1'},data:{token:null,leaseUntil:null,cycleKey:null,executionEnabled:false,enabledDomains:[]}});},20000);
const proof=()=>Array.from({length:300},(_,i)=>({index:i,id:randomUUID(),value:createHash('sha256').update('original proof '+i).digest('hex')}));
const pilot=()=>({version:1,playerId,actorName:'Synthetic',senderId:'100000001',broadcasterId:'100000002',replyParentMessageId:'synthetic-parent',commandKey:randomUUID(),handler:'box',stage:'RESPONSES',responses:[{status:'SENT',text:'Exact final response',messageId:randomUUID()}],intent:{now:old.toISOString(),reads:{box:proof()},memory:{}}});
async function receipt(extra:Record<string,unknown>={}){return db.twitchEventReceipt.create({data:{externalEventId:randomUUID(),eventType:'channel.chat.message',state:'PROCESSED',receivedAt:old,processedAt:old,payloadHash:'synthetic-original',externalReference:'command-pilot:synthetic',payloadMinimal:{commandPilot:pilot(),messageActivity:{plan:{event:{messageIds:['synthetic-event-proof']}}},...extra} as Prisma.InputJsonValue}});}
async function lease(domains:string[]=['twitch_terminal']){const token=randomUUID();await db.retentionJob.update({where:{id:'retention-v1'},data:{cycleKey:'2030-06-15',token,leaseUntil:new Date(Date.now()+120000),executionEnabled:true,enabledDomains:domains}});return token;}
describe('R1099 private PostgreSQL execution, pagination and recovery gates',()=>{
 it('rotates inventories across retries and days even when early domains finish only on their third visit',async()=>{
   let elapsed=0;vi.spyOn(performance,'now').mockImplementation(()=>elapsed);
   const inventory=new RetentionInventory(db),inspect=inventory.inspect.bind(inventory),visits=new Map<string,number>();
   vi.spyOn(inventory,'inspect').mockImplementation(async(...args)=>{
     const row=await inspect(...args),count=(visits.get(args[0].domain)??0)+1;
     visits.set(args[0].domain,count);elapsed+=5001;
     return {...row,coverage:count<3?'PARTIAL':'EXHAUSTIVE'};
   });
   vi.spyOn(RetentionTransformations.prototype,'run').mockImplementation(async domain=>({domain,status:'SUCCESS',scanned:0,expired:0,compacted:0,protected:0,logicalBytesBefore:0,logicalBytesAfter:0,storedBytesBefore:0,storedBytesAfter:0}));
   for(let day=0;day<2;day++)for(let attempt=0;attempt<3;attempt++){
     elapsed=0;
     await db.retentionRun.updateMany({data:{nextAttemptAt:new Date(0)}});
     const result=await new RetentionEngine(db,'EXECUTE',{now:()=>new Date(now.getTime()+day*86400000)},()=>{},inventory,['twitch_terminal','gacha','arcade']).run();
     expect(result.skipped).toBeUndefined();
     const inspected=result.report!.domains.map(row=>row.domain),missing=result.report!.notInspectedDomains;
     expect([...inspected,...missing].sort()).toEqual(retentionRules.map(row=>row.domain).sort());
   }
   expect([...visits.keys()].sort()).toEqual(retentionRules.map(row=>row.domain).sort());
   expect(await db.retentionProgress.findUnique({where:{domain:'inventory:rotation'}})).not.toBeNull();
 },90000);
 it('reserves execution time for every writer despite persistently partial inventories',async()=>{
   let elapsed=0;vi.spyOn(performance,'now').mockImplementation(()=>elapsed);
   const inventory=new RetentionInventory(db),inspect=inventory.inspect.bind(inventory);
   vi.spyOn(inventory,'inspect').mockImplementation(async(...args)=>{const row=await inspect(...args);elapsed+=5001;return {...row,coverage:'PARTIAL'};});
   const called:string[]=[];
   vi.spyOn(RetentionTransformations.prototype,'run').mockImplementation(async domain=>{called.push(domain);elapsed+=20000;return {domain,status:'PARTIAL',scanned:1,expired:0,compacted:0,protected:0,logicalBytesBefore:0,logicalBytesAfter:0,storedBytesBefore:0,storedBytesAfter:0};});
   const result=await new RetentionEngine(db,'EXECUTE',{now:()=>now},()=>{},inventory,['twitch_terminal','gacha','arcade']).run();
   expect(result.status).toBe('PARTIAL');expect(result.report!.notInspectedDomains.length).toBeGreaterThan(0);
   expect(called).toEqual(['twitch_terminal','gacha','arcade']);expect(result.report!.transformations.every(row=>row.scanned===1)).toBe(true);
 },90000);
 it('persists a fair next writer across days when a slow execution exhausts the cycle',async()=>{
   let elapsed=0;vi.spyOn(performance,'now').mockImplementation(()=>elapsed);
   const inventory=new RetentionInventory(db),inspect=inventory.inspect.bind(inventory);
   vi.spyOn(inventory,'inspect').mockImplementation(async(...args)=>{const row=await inspect(...args);elapsed+=5001;return {...row,coverage:'PARTIAL'};});
   const called:string[]=[];
   vi.spyOn(RetentionTransformations.prototype,'run').mockImplementation(async domain=>{called.push(domain);elapsed+=60000;return {domain,status:'PARTIAL',scanned:1,expired:0,compacted:0,protected:0,logicalBytesBefore:0,logicalBytesAfter:0,storedBytesBefore:0,storedBytesAfter:0};});
   for(let day=0;day<3;day++){
     elapsed=0;
     const date=new Date(now.getTime()+day*86400000);
     expect((await new RetentionEngine(db,'EXECUTE',{now:()=>date},()=>{},inventory,['twitch_terminal','gacha','arcade']).run()).status).toBe('PARTIAL');
   }
   expect(called).toEqual(['twitch_terminal','gacha','arcade']);
   expect((await db.retentionProgress.findUniqueOrThrow({where:{domain:'execute:rotation'}})).cursor).toEqual({next:'twitch_terminal'});
 },90000);
 it('preserves Prisma contains semantics for LIKE metacharacters in the SQL history reader',async()=>{
   const ids:string[]=[];
   for(const content of ['proof percent %','proof underscore _','proof slash \\','ordinary proof'])ids.push((await db.globalChatMessage.create({data:{authorPlayerId:playerId,sourceChannel:'INTERNAL_CHAT',messageType:'PLAYER',content,createdAt:now}})).id);
   for(const query of ['%','_','\\','proof']){
     const previous=await db.globalChatMessage.findMany({where:{id:{in:ids},content:{contains:query,mode:'insensitive'}},select:{id:true}});
     const current=await db.$queryRaw<{id:string}[]>(Prisma.sql`SELECT id FROM global_chat_messages WHERE id IN (${Prisma.join(ids.map(id=>Prisma.sql`${id}::uuid`))}) AND content ILIKE ${'%'+query+'%'}`);
     expect(current.map(row=>row.id).sort()).toEqual(previous.map(row=>row.id).sort());
   }
 });
 it('pages a composite claims key without losing or duplicating economic proofs',async()=>{
   const code=await db.giftCode.create({data:{token:randomUUID().toUpperCase(),title:'Synthetic retention',description:'Private qualification',type:'ONE_OFF',startsAt:old,endsAt:now}});
   for(let i=0;i<5;i++){
     const edition=await db.giftCodeEdition.create({data:{giftCodeId:code.id,editionKey:String(i),startsAt:old,endsAt:now}});
     const operation=await db.businessOperation.create({data:{playerId,operationType:'gift-code.claim',sourceChannel:'UI',status:'COMPLETED',startedAt:old,completedAt:old}});
     await db.giftCodeClaim.create({data:{giftCodeEditionId:edition.id,playerId,sourceChannel:'UI',claimedAt:old,operationId:operation.id}});
   }
   const rule=retentionRules.find(row=>row.domain==='gift_codes')!,inventory=new RetentionInventory(db,2);
   let cursor:Parameters<typeof inventory.inspect>[2],inspected=0,pages=0;
   do {const page=await inventory.inspect(rule,now,cursor);expect(page.coverage).not.toBe('ERROR');inspected+=page.inspected;cursor=page.cursor;pages++;if(page.coverage==='EXHAUSTIVE')break;}while(pages<10);
   expect(pages).toBe(3);expect(inspected).toBe(5);expect(await db.giftCodeClaim.count()).toBe(5);
 });
 it('commits one bounded batch, honors a stop and stale token between batches, then resumes without double counting',async()=>{
   for(let i=0;i<8;i++)await receipt();
   const token=await lease(),writer=new RetentionTransformations(db,['twitch_terminal']);
   const clock=vi.spyOn(performance,'now').mockReturnValueOnce(0).mockReturnValue(10);
   const partial=await writer.run('twitch_terminal',token,'2030-06-15',now,5);clock.mockRestore();
   expect(partial.status).toBe('PARTIAL');expect(partial.expired).toBe(5);
   const committed=await db.retentionProgress.findUniqueOrThrow({where:{domain:'execute:twitch_terminal'}});
   await db.retentionJob.update({where:{id:'retention-v1'},data:{executionEnabled:false}});
   expect((await writer.run('twitch_terminal',token,'2030-06-15',now,performance.now()+60000)).status).toBe('STOPPED');
   await db.retentionJob.update({where:{id:'retention-v1'},data:{executionEnabled:true,token:randomUUID()}});
   expect((await writer.run('twitch_terminal',token,'2030-06-15',now,performance.now()+60000)).status).toBe('STOPPED');
   expect(await db.retentionProgress.findUniqueOrThrow({where:{domain:'execute:twitch_terminal'}})).toEqual(committed);
   await db.retentionJob.update({where:{id:'retention-v1'},data:{token}});
   const resumed=await writer.run('twitch_terminal',token,'2030-06-15',now,performance.now()+60000);
   expect(resumed.status).toBe('SUCCESS');expect(resumed.scanned).toBe(await db.twitchEventReceipt.count());
   expect(resumed.compacted).toBeGreaterThanOrEqual(partial.compacted);
 },90000);
 it('rolls back both the transformed detail and cursor if checkpoint persistence fails before commit',async()=>{
   const before=await receipt(),token=await lease();
   await db.$executeRawUnsafe("CREATE FUNCTION retention_test_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.domain='execute:twitch_terminal' THEN RAISE EXCEPTION 'synthetic checkpoint crash'; END IF; RETURN NEW; END $$");
   await db.$executeRawUnsafe('CREATE TRIGGER retention_test_fail BEFORE INSERT OR UPDATE ON retention_progress FOR EACH ROW EXECUTE FUNCTION retention_test_fail()');
   try {
     expect((await new RetentionTransformations(db,['twitch_terminal']).run('twitch_terminal',token,'2030-06-15',now,performance.now()+60000)).status).toBe('ERROR');
     expect(await db.twitchEventReceipt.findUnique({where:{id:before.id}})).toEqual(before);
     expect(await db.retentionProgress.findUnique({where:{domain:'execute:twitch_terminal'}})).toBeNull();
   } finally {
     await db.$executeRawUnsafe('DROP TRIGGER retention_test_fail ON retention_progress');
     await db.$executeRawUnsafe('DROP FUNCTION retention_test_fail()');
   }
 },90000);
 it('visits more than 10000 rows without repeating a prefix and completes a durable inventory',async()=>{
   await db.$executeRaw`INSERT INTO notifications(id,player_id,domain_key,type_key,state,payload,created_at) SELECT gen_random_uuid(),${playerId}::uuid,'R1099','SYNTHETIC','UNREAD','{}'::jsonb,${old} FROM generate_series(1,10023)`;
   const result=await new RetentionEngine(db,'DRY_RUN',{now:()=>now},()=>{}).run();
   expect(result.status).toBe('SUCCESS');const report=result.report!.domains.find(row=>row.domain==='notifications')!;expect(report.inspected).toBe(10023);expect(report.nonTerminalProtected).toBe(10023);expect(report.coverage).toBe('EXHAUSTIVE');
   const checkpoint=await db.retentionProgress.findUniqueOrThrow({where:{domain:'notifications'}});expect(checkpoint.complete).toBe(true);expect(JSON.stringify(result.report)).not.toContain('"cursor"');
   expect((await new RetentionEngine(db,'DRY_RUN',{now:()=>now},()=>{}).run()).skipped).toBe('BUSY_COMPLETED_OR_BACKOFF');
   await db.notification.deleteMany({where:{playerId,domainKey:'R1099'}});
 },90000);
 it('resumes an interrupted page without counting the same rows twice',async()=>{
   for(let i=0;i<5;i++)await receipt();
   const controller=new AbortController(),inventory=new RetentionInventory(db,2),original=inventory.inspect.bind(inventory);
   vi.spyOn(inventory,'inspect').mockImplementation(async(...args)=>{const value=await original(...args);controller.abort();return value;});
   const interrupted=await new RetentionEngine(db,'DRY_RUN',{now:()=>now},()=>{},inventory).run(controller.signal);expect(interrupted.status).toBe('CANCELLED');
   expect((await db.retentionProgress.findUniqueOrThrow({where:{domain:'twitch_terminal'}})).complete).toBe(false);
   await db.$executeRawUnsafe("UPDATE retention_runs SET next_attempt_at=clock_timestamp()-interval '1 second'");
   const resumed=await new RetentionEngine(db,'DRY_RUN',{now:()=>now},()=>{},new RetentionInventory(db,2)).run();expect(resumed.status).toBe('SUCCESS');
   expect(resumed.report!.domains.find(row=>row.domain==='twitch_terminal')!.inspected).toBe(await db.twitchEventReceipt.count());
 },90000);
 it('compacts a terminal Twitch proof reversibly, preserves Event JSON and measures a positive stored gain',async()=>{
   const before=await receipt(),token=await lease();const result=await new RetentionTransformations(db,['twitch_terminal']).run('twitch_terminal',token,'2030-06-15',now,performance.now()+60000);
   expect(result.status).toBe('SUCCESS');expect(result.compacted).toBeGreaterThan(0);expect(result.storedBytesAfter).toBeLessThan(result.storedBytesBefore);
   console.info(JSON.stringify({event:'RETENTION_SYNTHETIC_MEASUREMENT',...result}));
   const after=await db.twitchEventReceipt.findUniqueOrThrow({where:{id:before.id}}),payload=after.payloadMinimal as Record<string,any>,original=before.payloadMinimal as Record<string,any>;
   expect({...payload,commandPilot:{...payload.commandPilot,intent:{...payload.commandPilot.intent,reads:decodeIntentReads(payload.commandPilot.intent.reads)}}}).toEqual(original);
   expect({...after,payloadMinimal:before.payloadMinimal}).toEqual(before);
   const replay=await new RetentionTransformations(db,['twitch_terminal']).run('twitch_terminal',token,'2030-06-15',now,performance.now()+60000);expect(replay).toEqual(result);
 },90000);
 it('refuses an expired lease or durable stop without changing a selected receipt',async()=>{
   const before=await receipt(),token=await lease();await db.retentionJob.update({where:{id:'retention-v1'},data:{executionEnabled:false}});
   expect((await new RetentionTransformations(db,['twitch_terminal']).run('twitch_terminal',token,'2030-06-15',now,performance.now()+10000)).status).toBe('STOPPED');expect(await db.twitchEventReceipt.findUnique({where:{id:before.id}})).toEqual(before);
   await db.retentionJob.update({where:{id:'retention-v1'},data:{executionEnabled:true,leaseUntil:new Date(0)}});
   expect((await new RetentionTransformations(db,['twitch_terminal']).run('twitch_terminal',token,'2030-06-15',now,performance.now()+10000)).status).toBe('STOPPED');
 });
 it('retains unknown versions, unconfirmed answers, executing states and fresh data',async()=>{
   const unknown=await receipt({commandPilot:{...pilot(),version:9}}),pending=await receipt({commandPilot:{...pilot(),responses:[{status:'SENDING',text:'Pending'}]}}),executing=await receipt({commandPilot:{...pilot(),stage:'EXECUTING'}}),fresh=await receipt();
   await db.twitchEventReceipt.update({where:{id:fresh.id},data:{processedAt:now}});const freshBefore=await db.twitchEventReceipt.findUniqueOrThrow({where:{id:fresh.id}}),token=await lease();
   await new RetentionTransformations(db,['twitch_terminal']).run('twitch_terminal',token,'2030-06-15',now,performance.now()+60000);
   for(const row of [unknown,pending,executing,freshBefore])expect(await db.twitchEventReceipt.findUnique({where:{id:row.id}})).toEqual(row);
 },90000);
 it('preserves Gacha original Team, v2 reference, state and RNG through stored compression',async()=>{
   const character=await db.character.findFirstOrThrow(),rotation=await db.bannerRotation.findFirstOrThrow(),team={teamId:null,elements:[],effects:[]};
   const op=await db.businessOperation.create({data:{playerId,operationType:'gacha.pull',sourceChannel:'UI',status:'COMPLETED',startedAt:old,completedAt:old,resultSummary:{gachaSnapshotVersion:2,activeTeam:team}}});
   const pull=await db.pullOperation.create({data:{playerId,bannerRotationId:rotation.id,targetCharacterId:character.id,pullCount:10,primogemCost:1600n,sourceChannel:'UI',businessOperationId:op.id,createdAt:old}});
   const snapshot={snapshotVersion:2,activeTeamRef:'operation',stateBefore:{pity5:0,pity4:0,captureProgress:0,fiftyFiftyLostStreak:0,totalPulls:'10',totalFiveStars:'1',totalFourStars:'2',fiftyFiftyWon:'1',fiftyFiftyLost:'0',capturesTriggered:'0',guaranteedFeatured5:false},stateAfter:{pity5:0,pity4:0,captureProgress:0,fiftyFiftyLostStreak:0,totalPulls:'10',totalFiveStars:'1',totalFourStars:'2',fiftyFiftyWon:'1',fiftyFiftyLost:'0',capturesTriggered:'0',guaranteedFeatured5:false},backToBack:true,rng:proof()};
   const before=await db.pullResult.create({data:{pullOperationId:pull.id,resultIndex:1,resultType:'character',characterId:character.id,rarity:5,wasNewCharacter:true,constellationAfter:0,copiesAfter:1,snapshot,createdAt:old}}),token=await lease(['gacha']);
   for(let index=2;index<=10;index++)await db.pullResult.create({data:{pullOperationId:pull.id,resultIndex:index,resultType:'character',characterId:character.id,rarity:5,wasNewCharacter:true,constellationAfter:0,copiesAfter:1,snapshot,createdAt:old}});
   const result=await new RetentionTransformations(db,['gacha']).run('gacha',token,'2030-06-15',now,performance.now()+60000);expect(result.compacted).toBeGreaterThan(0);
   console.info(JSON.stringify({event:'RETENTION_SYNTHETIC_MEASUREMENT',...result}));
   const after=await db.pullResult.findUniqueOrThrow({where:{id:before.id}});expect(expandDetail(after.snapshot)).toEqual(snapshot);expect(readGachaActiveTeam(after.snapshot,op.resultSummary)).toEqual(team);expect({...after,snapshot:before.snapshot}).toEqual(before);
   expect(await db.businessOperation.findUnique({where:{id:op.id}})).toEqual(op);
 },90000);
 it('preserves an Arcade response, fingerprint, operation, reward and replay data',async()=>{
   const op=await db.businessOperation.create({data:{playerId,operationType:'arcade.action',sourceChannel:'UI',status:'COMPLETED',startedAt:old,completedAt:old}});
   const response={operationId:op.id,alreadyProcessed:false,proof:proof(),rewards:{moras:'123',record:456}};
   const session=await db.arcadeSession.create({data:{playerId,game:'MEMORY',difficulty:'EASY',status:'FINISHED',firstSide:'PLAYER',privateState:{},randomState:1n,banterId:'synthetic',nextActionAt:old,finishedAt:old,outcome:'WIN',performancePoints:1,xpAwarded:1,businessDate:old,finishOperationId:op.id}});
   const intent={action:'synthetic exact replay'},key=randomUUID();
   const before=await db.arcadeReceipt.create({data:{playerId,sessionId:session.id,idempotencyKey:key,fingerprint:JSON.stringify(intent),operationId:op.id,response,createdAt:old}}),token=await lease(['arcade']);
   const result=await new RetentionTransformations(db,['arcade']).run('arcade',token,'2030-06-15',now,performance.now()+60000);expect(result.compacted).toBeGreaterThan(0);
   console.info(JSON.stringify({event:'RETENTION_SYNTHETIC_MEASUREMENT',...result}));
   const after=await db.arcadeReceipt.findUniqueOrThrow({where:{id:before.id}});expect(expandDetail(after.response)).toEqual(response);expect({...after,response:before.response}).toEqual(before);expect(await db.businessOperation.findUnique({where:{id:op.id}})).toEqual(op);
   const callback=vi.fn(async()=>{throw Error('Replay must not grant a reward');});
   expect(await arcadeTransaction(db,{now:()=>now},playerId,[],key,intent,callback)).toEqual({...response,alreadyProcessed:true});
   expect(callback).not.toHaveBeenCalled();expect(await db.businessOperation.findUnique({where:{id:op.id}})).toEqual(op);
 },90000);
 it('uses PostgreSQL calendar expiry consistently for count, page and equality',async()=>{
   const boundary=new Date('2024-02-29T11:00:00Z');const message=await db.globalChatMessage.create({data:{authorPlayerId:playerId,sourceChannel:'INTERNAL_CHAT',messageType:'PLAYER',content:'Synthetic calendar detail',createdAt:old}});
   const query=(at:Date)=>retentionVisiblePage(db,'chat',Prisma.sql`r.id=${message.id}::uuid`,Prisma.sql`r.id`,0,10,at);
   expect(await query(boundary)).toEqual({ids:[message.id],total:1});expect(await query(new Date(boundary.getTime()+1))).toEqual({ids:[],total:0});expect(await db.globalChatMessage.findUnique({where:{id:message.id}})).not.toBeNull();
 });
 it('restores only a verified postimage and preserves later unrelated progress',async()=>{
   const before=await receipt(),token=await lease();await new RetentionTransformations(db,['twitch_terminal']).run('twitch_terminal',token,'2030-06-15',now,performance.now()+60000);
   const compacted=await db.twitchEventReceipt.findUniqueOrThrow({where:{id:before.id}}),hash=retentionStorageHash(compacted.payloadMinimal!);
   await db.player.update({where:{id:playerId},data:{displayName:'Synthetic later progress'}});
   expect(await restoreStoredDetail(db,'twitch_terminal',before.id,hash)).toEqual({restored:true});
   expect((await db.twitchEventReceipt.findUniqueOrThrow({where:{id:before.id}})).payloadMinimal).toEqual(before.payloadMinimal);expect((await db.player.findUniqueOrThrow({where:{id:playerId}})).displayName).toBe('Synthetic later progress');
   await expect(restoreStoredDetail(db,'twitch_terminal',before.id,hash)).rejects.toThrow('RETENTION_RESTORE_STALE');
 },90000);
 it('does not round JSONB numbers beyond JavaScript precision during compaction',async()=>{
   const before=await receipt();await db.$executeRaw`UPDATE twitch_event_receipts SET payload_minimal=jsonb_set(payload_minimal,'{exactNumericProof}','9007199254740993'::jsonb) WHERE id=${before.id}::uuid`;
   const [original]=await db.$queryRaw<{text:string}[]>`SELECT payload_minimal::text AS text FROM twitch_event_receipts WHERE id=${before.id}::uuid`,token=await lease();
   await new RetentionTransformations(db,['twitch_terminal']).run('twitch_terminal',token,'2030-06-15',now,performance.now()+60000);
   const [after]=await db.$queryRaw<{text:string}[]>`SELECT payload_minimal::text AS text FROM twitch_event_receipts WHERE id=${before.id}::uuid`;expect(after!.text).toBe(original!.text);
 },90000);
});
