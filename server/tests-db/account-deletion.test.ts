import 'dotenv/config';
import {randomUUID} from 'node:crypto';
import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
import {isolatedBatchDatabase} from './isolated-batch-database.js';
import {PrismaCurrentPlayerStore} from '../src/infrastructure/database/prisma-current-player-store.js';
import {AccountDeletionService} from '../src/application/player/account-deletion-service.js';
import {checkErasureSchema} from '../src/application/player/erase-player-data.js';
import {assertNotErased} from '../src/application/player/account-erasure-markers.js';
import {AppError} from '../src/api/errors.js';
import {compactDetail} from '../src/application/retention/lossless-detail-storage.js';
import {encodeIntentReads} from '../src/application/twitch/twitch-intent-storage.js';
import {TwitchEventObserver} from '../src/application/twitch/twitch-event-observer.js';
import type {Prisma} from '../generated/prisma/client.js';
import {PrismaTwitchPlayerStore} from '../src/infrastructure/database/prisma-twitch-player-store.js';
import {twitchErasedAt} from '../src/application/player/account-erasure-markers.js';
import {buildApp} from '../src/app.js';
import {createLocalJWKSet,exportJWK,generateKeyPair,SignJWT} from 'jose';
import {SupabaseAuthAdapter,SupabaseJwtVerifier} from '../src/infrastructure/auth/supabase-auth-adapter.js';
const fixture=isolatedBatchDatabase(),db=fixture.database,key='11'.repeat(32);
beforeAll(async()=>{await fixture.setup({prismaMigrations:true,seedPublicCatalog:true});process.env['ACCOUNT_DELETION_MARKER_KEY']=key;},180000);
afterAll(async()=>{delete process.env['ACCOUNT_DELETION_MARKER_KEY'];await fixture.cleanup();},60000);
async function player(){const subject=randomUUID();return{subject,player:(await new PrismaCurrentPlayerStore(db).provision({provider:'supabase',providerSubject:subject,displayName:'Synth '+randomUUID().slice(0,8)})).player};}
function service(failAuth=false,offline=false){const errors:unknown[]=[],deleted=new Set<string>();const admin={
 verifyFresh:vi.fn(async(token:string,subject:string)=>{if(token!==`fresh:${subject}`)throw new AppError('Réauthentification requise.',401,'ACCOUNT_REAUTH_REQUIRED');}),
 isLive:vi.fn(async(_token:string,subject:string)=>!deleted.has(subject)),
 deleteUser:vi.fn(async(subject:string)=>{if(failAuth)throw new Error('Synthetic provider outage');deleted.add(subject);}),
 removeStorage:vi.fn(async()=>undefined)};
 const verifier={verify:async(token:string)=>({subject:token})};
 return {admin,errors,instance:new AccountDeletionService(db,admin,verifier,key,offline?'WAIT_FOR_OFFLINE_ERASURE':'RETENTION_30_DAYS',error=>errors.push(error))};}
const proof=(subject:string)=>({confirmation:'SUPPRIMER' as const,reauthenticationToken:`fresh:${subject}`});
describe('R1100 synthetic erasure in private PostgreSQL',()=>{
 it('returns202 then confirms worker completion after restart with a valid JWT even when Auth is already gone; expiry and peer access stay refused',async()=>{
   const target=await player(),peer=await player(),s=service(true),issuer='https://synthetic.invalid/auth/v1';
   await db.player.update({where:{id:target.player.id},data:{birthdayDay:29,birthdayMonth:2,birthdayRegisteredAt:new Date(),birthdayLastRewardYear:2025}});
   const birthdayCopy=await db.businessOperation.create({data:{playerId:peer.player.id,operationType:'fixture.profile-copy',sourceChannel:'UI',status:'COMPLETED',resultSummary:{profile:{player:{id:target.player.id,displayName:target.player.displayName},birthday:{access:'ALLOWED',data:{day:29,month:2}}},amount:'50000'}}});
   const {publicKey,privateKey}=await generateKeyPair('RS256');const jwk=await exportJWK(publicKey);
   const verifier=new SupabaseAuthAdapter(new SupabaseJwtVerifier(issuer,createLocalJWKSet({keys:[{...jwk,alg:'RS256',kid:'private-test'}]})));
   const token=(subject:string,expired=false)=>new SignJWT({}).setProtectedHeader({alg:'RS256',kid:'private-test'}).setIssuer(issuer).setSubject(subject)
     .setExpirationTime(Math.floor(Date.now()/1000)+(expired?-60:3600)).sign(privateKey);
   const instance=new AccountDeletionService(db,s.admin,verifier,key,'RETENTION_30_DAYS');
   const provision=vi.fn(()=>{throw new Error('No provisioning on followup')});
   const app=await buildApp({host:'127.0.0.1',port:3001,supabase:{}},{authIdentityVerifier:instance.guardedVerifier(),accountDeletion:instance,getOrProvisionCurrentPlayer:{execute:provision} as never});
   try{
     const jwt=await token(target.subject),body=proof(target.subject);
     const post=(access:string,payload:Record<string,unknown>=body)=>app.inject({method:'POST',url:'/api/v1/me/account/deletion',headers:{authorization:'Bearer '+access},payload});
     expect((await post(jwt)).statusCode).toBe(202);
     expect(await db.playerProgression.count({where:{playerId:target.player.id}})).toBe(0);
     const job=await db.accountDeletion.findUniqueOrThrow({where:{playerId:target.player.id}});
     expect(await db.player.findUniqueOrThrow({where:{id:target.player.id}})).toMatchObject({birthdayDay:null,birthdayMonth:null,birthdayRegisteredAt:null,birthdayLastRewardYear:null});
     expect((await db.businessOperation.findUniqueOrThrow({where:{id:birthdayCopy.id}})).resultSummary).toMatchObject({profile:{birthday:{access:'PRIVATE'}},amount:'50000'});
     expect(job.status).toBe('DATABASE_ERASED');expect((await post(jwt)).json()).toEqual({status:'PENDING'});expect(s.admin.verifyFresh).toHaveBeenCalledTimes(1);
     const adminCalls=s.admin.deleteUser.mock.calls.length;
     expect((await post(await token(target.subject,true))).statusCode).toBe(401);expect(s.admin.deleteUser).toHaveBeenCalledTimes(adminCalls);
     const peerBefore=await db.playerProgression.findUniqueOrThrow({where:{playerId:peer.player.id}});
     expect((await post(await token(peer.subject),{...body,playerId:target.player.id})).statusCode).toBe(400);
     expect((await post(await token(peer.subject))).statusCode).toBe(401);
     expect(await db.playerProgression.findUniqueOrThrow({where:{playerId:peer.player.id}})).toEqual(peerBefore);
     // Auth deletion completed just before the old process stopped. A new
     // worker safely repeats the idempotent provider step, never the DB erasure.
     s.admin.isLive.mockResolvedValue(false);s.admin.deleteUser.mockResolvedValue(undefined);
     const restarted=new AccountDeletionService(db,s.admin,verifier,key,'RETENTION_30_DAYS');await restarted.resumePending();
     expect((await post(jwt)).statusCode).toBe(200);expect((await post(jwt)).json()).toEqual({status:'COMPLETED'});
     expect(await db.accountDeletion.count({where:{playerId:target.player.id}})).toBe(1);expect(s.admin.verifyFresh).toHaveBeenCalledTimes(2); // own initial proof plus refused peer proof
     expect(await instance.guardedVerifier().verify(jwt)).toBeNull();expect(provision).not.toHaveBeenCalled();
   }finally{await app.close()}
 });
 it('erases completed canonicalization and automatic Web archives but never an unchosen Twitch target',async()=>{
   const target=await player(),lost=await player(),automatic=await player(),peer=await player(),s=service();
   const web=await db.webIdentity.findUniqueOrThrow({where:{playerId:target.player.id}});
   const twitchId='994'+Date.now();
   await db.twitchIdentity.create({data:{playerId:target.player.id,twitchUserId:twitchId,login:'scope_synthetic'}});
   for(const archive of [lost,automatic]){
     await db.playerProgression.update({where:{playerId:archive.player.id},data:{xp:54321n}});
     await db.webIdentity.delete({where:{playerId:archive.player.id}});
     await db.player.update({where:{id:archive.player.id},data:{legacyUsername:'archive_'+archive.player.id,status:'ARCHIVED'}});
   }
   await db.twitchLinkResolution.create({data:{webIdentityId:web.id,webPlayerId:target.player.id,twitchPlayerId:lost.player.id,twitchUserId:twitchId,login:'scope_synthetic',comparedState:{},choice:'WEB',completedAt:new Date(),expiresAt:new Date(Date.now()+60000)}});
   await db.twitchLinkResolution.create({data:{webIdentityId:web.id,webPlayerId:automatic.player.id,twitchPlayerId:target.player.id,twitchUserId:twitchId,login:'scope_synthetic',comparedState:{kind:'AUTOMATIC_RECOVERY'},expiresAt:new Date(Date.now()+60000)}});
   await db.twitchLinkResolution.create({data:{webIdentityId:web.id,webPlayerId:target.player.id,twitchPlayerId:peer.player.id,twitchUserId:'995'+Date.now(),login:'unchosen_synthetic',comparedState:{},expiresAt:new Date(Date.now()+60000)}});
   const peerBefore=await db.playerProgression.findUniqueOrThrow({where:{playerId:peer.player.id}});
   expect((await s.instance.execute({subject:target.subject},proof(target.subject))).status).toBe('COMPLETED');expect(s.errors).toEqual([]);
   for(const archive of [lost,automatic]){
     expect(await db.playerProgression.count({where:{playerId:archive.player.id}})).toBe(0);
     expect(await db.player.findUniqueOrThrow({where:{id:archive.player.id}})).toMatchObject({displayName:'Compte supprimé',legacyUsername:null});
     await expect(db.$transaction(tx=>assertNotErased(tx,'PLAYER',archive.player.id))).rejects.toThrow('RESTORE_FORBIDDEN');
   }
   expect(await db.playerProgression.findUniqueOrThrow({where:{playerId:peer.player.id}})).toEqual(peerBefore);
   expect(await db.webIdentity.count({where:{playerId:peer.player.id}})).toBe(1);
 });
 it('refuses a reassigned archive before accepting deletion',async()=>{
   const target=await player(),peer=await player(),s=service();
   const web=await db.webIdentity.findUniqueOrThrow({where:{playerId:target.player.id}});
   await db.twitchLinkResolution.create({data:{webIdentityId:web.id,webPlayerId:target.player.id,twitchPlayerId:peer.player.id,twitchUserId:'996'+Date.now(),login:'reassigned_synthetic',comparedState:{},choice:'WEB',completedAt:new Date(),expiresAt:new Date(Date.now()+60000)}});
   await expect(s.instance.execute({subject:target.subject},proof(target.subject))).rejects.toMatchObject({code:'ACCOUNT_DELETION_OWNERSHIP'});
   expect(await db.accountDeletion.count({where:{playerId:target.player.id}})).toBe(0);expect(s.admin.deleteUser).not.toHaveBeenCalled();
 });
 it('removes both proved friendship identities without losing peer historical values and blocks source restoration',async()=>{
   const target=await player(),peer=await player(),oldPeer=await player(),s=service(),twitchId='997'+Date.now();
   await db.twitchIdentity.create({data:{playerId:target.player.id,twitchUserId:twitchId,login:'friend_synthetic'}});
   const pairKey='f'.repeat(64);
   const fact=await db.legacyFriendshipFact.create({data:{sourceSnapshotHash:'a'.repeat(64),sourcePairKeyHash:pairKey,sourceFingerprint:'b'.repeat(64),leftSourceKeyHash:'c'.repeat(64),rightSourceKeyHash:'d'.repeat(64),leftTwitchUserId:twitchId,leftProofHash:'e'.repeat(64),rightTwitchUserId:'998'+Date.now(),rightProofHash:'9'.repeat(64),level:3,totalHearts:42n}});
   const pair=[peer.player.id,oldPeer.player.id].sort();
   const friendship=await db.friendship.create({data:{playerAId:pair[0]!,playerBId:pair[1]!,legacyFactId:fact.id,legacyLeftPlayerId:peer.player.id,level:3,totalHearts:42n}});
   const carryover=await db.friendshipLegacyHeartState.create({data:{friendshipId:friendship.id,senderPlayerId:oldPeer.player.id,lastHeartSentDate:new Date('2026-10-10'),legacyProvenance:{factId:fact.id,sourceFingerprint:fact.sourceFingerprint}}});
   const batch=await db.migrationBatch.create({data:{snapshotHash:'a'.repeat(64),status:'COMPLETED',mode:'CUTOVER',migratorVersion:'SYNTHETIC',summary:{sourcePairKeyHash:pairKey,materialized:1}}});
   await db.player.update({where:{id:oldPeer.player.id},data:{status:'ARCHIVED'}});
   const before=await db.friendship.findUniqueOrThrow({where:{id:friendship.id}});
   expect((await s.instance.execute({subject:target.subject},proof(target.subject))).status).toBe('COMPLETED');expect(s.errors).toEqual([]);
   expect(await db.legacyFriendshipFact.count({where:{id:fact.id}})).toBe(0);
   expect(await db.friendship.findUniqueOrThrow({where:{id:friendship.id}})).toEqual({...before,legacyFactId:null,legacyLeftPlayerId:null});
   expect((await db.friendshipLegacyHeartState.findUniqueOrThrow({where:{friendshipId_senderPlayerId:{friendshipId:friendship.id,senderPlayerId:oldPeer.player.id}}}))).toMatchObject({lastHeartSentDate:carryover.lastHeartSentDate,legacyProvenance:{factId:null,sourceFingerprint:null}});
   expect((await db.migrationBatch.findUniqueOrThrow({where:{id:batch.id}})).summary).toEqual({sourcePairKeyHash:null,materialized:1});
   await expect(db.$transaction(tx=>assertNotErased(tx,'FRIENDSHIP_SOURCE',pairKey))).rejects.toThrow('RESTORE_FORBIDDEN');
 });
 it('classifies actual foreign keys and JSON columns',async()=>{await db.$transaction(tx=>checkErasureSchema(tx));});
 it('refuses a frozen Event population before acceptance and preserves a completed shared draw',async()=>{
   const target=await player(),s=service();
   const definition=await db.eventDefinition.findFirstOrThrow();
   const edition=await db.eventEdition.create({data:{eventDefinitionId:definition.id,year:2201,startsAt:new Date('2201-01-01'),endsAt:new Date('2201-02-01'),status:'FINISHED',snapshot:definition.config as Prisma.InputJsonValue}});
   await db.eventParticipant.create({data:{eventEditionId:edition.id,playerId:target.player.id,points:17}});
   await db.eventMonthlyDraw.create({data:{eventEditionId:edition.id,activationId:'R1053',closesAt:edition.endsAt,status:'FROZEN',entropySeed:'ab'.repeat(32),population:[{playerId:target.player.id,points:17}],totalTickets:17,ticketIndex:2,frozenAt:new Date()}});
   await expect(s.instance.execute({subject:target.subject},proof(target.subject))).rejects.toMatchObject({code:'ACCOUNT_DELETION_RESPONSIBILITY'});
   expect(await db.accountDeletion.count({where:{playerId:target.player.id}})).toBe(0);
   const operation=await db.businessOperation.create({data:{playerId:target.player.id,operationType:'EVENT_MONTHLY_DRAW',sourceChannel:'SYSTEM',status:'COMPLETED',completedAt:new Date()}});
   await db.eventMonthlyDraw.update({where:{eventEditionId:edition.id},data:{status:'COMPLETED',completedAt:new Date(),winnerPlayerId:target.player.id,operationId:operation.id}});
   const notice=await db.notification.create({data:{playerId:(await player()).player.id,domainKey:'EVENT',typeKey:'SYNTHETIC',payload:{winnerPlayerId:target.player.id,winnerName:target.player.displayName,totalTickets:17}}});
   const before=await db.eventMonthlyDraw.findUniqueOrThrow({where:{eventEditionId:edition.id}});
   expect((await s.instance.execute({subject:target.subject},proof(target.subject))).status).toBe('COMPLETED');expect(s.errors).toEqual([]);
   expect(await db.eventMonthlyDraw.findUniqueOrThrow({where:{eventEditionId:edition.id}})).toEqual(before);
   expect(await db.eventParticipant.count({where:{playerId:target.player.id}})).toBe(0);
   expect((await db.notification.findUniqueOrThrow({where:{id:notice.id}})).payload).toMatchObject({winnerName:'Compte supprimé',totalTickets:17});
 });
 it('erases a provisioned account and progression while preserving the peer byte for byte',async()=>{
   const target=await player(),peer=await player(),s=service();
   await db.playerProgression.update({where:{playerId:target.player.id},data:{xp:12345n,totalMessages:17n}});
   const before=await db.$queryRaw`SELECT to_jsonb(p) AS row FROM players p WHERE id=${peer.player.id}::uuid`;
   const result=await s.instance.execute({subject:target.subject},proof(target.subject));
   expect(s.errors).toEqual([]);expect(result.status).toBe('COMPLETED');
   expect(await db.webIdentity.count({where:{playerId:target.player.id}})).toBe(0);
   expect(await db.playerProgression.count({where:{playerId:target.player.id}})).toBe(0);
   expect(await db.playerResourceBalance.count({where:{playerId:target.player.id}})).toBe(0);
   expect(await db.player.findUnique({where:{id:target.player.id}})).toMatchObject({displayName:'Compte supprimé',status:'ARCHIVED',elementKey:null,legacyUsername:null});
   expect(await db.$queryRaw`SELECT to_jsonb(p) AS row FROM players p WHERE id=${peer.player.id}::uuid`).toEqual(before);
   await expect(s.instance.guardedVerifier().verify(target.subject)).resolves.toBeNull();
   await expect(new PrismaCurrentPlayerStore(db).provision({provider:'supabase',providerSubject:target.subject,displayName:'Must not recreate'})).rejects.toThrow('ACCOUNT_DELETION_ACCEPTED');
   await expect(db.$transaction(tx=>assertNotErased(tx,'PLAYER',target.player.id))).rejects.toThrow('ACCOUNT_ERASED_RESTORE_FORBIDDEN');
 });
 it('rejects another identity proof before accepting any irreversible step',async()=>{
   const target=await player(),other=await player(),s=service();
   await expect(s.instance.execute({subject:target.subject},proof(other.subject))).rejects.toMatchObject({code:'ACCOUNT_REAUTH_REQUIRED'});
   expect(await db.player.findUnique({where:{id:target.player.id}})).toMatchObject({status:'ACTIVE'});
   expect(s.admin.deleteUser).not.toHaveBeenCalled();
 });
 it('resumes Auth failure without restoring or repeating deleted progression',async()=>{
   const target=await player(),s=service(true);
   expect((await s.instance.execute({subject:target.subject},proof(target.subject))).status).toBe('PENDING');
   expect(s.errors.map(x=>String(x))).toEqual(['Error: Synthetic provider outage']);
   expect(await db.playerProgression.count({where:{playerId:target.player.id}})).toBe(0);
   s.admin.deleteUser.mockResolvedValue(undefined);
   expect((await s.instance.execute({subject:target.subject},proof(target.subject))).status).toBe('COMPLETED');
   expect(s.admin.verifyFresh).toHaveBeenCalledTimes(1);
 });
 it('does not claim complete deletion while offline erasure is required',async()=>{
   const target=await player(),s=service(false,true);
   expect((await s.instance.execute({subject:target.subject},proof(target.subject))).status).toBe('PENDING');
   expect(s.errors).toEqual([]);
   expect(await db.accountDeletion.findUnique({where:{playerId:target.player.id}})).toMatchObject({status:'BACKUP_PENDING',authSubject:null,completedAt:null});
 });
 it('serializes requests from two tabs and calls Auth deletion only once',async()=>{
   const target=await player(),s=service();
   const results=await Promise.all([s.instance.execute({subject:target.subject},proof(target.subject)),s.instance.execute({subject:target.subject},proof(target.subject))]);
   expect(s.errors).toEqual([]);expect(results.some(x=>x.status==='COMPLETED')).toBe(true);expect(s.admin.deleteUser).toHaveBeenCalledTimes(1);
 });
 it('scrubs shared MP reports, peer notifications and compressed copies, preserving peer progression and economic numbers',async()=>{
   const target=await player(),peer=await player(),archived=await player(),s=service(),twitchId='88'+Date.now();
   await db.twitchIdentity.create({data:{playerId:target.player.id,twitchUserId:twitchId,login:'synthetic_deleted',displayName:target.player.displayName}});
   await db.player.update({where:{id:target.player.id},data:{legacyUsername:'SYNTHETIC_OLD'}});
   const batch=await db.migrationBatch.create({data:{snapshotHash:'a'.repeat(64),status:'COMPLETED',mode:'CUTOVER',migratorVersion:'SYNTHETIC',summary:{kind:'EVENT_MESSAGES',facts:{source:{SYNTHETIC_OLD:[{sender:'peer_old',text:'Peer received'}],peer_old:[{sender:'SYNTHETIC_OLD',text:'Private legacy without alias'},{sender:'peer_old',text:'Peer legacy preserved'}]}}}}});
   const issue=await db.migrationIssue.create({data:{batchId:batch.id,sourceName:'SYNTHETIC',legacyKey:'synthetic_old',path:'viewers.synthetic_old',severity:'WARNING',issueCode:'SYNTHETIC',description:'synthetic_old issue'}});
   const announcement=await db.giveawayAnnouncement.create({data:{kind:'WISH',text:target.player.displayName+' participe (17)',fullText:null,state:'SENT'}});
   const character=await db.character.findFirstOrThrow();
   await db.playerCharacter.create({data:{playerId:target.player.id,characterId:character.id,constellation:6,copies:7,firstObtainedAt:new Date()}});
   const team=await db.team.create({data:{playerId:target.player.id,displayPosition:1,name:'Private team'}});
   await db.teamMember.create({data:{teamId:team.id,position:1,characterId:character.id}});
   const pair=[target.player.id,peer.player.id].sort();
   const conversation=await db.directConversation.create({data:{playerAId:pair[0]!,playerBId:pair[1]!}});
   const operation=async(playerId:string)=>db.businessOperation.create({data:{playerId,operationType:'DIRECT_MESSAGE_SEND',sourceChannel:'UI',status:'COMPLETED',completedAt:new Date()}});
   const authored=await db.directMessage.create({data:{conversationId:conversation.id,authorPlayerId:target.player.id,content:'private authored without alias',operationId:(await operation(target.player.id)).id}});
   const reply=await db.directMessage.create({data:{conversationId:conversation.id,authorPlayerId:peer.player.id,content:'Peer text preserved',replyToMessageId:authored.id,operationId:(await operation(peer.player.id)).id}});
   const snapshot={id:authored.id,authorPlayerId:target.player.id,authorDisplayName:target.player.displayName,content:'private authored without alias'};
   const report=await db.directMessageReport.create({data:{reporterPlayerId:peer.player.id,reportedPlayerId:target.player.id,conversationId:conversation.id,messageId:authored.id,
     messageSnapshot:snapshot,contextSnapshot:[snapshot,{id:reply.id,authorPlayerId:peer.player.id,authorDisplayName:peer.player.displayName,content:'Peer text preserved',replyToMessageId:authored.id,replyPreview:'private authored without alias'}],snapshotFingerprint:'synthetic'}});
   const notification=await db.notification.create({data:{playerId:peer.player.id,domainKey:'FRIENDS',typeKey:'SYNTHETIC',payload:{senderId:target.player.id,senderName:target.player.displayName,body:target.player.displayName+' a répondu.',amount:twitchId}}});
   const archivedNotification=await db.notification.create({data:{playerId:archived.player.id,domainKey:'FRIENDS',typeKey:'SYNTHETIC',payload:{senderId:target.player.id,senderName:target.player.displayName}}});
   await db.player.update({where:{id:archived.player.id},data:{status:'ARCHIVED'}});
   const receipt=await db.twitchEventReceipt.create({data:{externalEventId:randomUUID(),eventType:'SYNTHETIC',state:'PROCESSED',processedAt:new Date(),payloadMinimal:compactDetail({frozen:encodeIntentReads({rows:Array.from({length:150},()=>({actorId:target.player.id,name:target.player.displayName,text:'private authored without alias',amount:twitchId}))})}) as Prisma.InputJsonValue}});
   const peerBefore=await db.playerProgression.findUniqueOrThrow({where:{playerId:peer.player.id}});
   expect((await s.instance.execute({subject:target.subject},proof(target.subject))).status).toBe('COMPLETED');expect(s.errors).toEqual([]);
   expect(await db.playerCharacter.count({where:{playerId:target.player.id}})).toBe(0);expect(await db.team.count({where:{playerId:target.player.id}})).toBe(0);
   expect(await db.directMessage.findUniqueOrThrow({where:{id:authored.id}})).toMatchObject({content:null});
   expect(await db.directMessage.findUniqueOrThrow({where:{id:reply.id}})).toMatchObject({content:'Peer text preserved',replyToMessageId:authored.id});
   const cleaned=await db.directMessageReport.findUniqueOrThrow({where:{id:report.id}});
   expect(JSON.stringify(cleaned.messageSnapshot)).not.toContain('private authored');expect(JSON.stringify(cleaned.contextSnapshot)).toContain('Peer text preserved');
   expect(JSON.stringify(cleaned.contextSnapshot)).not.toContain('private authored');
   expect((await db.notification.findUniqueOrThrow({where:{id:notification.id}})).payload).toMatchObject({senderName:'Compte supprimé',amount:twitchId});
   expect((await db.notification.findUniqueOrThrow({where:{id:archivedNotification.id}})).payload).toMatchObject({senderName:'Compte supprimé'});
   expect(JSON.stringify((await db.twitchEventReceipt.findUniqueOrThrow({where:{id:receipt.id}})).payloadMinimal)).not.toContain('private authored');
   const batchAfter=JSON.stringify((await db.migrationBatch.findUniqueOrThrow({where:{id:batch.id}})).summary);
   expect(batchAfter).not.toContain('SYNTHETIC_OLD');expect(batchAfter).not.toContain('Private legacy');expect(batchAfter).toContain('Peer legacy preserved');
   expect(await db.migrationIssue.findUniqueOrThrow({where:{id:issue.id}})).toMatchObject({legacyKey:null,path:null,description:'Référence personnelle supprimée'});
   expect(await db.giveawayAnnouncement.findUniqueOrThrow({where:{id:announcement.id}})).toMatchObject({text:'Compte supprimé participe (17)',fullText:null});
   expect(await db.playerProgression.findUniqueOrThrow({where:{playerId:peer.player.id}})).toEqual(peerBefore);
   await expect(db.$transaction(tx=>assertNotErased(tx,'TWITCH',twitchId))).rejects.toThrow('RESTORE_FORBIDDEN');
   await expect(new TwitchEventObserver(db).observeTwitchEvent({externalEventId:randomUUID(),eventType:'channel.chat.message',twitchUserId:twitchId,sourceTimestamp:new Date(Date.now()-60000).toISOString()})).rejects.toThrow('TWITCH_ERASED_DELIVERY');
   // A different Auth subject is a fresh registration; no old progression follows it.
   const fresh=await player();expect(fresh.player.id).not.toBe(target.player.id);
   expect(await db.playerCharacter.count({where:{playerId:fresh.player.id}})).toBe(0);
   const web=await db.webIdentity.findUniqueOrThrow({where:{playerId:fresh.player.id}});
   await expect(db.$executeRaw`UPDATE web_identities SET provider_subject=${target.subject} WHERE id=${web.id}::uuid`).rejects.toThrow('ACCOUNT_DELETION_ACCEPTED');
 },120000);
 it('refuses essential administration before any irreversible step',async()=>{
   const target=await player(),s=service();
   await db.playerRoleAssignment.create({data:{playerId:target.player.id,role:'ADMIN'}});
   await expect(s.instance.execute({subject:target.subject},proof(target.subject))).rejects.toMatchObject({code:'ACCOUNT_DELETION_RESPONSIBILITY'});
   expect(await db.accountDeletion.count({where:{playerId:target.player.id}})).toBe(0);expect(s.admin.deleteUser).not.toHaveBeenCalled();
   expect(await db.player.findUniqueOrThrow({where:{id:target.player.id}})).toMatchObject({status:'ACTIVE'});
 });
 it('refreshes the Twitch cutoff on a second deletion and fences a previously observed event under the provisioning lock',async()=>{
   const twitchId='99'+Date.now(),first=await player(),s=service();
   await db.twitchIdentity.create({data:{playerId:first.player.id,twitchUserId:twitchId,login:'synthetic_twice'}});
   expect((await s.instance.execute({subject:first.subject},proof(first.subject))).status).toBe('COMPLETED');
   const cutoff1=await twitchErasedAt(db,twitchId);
   const second=await player();await db.twitchIdentity.create({data:{playerId:second.player.id,twitchUserId:twitchId,login:'synthetic_twice'}});
   const observedBeforeSecondDeletion=new Date();
   expect((await s.instance.execute({subject:second.subject},proof(second.subject))).status).toBe('COMPLETED');
   const cutoff2=await twitchErasedAt(db,twitchId);expect(cutoff2!.getTime()).toBeGreaterThan(cutoff1!.getTime());
   await expect(new TwitchEventObserver(db).observeTwitchEvent({externalEventId:randomUUID(),eventType:'channel.chat.message',twitchUserId:twitchId,sourceTimestamp:observedBeforeSecondDeletion.toISOString()})).rejects.toThrow('TWITCH_ERASED_DELIVERY');
   const authority={covers:vi.fn(async()=>true)};
   expect(await new PrismaTwitchPlayerStore(db,authority as never).resolve({twitchUserId:twitchId,login:'synthetic_twice',displayName:'Synthetic',observedAt:observedBeforeSecondDeletion})).toBeNull();
   expect(authority.covers).not.toHaveBeenCalled();expect(await db.twitchIdentity.count({where:{twitchUserId:twitchId}})).toBe(0);
 },120000);
 it('timestamps acceptance after the Twitch lock wait, not at transaction start',async()=>{
   const target=await player(),s=service(),twitchId='77'+Date.now();
   await db.twitchIdentity.create({data:{playerId:target.player.id,twitchUserId:twitchId,login:'synthetic_locked'}});
   let release!:()=>void,ready!:()=>void;
   const holding=new Promise<void>(resolve=>{release=resolve}),locked=new Promise<void>(resolve=>{ready=resolve});
   const blocker=db.$transaction(async tx=>{await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`twitch-provision:${twitchId}`},0))::text`;ready();await holding;},{timeout:30000});
   await locked;const request=s.instance.execute({subject:target.subject},proof(target.subject));
   let observed:Date|undefined,failed:unknown;
   try {
     for(let attempt=0;attempt<50;attempt++){
       const wait=await fixture.admin.query<{waiting:boolean}>(`SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND NOT granted
         AND classid=((hashtextextended($1,0)>>32)&4294967295)::oid AND objid=(hashtextextended($1,0)&4294967295)::oid) AS waiting`,[`twitch-provision:${twitchId}`]);
       if(wait.rows[0]?.waiting){observed=(await fixture.admin.query<{at:Date}>('SELECT clock_timestamp() AS at')).rows[0]!.at;break;}
       await new Promise(resolve=>setTimeout(resolve,20));
     }
     expect(observed).toBeDefined();
   }catch(error){failed=error;}finally{release();await blocker;}
   expect((await request).status).toBe('COMPLETED');expect(s.errors).toEqual([]);if(failed)throw failed;
   const job=await db.accountDeletion.findUniqueOrThrow({where:{playerId:target.player.id}});
   expect(job.acceptedAt.getTime()).toBeGreaterThanOrEqual(observed!.getTime());
   expect(await new PrismaTwitchPlayerStore(db,{covers:vi.fn(async()=>true)} as never).resolve({twitchUserId:twitchId,login:'synthetic_locked',displayName:'Synthetic',observedAt:observed!})).toBeNull();
 },120000);
});
