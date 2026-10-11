import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { CatalogEngine } from '../src/application/character-catalog/catalog-engine.js';
import { CatalogSources, officialPlayableEvidence, parseOfficialPost } from '../src/infrastructure/character-catalog/catalog-sources.js';
import { mergeEvidence, normalizedIdentity, type CatalogFields, type Evidence } from '../src/application/character-catalog/catalog-policy.js';
import { PrismaGachaStore } from '../src/infrastructure/database/prisma-gacha-store.js';
import { publicPreparation } from '../src/application/character-catalog/catalog-progressive.js';
import { CatalogAdminService } from '../src/application/character-catalog/catalog-admin.js';
import type { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import type { AuthenticatedIdentity } from '../src/domain/identity/authenticated-identity.js';

const fixture=isolatedBatchDatabase(),db=fixture.database,now=new Date('2098-02-01T12:00:00Z');
beforeAll(()=>fixture.setup({prismaMigrations:true,seedPublicCatalog:true}),180_000);
afterAll(()=>fixture.cleanup(),60_000);
const proof=(value:string|number,reliability:Evidence['reliability']='OFFICIAL',url='https://www.hoyolab.com/article/987654321'):Evidence=>({value,reliability,provider:'hoyoverse',url,fetchedAt:now.toISOString()});
function fields(name:string):CatalogFields{return {originalName:proof(name),releaseDate:proof('2098-02-08')}};
async function candidate(name:string,extra:CatalogFields={}) {
  return db.catalogCandidate.create({data:{name,progressivePolicy:true,fields:{...fields(name),...extra},identities:{create:[{namespace:'official-name',externalId:normalizedIdentity(name)},{namespace:'hoyolab-post',externalId:randomUUID().replaceAll('-','')}]}}});
}
function runner() {return new CatalogEngine(db,{enabled:true,publish:true,dryRun:false},async url=>({url,status:404,mime:'text/plain',body:Buffer.alloc(0)}),()=>now);}
async function run(id:string,source:CatalogFields={}) {
  const discovery=vi.spyOn(CatalogSources.prototype,'discover').mockResolvedValue([]),structured=vi.spyOn(CatalogSources.prototype,'structured').mockResolvedValue({fields:source,images:{}});
  try{return await runner().run('retry',id);}finally{discovery.mockRestore();structured.mockRestore();}
}
async function attachOfficial(row:Awaited<ReturnType<typeof candidate>>){
  const post=await db.catalogIdentity.findFirstOrThrow({where:{candidateId:row.id,namespace:'hoyolab-post'}});
  // Exact official URL is derived from a verified source ID, not numeric Genshin identity.
  const id=String(BigInt(`0x${post.externalId.slice(0,12)}`));
  await db.catalogIdentity.update({where:{namespace_externalId:{namespace:'hoyolab-post',externalId:post.externalId}},data:{externalId:id}});
  const updated={...row.fields as CatalogFields,originalName:proof(row.name,'OFFICIAL',`https://www.hoyolab.com/article/${id}`)};
  return db.catalogCandidate.update({where:{id:row.id},data:{fields:updated}});
}

describe('private progressive catalogue migration and normal circuit',()=>{
  it('rehearses 073 in the Prisma ledger and preserves private RLS/browser denial',async()=>{
    expect(fixture.migrationStatus).toContain('up to date');
    const migrations=await fixture.admin.query(`SELECT migration_name FROM "${fixture.schema}"._prisma_migrations WHERE finished_at IS NOT NULL ORDER BY migration_name`);
    expect(migrations.rows.at(-1)?.migration_name).toBe('20261011190000_073_catalog_progressive');
    const result=await fixture.admin.query(`SELECT relrowsecurity,has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') AS anon,has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') AS auth FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname=$1 AND relname LIKE 'catalog_%' AND relkind='r'`,[fixture.schema]);
    expect(result.rows).toHaveLength(7);for(const row of result.rows)expect(row).toEqual({relrowsecurity:true,anon:false,auth:false});
  });
  it('migration changes only active private candidates and preserves historical rows exactly',async()=>{
    const scratch=`progressive_${randomUUID().replaceAll('-','')}`;
    await fixture.admin.query('BEGIN');
    try{
      await fixture.admin.query(`CREATE SCHEMA "${scratch}"; SET LOCAL search_path TO "${scratch}",public; CREATE TABLE catalog_candidates(id uuid PRIMARY KEY,character_id uuid,tracking_state text,fields jsonb,tracking_elements text[],revision int)`);
      const historical=randomUUID(),fresh=randomUUID(),paused=randomUUID();
      await fixture.admin.query(`INSERT INTO catalog_candidates VALUES($1,$2,'PROTECTED','{"untouched":true}','{}',7),($3,NULL,'ACTIVE','{}','{rarity}',0),($4,NULL,'PAUSED','{}','{}',2)`,[historical,randomUUID(),fresh,paused]);
      const before=(await fixture.admin.query('SELECT * FROM catalog_candidates WHERE id=$1',[historical])).rows[0];
      await fixture.admin.query(readFileSync('prisma/migrations/20261011190000_073_catalog_progressive/migration.sql','utf8'));
      expect((await fixture.admin.query('SELECT * FROM catalog_candidates WHERE id=$1',[historical])).rows[0]).toEqual({...before,progressive_policy:false});
      expect((await fixture.admin.query('SELECT progressive_policy FROM catalog_candidates WHERE id=$1',[fresh])).rows[0].progressive_policy).toBe(true);
      expect((await fixture.admin.query('SELECT progressive_policy FROM catalog_candidates WHERE id=$1',[paused])).rows[0].progressive_policy).toBe(false);
    }finally{await fixture.admin.query('ROLLBACK');}
  });
  it('exposes a partial candidate at J-7 through the real catalog store without Character or votes',async()=>{
    const row=await candidate('Private preparation');await run(row.id);
    expect(await db.catalogCandidate.findUniqueOrThrow({where:{id:row.id}})).toMatchObject({characterId:null,status:'INCOMPLETE',missing:expect.arrayContaining(['rarity','element'])});
    const loaded=await db.catalogCandidate.findUniqueOrThrow({where:{id:row.id},include:{assets:true}});
    expect(publicPreparation(loaded,now)).toMatchObject({rarity:null,elementKey:null,status:'PREPARATION'});
    // Store uses its real server clock, so this future fixture is still private there.
    expect((await new PrismaGachaStore(db).listPreparations()).some(value=>value.candidateId===row.id)).toBe(false);
    const currentFields={...loaded.fields as CatalogFields,releaseDate:proof(new Date().toISOString().slice(0,10))};
    await db.catalogCandidate.update({where:{id:row.id},data:{fields:currentFields}});
    const projection=(await new PrismaGachaStore(db).listPreparations()).find(value=>value.candidateId===row.id)!;
    expect(projection).toMatchObject({candidateId:row.id,rarity:null,elementKey:null});
    expect(Object.keys(projection).sort()).toEqual(['candidateId','elementKey','iconPath','name','provisional','rarity','releaseDate','status']);
    expect(await db.character.count({where:{name:row.name}})).toBe(0);
  });
  it('imports once under concurrent workers with qualified provisional consensus and no optional fields',async()=>{
    const admin=await db.player.create({data:{displayName:'Private progressive ADMIN',elementKey:'hydro'}});
    await db.playerRoleAssignment.create({data:{playerId:admin.id,role:'ADMIN',grantedByPlayerId:admin.id}});
    const row=await attachOfficial(await candidate('Private consensus activation',{element:proof('electro')}));
    const identity=normalizedIdentity(row.name);
    const consensus=['icy-veins','game8','sephijin'].reduce((result,publisher)=>mergeEvidence(result,'rarity',{value:4,provider:publisher,url:`https://${publisher}.test/private`,fetchedAt:now.toISOString(),reliability:'PROVISIONAL',consensusSource:{publisher,identity,qualified:true,observedAt:now.toISOString()}}),{} as CatalogFields);
    const historical=await db.character.findMany({where:{externalKey:{startsWith:'legacy:'}},orderBy:{id:'asc'}});
    const rotations=await db.bannerRotation.findMany({orderBy:{id:'asc'}}),slots=await db.bannerFeaturedCharacter.findMany({orderBy:[{bannerRotationId:'asc'},{characterId:'asc'}]});
    const discovery=vi.spyOn(CatalogSources.prototype,'discover').mockResolvedValue([]),structured=vi.spyOn(CatalogSources.prototype,'structured').mockResolvedValue({fields:consensus,images:{}});
    try{
      const outcomes=await Promise.all([runner().run('retry',row.id),runner().run('retry',row.id)]);
      expect(outcomes.some(value=>'skipped'in value&&value.skipped==='LEASE_BUSY')).toBe(true);
      const after=await db.catalogCandidate.findUniqueOrThrow({where:{id:row.id},include:{character:true}});
      expect(after).toMatchObject({trackingState:'ACTIVE',character:{externalKey:`catalog:${row.id}`,rarity:4,elementKey:'electro',iconPath:null,splashPath:null,weaponType:null,region:null},fields:{rarity:{reliability:'PROVISIONAL',qualification:'PROVISIONAL_CONSENSUS'}}});
      expect(after.characterId).not.toBeNull();
      const receipt=outcomes.find(value=>'runId'in value&&'processed'in value)!;
      if(!('runId'in receipt))throw Error('Run missing');
      expect(await runner().run('retry',row.id,receipt.runId)).toEqual({skipped:'ALREADY_COMPLETED'});
      await runner().run('retry',row.id);
      expect(await db.character.count({where:{externalKey:`catalog:${row.id}`}})).toBe(1);
      expect(await db.catalogImportOutbox.count({where:{candidateId:row.id}})).toBe(1);
      expect(await db.notification.count({where:{typeKey:'CHARACTER_IMPORTED_ADMIN',playerId:admin.id,actionTargetId:after.characterId}})).toBe(1);
      expect((await new PrismaGachaStore(db).listActiveCharacters()).find(value=>value.id===after.characterId)?.informationProvisional).toBe(true);
      expect(await db.character.findMany({where:{externalKey:{startsWith:'legacy:'}},orderBy:{id:'asc'}})).toEqual(historical);
      expect(historical).toHaveLength(120);
      expect(await db.bannerRotation.findMany({orderBy:{id:'asc'}})).toEqual(rotations);
      expect(await db.bannerFeaturedCharacter.findMany({orderBy:[{bannerRotationId:'asc'},{characterId:'asc'}]})).toEqual(slots);
      expect(await Promise.all([db.pullOperation.count(),db.pullResult.count(),db.playerCharacter.count(),db.resourceMovement.count()])).toEqual([0,0,0,0]);
    }finally{discovery.mockRestore();structured.mockRestore();}
  },60_000);
  it('continues targeted post-release enrichment, retains ADMIN locks, and never changes combat values',async()=>{
    const row=await db.catalogCandidate.findFirstOrThrow({where:{name:'Private consensus activation'}});
    await db.character.update({where:{id:row.characterId!},data:{region:'ADMIN region'}});
    await db.catalogCandidate.update({where:{id:row.id},data:{fields:{...row.fields as CatalogFields,releaseDate:proof('2097-01-01'),region:{...proof('ADMIN region','ADMIN'),locked:true,override:true}},trackingElements:['weapon','region','rarity']}});
    await run(row.id,{weapon:{...proof('Épée','STRUCTURED'),provider:'genshin-db'},region:{...proof('Other','STRUCTURED'),provider:'genshin-db'},rarity:{...proof(5,'OFFICIAL'),provider:'hoyoverse'}});
    const after=await db.catalogCandidate.findUniqueOrThrow({where:{id:row.id},include:{character:true}});
    expect(after).toMatchObject({trackingState:'ACTIVE',fields:{region:{value:'ADMIN region',locked:true}},character:{rarity:4,elementKey:'electro',weaponType:'Épée',region:'ADMIN region'}});
    const notice=await db.notification.findFirstOrThrow({where:{deduplicationKey:{startsWith:`catalog-review-group:${row.id}:`}}});
    expect(notice.payload).toMatchObject({title:expect.stringContaining('Intervention nécessaire'),expectedAction:expect.stringContaining('personnage actif')});
    await db.notification.update({where:{id:notice.id},data:{state:'ARCHIVED',archivedAt:new Date()}});
    await run(row.id);
    expect(await db.notification.findUniqueOrThrow({where:{id:notice.id}})).toMatchObject({state:'ARCHIVED'});
  });
  it('does not activate uncertain aliases or copied consensus and needs no fake date for actual released proof',async()=>{
    const row=await candidate('Private no date',{rarity:proof(5),element:proof('cryo'),releaseDate:undefined});
    const post=parseOfficialPost({post:{post_id:'77554433',uid:'1015537',game_id:2,created_at:now.getTime()/1000,subject:'Private release',structured_content:JSON.stringify([{insert:`◆Name: ${row.name}\n${row.name} is now available as a playable character.\n`}]),is_deleted:0},user:{uid:'1015537',certification:{type:1,desc:'Official Big Boss'}}},now);
    const evidence=officialPlayableEvidence(post,[row.name],now)!;
    await db.catalogCandidate.update({where:{id:row.id},data:{fields:{...row.fields as CatalogFields,originalName:post.fields.originalName!,playable:evidence}}});
    await run(row.id);expect((await db.catalogCandidate.findUniqueOrThrow({where:{id:row.id}})).characterId).toBeNull();
    await db.catalogIdentity.create({data:{candidateId:row.id,namespace:'hoyolab-post',externalId:post.id}});
    await run(row.id);
    expect(await db.catalogCandidate.findUniqueOrThrow({where:{id:row.id},include:{character:true}})).toMatchObject({character:{releaseDate:null,rarity:5,elementKey:'cryo'}});
    await expect(db.catalogIdentity.create({data:{candidateId:row.id,namespace:'official-name',externalId:normalizedIdentity('Private consensus activation')}})).rejects.toThrow();
  });
  it('quarantines a corrupt optional image without blocking activation or publishing a provisional name',async()=>{
    const row=await attachOfficial(await candidate('Private optional image',{rarity:proof(4),element:proof('hydro'),name:proof('Unconfirmed translation','PROVISIONAL')}));
    const asset=await db.catalogAsset.create({data:{candidateId:row.id,role:'icon',provider:'fixture',hash:'a'.repeat(64),url:`https://fixture.supabase.co/storage/v1/object/public/character-catalog/characters/${row.id}/icon/${'a'.repeat(64)}.png`,mime:'image/png',width:256,height:256,bytes:100,status:'AVAILABLE'}});
    const discovery=vi.spyOn(CatalogSources.prototype,'discover').mockResolvedValue([]),structured=vi.spyOn(CatalogSources.prototype,'structured').mockResolvedValue(null);
    const worker=new CatalogEngine(db,{enabled:true,publish:true,dryRun:false,storageUrl:'https://fixture.supabase.co',storageKey:'synthetic-private'},async url=>({url,status:200,mime:'image/png',body:Buffer.from('corrupt')}),()=>now);
    try{await worker.run('retry',row.id);}finally{discovery.mockRestore();structured.mockRestore();}
    expect(await db.catalogCandidate.findUniqueOrThrow({where:{id:row.id},include:{character:true}})).toMatchObject({character:{name:row.name,iconPath:null,rarity:4,elementKey:'hydro'}});
    expect(await db.catalogAsset.findUniqueOrThrow({where:{id:asset.id}})).toMatchObject({status:'UNVERIFIED',hash:'a'.repeat(64)});
    expect(await db.catalogAttempt.count({where:{candidateId:row.id,errorCode:'STORAGE_VERIFICATION_FAILED'}})).toBe(1);
  });
  it('resumes only explicitly selected historical elements under ADMIN authority',async()=>{
    const discovery=vi.spyOn(CatalogSources.prototype,'discover').mockResolvedValue([]),structured=vi.spyOn(CatalogSources.prototype,'structured').mockResolvedValue(null);
    try{await runner().run('retry');}finally{discovery.mockRestore();structured.mockRestore();}
    const protectedRows=await db.catalogCandidate.findMany({where:{character:{externalKey:{startsWith:'legacy:'}}}});
    expect(protectedRows).toHaveLength(120);expect(protectedRows.every(row=>row.trackingState==='PROTECTED'&&!row.progressivePolicy&&!row.trackingElements.length)).toBe(true);
    const actor=await db.player.findFirstOrThrow({where:{displayName:'Private progressive ADMIN'}});
    const admin=new CatalogAdminService(db,{execute:async()=>actor} as unknown as GetCurrentPlayer,runner());
    const row=protectedRows[0]!;
    await admin.tracking({} as AuthenticatedIdentity,row.id,'resume',['weapon'],'Private targeted authorization',row.revision,randomUUID());
    expect(await db.catalogCandidate.findUniqueOrThrow({where:{id:row.id}})).toMatchObject({progressivePolicy:true,trackingState:'ACTIVE',trackingElements:['weapon']});
    expect(await db.catalogCandidate.count({where:{character:{externalKey:{startsWith:'legacy:'}},trackingState:'PROTECTED'}})).toBe(119);
  },60_000);
});
