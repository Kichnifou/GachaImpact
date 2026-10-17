import { writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { SocialService } from '../src/application/social/social-service.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { PRESENCE_AWAY_MS, PRESENCE_INACTIVE_MS, PRESENCE_CONNECTION_TIMEOUT_MS } from '../src/application/social/presence-service.js';

const fixture=isolatedBatchDatabase(),{database}=fixture;
const base=new Date('2026-10-17T10:00:00Z');let now=new Date(base);
const store={findByIdentity:async(_provider:string,subject:string)=>{
  const p=await database.player.findUnique({where:{id:subject}});
  return p?{id:p.id,displayName:p.displayName,status:p.status,elementKey:null}:null;
},provision:async()=>{throw Error('No provisioning in private presence fixture');}};
const service=new SocialService(new GetCurrentPlayer(store),database,{now:()=>now});
let owner:string,observer:string,peer:string;
const identity=(subject:string)=>({subject});
const connected=()=>service.connected(identity(observer));
beforeAll(async()=>{
  await fixture.setup({prismaMigrations:true});
  const players=await Promise.all(['Owner','Observer','Peer'].map(displayName=>database.player.create({data:{displayName:'R1109 private '+displayName}})));
  [owner,observer,peer]=players.map(row=>row.id) as [string,string,string];
},60_000);
beforeEach(async()=>{now=new Date(base);await database.playerSession.deleteMany();await database.privacySetting.deleteMany();await database.playerBlock.deleteMany();});
afterAll(async()=>{await fixture.cleanup();},60_000);

it('counts confirmed connections with no input, deduplicates tabs and does not record user activity',async()=>{
  await Promise.all([service.presence.touch(owner,randomUUID(),false,true),service.presence.touch(owner,randomUUID(),false,true),service.presence.touch(peer,randomUUID(),false,true)]);
  const value=await connected();expect(value.total).toBe(2);expect(new Set(value.players.map(row=>row.id)).size).toBe(2);
  expect(value.players.every(row=>row.status==='ONLINE')).toBe(true);
  expect(await database.playerSession.count({where:{lastActivityAt:{not:null}}})).toBe(0);
  expect(await database.playerActivityState.count()).toBe(0);expect(await database.playerDailyActivity.count()).toBe(0);
},30_000);
it('closes one tab without disconnecting another and reconnects without duplicate players',async()=>{
  const a=randomUUID(),b=randomUUID();await Promise.all([service.presence.touch(owner,a,false,true),service.presence.touch(owner,b,false,true)]);
  await service.presence.end(owner,a);expect((await connected()).total).toBe(1);
  await service.presence.end(owner,b);expect((await connected()).total).toBe(0);
  await service.presence.touch(owner,randomUUID(),false,true);expect((await connected()).total).toBe(1);
},30_000);
it('keeps ten-minute AWAY, two-hour inactivity and abrupt-close three-minute detection',async()=>{
  const key=randomUUID();await service.presence.touch(owner,key,false,true);
  now=new Date(+base+PRESENCE_AWAY_MS);await service.presence.touch(owner,key,false);
  expect((await connected()).players[0]?.status).toBe('AWAY');
  now=new Date(+base+PRESENCE_INACTIVE_MS);await service.presence.touch(owner,key,false);
  expect((await connected()).total).toBe(0);
  await service.presence.end(owner,key);
  now=new Date(base);await service.presence.touch(peer,randomUUID(),false,true);
  now=new Date(+base+PRESENCE_CONNECTION_TIMEOUT_MS);expect((await connected()).total).toBe(0);
},30_000);
it('filters private, blocked and inactive Players for the same observer',async()=>{
  await Promise.all([service.presence.touch(owner,randomUUID(),false,true),service.presence.touch(peer,randomUUID(),false,true)]);
  await service.privacy.save(owner,'PRESENCE','PRIVATE');expect((await connected()).players.map(row=>row.id)).toEqual([peer]);
  expect((await service.connected(identity(owner))).players.some(row=>row.id===owner)).toBe(true);
  await service.privacy.save(owner,'PRESENCE','PUBLIC');await database.playerBlock.create({data:{blockerPlayerId:owner,blockedPlayerId:observer}});
  expect((await connected()).players.map(row=>row.id)).toEqual([peer]);
  await database.playerBlock.deleteMany();await database.player.update({where:{id:peer},data:{status:'SUSPENDED'}});
  try{expect((await connected()).players.map(row=>row.id)).toEqual([owner]);}finally{await database.player.update({where:{id:peer},data:{status:'ACTIVE'}});}
},30_000);
it('serializes concurrent start/end and keeps the ended-session tombstone authoritative',async()=>{
  const key=randomUUID();await Promise.allSettled([service.presence.touch(owner,key,false,true),service.presence.end(owner,key),service.presence.touch(owner,key,false,true)]);
  expect((await connected()).total).toBe(0);
  await expect(service.presence.touch(owner,key,false,true)).rejects.toMatchObject({code:'PRESENCE_SESSION_ENDED'});
  const rows=await database.playerSession.findMany({where:{playerId:owner}});expect(rows).toHaveLength(1);expect(rows[0]?.endedAt).not.toBeNull();
},30_000);
it('bounds the unchanged read cost for 100 private Players without locks or writes',async()=>{
  const ids=(await Promise.all(Array.from({length:97},(_,index)=>database.player.create({data:{displayName:'R1109 scale '+index}})))).map(row=>row.id);
  await service.presence.touch(owner,randomUUID(),false,true);
  const before=await database.playerSession.findMany();
  const players=vi.spyOn(database.player,'findMany'),sessions=vi.spyOn(database.playerSession,'findMany');
  const times:number[]=[];
  try{for(let i=0;i<5;i++){const start=performance.now();expect((await connected()).total).toBe(1);times.push(performance.now()-start);}
    expect(players).toHaveBeenCalledTimes(10);expect(sessions).toHaveBeenCalledTimes(5);
  }finally{players.mockRestore();sessions.mockRestore();}
  expect(await database.playerSession.findMany()).toEqual(before);
  expect(await database.playerActivityState.count()).toBe(0);
  const measure={players:ids.length+3,reads:times.length,latencyMs:times.map(ms=>Math.round(ms)),pool:fixture.poolSnapshot()};
  if(process.env['R1109_PRESENCE_EVIDENCE_PATH'])writeFileSync(process.env['R1109_PRESENCE_EVIDENCE_PATH'],JSON.stringify(measure,null,2));
},45_000);
