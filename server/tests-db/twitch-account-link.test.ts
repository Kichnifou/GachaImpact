import { randomUUID } from 'node:crypto';
import { permanentMissionCatalog } from '../src/domain/missions/permanent-mission-catalog.js';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { bootstrapPlayer } from '../src/infrastructure/database/player-bootstrap.js';
import { TwitchAccountLink } from '../src/application/twitch/twitch-account-link.js';
import { PrismaCurrentPlayerStore } from '../src/infrastructure/database/prisma-current-player-store.js';
import { NotificationService } from '../src/application/notification/notification-service.js';
import type { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import type { ExpeditionService } from '../src/application/expedition/expedition-service.js';
import { buildCutoverPurgePlan, applyPrivateCutoverPurge } from '../src/application/migration/legacy-cutover-purge.js';
import { assessPlayerCanonicalizationSafety } from '../src/application/twitch/player-canonicalization-safety.js';
import { assessBaselineCanonicalizationSafety } from './canonicalization-safety-reference.js';
import { readLegacyAccountProjection } from './legacy-account-projection.js';

const fixture = isolatedBatchDatabase(), db = fixture.database, link = new TwitchAccountLink(db);
let sequence = 0;
beforeAll(async () => {
  await fixture.setup({ prismaMigrations:true });
  await db.permanentMissionDefinition.createMany({ data:permanentMissionCatalog.map(entry=>({...entry})),skipDuplicates:true });
},180_000);
afterAll(async () => {
  await fixture.cleanup();
  const pool = fixture.poolSnapshot();
  expect(pool.total).toBe(0); expect(pool.idle).toBe(0); expect(pool.waiting).toBe(0); expect(pool.opened).toBe(pool.closed);
}, 60_000);
async function equivalentAssessment(playerId: string) {
  return db.$transaction(async tx => {
    await tx.$executeRaw`SET LOCAL statement_timeout='5000ms'`;
    const baseline = await assessBaselineCanonicalizationSafety(tx, playerId);
    const optimized = await assessPlayerCanonicalizationSafety(tx, playerId);
    expect(optimized).toEqual(baseline);
    return optimized;
  }, { isolationLevel: 'RepeatableRead', timeout: 60_000 });
}
async function profiles(significant = true) {
  const subject = randomUUID(), twitchUserId = String(960000000000 + ++sequence);
  const web = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Private Web', webIdentity: { provider: 'supabase', providerSubject: subject } }));
  const twitch = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Private Twitch', twitchIdentity: { twitchUserId, login: 'private_original', displayName: 'Private Twitch', firstSeenAt: new Date() } }));
  if (significant) { await db.player.update({ where: { id: web.id }, data: { elementKey: 'pyro' } }); await db.playerProgression.update({ where: { playerId: web.id }, data: { xp: 90n } }); await db.playerResourceBalance.update({ where: { playerId_resourceKey: { playerId: web.id, resourceKey: 'primogems' } }, data: { amount: 100n } }); }
  await db.playerProgression.update({ where: { playerId: twitch.id }, data: { xp: 60n, totalMessages: 55n } });
  await db.playerResourceBalance.update({ where: { playerId_resourceKey: { playerId: twitch.id, resourceKey: 'primogems' } }, data: { amount: 777n } });
  const identity = await db.webIdentity.findUniqueOrThrow({ where: { playerId: web.id } });
  return { web, twitch, subject, twitchUserId, identity };
}
it('links an unknown verified Twitch ID to the same significant Web Player without replacing gameplay', async () => {
  const f = await profiles(), unknown = String(970000000000 + sequence);
  const balances = await db.playerResourceBalance.findMany({ where: { playerId: f.web.id } });
  await expect(link.verified(f.identity.id, f.web.id, unknown, 'new_login', 'New name')).resolves.toMatchObject({ linked: true, playerId: f.web.id, resolutionRequired: false });
  expect(await db.playerResourceBalance.findMany({ where: { playerId: f.web.id } })).toEqual(balances);
  expect((await db.playerProgression.findUniqueOrThrow({ where: { playerId: f.web.id } })).xp).toBe(90n);
  expect(await db.twitchLinkResolution.count({ where: { webIdentityId: f.identity.id } })).toBe(0);
});
it('recovers a null-element Twitch Player from a disposable Web Player using the same WebIdentity', async () => {
  const f = await profiles(false);
  await expect(link.verified(f.identity.id, f.web.id, f.twitchUserId, 'renamed', 'Renamed')).resolves.toMatchObject({ playerId: f.twitch.id, linked: true });
  expect(await db.player.findUnique({ where: { id: f.web.id } })).toBeNull();
  expect(await db.webIdentity.findUniqueOrThrow({ where: { id: f.identity.id } })).toMatchObject({ playerId: f.twitch.id });
  expect((await db.player.findUniqueOrThrow({ where: { id: f.twitch.id } })).elementKey).toBeNull();
  expect((await db.playerProgression.findUniqueOrThrow({ where: { playerId: f.twitch.id } })).xp).toBe(60n);
});
it('is idempotent on the same Player and refreshes a rename without changing immutable Twitch ID', async () => {
  const f = await profiles(false); await link.verified(f.identity.id, f.web.id, f.twitchUserId, 'first', 'First');
  await link.verified(f.identity.id, f.twitch.id, f.twitchUserId, 'new_name', 'New name');
  expect(await db.twitchIdentity.findUniqueOrThrow({ where: { twitchUserId: f.twitchUserId } })).toMatchObject({ playerId: f.twitch.id, login: 'new_name', displayName: 'New name' });
  expect(await db.twitchIdentity.count({ where: { twitchUserId: f.twitchUserId } })).toBe(1);
});
it.each(['WEB','TWITCH'] as const)('keeps exactly the selected %s graph, archives the other and makes the choice final', async choice => {
  const f = await profiles();
  expect(await link.verified(f.identity.id, f.web.id, f.twitchUserId, 'verified', 'Verified')).toMatchObject({ resolutionRequired: true, linked: false });
  expect((await db.player.findUniqueOrThrow({ where: { id: f.web.id } })).status).toBe('ACTIVE');
  const pending = (await link.pending(f.identity.id))!;
  expect(pending.web).toMatchObject({ level: 3, elementKey: 'pyro', resources: { primogems: '100' } });
  expect(pending.twitch).toMatchObject({ level: 2, elementKey: null, resources: { primogems: '777' }, totalMessages: '55' });
  const winner = choice === 'WEB' ? f.web.id : f.twitch.id, loser = choice === 'WEB' ? f.twitch.id : f.web.id;
  const balances = await db.playerResourceBalance.findMany({ where: { playerId: { in: [winner,loser] } }, orderBy: [{ playerId: 'asc' }, { resourceKey: 'asc' }] });
  await expect(link.resolve(f.identity.id, pending.id, choice, pending.revision)).resolves.toMatchObject({ linked: true, playerId: winner });
  expect(await db.webIdentity.findUniqueOrThrow({ where: { id: f.identity.id } })).toMatchObject({ playerId: winner });
  expect(await db.twitchIdentity.findUniqueOrThrow({ where: { twitchUserId: f.twitchUserId } })).toMatchObject({ playerId: winner, login:'verified', displayName:'Verified' });
  expect((await new PrismaCurrentPlayerStore(db).findByIdentity('supabase', f.subject))!.id).toBe(winner);
  expect((await db.player.findUniqueOrThrow({ where: { id: loser } })).status).toBe('ARCHIVED');
  expect(await db.playerResourceBalance.findMany({ where: { playerId: { in: [winner,loser] } }, orderBy: [{ playerId: 'asc' }, { resourceKey: 'asc' }] })).toEqual(balances);
  expect(await db.twitchLinkResolution.findUniqueOrThrow({ where: { id: pending.id } })).toMatchObject({ choice, completedAt: expect.any(Date) });
  await expect(link.resolve(f.identity.id, pending.id, choice, pending.revision)).resolves.toMatchObject({ linked: true });
  await expect(link.resolve(f.identity.id, pending.id, choice === 'WEB' ? 'TWITCH' : 'WEB', pending.revision)).rejects.toMatchObject({ code: 'TWITCH_PROFILE_CHANGED' });
  expect(await link.pending(f.identity.id)).toBeNull();
}, 90_000);
it('requires renewed confirmation after gameplay changed and rejects another authenticated WebIdentity', async () => {
  const f = await profiles(), other = await profiles(); await link.verified(f.identity.id, f.web.id, f.twitchUserId, 'verified', 'Verified');
  const pending = (await link.pending(f.identity.id))!;
  await expect(link.resolve(other.identity.id, pending.id, 'TWITCH', pending.revision)).rejects.toMatchObject({ code: 'TWITCH_PROFILE_CHANGED' });
  await db.playerResourceBalance.update({ where: { playerId_resourceKey: { playerId: f.twitch.id, resourceKey: 'primogems' } }, data: { amount: 888n } });
  expect(await link.resolve(f.identity.id, pending.id, 'TWITCH', pending.revision)).toMatchObject({ linked: false, resolutionRequired: true, resolution: { twitch: { resources: { primogems: '888' } } } });
  expect((await db.webIdentity.findUniqueOrThrow({ where: { id: f.identity.id } })).playerId).toBe(f.web.id);
  await link.resolve(f.identity.id, pending.id, 'TWITCH', (await link.pending(f.identity.id))!.revision);
});
it('never takes an existing third-party WebIdentity or replaces a different linked Twitch ID', async () => {
  const f = await profiles(); await db.webIdentity.create({ data: { playerId: f.twitch.id, provider: 'supabase', providerSubject: randomUUID() } });
  await expect(link.verified(f.identity.id, f.web.id, f.twitchUserId, 'verified', 'Verified')).rejects.toMatchObject({ code: 'TWITCH_PROFILE_WEB_CONFLICT' });
  await link.verified(f.identity.id, f.web.id, String(980000000000 + sequence), 'second', 'Second');
  await expect(link.verified(f.identity.id, f.web.id, String(990000000000 + sequence), 'third', 'Third')).rejects.toMatchObject({ code: 'TWITCH_PROFILE_WEB_CONFLICT' });
});
it('expires OAuth-backed choices without changing either Player', async () => {
  const f = await profiles(); await link.verified(f.identity.id, f.web.id, f.twitchUserId, 'verified', 'Verified');
  const pending = (await link.pending(f.identity.id))!;
  await db.twitchLinkResolution.update({ where: { id: pending.id }, data: { createdAt: new Date(Date.now()-120000), expiresAt: new Date(Date.now()-1000) } });
  await expect(link.resolve(f.identity.id, pending.id, 'WEB', pending.revision)).rejects.toMatchObject({ code: 'TWITCH_RESOLUTION_EXPIRED' });
  expect((await db.player.findUniqueOrThrow({ where: { id: f.twitch.id } })).status).toBe('ACTIVE');
});
it('archives all visible notifications in one Player scope, keeping other Players and business payloads', async () => {
  const f = await profiles();
  for (const [playerId,state] of [[f.web.id,'UNREAD'],[f.web.id,'READ'],[f.twitch.id,'UNREAD']] as const) await db.notification.create({ data: { playerId, state, domainKey: 'test', typeKey: 'PRIVATE_PROOF', payload: { businessReference: 'preserved' } } });
  const service = new NotificationService({ execute: async () => ({ id: f.web.id }) } as unknown as GetCurrentPlayer, db, { now: () => new Date() }, {} as ExpeditionService);
  expect(await service.archiveAll({ subject: f.subject })).toMatchObject({ unreadCount: 0, notifications: [] });
  expect(await db.notification.count({ where: { playerId: f.web.id, state: 'ARCHIVED' } })).toBe(2);
  expect(await db.notification.count({ where: { playerId: f.twitch.id, state: 'UNREAD' } })).toBe(1);
  expect((await db.notification.findFirstOrThrow({ where: { playerId: f.web.id } })).payload).toEqual({ businessReference: 'preserved' });
});
it('keeps Native authority ownership after a deliberate Web choice made while authority is OFF', async () => {
  const f = await profiles();
  await db.twitchNativeTarget.create({ data: { twitchUserId: f.twitchUserId, playerId: f.twitch.id, dataAuthority: 'NATIVE', canary: true, acknowledgement: 'STREAMERBOT_PATH_DISABLED', transferredAt: new Date() } });
  await db.twitchCanaryImport.create({ data: { twitchUserId: f.twitchUserId, playerId: f.twitch.id, snapshotHash: 'a'.repeat(64), identityReportHash: 'b'.repeat(64), backupHash: 'c'.repeat(64) } });
  await link.verified(f.identity.id,f.web.id,f.twitchUserId,'verified','Verified'); const pending = (await link.pending(f.identity.id))!;
  await link.resolve(f.identity.id,pending.id,'WEB',pending.revision);
  expect(await db.twitchNativeTarget.findUniqueOrThrow({ where: { twitchUserId: f.twitchUserId } })).toMatchObject({ playerId: f.web.id, dataAuthority: 'NATIVE' });
  expect((await db.twitchCanaryImport.findFirstOrThrow({ where: { twitchUserId: f.twitchUserId } })).playerId).toBe(f.twitch.id);
  const proof = await db.twitchLinkResolution.findUniqueOrThrow({ where: { id: pending.id } });
  expect(proof).toMatchObject({ webPlayerId:f.web.id,twitchPlayerId:f.twitch.id,choice:'WEB' });
  const projection = await readLegacyAccountProjection(fixture.admin, fixture.schema);
  expect(projection.players.find(row=>row.id===f.web.id)).toMatchObject({dataAuthority:'NATIVE',canaryImported:true,twitchUserId:f.twitchUserId});
});
it('blocks retirement of an operator even after an OFF kill, without removing any identity', async () => {
  const f = await profiles();
  await db.twitchNativeAuthority.create({ data: { id:'twitch-commands',operatorPlayerId:f.twitch.id,desiredMode:'OFF' } });
  await link.verified(f.identity.id,f.web.id,f.twitchUserId,'verified','Verified'); const pending = (await link.pending(f.identity.id))!;
  await expect(link.resolve(f.identity.id,pending.id,'WEB',pending.revision)).rejects.toMatchObject({ code:'TWITCH_PROGRESSION_SHARED_STATE_REQUIRES_OPERATOR' });
  expect((await db.twitchIdentity.findUniqueOrThrow({where:{twitchUserId:f.twitchUserId}})).playerId).toBe(f.twitch.id);
  await db.twitchNativeAuthority.delete({where:{id:'twitch-commands'}});
});
it('serializes opposite concurrent choices to exactly one main progression', async () => {
  const f = await profiles(); await link.verified(f.identity.id,f.web.id,f.twitchUserId,'verified','Verified'); const pending = (await link.pending(f.identity.id))!;
  const results = await Promise.allSettled([link.resolve(f.identity.id,pending.id,'WEB',pending.revision),link.resolve(f.identity.id,pending.id,'TWITCH',pending.revision)]);
  expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);
  expect(results.filter(result=>result.status==='rejected')).toHaveLength(1);
  const web = await db.webIdentity.findUniqueOrThrow({ where:{ id:f.identity.id } }), twitch = await db.twitchIdentity.findUniqueOrThrow({where:{twitchUserId:f.twitchUserId}});
  expect(web.playerId).toBe(twitch.playerId);
  expect(await db.player.count({where:{id:{in:[f.web.id,f.twitch.id]},status:'ACTIVE'}})).toBe(1);
},90_000);
it.each(['WEB','TWITCH'] as const)('rolls back the entire %s choice after identity writes if archiving fails', async choice => {
  const f=await profiles();
  const pending=await compare(f),loser=choice==='WEB'?f.twitch.id:f.web.id,schema=`"${fixture.schema}"`;
  const balances=await db.playerResourceBalance.findMany({where:{playerId:{in:[f.web.id,f.twitch.id]}},orderBy:[{playerId:'asc'},{resourceKey:'asc'}]});
  await fixture.admin.query(`CREATE FUNCTION ${schema}.fixture_fail_archive() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture_cancel_archive'; END $$`);
  await fixture.admin.query(`CREATE TRIGGER fixture_fail_archive BEFORE UPDATE ON ${schema}.players FOR EACH ROW WHEN(OLD.id='${loser}'::uuid AND NEW.status='ARCHIVED') EXECUTE FUNCTION ${schema}.fixture_fail_archive()`);
  try {
    await expect(link.resolve(f.identity.id,pending.id,choice,pending.revision)).rejects.toThrow('fixture_cancel_archive');
    await unchanged(f);
    expect(await db.twitchLinkResolution.findUniqueOrThrow({where:{id:pending.id}})).toMatchObject({completedAt:null,choice:null});
    expect(await db.playerResourceBalance.findMany({where:{playerId:{in:[f.web.id,f.twitch.id]}},orderBy:[{playerId:'asc'},{resourceKey:'asc'}]})).toEqual(balances);
  } finally {
    await fixture.admin.query(`DROP TRIGGER fixture_fail_archive ON ${schema}.players`);
    await fixture.admin.query(`DROP FUNCTION ${schema}.fixture_fail_archive()`);
  }
  await expect(link.resolve(f.identity.id,pending.id,choice,pending.revision)).resolves.toMatchObject({linked:true});
});
it('blocks migration pending targets before recovery and before a pending choice', async () => {
  const f = await profiles(false);
  await db.twitchNativeTarget.create({ data: { twitchUserId:f.twitchUserId, playerId:f.twitch.id, dataAuthority:'MIGRATION_PENDING' } });
  await expect(link.verified(f.identity.id,f.web.id,f.twitchUserId,'verified','Verified')).rejects.toMatchObject({ code:'TWITCH_PROFILE_WEB_CONFLICT' });
  expect((await db.webIdentity.findUniqueOrThrow({where:{id:f.identity.id}})).playerId).toBe(f.web.id);
  const significant = await profiles();
  await link.verified(significant.identity.id,significant.web.id,significant.twitchUserId,'verified','Verified');
  const pending = (await link.pending(significant.identity.id))!;
  await db.twitchNativeTarget.create({ data: { twitchUserId:significant.twitchUserId, playerId:significant.twitch.id, dataAuthority:'MIGRATION_PENDING' } });
  await expect(link.resolve(significant.identity.id,pending.id,'TWITCH',pending.revision)).rejects.toMatchObject({code:'TWITCH_PROFILE_WEB_CONFLICT'});
  await expect(link.pending(significant.identity.id)).rejects.toMatchObject({code:'TWITCH_PROFILE_WEB_CONFLICT'});
});
it('rejects a revoked WebIdentity and SQL audit records without a complete terminal choice', async () => {
  const f = await profiles();
  await db.webIdentity.update({where:{id:f.identity.id},data:{state:'DISABLED'}});
  await expect(link.verified(f.identity.id,f.web.id,f.twitchUserId,'verified','Verified')).rejects.toMatchObject({code:'TWITCH_PROFILE_CHANGED'});
  await db.webIdentity.update({where:{id:f.identity.id},data:{state:'ACTIVE'}});
  await link.verified(f.identity.id,f.web.id,f.twitchUserId,'verified','Verified');const pending=(await link.pending(f.identity.id))!;
  await expect(db.twitchLinkResolution.update({where:{id:pending.id},data:{completedAt:new Date(),choice:null}})).rejects.toThrow();
  await expect(db.twitchLinkResolution.update({where:{id:pending.id},data:{completedAt:null,choice:'WEB'}})).rejects.toThrow();
  await db.webIdentity.update({where:{id:f.identity.id},data:{state:'DISABLED'}});
  await expect(link.resolve(f.identity.id,pending.id,'TWITCH',pending.revision)).rejects.toMatchObject({code:'TWITCH_PROFILE_CHANGED'});
});
async function unchanged(f:Awaited<ReturnType<typeof profiles>>) {
  expect((await db.webIdentity.findUniqueOrThrow({where:{id:f.identity.id}})).playerId).toBe(f.web.id);
  expect((await db.twitchIdentity.findUniqueOrThrow({where:{twitchUserId:f.twitchUserId}})).playerId).toBe(f.twitch.id);
  expect(await db.player.count({where:{id:{in:[f.web.id,f.twitch.id]},status:'ACTIVE'}})).toBe(2);
}
async function compare(f:Awaited<ReturnType<typeof profiles>>) {
  await link.verified(f.identity.id,f.web.id,f.twitchUserId,'verified','Verified');
  return (await link.pending(f.identity.id))!;
}
const sharedReason='TWITCH_PROGRESSION_SHARED_STATE_REQUIRES_OPERATOR';
async function friendship(playerId:string,otherId:string) {
  const [playerAId,playerBId]=[playerId,otherId].sort();
  return db.friendship.create({data:{playerAId:playerAId!,playerBId:playerBId!,becameFriendsAt:new Date()}});
}
it.each(['WEB','TWITCH'] as const)('blocks only %s when its loser has an active Friendship, and retains the other safe choice',async blocked=>{
  const f=await profiles(),other=await profiles(),loser=blocked==='WEB'?f.twitch.id:f.web.id;
  const relation=await friendship(loser,other.web.id),pending=await compare(f),allowed=blocked==='WEB'?'TWITCH':'WEB';
  expect(pending.safety).toMatchObject({[blocked]:{status:'OPERATOR_REQUIRED',reason:sharedReason},[allowed]:{status:'SAFE',reason:null}});
  expect(JSON.stringify(pending)).not.toContain(other.web.id);
  await expect(link.resolve(f.identity.id,pending.id,blocked,pending.revision)).rejects.toMatchObject({code:sharedReason});
  await unchanged(f);expect(await db.friendship.findUniqueOrThrow({where:{id:relation.id}})).toEqual(relation);
  await expect(link.resolve(f.identity.id,pending.id,allowed,pending.revision)).resolves.toMatchObject({linked:true,playerId:loser});
  expect(await db.friendship.findUniqueOrThrow({where:{id:relation.id}})).toEqual(relation);
},90_000);
it('blocks both choices when each loser has shared state',async()=>{
  const f=await profiles(),other=await profiles();await friendship(f.web.id,other.web.id);await friendship(f.twitch.id,other.web.id);
  const pending=await compare(f);
  for(const choice of ['WEB','TWITCH'] as const) {
    expect(pending.safety[choice].status).toBe('OPERATOR_REQUIRED');
    await expect(link.resolve(f.identity.id,pending.id,choice,pending.revision)).rejects.toMatchObject({code:sharedReason});
  }
  await unchanged(f);
},90_000);
it('keeps a Direct Conversation and pending request intact when retirement is refused',async()=>{
  const f=await profiles(),other=await profiles(),[playerAId,playerBId]=[f.twitch.id,other.web.id].sort();
  const conversation=await db.directConversation.create({data:{playerAId:playerAId!,playerBId:playerBId!}});
  const request=await db.directConversationRequest.create({data:{conversationId:conversation.id,senderPlayerId:other.web.id,recipientPlayerId:f.twitch.id}});
  const pending=await compare(f);
  await expect(link.resolve(f.identity.id,pending.id,'WEB',pending.revision)).rejects.toMatchObject({code:sharedReason});
  await unchanged(f);expect(await db.directConversation.findUniqueOrThrow({where:{id:conversation.id}})).toEqual(conversation);
  expect(await db.directConversationRequest.findUniqueOrThrow({where:{id:request.id}})).toEqual(request);
},90_000);
it.each(['SOCIAL','TRADE','ACTIVITY'] as const)('classifies pending %s state as unsafe',async domain=>{
  const f=await profiles(),other=await profiles();
  if(domain==='SOCIAL') await db.friendRequest.create({data:{senderPlayerId:other.web.id,recipientPlayerId:f.twitch.id,sourceChannel:'UI'}});
  if(domain==='TRADE') {
    const operation=await db.businessOperation.create({data:{playerId:other.web.id,operationType:'TRADE',sourceChannel:'UI',status:'COMPLETED',completedAt:new Date()}});
    await db.tradeRequest.create({data:{senderPlayerId:other.web.id,recipientPlayerId:f.twitch.id,senderResourceKey:'particles_pyro',recipientResourceKey:'particles_hydro',originalAmount:1n,currentAmount:1n,operationId:operation.id,sourceChannel:'UI',expiresAt:new Date(Date.now()+60_000)}});
  }
  if(domain==='ACTIVITY') await db.arcadeSession.create({data:{playerId:f.twitch.id,game:'MEMORY',difficulty:'EASY',firstSide:'PLAYER',privateState:{},randomState:1n,banterId:'fixture',nextActionAt:new Date()}});
  const pending=await compare(f);expect(pending.safety.WEB.status).toBe('OPERATOR_REQUIRED');
  await expect(link.resolve(f.identity.id,pending.id,'WEB',pending.revision)).rejects.toMatchObject({code:sharedReason});await unchanged(f);
},90_000);
it.each(['TEAM','MISSION','GACHA'] as const)('requires new consent after an invisible %s mutation, with no identity or status change',async domain=>{
  const f=await profiles();
  if(domain==='TEAM') await db.team.create({data:{playerId:f.twitch.id,displayPosition:1,name:'Before'}});
  const pending=await compare(f);
  if(domain==='TEAM') await db.team.updateMany({where:{playerId:f.twitch.id},data:{name:'Invisible change'}});
  if(domain==='MISSION') {
    const definition=permanentMissionCatalog[0]!;
    await db.playerPermanentMissionProgress.upsert({where:{playerId_definitionId:{playerId:f.twitch.id,definitionId:definition.id}},create:{playerId:f.twitch.id,definitionId:definition.id,progress:1n},update:{progress:{increment:1n}}});
  }
  if(domain==='GACHA') await db.playerGachaState.update({where:{playerId:f.twitch.id},data:{pity5:{increment:1}}});
  const result=await link.resolve(f.identity.id,pending.id,'WEB',pending.revision);
  expect(result).toMatchObject({linked:false,resolutionRequired:true,resolution:{web:pending.web,twitch:pending.twitch}});
  const fresh=result.resolution!;expect(fresh.revision).not.toBe(pending.revision);await unchanged(f);
  expect(await link.resolve(f.identity.id,pending.id,'WEB',pending.revision)).toMatchObject({resolutionRequired:true,resolution:{revision:fresh.revision}});
  await unchanged(f);
  expect(await link.resolve(f.identity.id,pending.id,'WEB',fresh.revision)).toMatchObject({linked:true,playerId:f.web.id});
},90_000);
it('binds consent to its revision even if another tab refreshed pending first',async()=>{
  const f=await profiles(),pending=await compare(f);
  await db.playerGachaState.update({where:{playerId:f.web.id},data:{pity4:1}});
  const otherTab=(await link.pending(f.identity.id))!;expect(otherTab.revision).not.toBe(pending.revision);
  expect(await link.resolve(f.identity.id,pending.id,'TWITCH',pending.revision)).toMatchObject({resolutionRequired:true,resolution:{revision:otherTab.revision}});
  await unchanged(f);
  expect(await link.resolve(f.identity.id,pending.id,'TWITCH',otherTab.revision)).toMatchObject({linked:true});
},90_000);
it('refreshes consent and then refuses a newly unsafe choice without moving shared rows',async()=>{
  const f=await profiles(),other=await profiles(),pending=await compare(f);const relation=await friendship(f.twitch.id,other.web.id);
  const fresh=(await link.resolve(f.identity.id,pending.id,'WEB',pending.revision)).resolution!;
  expect(fresh.safety.WEB.status).toBe('OPERATOR_REQUIRED');await unchanged(f);
  await expect(link.resolve(f.identity.id,pending.id,'WEB',fresh.revision)).rejects.toMatchObject({code:sharedReason});
  await unchanged(f);expect(await db.friendship.findUniqueOrThrow({where:{id:relation.id}})).toEqual(relation);
},90_000);
it('stores only versioned summaries, fingerprints and safety; ignores sessions and preserves bigint precision',async()=>{
  const f=await profiles(),pending=await compare(f);
  const stored=(await db.twitchLinkResolution.findUniqueOrThrow({where:{id:pending.id}})).comparedState as Record<string,unknown>;
  expect(Object.keys(stored).sort()).toEqual(['fingerprints','legacyFingerprint','presentation','revision','safety','version']);expect(stored.version).toBe(1);
  expect(stored.fingerprints).toEqual({web:expect.stringMatching(/^[a-f0-9]{64}$/),twitch:expect.stringMatching(/^[a-f0-9]{64}$/)});
  expect(pending).not.toHaveProperty('fingerprints');
  await db.playerSession.create({data:{playerId:f.twitch.id,sessionTokenHash:'d'.repeat(64)}});
  expect((await link.pending(f.identity.id))!.revision).toBe(pending.revision);expect(JSON.stringify(stored)).not.toContain('d'.repeat(64));
  await db.playerEconomyStats.update({where:{playerId:f.twitch.id},data:{totalPrimosSpent:9007199254740992n}});
  const first=await equivalentAssessment(f.twitch.id);
  // Change only the int8 value: neither a rounded JS number nor an updated timestamp can distinguish these rows.
  await db.$executeRaw`UPDATE player_economy_stats SET total_primos_spent=9007199254740993 WHERE player_id=${f.twitch.id}::uuid`;
  const second=await equivalentAssessment(f.twitch.id);expect(second.fingerprint).not.toBe(first.fingerprint);
},90_000);
it('fails closed for future direct and nested FK tables and new cross-player columns on owned tables',async()=>{
  const f=await profiles();const team=await db.team.create({data:{playerId:f.twitch.id,displayPosition:1}});
  const schema=`"${fixture.schema}"`;
  for(const [name,parent,column,value] of [['future_player_shared','players','player_id',f.twitch.id],['future_team_shared','teams','team_id',team.id]] as const) {
    await fixture.admin.query(`CREATE TABLE ${schema}."${name}" (id uuid PRIMARY KEY, "${column}" uuid REFERENCES ${schema}."${parent}"(id), private_body text)`);
    try {
      await fixture.admin.query(`INSERT INTO ${schema}."${name}" VALUES ($1,$2,'never expose this body')`,[randomUUID(),value]);
      const assessment=await equivalentAssessment(f.twitch.id);expect(assessment.safety.status).toBe('OPERATOR_REQUIRED');
      expect(JSON.stringify(assessment)).not.toContain('never expose this body');
    } finally {await fixture.admin.query(`DROP TABLE ${schema}."${name}"`);}
  }
  await fixture.admin.query(`ALTER TABLE ${schema}.teams ADD COLUMN future_other_player_id uuid REFERENCES ${schema}.players(id)`);
  try {
    await fixture.admin.query(`UPDATE ${schema}.teams SET future_other_player_id=$1 WHERE id=$2`,[f.web.id,team.id]);
    for(const playerId of [f.web.id,f.twitch.id]) expect((await equivalentAssessment(playerId)).safety.status).toBe('OPERATOR_REQUIRED');
  } finally {await fixture.admin.query(`ALTER TABLE ${schema}.teams DROP COLUMN future_other_player_id`);}
},90_000);
it('requires an operator for live Boss ranking rows and allows proven finished history',async()=>{
  const f=await profiles();
  const boss=await db.monthlyBoss.create({data:{monthStart:new Date('1900-01-01'),nameSnapshot:'Private Boss',baseHp:500000n,hpVariationPercent:0,maxHp:500000n,currentHp:500000n,resistanceElementKey:'pyro'}});
  const batch=await db.migrationBatch.create({data:{snapshotHash:'e'.repeat(64),mode:'REHEARSAL',migratorVersion:'test'}});
  const operation=await db.businessOperation.create({data:{playerId:f.twitch.id,operationType:'BOSS',sourceChannel:'UI',status:'COMPLETED',completedAt:new Date()}});
  await db.bossLegacyContribution.create({data:{bossId:boss.id,playerId:f.twitch.id,batchId:batch.id,legacyProvenance:{synthetic:true}}});
  await db.bossAttack.create({data:{bossId:boss.id,playerId:f.twitch.id,businessDate:new Date('1900-01-01'),damage:1n,operationId:operation.id}});
  await db.playerBossParticipation.create({data:{bossId:boss.id,playerId:f.twitch.id,totalDamage:1n,attackCount:1n,bestHit:1n,firstAttackAt:new Date(),lastAttackAt:new Date()}});
  await db.twitchNativeAudit.create({data:{actorPlayerId:f.twitch.id,action:'PRIVATE_HISTORY'}});
  const pending=await compare(f);expect(pending.safety.WEB.status).toBe('OPERATOR_REQUIRED');
  const assessment=await db.$transaction(tx=>assessPlayerCanonicalizationSafety(tx,f.twitch.id),{isolationLevel:'RepeatableRead'});
  for(const table of ['boss_legacy_contributions','boss_attacks','player_boss_participations']) expect(assessment.classifications.some(row=>row.edge.startsWith(table+'(')&&row.classification==='SHARED_ACTIVE')).toBe(true);
  await expect(link.resolve(f.identity.id,pending.id,'WEB',pending.revision)).rejects.toMatchObject({code:sharedReason});await unchanged(f);
  await db.monthlyBoss.update({where:{id:boss.id},data:{currentHp:0n,defeatedAt:new Date(),finalBlowPlayerId:f.web.id}});
  const fresh=(await link.pending(f.identity.id))!;expect(fresh.safety.WEB.status).toBe('SAFE');
  expect(await link.resolve(f.identity.id,pending.id,'WEB',pending.revision)).toMatchObject({resolutionRequired:true});await unchanged(f);
  expect(await link.resolve(f.identity.id,fresh.id,'WEB',fresh.revision)).toMatchObject({linked:true});
  expect(await db.bossLegacyContribution.count({where:{playerId:f.twitch.id}})).toBe(1);
},90_000);
it('preserves both audited graphs, including the archive, during private future batch purge', async () => {
  const records = await db.twitchLinkResolution.findMany({ where: { completedAt: { not: null } } });
  const ids = [...new Set(records.flatMap(row => [row.webPlayerId,row.twitchPlayerId]))];
  const balances = await db.playerResourceBalance.findMany({ where: { playerId: { in: ids } }, orderBy: [{ playerId: 'asc' },{ resourceKey: 'asc' }] });
  const plan = await buildCutoverPurgePlan(db, fixture.schema);
  await db.$transaction(tx => applyPrivateCutoverPurge(tx, plan));
  expect(await db.playerResourceBalance.findMany({ where: { playerId: { in: ids } }, orderBy: [{ playerId: 'asc' },{ resourceKey: 'asc' }] })).toEqual(balances);
  expect(await db.twitchLinkResolution.count({ where: { completedAt: { not: null } } })).toBe(records.length);
}, 90_000);
