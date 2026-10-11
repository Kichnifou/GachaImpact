import { createHash } from 'node:crypto';
import type { Prisma } from '../../../generated/prisma/client.js';
import { readFields } from './catalog-policy.js';

const labels: Record<string,string> = {name:'Nom',originalName:'Nom original',rarity:'Rareté',element:'Élément',weapon:'Arme',region:'Région',numericId:'Identité officielle',releaseDate:'Sortie officielle',title:'Titre',constellation:'Constellation',icon:'Portrait',splash:'Illustration principale',wish:'Illustration de vœu',fullbody:'Personnage en pied',promotion:'Visuel promotionnel'};

export function catalogReviewPayload(id:string,name:string,changes:string[],conflict:boolean,previousFields:string[]=[]) {
  const intervention=changes.find(change=>change.startsWith('intervention : '))?.slice('intervention : '.length);
  const preparation=changes.some(change=>change.startsWith('preparation : '));
  const fields=[...new Set([...previousFields,...changes.map(change=>labels[change.split(' : ')[0]!]??'Informations')])];
  return {candidateId:id,title:`${intervention?'Intervention nécessaire':preparation?'Fiche en préparation':conflict?'Conflit à examiner':'Fiche mise à jour'} : ${name}`,
    message:intervention??(preparation?'La fiche partielle est visible dans le catalogue. Les informations de jeu restent à compléter.':conflict?'Des informations se contredisent. Consulter la fiche.':`${fields.slice(0,3).join(', ')}${fields.length>3?` et ${fields.length-3} autre(s)`:''} : nouveautés à examiner.`),conflict,fields,...(intervention?{expectedAction:intervention}:{}),publicationStage:preparation?'PREPARATION':'ENRICHMENT'};
}

/** Archived events retain replay receipts independently of group read/archive. */
export async function notifyCatalogReview(tx: Prisma.TransactionClient, id: string, name: string, changes: string[], signature: string, now: Date) {
  const hash=createHash('sha256').update(signature).digest('hex');
  const candidate=await tx.catalogCandidate.findUniqueOrThrow({where:{id}});
  const conflict=Object.values(readFields(candidate.fields)).some(value=>value?.conflict);
  const admins=await tx.playerRoleAssignment.findMany({where:{role:'ADMIN',revokedAt:null,player:{status:'ACTIVE'}},select:{playerId:true}});
  for (const admin of admins) {
    const eventKey=`catalog-review:${id}:${hash}:${admin.playerId}`;
    const inserted=await tx.notification.createMany({data:[{playerId:admin.playerId,domainKey:'character-catalog',typeKey:'CATALOG_REVIEW_ADMIN',
      state:'ARCHIVED',archivedAt:now,deduplicationKey:eventKey,payload:{candidateId:id,changes,signature:hash,eventReceipt:true}}],skipDuplicates:true});
    if (!inserted.count) continue;
    const deduplicationKey=`catalog-review-group:${id}:${admin.playerId}`;
    const previous=await tx.notification.findUnique({where:{deduplicationKey}});
    const priorFields=previous?.state==='UNREAD'?(previous.payload as Prisma.JsonObject)['fields']:null;
    const payload=catalogReviewPayload(id,name,changes,conflict,Array.isArray(priorFields)?priorFields.filter((value):value is string=>typeof value==='string'):[]);
    await tx.notification.upsert({where:{deduplicationKey},create:{playerId:admin.playerId,domainKey:'character-catalog',typeKey:'CATALOG_REVIEW_ADMIN',
      deduplicationKey,payload,actionKey:'OPEN_ADMIN_CANDIDATE',actionTargetId:id},
      update:{payload,actionKey:'OPEN_ADMIN_CANDIDATE',actionTargetId:id,state:'UNREAD',readAt:null,archivedAt:null,createdAt:now}});
  }
}
