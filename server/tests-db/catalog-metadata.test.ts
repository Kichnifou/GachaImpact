import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {isolatedBatchDatabase} from './isolated-batch-database.js';
import {CharacterAdminService} from '../src/application/moderation/character-admin-service.js';
import {CatalogAdminService} from '../src/application/character-catalog/catalog-admin.js';
import {CatalogEngine} from '../src/application/character-catalog/catalog-engine.js';
import type {GetCurrentPlayer} from '../src/application/player/get-current-player.js';
import type {AuthenticatedIdentity} from '../src/domain/identity/authenticated-identity.js';
import {NotificationService} from '../src/application/notification/notification-service.js';
import {notifyCatalogReview} from '../src/application/character-catalog/catalog-notifications.js';
import type {ExpeditionService} from '../src/application/expedition/expedition-service.js';
const fixture=isolatedBatchDatabase(),db=fixture.database;
beforeAll(()=>fixture.setup({seedPublicCatalog:true}),120_000);
afterAll(()=>fixture.cleanup(),60_000);
const engine=()=>new CatalogEngine(db,{enabled:false,publish:false,dryRun:true},async()=>{throw Error('No network in metadata tests')});
describe('private consolidated catalogue UX metadata',()=>{
  it('archives a catalogue group durably, preserves receipts, and reactivates only for a new semantic event',async()=>{
    const player=await db.player.create({data:{displayName:'Private archive semantics',elementKey:'hydro'}});
    await db.playerRoleAssignment.create({data:{playerId:player.id,role:'ADMIN',grantedByPlayerId:player.id}});
    const candidate=await db.catalogCandidate.create({data:{name:'Private archive candidate'}});
    const now=new Date(),identity={} as AuthenticatedIdentity,getPlayer={execute:async()=>player} as unknown as GetCurrentPlayer;
    const service=new NotificationService(getPlayer,db,{now:()=>now},{} as ExpeditionService);
    const emit=(signature:string)=>db.$transaction(tx=>notifyCatalogReview(tx,candidate.id,candidate.name,['icon : image disponible'],signature,now));
    await emit('first');
    const group=await db.notification.findUniqueOrThrow({where:{deduplicationKey:`catalog-review-group:${candidate.id}:${player.id}`}});
    expect((await service.archiveOne(identity,group.id)).notifications.some(value=>value.id===group.id)).toBe(false);
    await emit('first');expect(await db.notification.findUniqueOrThrow({where:{id:group.id}})).toMatchObject({state:'ARCHIVED',payload:group.payload});
    expect(await db.notification.count({where:{deduplicationKey:{startsWith:`catalog-review:${candidate.id}:`},state:'ARCHIVED'}})).toBeGreaterThan(0);
    await emit('second');expect(await db.notification.findUniqueOrThrow({where:{id:group.id}})).toMatchObject({state:'UNREAD'});
    await service.readOne(identity,group.id);await service.archiveOne(identity,group.id);await service.archiveOne(identity,group.id);
    expect(await db.notification.findUniqueOrThrow({where:{id:group.id}})).toMatchObject({state:'ARCHIVED'});
    await db.catalogCandidate.delete({where:{id:candidate.id}});
  });
  it('restricts metadata choices to ADMIN, persists normalized regions and identifies every missing image role',async()=>{
    const player=await db.player.create({data:{displayName:'Private metadata choices',elementKey:'hydro'}});
    const getPlayer={execute:async()=>player} as unknown as GetCurrentPlayer,identity={} as AuthenticatedIdentity;
    const characters=new CharacterAdminService(db,getPlayer),admin=new CatalogAdminService(db,getPlayer,engine());
    await expect(characters.options(identity)).rejects.toMatchObject({statusCode:403});
    const role=await db.playerRoleAssignment.create({data:{playerId:player.id,role:'ADMIN',grantedByPlayerId:player.id}});
    const candidate=await db.catalogCandidate.create({data:{name:'Private extensible region'}});
    const character=await db.character.create({data:{externalKey:`private-metadata-${randomUUID()}`,name:'Private one missing image',rarity:4,elementKey:'hydro',region:'Horizon',iconPath:'/private/icon.png',splashPath:'/private/splash.png',wishPath:'/private/wish.png'}});
    try{
      await admin.edit(identity,candidate.id,{weapon:'Sword',region:'  Nouvelle   région  '},randomUUID());
      expect((await db.catalogCandidate.findUniqueOrThrow({where:{id:candidate.id}})).fields).toMatchObject({weapon:{value:'Épée',reliability:'ADMIN'},region:{value:'Nouvelle région'}});
      const second=await db.catalogCandidate.create({data:{name:'Private duplicate region'}});
      try{await admin.edit(identity,second.id,{region:'nouvelle région'},randomUUID());expect((await db.catalogCandidate.findUniqueOrThrow({where:{id:second.id}})).fields).toMatchObject({region:{value:'Nouvelle région'}});}finally{await db.catalogCandidate.delete({where:{id:second.id}})}
      const options=await characters.options(identity);expect(options.regions.filter(value=>value.toLowerCase()==='nouvelle région')).toEqual(['Nouvelle région']);expect(options.regions).toContain('Horizon');
      const missing=await characters.list(identity,{page:1,search:'Private one missing image',missingAssets:true});expect(missing.entries).toMatchObject([{id:character.id,fullbodyPath:null}]);
      await expect(admin.edit(identity,candidate.id,{weapon:'unknown weapon'},randomUUID())).rejects.toMatchObject({statusCode:400});
      await db.playerRoleAssignment.update({where:{id:role.id},data:{revokedAt:new Date()}});await expect(characters.options(identity)).rejects.toMatchObject({statusCode:403});
    }finally{await db.catalogCandidate.delete({where:{id:candidate.id}});await db.character.delete({where:{id:character.id}})}
  },60_000);
});
