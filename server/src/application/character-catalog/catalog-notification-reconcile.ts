import { createHash } from 'node:crypto';
import type { Prisma, PrismaClient } from '../../../generated/prisma/client.js';
import { lockCatalogJob } from './catalog-control.js';
import { catalogReviewPayload } from './catalog-notifications.js';
import { readFields } from './catalog-policy.js';

type Database = PrismaClient | Prisma.TransactionClient;
/** Bounded operator maintenance. Legacy event rows and payloads remain receipts. */
export async function planCatalogNotificationReconcile(db: Database) {
  const admins=await db.playerRoleAssignment.findMany({where:{role:'ADMIN',revokedAt:null,player:{status:'ACTIVE'}},select:{playerId:true},orderBy:{playerId:'asc'}});
  const rows=await db.notification.findMany({where:{typeKey:'CATALOG_REVIEW_ADMIN',deduplicationKey:{startsWith:'catalog-review:'},playerId:{in:admins.map(row=>row.playerId)}},orderBy:{id:'asc'},take:1001});
  if(rows.length>1000)throw new Error('NOTIFICATION_RECONCILE_SCOPE_EXCEEDED');
  const groups=new Map<string,typeof rows>();
  for(const row of rows){
    const match=row.deduplicationKey?.match(/^catalog-review:([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}):[a-f0-9]{64}:([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/);
    if(!match || match[2]!==row.playerId)continue;
    const payload=row.payload as Prisma.JsonObject;
    if(payload['eventReceipt']===true)continue;
    const key=`catalog-review-group:${match[1]}:${row.playerId}`;
    groups.set(key,[...(groups.get(key)??[]),row]);
  }
  const entries=[];
  for(const[key,events]of groups){
    const candidateId=key.split(':')[1]!;
    const candidate=await db.catalogCandidate.findUnique({where:{id:candidateId},select:{id:true,name:true,fields:true}});
    if(!candidate)continue;
    const existing=await db.notification.findUnique({where:{deduplicationKey:key}});
    entries.push({key,candidate,events,existing});
  }
  const fingerprint=createHash('sha256').update(JSON.stringify({admins,entries})).digest('hex');
  return {fingerprint,entries,legacyRows:entries.reduce((count,entry)=>count+entry.events.length,0)};
}

export async function reconcileCatalogNotifications(db: PrismaClient,expectedSha:string,now=new Date()) {
  return db.$transaction(async tx=>{
    await lockCatalogJob(tx);
    // Read/archive actions lock the same notification rows. Drift requires a new plan.
    await tx.$queryRaw`SELECT id FROM notifications WHERE type_key='CATALOG_REVIEW_ADMIN' ORDER BY id FOR UPDATE`;
    const plan=await planCatalogNotificationReconcile(tx);
    if(plan.fingerprint!==expectedSha)throw new Error('NOTIFICATION_RECONCILE_PLAN_CHANGED');
    let created=0,archived=0;
    for(const entry of plan.entries){
      const active=entry.events.filter(row=>row.state!=='ARCHIVED');
      if(!entry.existing&&active.length){
        const latest=[...active].sort((a,b)=>b.createdAt.getTime()-a.createdAt.getTime())[0]!;
        const changes=active.flatMap(row=>{const values=(row.payload as Prisma.JsonObject)['changes'];return Array.isArray(values)?values.filter((value):value is string=>typeof value==='string'):[]});
        const conflict=Object.values(readFields(entry.candidate.fields)).some(value=>value?.conflict);
        const unread=active.some(row=>row.state==='UNREAD');
        await tx.notification.create({data:{playerId:latest.playerId,domainKey:'character-catalog',typeKey:'CATALOG_REVIEW_ADMIN',deduplicationKey:entry.key,
          state:unread?'UNREAD':'READ',readAt:unread?null:latest.readAt,createdAt:latest.createdAt,
          actionKey:'OPEN_ADMIN_CANDIDATE',actionTargetId:entry.candidate.id,payload:catalogReviewPayload(entry.candidate.id,entry.candidate.name,changes,conflict)}});
        created++;
      }
      archived+=(await tx.notification.updateMany({where:{id:{in:active.map(row=>row.id)}},data:{state:'ARCHIVED',archivedAt:now}})).count;
    }
    return {legacyRows:plan.legacyRows,groupsCreated:created,eventsArchived:archived,proofsDeleted:0};
  },{timeout:30000});
}
