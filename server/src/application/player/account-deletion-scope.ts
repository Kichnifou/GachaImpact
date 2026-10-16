import type { Prisma } from '../../../generated/prisma/client.js';
import { AppError } from '../../api/errors.js';

/** Ownership comes from the stable WebIdentity, never a matching name or an operator. */
export async function accountDeletionScope(tx: Prisma.TransactionClient, webIdentityId: string, rootId: string) {
  const resolutions = await tx.twitchLinkResolution.findMany({where:{webIdentityId}});
  const candidates = new Set<string>();
  for (const row of resolutions) {
    if (row.webPlayerId !== rootId) candidates.add(row.webPlayerId);
    if (row.completedAt && row.choice === 'WEB' && row.twitchPlayerId !== rootId) candidates.add(row.twitchPlayerId);
  }
  const archives = await tx.player.findMany({where:{id:{in:[...candidates]}},include:{webIdentity:true,twitchIdentity:true}});
  const refused = () => {throw new AppError('Les anciennes associations de ce compte nécessitent une vérification avant la suppression.',409,'ACCOUNT_DELETION_OWNERSHIP');};
  const required = new Set(resolutions.filter(r=>r.completedAt&&r.choice==='WEB').map(r=>r.twitchPlayerId).filter(id=>id!==rootId));
  const owned = archives.filter(p=>p.status==='ARCHIVED');
  if (archives.some(p=>p.status!=='ARCHIVED'||p.webIdentity||p.twitchIdentity) || [...required].some(id=>!owned.some(p=>p.id===id))) refused();
  const playerIds = [...new Set([rootId,...owned.map(p=>p.id)])].sort();
  if(playerIds.length>25)refused();
  const historical = resolutions.filter(r=>r.completedAt || (r.webPlayerId!==rootId&&playerIds.includes(r.webPlayerId)));
  const current = await tx.twitchIdentity.findMany({where:{playerId:{in:playerIds}}});
  const twitchIds = [...new Set([...historical.map(r=>r.twitchUserId),...current.map(r=>r.twitchUserId)])].sort();
  if(await tx.twitchIdentity.findFirst({where:{twitchUserId:{in:twitchIds},playerId:{notIn:playerIds}}}))refused();
  return {playerIds,twitchIds,aliases:historical.flatMap(r=>[r.login,...(r.displayName?[r.displayName]:[])]),logins:historical.map(r=>r.login)};
}
