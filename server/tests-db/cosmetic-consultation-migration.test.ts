import 'dotenv/config';
import {readFileSync} from 'node:fs';
import {afterAll,beforeAll,expect,it} from 'vitest';
import {isolatedBatchDatabase} from './isolated-batch-database.js';
const fixture=isolatedBatchDatabase(),db=fixture.database;
beforeAll(()=>fixture.setup({prismaMigrations:true}),120000);afterAll(()=>fixture.cleanup(),60000);
it('baselines existing possessions without changing acquisition timestamps or granting cosmetics',async()=>{
  const player=await db.player.create({data:{displayName:'Isolated R1052'}});
  const live=await db.cosmeticDefinition.create({data:{externalKey:'r1052-migration-live',type:'AVATAR',displayName:'Live'}});
  const historical=await db.cosmeticDefinition.create({data:{externalKey:'r1052-migration-historical',type:'TITLE',displayName:'Historical'}});
  const archived=await db.player.create({data:{displayName:'Isolated archived R1052'}});
  await db.playerCosmetic.create({data:{playerId:archived.id,cosmeticId:live.id,unlockSource:'gacha-first-ownership',unlockedAt:new Date('2026-01-02T03:04:05Z')}});
  await db.player.update({where:{id:archived.id},data:{status:'ARCHIVED'}});
  await expect(db.playerCosmetic.update({where:{playerId_cosmeticId:{playerId:archived.id,cosmeticId:live.id}},data:{acquisitionDateKnown:true}})).rejects.toThrow('PLAYER_ARCHIVED');
  await fixture.admin.query('ALTER TABLE player_cosmetics DROP COLUMN consulted_at, DROP COLUMN acquisition_date_known');
  const at=new Date('2026-01-02T03:04:05Z');
  await fixture.admin.query('INSERT INTO player_cosmetics(player_id,cosmetic_id,unlock_source,unlocked_at) VALUES ($1,$2,$3,$4),($1,$5,$6,$4)',[player.id,live.id,'gacha-first-ownership',at,historical.id,'PROFILE_LEVEL_BACKFILL_059']);
  await fixture.admin.query(readFileSync(new URL('../prisma/migrations/20261012190000_076_cosmetic_consultation/migration.sql',import.meta.url),'utf8'));
  const rows=await db.playerCosmetic.findMany({where:{playerId:player.id}});
  expect(rows).toHaveLength(2);for(const row of rows){expect(row.unlockedAt).toEqual(at);expect(row.consultedAt).toBeInstanceOf(Date)}
  expect(rows.find(row=>row.cosmeticId===live.id)?.acquisitionDateKnown).toBe(true);
  expect(rows.find(row=>row.cosmeticId===historical.id)?.acquisitionDateKnown).toBe(false);
  const archivedRow=await db.playerCosmetic.findUniqueOrThrow({where:{playerId_cosmeticId:{playerId:archived.id,cosmeticId:live.id}}});
  expect(archivedRow).toMatchObject({unlockedAt:at,acquisitionDateKnown:false});expect(archivedRow.consultedAt).toBeInstanceOf(Date);
  // Partial deployment left both columns present. Retrying the same SQL is
  // neutral for consultation and still never updates archived possessions.
  await db.playerCosmetic.update({where:{playerId_cosmeticId:{playerId:player.id,cosmeticId:live.id}},data:{consultedAt:null}});
  await fixture.admin.query(readFileSync(new URL('../prisma/migrations/20261012190000_076_cosmetic_consultation/migration.sql',import.meta.url),'utf8'));
  expect((await db.playerCosmetic.findUniqueOrThrow({where:{playerId_cosmeticId:{playerId:player.id,cosmeticId:live.id}}})).consultedAt).toBeNull();
  expect((await db.playerCosmetic.findUniqueOrThrow({where:{playerId_cosmeticId:{playerId:archived.id,cosmeticId:live.id}}})).acquisitionDateKnown).toBe(false);
  expect((await db.$queryRaw<{current_schema:string}[]>`SELECT current_schema()`)[0]?.current_schema).toBe(fixture.schema);
});
