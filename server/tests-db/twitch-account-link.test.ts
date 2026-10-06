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

const fixture = isolatedBatchDatabase(), db = fixture.database, link = new TwitchAccountLink(db);
let sequence = 0;
beforeAll(async () => {
  await fixture.setup({ prismaMigrations:true });
  await db.permanentMissionDefinition.createMany({ data:permanentMissionCatalog.map(entry=>({...entry})),skipDuplicates:true });
},180_000);
afterAll(() => fixture.cleanup(), 60_000);
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
  await expect(link.resolve(f.identity.id, pending.id, choice)).resolves.toMatchObject({ linked: true, playerId: winner });
  expect(await db.webIdentity.findUniqueOrThrow({ where: { id: f.identity.id } })).toMatchObject({ playerId: winner });
  expect(await db.twitchIdentity.findUniqueOrThrow({ where: { twitchUserId: f.twitchUserId } })).toMatchObject({ playerId: winner, login:'verified', displayName:'Verified' });
  expect((await new PrismaCurrentPlayerStore(db).findByIdentity('supabase', f.subject))!.id).toBe(winner);
  expect((await db.player.findUniqueOrThrow({ where: { id: loser } })).status).toBe('ARCHIVED');
  expect(await db.playerResourceBalance.findMany({ where: { playerId: { in: [winner,loser] } }, orderBy: [{ playerId: 'asc' }, { resourceKey: 'asc' }] })).toEqual(balances);
  expect(await db.twitchLinkResolution.findUniqueOrThrow({ where: { id: pending.id } })).toMatchObject({ choice, completedAt: expect.any(Date) });
  await expect(link.resolve(f.identity.id, pending.id, choice)).resolves.toMatchObject({ linked: true });
  await expect(link.resolve(f.identity.id, pending.id, choice === 'WEB' ? 'TWITCH' : 'WEB')).rejects.toMatchObject({ code: 'TWITCH_PROFILE_CHANGED' });
  expect(await link.pending(f.identity.id)).toBeNull();
}, 90_000);
it('requires renewed confirmation after gameplay changed and rejects another authenticated WebIdentity', async () => {
  const f = await profiles(), other = await profiles(); await link.verified(f.identity.id, f.web.id, f.twitchUserId, 'verified', 'Verified');
  const pending = (await link.pending(f.identity.id))!;
  await expect(link.resolve(other.identity.id, pending.id, 'TWITCH')).rejects.toMatchObject({ code: 'TWITCH_PROFILE_CHANGED' });
  await db.playerResourceBalance.update({ where: { playerId_resourceKey: { playerId: f.twitch.id, resourceKey: 'primogems' } }, data: { amount: 888n } });
  expect(await link.resolve(f.identity.id, pending.id, 'TWITCH')).toMatchObject({ linked: false, resolutionRequired: true, resolution: { twitch: { resources: { primogems: '888' } } } });
  expect((await db.webIdentity.findUniqueOrThrow({ where: { id: f.identity.id } })).playerId).toBe(f.web.id);
  await link.resolve(f.identity.id, pending.id, 'TWITCH');
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
  await expect(link.resolve(f.identity.id, pending.id, 'WEB')).rejects.toMatchObject({ code: 'TWITCH_RESOLUTION_EXPIRED' });
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
  await link.resolve(f.identity.id,pending.id,'WEB');
  expect(await db.twitchNativeTarget.findUniqueOrThrow({ where: { twitchUserId: f.twitchUserId } })).toMatchObject({ playerId: f.web.id, dataAuthority: 'NATIVE' });
  expect((await db.twitchCanaryImport.findFirstOrThrow({ where: { twitchUserId: f.twitchUserId } })).playerId).toBe(f.twitch.id);
  const proof = await db.twitchLinkResolution.findUniqueOrThrow({ where: { id: pending.id } });
  expect(proof).toMatchObject({ webPlayerId:f.web.id,twitchPlayerId:f.twitch.id,choice:'WEB' });
});
it('blocks retirement of an operator even after an OFF kill, without removing any identity', async () => {
  const f = await profiles();
  await db.twitchNativeAuthority.create({ data: { id:'twitch-commands',operatorPlayerId:f.twitch.id,desiredMode:'OFF' } });
  await link.verified(f.identity.id,f.web.id,f.twitchUserId,'verified','Verified'); const pending = (await link.pending(f.identity.id))!;
  await expect(link.resolve(f.identity.id,pending.id,'WEB')).rejects.toMatchObject({ code:'TWITCH_PROFILE_WEB_CONFLICT' });
  expect((await db.twitchIdentity.findUniqueOrThrow({where:{twitchUserId:f.twitchUserId}})).playerId).toBe(f.twitch.id);
  await db.twitchNativeAuthority.delete({where:{id:'twitch-commands'}});
});
it('serializes opposite concurrent choices to exactly one main progression', async () => {
  const f = await profiles(); await link.verified(f.identity.id,f.web.id,f.twitchUserId,'verified','Verified'); const pending = (await link.pending(f.identity.id))!;
  const results = await Promise.allSettled([link.resolve(f.identity.id,pending.id,'WEB'),link.resolve(f.identity.id,pending.id,'TWITCH')]);
  expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);
  expect(results.filter(result=>result.status==='rejected')).toHaveLength(1);
  const web = await db.webIdentity.findUniqueOrThrow({ where:{ id:f.identity.id } }), twitch = await db.twitchIdentity.findUniqueOrThrow({where:{twitchUserId:f.twitchUserId}});
  expect(web.playerId).toBe(twitch.playerId);
  expect(await db.player.count({where:{id:{in:[f.web.id,f.twitch.id]},status:'ACTIVE'}})).toBe(1);
},90_000);
it('blocks migration pending targets before recovery and before a pending choice', async () => {
  const f = await profiles(false);
  await db.twitchNativeTarget.create({ data: { twitchUserId:f.twitchUserId, playerId:f.twitch.id, dataAuthority:'MIGRATION_PENDING' } });
  await expect(link.verified(f.identity.id,f.web.id,f.twitchUserId,'verified','Verified')).rejects.toMatchObject({ code:'TWITCH_PROFILE_WEB_CONFLICT' });
  expect((await db.webIdentity.findUniqueOrThrow({where:{id:f.identity.id}})).playerId).toBe(f.web.id);
  const significant = await profiles();
  await link.verified(significant.identity.id,significant.web.id,significant.twitchUserId,'verified','Verified');
  const pending = (await link.pending(significant.identity.id))!;
  await db.twitchNativeTarget.create({ data: { twitchUserId:significant.twitchUserId, playerId:significant.twitch.id, dataAuthority:'MIGRATION_PENDING' } });
  await expect(link.resolve(significant.identity.id,pending.id,'TWITCH')).rejects.toMatchObject({code:'TWITCH_PROFILE_WEB_CONFLICT'});
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
  await expect(link.resolve(f.identity.id,pending.id,'TWITCH')).rejects.toMatchObject({code:'TWITCH_PROFILE_CHANGED'});
});
it('preserves both audited graphs, including the archive, during private future batch purge', async () => {
  const records = await db.twitchLinkResolution.findMany({ where: { completedAt: { not: null } } });
  const ids = [...new Set(records.flatMap(row => [row.webPlayerId,row.twitchPlayerId]))];
  const balances = await db.playerResourceBalance.findMany({ where: { playerId: { in: ids } }, orderBy: [{ playerId: 'asc' },{ resourceKey: 'asc' }] });
  const plan = await buildCutoverPurgePlan(db, fixture.schema);
  await db.$transaction(tx => applyPrivateCutoverPurge(tx, plan));
  expect(await db.playerResourceBalance.findMany({ where: { playerId: { in: ids } }, orderBy: [{ playerId: 'asc' },{ resourceKey: 'asc' }] })).toEqual(balances);
  expect(await db.twitchLinkResolution.count({ where: { completedAt: { not: null } } })).toBe(records.length);
}, 90_000);
