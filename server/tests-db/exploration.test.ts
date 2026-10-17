import 'dotenv/config';
import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,beforeEach,expect,it,vi} from 'vitest';
import {ExplorationBackgroundStock} from '../src/application/exploration/background-stock.js';
import {isolatedBatchDatabase} from './isolated-batch-database.js';
import {ExplorationService} from '../src/application/exploration/exploration-service.js';
import {GetCurrentPlayer} from '../src/application/player/get-current-player.js';
import {PrismaCurrentPlayerStore} from '../src/infrastructure/database/prisma-current-player-store.js';
import {PrismaEconomyService} from '../src/infrastructure/database/prisma-economy-service.js';
import {resourceKeys} from '../src/domain/economy/resources.js';
import {directions,walkMaze,type Direction,type ExplorationMaze} from '../src/domain/exploration/maze.js';
import {usefulOpened,type ExplorationReward} from '../src/domain/exploration/rewards.js';
import type {ExplorationSessionView} from '../src/domain/exploration/types.js';
const fixture=isolatedBatchDatabase(),db=fixture.database;
let now=new Date('2035-10-17T12:00:00Z');
const getPlayer=new GetCurrentPlayer(new PrismaCurrentPlayerStore(db)),clock={now:()=>now};
const service=(economy?:PrismaEconomyService)=>new ExplorationService(db,getPlayer,clock,()=>42,economy);
const advance=(ms:number)=>{now=new Date(+now+ms);};
beforeAll(()=>fixture.setup({seedPublicCatalog:true,prismaMigrations:true}),120000);
afterAll(()=>fixture.cleanup(),120000);
beforeEach(()=>{now=new Date('2035-10-17T12:00:00Z');});
async function player(){
  const subject=randomUUID();const row=await db.player.create({data:{displayName:'Private Exploration Fixture',elementKey:'cryo',webIdentity:{create:{provider:'supabase',providerSubject:subject}},progression:{create:{xp:0n}},economyStats:{create:{}},resourceBalances:{create:resourceKeys.map(resourceKey=>({resourceKey,amount:0n}))}}});
  return {id:row.id,identity:{subject}};
}
async function start(p:Awaited<ReturnType<typeof player>>){return (await service().act(p.identity,{kind:'START',regionKey:'mondstadt',sessionId:null,idempotencyKey:randomUUID()})).session!;}
export function chestPath(maze:ExplorationMaze,chestIndex:number){
  const queue=[{...maze.start,path:''}],seen=new Set<string>(),chest=maze.chests[chestIndex]!;
  while(queue.length){const at=queue.shift()!,key=`${at.x},${at.y}`;if(seen.has(key))continue;seen.add(key);if(Math.abs(at.x-chest.x)+Math.abs(at.y-chest.y)===1)return at.path;
    for(const direction of Object.keys(directions) as Direction[]){const next=walkMaze(maze,at,direction,true);if(next!==at)queue.push({...next,path:at.path+direction});}}
  throw Error('Chest unreachable');
}
async function usefulChest(session:ExplorationSessionView){const stored=await db.explorationSession.findUniqueOrThrow({where:{id:session.id}});const rewards=stored.hiddenRewards as unknown as ExplorationReward[];return {stored,rewards,index:rewards.findIndex(row=>row.category!=='empty')};}
const open=(p:Awaited<ReturnType<typeof player>>,session:ExplorationSessionView,index:number,key=randomUUID())=>service().act(p.identity,{kind:'OPEN',sessionId:session.id,chestIndex:index,path:chestPath(session.maze,index),idempotencyKey:key});
it('applies migration090 privately with RLS and no anon/authenticated SELECT',async()=>{
  expect(fixture.migrationStatus).toContain('up to date');
  const rows=await db.$queryRawUnsafe<{relname:string;relrowsecurity:boolean;anon:boolean;authenticated:boolean}[]>(`SELECT c.relname,c.relrowsecurity,has_table_privilege('anon',c.oid,'SELECT') AS anon,has_table_privilege('authenticated',c.oid,'SELECT') AS authenticated FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relname IN('exploration_region_progress','exploration_sessions','exploration_backgrounds','exploration_background_search')`,fixture.schema);
  expect(rows).toHaveLength(4);expect(rows.every(row=>row.relrowsecurity&&!row.anon&&!row.authenticated)).toBe(true);
});
it('derives ten current regions only from active published Characters and discovers a new active region',async()=>{
  const p=await player(),initial=await service().overview(p.identity);expect(initial.regions.map(row=>row.name).sort()).toEqual(['Mondstadt','Liyue','Inazuma','Sumeru','Fontaine','Natlan','Snezhnaya','Nod-Krai','Espace','Celestia'].sort());
  const row=await db.character.create({data:{externalKey:randomUUID(),name:'Private Future Character',rarity:5,elementKey:'pyro',region:'Private New Region',isActive:false}});
  expect((await service().overview(p.identity)).regions.some(row=>row.key==='privatenewregion')).toBe(false);
  await db.character.update({where:{id:row.id},data:{isActive:true}});expect((await service().overview(p.identity)).regions.some(row=>row.key==='privatenewregion')).toBe(true);
  await db.character.update({where:{id:row.id},data:{isActive:false}});
  await db.catalogCandidate.create({data:{name:'Private Candidate',fields:{region:{value:'Candidate Only'}}}});expect((await service().overview(p.identity)).regions.some(row=>row.name==='Candidate Only')).toBe(false);
});
it('persists seed, full maze and three hidden outcomes without consuming unopened stocks or exposing rewards',async()=>{
  const p=await player(),session=await start(p),{stored,rewards}=await usefulChest(session);
  expect(stored.seed).toBe('42');expect(stored.maze).toEqual(session.maze);expect(rewards).toHaveLength(3);expect(session.reward).toBeNull();expect(JSON.stringify(session)).not.toContain('hiddenRewards');expect(usefulOpened(session.progress)).toBe(0);
  expect(await db.resourceMovement.count({where:{playerId:p.id,causeKey:'exploration.chest'}})).toBe(0);
  const restarted=await service().overview(p.identity);expect(restarted.session).toEqual(session);
});
it('credits and consumes exactly one useful chest atomically and replays the original receipt after restart/disconnection',async()=>{
  const p=await player(),session=await start(p),{index,rewards}=await usefulChest(session),key=randomUUID();
  const first=await open(p,session,index,key),again=await open(p,session,index,key);
  expect(again).toEqual({...first,alreadyProcessed:true});expect(first.session!.reward).toEqual(rewards[index]);expect(usefulOpened(first.session!.progress)).toBe(1);
  const movements=await db.resourceMovement.findMany({where:{playerId:p.id,causeKey:'exploration.chest'}});expect(movements).toHaveLength(1);expect(movements[0]!.delta).toBe(BigInt(rewards[index]!.amount));
  expect((await service().overview(p.identity)).session!.reward).toEqual(rewards[index]);
});
it('serializes two tabs opening different chests and duplicate same-key requests',async()=>{
  const p=await player(),session=await start(p),before=await db.explorationSession.findUniqueOrThrow({where:{id:session.id}});
  const results=await Promise.allSettled([open(p,session,0),open(p,session,1)]);expect(results.filter(row=>row.status==='fulfilled')).toHaveLength(1);expect(results.filter(row=>row.status==='rejected')).toHaveLength(1);
  expect((await db.explorationSession.findUniqueOrThrow({where:{id:session.id}})).hiddenRewards).toEqual(before.hiddenRewards);expect(await db.resourceMovement.count({where:{playerId:p.id,causeKey:'exploration.chest'}})).toBeLessThanOrEqual(1);
  const q=await player(),other=await start(q),{index}=await usefulChest(other),key=randomUUID(),twice=await Promise.all([open(q,other,index,key),open(q,other,index,key)]);expect(twice[0]!.operationId).toBe(twice[1]!.operationId);expect(await db.resourceMovement.count({where:{playerId:q.id,causeKey:'exploration.chest'}})).toBe(1);
});
it('rolls back a real credit, progress, opening and receipt together on failure',async()=>{
  const p=await player(),session=await start(p),{index}=await usefulChest(session),economy=new PrismaEconomyService(()=>now),original=economy.credit.bind(economy);
  economy.credit=async(tx,input)=>{await original(tx,input);throw Error('Injected after actual credit');};
  await expect(service(economy).act(p.identity,{kind:'OPEN',sessionId:session.id,chestIndex:index,path:chestPath(session.maze,index),idempotencyKey:randomUUID()})).rejects.toThrow('Injected');
  expect((await service().overview(p.identity)).session!.state).toBe('ACTIVE');expect(usefulOpened((await service().overview(p.identity)).session!.progress)).toBe(0);expect(await db.resourceMovement.count({where:{playerId:p.id}})).toBe(0);expect(await db.businessOperation.count({where:{playerId:p.id,operationType:'exploration.action'}})).toBe(1);
});
it('handles the last quota999→1000 and then infinite exactempty/own/other without further progress',async()=>{
  const p=await player();await db.explorationRegionProgress.create({data:{playerId:p.id,regionKey:'mondstadt',primogemsUsed:100,morasUsed:200,ownUsed:300,otherUsed:399}});
  let session=await start(p);const hidden=await usefulChest(session);expect(hidden.rewards.filter(row=>row.category!=='empty').every(row=>row.category==='other')).toBe(true);
  let result=await open(p,session,hidden.index);expect(usefulOpened(result.session!.progress)).toBe(1000);
  for(let turn=0;turn<3;turn++){
    result=await service().act(p.identity,{kind:'NEXT',sessionId:result.session!.id,idempotencyKey:randomUUID()});session=result.session!;expect(session.infinite).toBe(true);
    const next=await usefulChest(session);expect(next.rewards.map(row=>row.category).sort()).toEqual(['empty','other','own']);result=await open(p,session,next.index);expect(usefulOpened(result.session!.progress)).toBe(1000);expect(Number(result.session!.reward!.amount)).toBeLessThanOrEqual(5);
  }
});
it('keeps gains through Stop, abandonment and stale/ambiguous retries without accepting stale session actions',async()=>{
  const p=await player(),session=await start(p),{index}=await usefulChest(session),key=randomUUID(),opened=await open(p,session,index,key);
  const next=await service().act(p.identity,{kind:'NEXT',sessionId:session.id,idempotencyKey:randomUUID()});expect(next.session!.id).not.toBe(session.id);
  await expect(open(p,session,index)).rejects.toMatchObject({code:'EXPLORATION_CONFLICT'});
  expect((await open(p,session,index,key)).session).toEqual(opened.session);
  await expect(open(p,session,(index+1)%3,key)).rejects.toMatchObject({code:'EXPLORATION_IDEMPOTENCY_CONFLICT'});
  const abandoned=await service().act(p.identity,{kind:'ABANDON',sessionId:next.session!.id,idempotencyKey:randomUUID()});expect(abandoned.session).toBeNull();expect(usefulOpened(abandoned.regions.find(row=>row.key==='mondstadt')!.progress)).toBe(1);
});
it('grants ten seconds from authoritative presence and expires without undoing any credited reward',async()=>{
  const p=await player(),session=await start(p),{index}=await usefulChest(session);await open(p,session,index);
  advance(6000);const tab=randomUUID();await service().presence(p.identity,session.id,{tabKey:tab,sequence:1,visible:true});advance(9999);expect((await service().overview(p.identity)).session!.state).toBe('OPENED');advance(1);
  expect((await service().overview(p.identity)).session).toBeNull();expect(await db.resourceMovement.count({where:{playerId:p.id,causeKey:'exploration.chest'}})).toBe(1);
  expect((await service().presence(p.identity,session.id,{tabKey:tab,sequence:2,visible:true})).active).toBe(false);
});
it('ignores out-of-order tab presence and retains the postchest choice on timely return',async()=>{
  const p=await player(),session=await start(p),{index}=await usefulChest(session);await open(p,session,index);const tab=randomUUID();
  await service().presence(p.identity,session.id,{tabKey:tab,sequence:2,visible:false});advance(6000);const returned=await service().presence(p.identity,session.id,{tabKey:tab,sequence:3,visible:true});
  advance(2000);expect((await service().presence(p.identity,session.id,{tabKey:tab,sequence:1,visible:false})).expiresAt).toBe(returned.expiresAt);expect((await service().overview(p.identity)).session!.openedChest).toBe(index);
});
it('expires a browser crash before opening and permits a fresh start without any gain',async()=>{
  const p=await player(),session=await start(p);advance(10000);expect((await service().overview(p.identity)).session).toBeNull();expect((await start(p)).id).not.toBe(session.id);expect(await db.resourceMovement.count({where:{playerId:p.id}})).toBe(0);
});
it('abandons an explicit prechest departure unless another tab is still visibly present',async()=>{
  const p=await player(),session=await start(p),a=randomUUID(),b=randomUUID();
  await service().presence(p.identity,session.id,{tabKey:a,sequence:1,visible:true});await service().presence(p.identity,session.id,{tabKey:b,sequence:1,visible:true});
  expect((await service().presence(p.identity,session.id,{tabKey:a,sequence:2,visible:false})).active).toBe(true);
  expect((await service().presence(p.identity,session.id,{tabKey:b,sequence:2,visible:false})).active).toBe(false);
  expect((await service().overview(p.identity)).session).toBeNull();expect(await db.resourceMovement.count({where:{playerId:p.id}})).toBe(0);
});
it('does not consume quotas on abandon and refuses teleports, foreign sessions and changed elements',async()=>{
  const p=await player(),q=await player(),session=await start(p);
  await expect(service().act(p.identity,{kind:'OPEN',sessionId:session.id,chestIndex:0,path:'',idempotencyKey:randomUUID()})).rejects.toMatchObject({code:'EXPLORATION_INVALID_PATH'});
  await expect(open(q,session,0)).rejects.toMatchObject({code:'EXPLORATION_CONFLICT'});
  await db.player.update({where:{id:p.id},data:{elementKey:'electro'}});await expect(open(p,session,0)).rejects.toMatchObject({code:'EXPLORATION_CONFLICT'});
  const result=await service().act(p.identity,{kind:'ABANDON',sessionId:session.id,idempotencyKey:randomUUID()});expect(usefulOpened(result.regions.find(row=>row.key==='mondstadt')!.progress)).toBe(0);expect(await db.resourceMovement.count({where:{playerId:{in:[p.id,q.id]}}})).toBe(0);
});
it('queues discovery once per Paris day, caps approved stock at5 and skips complete regions on later nights',async()=>{
  const discover=vi.fn(async(_region:string)=>[]),stock=new ExplorationBackgroundStock(db,()=>now,discover);
  await stock.tick();expect(discover).toHaveBeenCalledTimes(10);await stock.tick();expect(discover).toHaveBeenCalledTimes(10);
  const candidates=[];for(let index=0;index<6;index++)candidates.push(await db.explorationBackground.create({data:{regionKey:'mondstadt',sourceUrl:`https://commons.wikimedia.org/wiki/File:PrivateFixture${index}.png`,imageUrl:`https://upload.wikimedia.org/private${index}.png`,licenseUrl:'https://creativecommons.org/licenses/by/4.0/',licenseName:'CC BY4.0',attribution:'Synthetic private fixture',width:1200,height:600}}));
  for(let index=0;index<5;index++){const sha=String(index).padStart(64,'a'),asset={localPath:`/assets/exploration/backgrounds/${sha}.png`,sha256:sha,width:1200,height:600,rightsConfirmed:true};if(index===0)await expect(stock.approve(candidates[index]!.id,{...asset,rightsConfirmed:false})).rejects.toThrow('BACKGROUND_IMPORT_INVALID');await stock.approve(candidates[index]!.id,asset);}
  const sha='f'.repeat(64);await expect(stock.approve(candidates[5]!.id,{localPath:`/assets/exploration/backgrounds/${sha}.png`,sha256:sha,width:1200,height:600,rightsConfirmed:true})).rejects.toThrow('BACKGROUND_STOCK_FULL');
  discover.mockClear();advance(86400000);await stock.tick();expect(discover).toHaveBeenCalledTimes(9);expect(discover.mock.calls.some(([region])=>region==='Mondstadt')).toBe(false);
});

it('serializes competing imports of the same candidate without replacing an approved asset',async()=>{
  const candidate=await db.explorationBackground.create({data:{regionKey:'liyue',sourceUrl:'https://commons.wikimedia.org/wiki/File:PrivateConcurrent.png',imageUrl:'https://upload.wikimedia.org/private-concurrent.png',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',licenseName:'CC BY4.0',attribution:'Synthetic private fixture',width:1200,height:600}});
  const stock=new ExplorationBackgroundStock(db,()=>now),asset=(sha:string)=>({localPath:`/assets/exploration/backgrounds/${sha}.png`,sha256:sha,width:1200,height:600,rightsConfirmed:true});
  const results=await Promise.allSettled([stock.approve(candidate.id,asset('b'.repeat(64))),stock.approve(candidate.id,asset('c'.repeat(64)))]);
  expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);
  const rejected=results.find(result=>result.status==='rejected');expect(rejected?.status==='rejected'&&String(rejected.reason)).toContain('BACKGROUND_ALREADY_IMPORTED');
  const stored=await db.explorationBackground.findUniqueOrThrow({where:{id:candidate.id}}),fulfilled=results.find(result=>result.status==='fulfilled');
  expect(fulfilled?.status==='fulfilled'&&fulfilled.value.sha256).toBe(stored.sha256);
  expect(await stock.approve(candidate.id,asset(stored.sha256!))).toEqual(stored);
});
