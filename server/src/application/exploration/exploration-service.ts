import {randomBytes,randomInt} from 'node:crypto';
import {Prisma,type PrismaClient,type ExplorationRegionProgress} from '../../../generated/prisma/client.js';
import type {AuthenticatedIdentity} from '../../domain/identity/authenticated-identity.js';
import type {Clock} from '../../domain/time/business-date.js';
import type {GetCurrentPlayer} from '../player/get-current-player.js';
import {lockPlayerMutation} from '../player/player-mutation-guard.js';
import {AppError} from '../../api/errors.js';
import {isPrismaConcurrencyCollision} from '../../infrastructure/database/prisma-concurrency.js';
import {PrismaEconomyService} from '../../infrastructure/database/prisma-economy-service.js';
import {isElementKey} from '../../domain/economy/resources.js';
import {createExplorationMaze,validateChestPath,type ExplorationMaze} from '../../domain/exploration/maze.js';
import {drawExplorationRewards,emptyProgress,explorationQuotas,usefulOpened,type ExplorationProgress,type ExplorationReward} from '../../domain/exploration/rewards.js';
import type {ExplorationAction,ExplorationMutation,ExplorationPresence,ExplorationSnapshot,ExplorationSessionView} from '../../domain/exploration/types.js';
import {activeExplorationRegions} from './regions.js';
import {isLocalExplorationBackground} from './background-stock.js';

const conflict=(message='Cette exploration a changé. Actualisez la région.',code='EXPLORATION_CONFLICT')=>new AppError(message,409,code);
const json=(value:unknown)=>JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const progressOf=(row:ExplorationRegionProgress|undefined|null):ExplorationProgress=>row?{primogems:row.primogemsUsed,moras:row.morasUsed,own:row.ownUsed,other:row.otherUsed}:emptyProgress();
type Presence=Record<string,{sequence:number;visible:boolean;seenAt:number}>;

export class ExplorationService {
  private readonly economy:PrismaEconomyService;
  constructor(private readonly db:PrismaClient,private readonly getPlayer:GetCurrentPlayer,private readonly clock:Clock,
    private readonly seed:()=>number=()=>randomBytes(4).readUInt32LE(),economy?:PrismaEconomyService,private readonly draw:()=>number=()=>randomInt(0x100000000)/0x100000000){this.economy=economy??new PrismaEconomyService(()=>clock.now());}
  private async actor(identity:AuthenticatedIdentity){
    const actor=await this.getPlayer.execute(identity);
    if(actor.status!=='ACTIVE'||!actor.elementKey||!isElementKey(actor.elementKey))throw new AppError('Choisissez un élément avec un profil actif pour explorer.',403,'EXPLORATION_UNAVAILABLE');
    return actor;
  }
  private async transaction<T>(playerId:string,run:(tx:Prisma.TransactionClient)=>Promise<T>):Promise<T>{
    for(let attempt=0;attempt<5;attempt++)try{return await this.db.$transaction(async tx=>{await lockPlayerMutation(tx,playerId);return run(tx);},{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:15000});}
    catch(error){if(attempt<4&&isPrismaConcurrencyCollision(error))continue;throw error;}
    throw Error('Exploration transaction retries exhausted');
  }
  private async current(tx:Prisma.TransactionClient,playerId:string,now:Date){
    const session=await tx.explorationSession.findFirst({where:{playerId,endedAt:null}});
    if(session&&session.expiresAt&&session.expiresAt<=now){
      await tx.explorationSession.update({where:{id:session.id},data:{state:'ABANDONED',endedAt:now}});return null;
    }
    return session;
  }
  private async snapshot(tx:Prisma.TransactionClient,playerId:string,now:Date):Promise<ExplorationSnapshot>{
    const regions=await activeExplorationRegions(tx),progress=await tx.explorationRegionProgress.findMany({where:{playerId}}),session=await this.current(tx,playerId,now);
    let view:ExplorationSessionView|null=null;
    if(session){
      const background=session.backgroundPath?await tx.explorationBackground.findFirst({where:{regionKey:session.regionKey,state:'APPROVED',localPath:session.backgroundPath}}):null;
      view={id:session.id,regionKey:session.regionKey,regionName:session.regionName,maze:session.maze as unknown as ExplorationMaze,state:session.state as 'ACTIVE'|'OPENED',infinite:session.infinite,
        backgroundPath:background&&session.backgroundPath&&isLocalExplorationBackground(session.backgroundPath)?session.backgroundPath:null,backgroundCredit:background?{sourceUrl:background.sourceUrl,licenseUrl:background.licenseUrl,attribution:background.attribution}:null,
        openedChest:session.openedChest,reward:session.openedReward as ExplorationReward|null,progress:progressOf(progress.find(row=>row.regionKey===session.regionKey)),expiresAt:session.expiresAt?.toISOString()??null};
    }
    return {regions:regions.map(region=>({...region,progress:progressOf(progress.find(row=>row.regionKey===region.key))})),session:view,serverNow:now.toISOString()};
  }
  async overview(identity:AuthenticatedIdentity){const actor=await this.actor(identity);return this.transaction(actor.id,tx=>this.snapshot(tx,actor.id,this.clock.now()));}
  async act(identity:AuthenticatedIdentity,input:ExplorationAction):Promise<ExplorationMutation>{
    const actor=await this.actor(identity),fingerprint=JSON.stringify(input.kind==='START'?{kind:input.kind,sessionId:input.sessionId,regionKey:input.regionKey}:input.kind==='OPEN'?{kind:input.kind,sessionId:input.sessionId,chestIndex:input.chestIndex,path:input.path}:{kind:input.kind,sessionId:input.sessionId});
    return this.transaction(actor.id,async tx=>{
      const old=await tx.businessOperation.findFirst({where:{sourceChannel:'UI',idempotencyKey:input.idempotencyKey}});
      if(old){
        const receipt=old.resultSummary as {fingerprint?:string;response?:ExplorationMutation}|null;
        if(old.playerId!==actor.id||old.operationType!=='exploration.action'||old.status!=='COMPLETED'||receipt?.fingerprint!==fingerprint||!receipt.response)throw conflict('Cette clé correspond à une autre action.','EXPLORATION_IDEMPOTENCY_CONFLICT');
        return {...receipt.response,alreadyProcessed:true};
      }
      const player=await tx.player.findUniqueOrThrow({where:{id:actor.id}});
      if(player.status!=='ACTIVE'||!player.elementKey||!isElementKey(player.elementKey))throw conflict('Ce profil ne peut pas explorer.');
      const now=this.clock.now(),current=await this.current(tx,player.id,now);
      if(input.kind==='START'){if(current)throw conflict('Une exploration est déjà en cours.');}
      else if(!current||current.id!==input.sessionId)throw conflict();
      if(current&&current.elementKey!==player.elementKey&&!['ABANDON','STOP'].includes(input.kind))throw conflict('Votre élément a changé. Abandonnez cette exploration avant de recommencer.');
      const operation=await tx.businessOperation.create({data:{playerId:player.id,operationType:'exploration.action',sourceChannel:'UI',idempotencyKey:input.idempotencyKey,startedAt:now}});
      if(input.kind==='START'||input.kind==='NEXT'){
        if(input.kind==='NEXT'&&current?.state!=='OPENED')throw conflict('Ouvrez un coffre avant de continuer.');
        const key=input.kind==='START'?input.regionKey:current!.regionKey;
        const region=(await activeExplorationRegions(tx)).find(row=>row.key===key);
        if(!region)throw conflict('Cette région ne possède aucun personnage publié actif.','EXPLORATION_REGION_UNAVAILABLE');
        if(current)await tx.explorationSession.update({where:{id:current.id},data:{state:'STOPPED',endedAt:now}});
        const row=await tx.explorationRegionProgress.upsert({where:{playerId_regionKey:{playerId:player.id,regionKey:key}},create:{playerId:player.id,regionKey:key},update:{}});
        const progress=progressOf(row),seed=this.seed(),random=this.draw,rewards=drawExplorationRewards(progress,player.elementKey,random);
        const backgrounds=await tx.explorationBackground.findMany({where:{regionKey:key,state:'APPROVED'},orderBy:{id:'asc'},take:5});
        const background=backgrounds.length?backgrounds[Math.floor(random()*backgrounds.length)]!.localPath:null;
        await tx.explorationSession.create({data:{playerId:player.id,regionKey:key,regionName:region.name,elementKey:player.elementKey,seed:String(seed),maze:json(createExplorationMaze(seed)),hiddenRewards:json(rewards),infinite:usefulOpened(progress)===1000,backgroundPath:background,expiresAt:new Date(+now+10000)}});
      }else if(input.kind==='OPEN'){
        if(current!.state!=='ACTIVE')throw conflict('Un seul coffre peut être ouvert dans ce labyrinthe.','EXPLORATION_CHEST_ALREADY_OPEN');
        if(!validateChestPath(current!.maze as unknown as ExplorationMaze,input.path,input.chestIndex))throw new AppError('Rejoignez un coffre par un chemin praticable.',400,'EXPLORATION_INVALID_PATH');
        const reward=(current!.hiddenRewards as unknown as ExplorationReward[])[input.chestIndex]!;
        if(reward.category!=='empty'){
          const stock=await tx.explorationRegionProgress.findUniqueOrThrow({where:{playerId_regionKey:{playerId:player.id,regionKey:current!.regionKey}}});
          const progress=progressOf(stock);
          if(current!.infinite){if(usefulOpened(progress)!==1000||!['own','other'].includes(reward.category))throw conflict();}
          else {
            if(progress[reward.category]>=explorationQuotas[reward.category])throw conflict('Le stock de ce coffre doit être vérifié.');
            const field={primogems:'primogemsUsed',moras:'morasUsed',own:'ownUsed',other:'otherUsed'}[reward.category];
            await tx.explorationRegionProgress.update({where:{playerId_regionKey:{playerId:player.id,regionKey:current!.regionKey}},data:{[field]:{increment:1}}});
          }
          await this.economy.credit(tx,{playerId:player.id,playerElementKey:player.elementKey,resourceKey:reward.resourceKey!,amount:BigInt(reward.amount),causeKey:'exploration.chest',domainKey:'exploration',operationId:operation.id,sourceChannel:'UI'});
        }
        await tx.explorationSession.update({where:{id:current!.id},data:{state:'OPENED',openedChest:input.chestIndex,openedReward:json(reward),expiresAt:new Date(now.getTime()+10000)}});
      }else{
        if(input.kind==='STOP'&&current!.state!=='OPENED')throw conflict('Utilisez Abandonner avant de choisir un coffre.');
        if(input.kind==='ABANDON'&&current!.state!=='ACTIVE')throw conflict('Utilisez Arrêter après avoir ouvert un coffre.');
        await tx.explorationSession.update({where:{id:current!.id},data:{state:input.kind==='STOP'?'STOPPED':'ABANDONED',endedAt:now}});
      }
      const response={...await this.snapshot(tx,player.id,now),operationId:operation.id,alreadyProcessed:false};
      await tx.businessOperation.update({where:{id:operation.id},data:{status:'COMPLETED',completedAt:now,resultSummary:json({fingerprint,response})}});
      return response;
    });
  }
  async presence(identity:AuthenticatedIdentity,sessionId:string,input:ExplorationPresence){
    const actor=await this.actor(identity);
    return this.transaction(actor.id,async tx=>{
      const now=this.clock.now(),session=await this.current(tx,actor.id,now);
      if(!session||session.id!==sessionId)return {active:false,expiresAt:null,serverNow:now.toISOString()};
      const entries=(session.presence as Presence),previous=entries[input.tabKey];
      if(previous&&previous.sequence>=input.sequence)return {active:true,expiresAt:session.expiresAt!.toISOString(),serverNow:now.toISOString()};
      const recent=Object.fromEntries(Object.entries(entries).filter(([,value])=>value.seenAt>now.getTime()-60000));
      if(!recent[input.tabKey]&&Object.keys(recent).length>=32)throw conflict('Trop d’onglets Exploration ouverts.');
      recent[input.tabKey]={...input,seenAt:now.getTime()};
      const visible=Object.values(recent).filter(value=>value.visible&&value.seenAt>+now-10000);
      if(session.state==='ACTIVE'&&!visible.length){await tx.explorationSession.update({where:{id:sessionId},data:{state:'ABANDONED',endedAt:now,presence:json(recent)}});return {active:false,expiresAt:null,serverNow:now.toISOString()};}
      const expiresAt=new Date(session.state==='ACTIVE'?Math.max(...visible.map(value=>value.seenAt+10000)):+now+10000);
      await tx.explorationSession.update({where:{id:sessionId},data:{presence:json(recent),expiresAt}});
      return {active:true,expiresAt:expiresAt.toISOString(),serverNow:now.toISOString()};
    });
  }
  /** Shared lazy/batch maintenance only; never schedules a timer per Player. */
  async expireAbandoned(){const now=this.clock.now();return this.db.explorationSession.updateMany({where:{state:{in:['ACTIVE','OPENED']},endedAt:null,expiresAt:{lte:now}},data:{state:'ABANDONED',endedAt:now}});}
}
