import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { PrismaDailyCombatStore } from '../src/infrastructure/database/prisma-daily-combat-store.js';
import type { DailyCombatView } from '../src/application/combat/daily-combat-store.js';

const fixture = isolatedBatchDatabase(), db = fixture.database;
const store = new PrismaDailyCombatStore(db,{encounter:{nextInt:()=>0},fight:{nextInt:()=>0}});
const now = new Date('2099-10-17T12:00:00Z');
beforeAll(()=>fixture.setup({seedPublicCatalog:true,prismaMigrations:true}),60_000);
afterAll(()=>fixture.cleanup(),60_000);
const ids = (view:DailyCombatView)=>view.loadout.slots.map(slot=>slot.character?.id??null);
async function player() {
  const rows = await db.character.findMany({where:{isActive:true},orderBy:{id:'asc'},take:8});expect(rows).toHaveLength(8);
  const id = randomUUID();await db.player.create({data:{id,displayName:'Private Combat Composition',elementKey:'hydro',characters:{create:rows.map(row=>({characterId:row.id,copies:1,constellation:0,firstObtainedAt:now}))}}});
  const context={playerId:id,playerElementKey:'hydro' as const,businessDate:'2099-10-17',now};
  const view=await store.getView(context);
  return {id,rows,context,view,input:(characterIds:readonly(string|null)[],from=view,key=randomUUID())=>({...context,characterIds,expectedCharacterIds:ids(from),expectedMode:from.loadout.nextAttemptMode,encounterId:from.encounter.id,idempotencyKey:key})};
}
describe('Training atomic quick composition, private PostgreSQL',()=>{
 it('applies zero/partial/full ordered MANUAL slots and authoritative preview, preserving Teams and Boss',async()=>{
  const p=await player();const team=await db.team.create({data:{playerId:p.id,displayPosition:1,isBaseSlot:true,isActive:true,members:{create:[{position:1,characterId:p.rows[7]!.id}]}}});
  await db.playerBossLoadout.create({data:{playerId:p.id,slots:{create:[{position:3,characterId:p.rows[6]!.id}]}}});
  const teamBefore=await db.team.findUnique({where:{id:team.id},include:{members:true}}),bossBefore=await db.playerBossLoadout.findUnique({where:{playerId:p.id},include:{slots:true}});
  const partial=await store.replaceComposition(p.input([null,p.rows[1]!.id,null,p.rows[3]!.id]));expect(ids(partial)).toEqual([null,p.rows[1]!.id,null,p.rows[3]!.id]);expect(partial.preview).toBeNull();
  const full=await store.replaceComposition(p.input(p.rows.slice(0,4).map(r=>r.id),partial));expect(full.preview).not.toBeNull();expect(full.loadout.nextAttemptMode).toBe('MANUAL');expect(full.canFight).toBe(true);
  const auto=await store.autoSelect(p.context);expect(auto.loadout.nextAttemptMode).toBe('AUTO');const manual=await store.replaceComposition(p.input(ids(auto),auto));expect(manual.loadout.nextAttemptMode).toBe('MANUAL');
  const empty=await store.replaceComposition(p.input([null,null,null,null],manual));expect(ids(empty)).toEqual([null,null,null,null]);expect(empty.canFight).toBe(false);
  expect(await db.team.findUnique({where:{id:team.id},include:{members:true}})).toEqual(teamBefore);expect(await db.playerBossLoadout.findUnique({where:{playerId:p.id},include:{slots:true}})).toEqual(bossBefore);
  expect(await db.dailyCombatAttempt.count({where:{playerId:p.id}})).toBe(0);expect(await db.resourceMovement.count({where:{playerId:p.id}})).toBe(0);
 });
 it('rejects duplicates, inactive and unowned entries without partial changes',async()=>{
  const p=await player();const first=await store.setSlot({...p.context,position:2,characterId:p.rows[0]!.id});const before=await db.playerDailyCombatLoadoutSlot.findMany({where:{playerId:p.id}});
  await expect(store.replaceComposition(p.input([p.rows[0]!.id,p.rows[0]!.id,null,null],first))).rejects.toMatchObject({code:'DAILY_COMBAT_CHARACTER_DUPLICATE'});
  const other=await db.character.findFirstOrThrow({where:{isActive:true,id:{notIn:p.rows.map(r=>r.id)}}});await expect(store.replaceComposition(p.input([other.id,null,null,null],first))).rejects.toMatchObject({code:'DAILY_COMBAT_CHARACTER_NOT_AVAILABLE'});
  await db.character.update({where:{id:p.rows[1]!.id},data:{isActive:false}});try{await expect(store.replaceComposition(p.input([p.rows[1]!.id,null,null,null],first))).rejects.toMatchObject({code:'DAILY_COMBAT_CHARACTER_NOT_AVAILABLE'});}finally{await db.character.update({where:{id:p.rows[1]!.id},data:{isActive:true}})}
  expect(await db.playerDailyCombatLoadoutSlot.findMany({where:{playerId:p.id}})).toEqual(before);expect(await db.businessOperation.count({where:{playerId:p.id,operationType:'daily-combat.composition'}})).toBe(0);
 });
 it('allows a KO only retained at its current place and rejects KO additions or moves',async()=>{
  const p=await player();const first=await store.setSlot({...p.context,position:2,characterId:p.rows[0]!.id});await db.playerDailyCombatKo.createMany({data:[p.rows[0]!.id,p.rows[1]!.id].map(characterId=>({playerId:p.id,encounterId:first.encounter.id,characterId}))});
  const retained=await store.replaceComposition(p.input([p.rows[2]!.id,p.rows[0]!.id,null,null],first));expect(retained.loadout.slots[1]!.ko).toBe(true);
  await expect(store.replaceComposition(p.input([p.rows[0]!.id,null,null,null],retained))).rejects.toMatchObject({code:'DAILY_COMBAT_CHARACTER_KO'});await expect(store.replaceComposition(p.input([p.rows[1]!.id,p.rows[0]!.id,null,null],retained))).rejects.toMatchObject({code:'DAILY_COMBAT_CHARACTER_KO'});expect(ids(await store.getView(p.context))).toEqual(ids(retained));
 });
 it('deduplicates concurrent double confirmation and never reapplies an older result on retry',async()=>{
  const p=await player(),input=p.input([p.rows[0]!.id,null,p.rows[2]!.id,null]);const [a,b]=await Promise.all([store.replaceComposition(input),store.replaceComposition(input)]);expect(ids(a)).toEqual(ids(b));expect(await db.businessOperation.count({where:{playerId:p.id,operationType:'daily-combat.composition'}})).toBe(1);
  const changed=await store.removeSlot({...p.context,position:1});expect(ids(await store.replaceComposition(input))).toEqual(ids(changed));await expect(store.replaceComposition({...input,characterIds:[null,null,null,null]})).rejects.toMatchObject({code:'DAILY_COMBAT_IDEMPOTENCY_CONFLICT'});
 });
 it('serializes concurrent different confirmations from the same snapshot with one conflict',async()=>{
  const p=await player();const outcomes=await Promise.allSettled([store.replaceComposition(p.input([p.rows[0]!.id,null,null,null])),store.replaceComposition(p.input([null,p.rows[1]!.id,null,null]))]);expect(outcomes.filter(x=>x.status==='fulfilled')).toHaveLength(1);const rejected=outcomes.find(x=>x.status==='rejected') as PromiseRejectedResult;expect(rejected.reason).toMatchObject({code:'DAILY_COMBAT_COMPOSITION_CHANGED'});expect(await db.playerDailyCombatLoadoutSlot.count({where:{playerId:p.id}})).toBe(1);
 });
 it('detects another-tab slot/mode/day changes and accepts an explicitly refreshed snapshot',async()=>{
  const p=await player();const old=p.input([p.rows[0]!.id,null,null,null]);const changed=await store.setSlot({...p.context,position:4,characterId:p.rows[1]!.id});await expect(store.replaceComposition(old)).rejects.toMatchObject({code:'DAILY_COMBAT_COMPOSITION_CHANGED'});const valid=p.input([p.rows[0]!.id,null,null,null],changed);await expect(store.replaceComposition({...valid,expectedMode:'AUTO'})).rejects.toMatchObject({code:'DAILY_COMBAT_COMPOSITION_CHANGED'});await expect(store.replaceComposition({...valid,encounterId:randomUUID()})).rejects.toMatchObject({code:'DAILY_COMBAT_COMPOSITION_CHANGED'});expect(ids(await store.replaceComposition(valid))).toEqual(valid.characterIds);
 });
});
