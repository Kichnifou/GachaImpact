import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {readFileSync} from 'node:fs';
import sharp from 'sharp';
import { validateImage } from '../src/infrastructure/character-catalog/catalog-images.js';
import type { CatalogFields } from '../src/application/character-catalog/catalog-policy.js';
import { CatalogFetchError } from '../src/infrastructure/character-catalog/catalog-http.js';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { CatalogEngine } from '../src/application/character-catalog/catalog-engine.js';
import { CatalogAdminService } from '../src/application/character-catalog/catalog-admin.js';
import { CatalogScheduler } from '../src/application/character-catalog/catalog-scheduler.js';
import { getNextBusinessResetAt } from '../src/domain/time/business-date.js';
import type { CatalogHttp } from '../src/infrastructure/character-catalog/catalog-http.js';
import type { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import type { AuthenticatedIdentity } from '../src/domain/identity/authenticated-identity.js';
import { applyReleaseDatePlan } from '../src/application/character-catalog/catalog-date-backfill.js';
import { canCollect } from '../src/application/character-catalog/catalog-followup.js';
import { recordImageVersion } from '../src/application/character-catalog/catalog-image-version.js';
import { CatalogSources } from '../src/infrastructure/character-catalog/catalog-sources.js';
import { vi } from 'vitest';
import { notifyCatalogReview } from '../src/application/character-catalog/catalog-notifications.js';
import { planCatalogNotificationReconcile,reconcileCatalogNotifications } from '../src/application/character-catalog/catalog-notification-reconcile.js';

const fixture = isolatedBatchDatabase(), db = fixture.database;
beforeAll(() => fixture.setup({ prismaMigrations: true, seedPublicCatalog: true }), 180_000);
afterAll(() => fixture.cleanup(), 60_000);
const official = { post: { post_id: '46884007', uid: '1015537', game_id: 2, created_at: 1790654467, subject: 'Fixture official',
  structured_content: JSON.stringify([{ insert: '◆Name: Private Catalog\n◆Vision: Electro\n' }]), is_deleted: 0 },
  user: { uid: '1015537', certification: { type: 1, desc: 'Official Big Boss' } } };
const http: CatalogHttp = async url => {
  let value: unknown;
  if (url.includes('getNewsList')) value = { retcode: 0, data: { list: [official], last_id: 0, is_last: true } };
  else if (url.includes('getPostFull')) value = { retcode: 0, data: { post: official } };
  else if (url.includes('commits/main')) value = { sha: 'a'.repeat(40) };
  else if (url.includes('/contents/')) value = Array.from({ length: 100 }, (_, i) => ({ name: `unused-${i}.json`, download_url: null }));
  else if (url.endsWith('/characters')) value = ['old-coverage'];
  else return { status: 404, body: Buffer.alloc(0), mime: 'text/plain', url };
  return { status: 200, body: Buffer.from(JSON.stringify(value)), mime: 'application/json', url };
};
const engine = () => new CatalogEngine(db, { enabled: true, publish: false, dryRun: false }, http);

describe('isolated catalogue migration, durable cycles and invariants', () => {
  it('persists a fresh contradictory proof once, blocks eligibility and retains it on replay',async()=>{
    const evidence={value:5,provider:'genshin-db',url:'https://fixture.test/rarity',fetchedAt:new Date().toISOString(),reliability:'STRUCTURED' as const};
    const candidate=await db.catalogCandidate.create({data:{name:'Private conflict replay',trackingElements:['rarity'],fields:{rarity:evidence}}});
    const structured=vi.spyOn(CatalogSources.prototype,'structured').mockResolvedValue({fields:{rarity:{...evidence,value:4}},images:{}});
    const discovery=vi.spyOn(CatalogSources.prototype,'discover').mockResolvedValue([]);
    try{
      expect(await engine().run('retry',candidate.id)).toMatchObject({changed:1});
      const after=await db.catalogCandidate.findUniqueOrThrow({where:{id:candidate.id}});
      expect(after).toMatchObject({status:'CONFLICT',fields:{rarity:{value:5,conflict:true,alternatives:[{value:4}]}}});
      expect(await db.catalogAttempt.count({where:{candidateId:candidate.id,outcome:'CONFLICT'}})).toBe(1);
      expect(await engine().run('retry',candidate.id)).toMatchObject({changed:0});
      expect((await db.catalogCandidate.findUniqueOrThrow({where:{id:candidate.id}})).fields).toEqual(after.fields);
    }finally{structured.mockRestore();discovery.mockRestore();await db.catalogAttempt.deleteMany({where:{candidateId:candidate.id}});await db.catalogCandidate.delete({where:{id:candidate.id}});}
  });
  it('replays all versioned migrations and protects the seven new tables from browser roles', async () => {
    expect(fixture.migrationStatus).toContain('up to date');
    const rows = await fixture.admin.query(`SELECT c.relname, c.relrowsecurity, has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE') AS anon, has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') AS auth FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname=$1 AND c.relname LIKE 'catalog_%' AND c.relkind='r'`, [fixture.schema]);
    expect(rows.rows).toHaveLength(7);
    for (const row of rows.rows) expect(row).toMatchObject({ relrowsecurity: true, anon: false, auth: false });
  });
  it('counts a newly decoded promotion once and never exposes it as a playable image',async()=>{
    const candidate=await db.catalogCandidate.create({data:{name:'Private promotion count',trackingElements:['promotion']}});
    const body=await sharp({create:{width:128,height:128,channels:4,background:{r:70,g:100,b:190,alpha:1}}}).png().toBuffer();
    const url='https://fixture.test/promotion.png';
    await db.catalogAsset.create({data:{candidateId:candidate.id,role:'promotion',provider:'hoyoverse',sourceUrl:url,status:'UNVERIFIED'}});
    const discovery=vi.spyOn(CatalogSources.prototype,'discover').mockResolvedValue([]);
    const structured=vi.spyOn(CatalogSources.prototype,'structured').mockResolvedValue(null);
    const runner=new CatalogEngine(db,{enabled:false,publish:false,dryRun:false},async target=>({status:200,mime:'image/png',body,url:target}));
    try{
      expect(await runner.run('retry',candidate.id)).toMatchObject({changed:1});
      expect(await db.catalogAsset.findFirstOrThrow({where:{candidateId:candidate.id}})).toMatchObject({status:'SOURCE_VALIDATED',role:'promotion',url:null,officialConfirmed:true});
      expect(await runner.run('retry',candidate.id)).toMatchObject({changed:0});
    }finally{discovery.mockRestore();structured.mockRestore();await db.catalogAttempt.deleteMany({where:{candidateId:candidate.id}});await db.catalogAsset.deleteMany({where:{candidateId:candidate.id}});await db.catalogCandidate.delete({where:{id:candidate.id}});}
  });
  it('rejects AVAILABLE assets with null dimensions, bytes or MIME at the SQL boundary', async () => {
    const candidate = await db.catalogCandidate.create({ data: { name: 'Private SQL constraint', nextCheckAt: new Date('2099-01-01T00:00:00Z') } });
    try {
      for (const field of ['width', 'height', 'bytes', 'mime'] as const) {
        await expect(db.catalogAsset.create({ data: { candidateId: candidate.id, role: 'icon', hash: 'a'.repeat(64),
          url: 'https://fixture.supabase.co/storage/v1/object/public/character-catalog/fixture.png', provider: 'fixture',
          status: 'AVAILABLE', width: 256, height: 256, bytes: 100, mime: 'image/png', [field]: null } })).rejects.toThrow();
      }
      expect(await db.catalogAsset.count({ where: { candidateId: candidate.id } })).toBe(0);
    } finally { await db.catalogCandidate.delete({ where: { id: candidate.id } }); }
  });
  it('migration071 preserves an existing cycle but recalculates its obsolete historical remainder',async()=>{
    const schema=`followup_${randomUUID().replaceAll('-','')}`;
    await fixture.admin.query('BEGIN');
    try{
      await fixture.admin.query(`CREATE SCHEMA "${schema}"; SET LOCAL search_path TO "${schema}",public;
        CREATE TABLE catalog_candidates(id uuid PRIMARY KEY,character_id uuid,revision int DEFAULT 0,next_check_at timestamptz DEFAULT CURRENT_TIMESTAMP,fields jsonb DEFAULT '{}');
        CREATE TABLE catalog_assets(candidate_id uuid);
        CREATE TABLE catalog_runs(status text,cycle_key text,summary jsonb);`);
      const historical=randomUUID(),fresh=randomUUID();
      await fixture.admin.query('INSERT INTO catalog_candidates(id,character_id) VALUES ($1,$2),($3,NULL)',[historical,randomUUID(),fresh]);
      await fixture.admin.query("INSERT INTO catalog_runs VALUES ('QUEUED','daily:2026-10-11',$1)",[JSON.stringify({remaining:107,processedCandidateIds:[historical],dailyCutoff:'2099-01-01T00:00:00Z'})]);
      await fixture.admin.query(readFileSync('prisma/migrations/20261011090000_071_protect_catalog_followup/migration.sql','utf8'));
      expect((await fixture.admin.query('SELECT tracking_state,tracking_elements FROM catalog_candidates WHERE id=$1',[historical])).rows[0]).toEqual({tracking_state:'PROTECTED',tracking_elements:[]});
      expect((await fixture.admin.query('SELECT summary FROM catalog_runs')).rows[0].summary).toMatchObject({previousRemaining:107,remaining:1,processedCandidateIds:[historical],scopeRecalculationRequired:true});
    }finally{await fixture.admin.query('ROLLBACK');}
  });
  it('two instances discover once; completed replay changes no active Character', async () => {
    const before = await db.character.findMany({ orderBy: { id: 'asc' } });
    const result = await Promise.all([engine().run(), engine().run()]);
    expect(result.some(value => 'skipped' in value && value.skipped === 'LEASE_BUSY')).toBe(true);
    expect(await db.catalogIdentity.count({ where: { namespace: 'hoyolab-post', externalId: '46884007' } })).toBe(1);
    expect(await db.catalogCandidate.count({ where: { name: 'Private Catalog' } })).toBe(1);
    const daily = await db.catalogRun.findFirstOrThrow({ where: { cycleKey: { startsWith: 'daily:' } } });
    expect(daily.status).toBe('COMPLETED');
    expect(daily.summary).toMatchObject({processed:1,remaining:0,selectionPolicy:'protected-v1'});
    expect(await db.catalogCandidate.count({where:{characterId:{not:null},trackingState:'PROTECTED',trackingElements:{isEmpty:true},checkedAt:null}})).toBe(before.length);
    expect(await db.catalogRun.count({ where: { cycleKey: { startsWith: 'daily:' } } })).toBe(1);
    expect((await db.catalogRun.findUniqueOrThrow({ where: { id: daily.id } })).status).toBe('COMPLETED');
    expect(await engine().run()).toEqual({ skipped: 'ALREADY_COMPLETED' });
    expect(await db.character.findMany({ orderBy: { id: 'asc' } })).toEqual(before);
    expect(await db.catalogImportOutbox.count()).toBe(0);
  }, 300_000);
  it('missing fundamentals are durable and a manual retry remains idempotent', async () => {
    const candidate = await db.catalogCandidate.findFirstOrThrow({ where: { name: 'Private Catalog' } });
    expect(candidate.characterId).toBeNull(); expect(candidate.missing).toEqual(expect.arrayContaining(['rarity', 'officialReleaseDate', 'icon']));
    expect(candidate.nextCheckAt.getTime()).toBeGreaterThan(candidate.checkedAt!.getTime());
    expect(candidate.nextCheckAt).toEqual(getNextBusinessResetAt(candidate.checkedAt!));
    const requestId = randomUUID();
    const run = await db.catalogRun.create({ data: { cycleKey: `manual:${requestId}`, status: 'QUEUED', summary: { candidateId: candidate.id, mode: 'retry' } } });
    await engine().run('retry', candidate.id, run.id);
    expect(await engine().run('retry', candidate.id, run.id)).toEqual({ skipped: 'ALREADY_COMPLETED' });
    expect(await db.catalogCandidate.count({ where: { name: 'Private Catalog' } })).toBe(1);
    expect(await db.catalogAttempt.count({ where: { candidateId: candidate.id, errorCode: 'COVERAGE_UNQUALIFIED' } })).toBeGreaterThan(0);
  }, 60_000);
  it('reaudit writes its report and attempts without changing metadata/assets/Character', async () => {
    const candidate = await db.catalogCandidate.findFirstOrThrow({ where: { name: 'Private Catalog' } });
    const before = await db.catalogCandidate.findUniqueOrThrow({ where: { id: candidate.id }, include: { assets: true } });
    await engine().run('audit', candidate.id);
    expect(await db.catalogCandidate.findUniqueOrThrow({ where: { id: candidate.id }, include: { assets: true } })).toEqual(before);
  }, 60_000);
  it('expired leases are recovered; a live lease cannot be stolen', async () => {
    const token = randomUUID();
    await db.catalogJob.update({ where: { id: 'R1051' }, data: { leaseToken: token, leaseUntil: new Date(Date.now() + 60_000) } });
    expect(await engine().run()).toEqual({ skipped: 'LEASE_BUSY' });
    await db.catalogJob.update({ where: { id: 'R1051' }, data: { leaseUntil: new Date(Date.now() - 1000) } });
    expect(await engine().run()).toEqual({ skipped: 'ALREADY_COMPLETED' });
    expect(await db.catalogJob.findUnique({ where: { id: 'R1051' } })).toMatchObject({ leaseToken: null, leaseUntil: null });
  });
  it('scheduler catches up once for today after missed dates, independent of player activity', async () => {
    const job = await db.catalogJob.findUniqueOrThrow({ where: { id: 'R1051' } });
    const runs = await db.catalogRun.count();
    await new CatalogScheduler(db, engine()).catchUp();
    expect(await db.catalogRun.count()).toBe(runs);
    expect((await db.catalogJob.findUniqueOrThrow({ where: { id: 'R1051' } })).lastSuccessDate).toBe(job.lastSuccessDate);
  });
  it('ADMIN permissions are checked; metadata corrections survive retry and cannot bypass a publication gate', async () => {
    const player = await db.player.create({ data: { displayName: 'Private catalog admin', elementKey: 'hydro' } });
    const getPlayer = { execute: async () => player } as unknown as GetCurrentPlayer;
    const identity = {} as AuthenticatedIdentity;
    const admin = new CatalogAdminService(db, getPlayer, engine());
    const candidate = await db.catalogCandidate.findFirstOrThrow({ where: { name: 'Private Catalog' } });
    await expect(admin.overview(identity)).rejects.toMatchObject({ statusCode: 403 });
    await db.playerRoleAssignment.create({ data: { playerId: player.id, role: 'ADMIN', grantedByPlayerId: player.id } });
    await admin.edit(identity, candidate.id, { rarity: 4 }, randomUUID());
    await engine().run('retry', candidate.id);
    expect((await db.catalogCandidate.findUniqueOrThrow({ where: { id: candidate.id } })).fields).toMatchObject({ rarity: { value: 4, override: true } });
    await expect(admin.override(identity, candidate.id, randomUUID(), 'Private controlled reason', 0)).rejects.toMatchObject({ code: 'CATALOG_PUBLICATION_DISABLED' });
  }, 60_000);
  it('notifications come only from a committed outbox, deduplicate and target only current ADMIN', async () => {
    const candidate = await db.catalogCandidate.findFirstOrThrow({ where: { characterId: { not: null } } });
    const ordinary = await db.player.create({ data: { displayName: 'Private ordinary', elementKey: 'hydro' } });
    await db.catalogImportOutbox.create({ data: { candidateId: candidate.id, characterId: candidate.characterId!, name: 'Private notification', payload: { title: 'Nouveau personnage ajouté : Private notification' } } });
    await Promise.all([engine().deliverNotifications(), engine().deliverNotifications()]);
    expect(await db.notification.count({ where: { typeKey: 'CHARACTER_IMPORTED_ADMIN', playerId: ordinary.id } })).toBe(0);
    expect(await db.notification.count({ where: { typeKey: 'CHARACTER_IMPORTED_ADMIN' } })).toBe(1);
    await engine().deliverNotifications(); expect(await db.notification.count({ where: { typeKey: 'CHARACTER_IMPORTED_ADMIN' } })).toBe(1);
  });
  it('verifies public bytes, rolls back a failed publication, then imports once with a committed outbox', async () => {
    const now = new Date(), fields: CatalogFields = {};
    for (const [key, value] of [['originalName', 'Private Publish'], ['rarity', 5], ['element', 'electro'], ['numericId', 19999998], ['releaseDate', '2026-01-01']] as const)
      fields[key] = { value, provider: 'fixture', url: 'https://www.hoyolab.com/article/1', reliability: 'OFFICIAL', fetchedAt: now.toISOString() };
    const candidate = await db.catalogCandidate.create({ data: { name: 'Private Publish', fields, identities: { create: { namespace: 'genshin', externalId: '19999998' } } } });
    const bytes = new Map<string, Buffer>();
    for (const role of ['icon', 'splash'] as const) {
      const body = await sharp({ create: { width: role === 'icon' ? 256 : 1024, height: role === 'icon' ? 256 : 512, channels: 4, background: { r: 100, g: 180, b: 200, alpha: .8 } } }).png().toBuffer();
      const image = await validateImage(body, 'image/png', role);
      const url = `https://fixture.supabase.co/storage/v1/object/public/character-catalog/characters/${candidate.id}/${role}/${image.hash}.png`;
      bytes.set(url, image.body);
      await db.catalogAsset.create({ data: { candidateId: candidate.id, role, hash: image.hash, provider: 'fixture', url, mime: 'image/png', width: image.width, height: image.height, bytes: image.bytes, status: 'AVAILABLE' } });
    }
    const publisher = new CatalogEngine(db, { enabled: true, publish: true, dryRun: false, storageUrl: 'https://fixture.supabase.co', storageKey: 'private_fixture' },
      async url => ({ status: 200, mime: 'image/png', body: bytes.get(url) ?? Buffer.from('wrong'), url }));
    const verified = await publisher.verifyPublication(candidate.id);
    const count = await db.character.count(), notices = await db.notification.count({ where: { typeKey: 'CHARACTER_IMPORTED_ADMIN' } });
    await expect(db.$transaction(async tx => { await publisher.publish(tx, candidate, fields, false, verified); throw new Error('rollback fixture'); })).rejects.toThrow('rollback fixture');
    expect(await db.character.count()).toBe(count);
    expect(await db.catalogImportOutbox.findUnique({ where: { candidateId: candidate.id } })).toBeNull();
    await publisher.deliverNotifications(); expect(await db.notification.count({ where: { typeKey: 'CHARACTER_IMPORTED_ADMIN' } })).toBe(notices);
    await db.$transaction(tx => publisher.publish(tx, candidate, fields, false, verified));
    const published = await db.catalogCandidate.findUniqueOrThrow({ where: { id: candidate.id } });
    expect(published.characterId).not.toBeNull(); expect(await db.character.count()).toBe(count + 1);
    expect(published).toMatchObject({trackingState:'PROTECTED',trackingElements:[]});
    await expect(db.$transaction(tx => publisher.publish(tx, published, fields, false, verified))).rejects.toThrow('FICHE_PROTEGEE');
    await Promise.all([publisher.deliverNotifications(), publisher.deliverNotifications()]);
    expect(await db.catalogImportOutbox.count({ where: { candidateId: candidate.id } })).toBe(1);
    expect(await db.notification.count({ where: { typeKey: 'CHARACTER_IMPORTED_ADMIN', actionTargetId: published.characterId! } })).toBe(1);
    bytes.set([...bytes.keys()][0]!, Buffer.from('changed'));
    await expect(publisher.verifyPublication(candidate.id)).rejects.toThrow('STORAGE_VERIFICATION_FAILED');
  }, 60_000);
  it('backs off failed manual work durably and resumes it after a process restart', async () => {
    const candidate = await db.catalogCandidate.findFirstOrThrow({ where: { name: 'Private Catalog' } });
    const run = await db.catalogRun.create({ data: { cycleKey: `manual:${randomUUID()}`, status: 'QUEUED', summary: { candidateId: candidate.id, mode: 'audit' } } });
    const failing = new CatalogEngine(db, { enabled: true, publish: false, dryRun: false }, async () => { throw new CatalogFetchError('BUDGET_EXHAUSTED'); });
    await expect(failing.run('audit', candidate.id, run.id)).rejects.toThrow('BUDGET_EXHAUSTED');
    expect(await db.catalogRun.findUniqueOrThrow({ where: { id: run.id } })).toMatchObject({ status: 'FAILED', failureCount: 1, summary: { mode: 'audit', candidateId: candidate.id } });
    expect(await engine().run('audit', candidate.id, run.id)).toEqual({ skipped: 'BACKOFF' });
    await db.catalogRun.update({ where: { id: run.id }, data: { nextAttemptAt: new Date(Date.now() - 1000) } });
    await new CatalogScheduler(db, engine()).catchUp();
    expect(await db.catalogRun.findUniqueOrThrow({ where: { id: run.id } })).toMatchObject({ status: 'COMPLETED', failureCount: 0 });
  }, 60_000);
  it('never requests a protected fiche; ADMIN reopens exactly one image role with a revision guard', async () => {
    const candidate=await db.catalogCandidate.findFirstOrThrow({where:{characterId:{not:null}}});
    let requests=0;
    const guarded=new CatalogEngine(db,{enabled:false,publish:false,dryRun:false},async url=>{requests++;return http(url);});
    expect(await guarded.run('retry',candidate.id)).toMatchObject({processed:0,changed:0});
    expect(requests).toBe(0);
    const player=await db.player.findFirstOrThrow({where:{displayName:'Private catalog admin'}});
    const admin=new CatalogAdminService(db,{execute:async()=>player} as unknown as GetCurrentPlayer,guarded);
    await admin.tracking({} as AuthenticatedIdentity,candidate.id,'resume',['icon'],'Réouverture portrait seulement',candidate.revision,randomUUID());
    const reopened=await db.catalogCandidate.findUniqueOrThrow({where:{id:candidate.id}});
    expect(reopened).toMatchObject({trackingState:'ACTIVE',trackingElements:['icon'],fields:candidate.fields});
    expect(canCollect(reopened,'icon')).toBe(true);expect(canCollect(reopened,'rarity')).toBe(false);
    await expect(admin.tracking({} as AuthenticatedIdentity,candidate.id,'resume',['splash'],'Ancienne révision interdite',candidate.revision,randomUUID())).rejects.toMatchObject({code:'CATALOG_REVISION_CONFLICT'});
    await admin.tracking({} as AuthenticatedIdentity,candidate.id,'protect',[],'Fin de la recette privée',reopened.revision,randomUUID());
  });
  it('rechecks a lock placed while a provider request is in flight, without overwriting ADMIN evidence',async()=>{
    const proof={value:5,provider:'fixture',url:'https://www.hoyolab.com/article/1',reliability:'STRUCTURED' as const,fetchedAt:new Date().toISOString()};
    const candidate=await db.catalogCandidate.create({data:{name:'Private race',fields:{rarity:proof}}});
    let changed=false;
    const racing=new CatalogEngine(db,{enabled:true,publish:false,dryRun:false},async url=>{
      if(!changed&&url.includes('commits/main')){changed=true;await db.catalogCandidate.update({where:{id:candidate.id},data:{fields:{rarity:{...proof,value:4,locked:true,adminValidated:true,reliability:'ADMIN',override:true}},revision:{increment:1}}});}
      return http(url);
    });
    await racing.run('retry',candidate.id);
    expect((await db.catalogCandidate.findUniqueOrThrow({where:{id:candidate.id}})).fields).toMatchObject({rarity:{value:4,locked:true,override:true}});
    expect(await db.catalogAttempt.count({where:{candidateId:candidate.id,errorCode:'REVISION_CHANGED'}})).toBe(1);
    await db.catalogAttempt.deleteMany({where:{candidateId:candidate.id}});
    await db.catalogCandidate.delete({where:{id:candidate.id}});
  });
  it('stops an already-published official release before dedicated HTTP, retaining provisional statuses',async()=>{
    const candidate=await db.catalogCandidate.findFirstOrThrow({where:{characterId:{not:null},trackingState:'PROTECTED'}});
    const fields={...(candidate.fields as CatalogFields),releaseDate:{value:'2026-01-01',provider:'hoyoverse',url:'https://www.hoyolab.com/article/1',reliability:'OFFICIAL' as const,fetchedAt:new Date().toISOString()},weapon:{value:'Sword',provider:'icy-veins',url:'https://www.icy-veins.com/',reliability:'PROVISIONAL' as const,fetchedAt:new Date().toISOString()}};
    const active=await db.catalogCandidate.update({where:{id:candidate.id},data:{fields,trackingState:'ACTIVE',trackingElements:['icon']}});
    let requests=0;
    await new CatalogEngine(db,{enabled:true,publish:false,dryRun:false},async url=>{requests++;return http(url);}).run('retry',candidate.id);
    expect(requests).toBe(0);
    expect(await db.catalogCandidate.findUniqueOrThrow({where:{id:candidate.id}})).toMatchObject({trackingState:'PROTECTED',trackingElements:[],fields:{weapon:{reliability:'PROVISIONAL'}}});
    expect(active.characterId).not.toBeNull();
  });
  it('applies a date plan only to NULL releaseDate, retains protection and replays without changes',async()=>{
    const seed=await db.character.findFirstOrThrow();
    const candidate=await db.catalogCandidate.upsert({where:{characterId:seed.id},create:{characterId:seed.id,name:seed.name,trackingState:'PROTECTED',trackingElements:[]},update:{}});
    const before=await db.character.findUniqueOrThrow({where:{id:candidate.characterId!}});
    await db.character.update({where:{id:before.id},data:{releaseDate:null}});
    const snapshot=await db.character.findUniqueOrThrow({where:{id:before.id}});
    const plan={version:1,operation:'R1051_RELEASE_DATE_NULL_ONLY',sourceUrl:'https://game8.co/games/Genshin-Impact/archives/307054',fetchedAt:new Date().toISOString(),sourceSha256:'a'.repeat(64),entries:[{id:before.id,name:before.name,externalKey:before.externalKey,rarity:before.rarity,element:before.elementKey,releaseDate:'2022-01-05'}]};
    expect(await applyReleaseDatePlan(db,plan)).toMatchObject({updated:1,trackingReopened:0});
    const after=await db.character.findUniqueOrThrow({where:{id:before.id}});
    expect({...after,releaseDate:snapshot.releaseDate,updatedAt:snapshot.updatedAt}).toEqual(snapshot);
    expect(await db.catalogCandidate.findUniqueOrThrow({where:{id:candidate.id}})).toMatchObject({trackingState:'PROTECTED',trackingElements:[],fields:{releaseDate:{locked:true,reliability:'STRUCTURED'}}});
    expect(await applyReleaseDatePlan(db,plan)).toMatchObject({updated:0,alreadyDated:1});
    expect(await db.character.findUniqueOrThrow({where:{id:before.id}})).toEqual(after);
    const correction={...plan,operation:'R1051_RELEASE_DATE_REVIEWED_CORRECTION',entries:[{...plan.entries[0]!,expectedCurrentDate:'2022-01-06',releaseDate:'2022-01-07',provider:'playstation-hoyoverse',sourceUrl:'https://blog.playstation.com/2021/07/09/genshin-impact-version-2-0-all-about-inazuma/'}]};
    await expect(applyReleaseDatePlan(db,correction)).rejects.toThrow('BACKFILL_EXPECTED_DATE_CHANGED');
    expect(await db.character.findUniqueOrThrow({where:{id:before.id}})).toEqual(after);
    correction.entries[0]!.expectedCurrentDate='2022-01-05';
    expect(await applyReleaseDatePlan(db,correction)).toMatchObject({updated:1});
    expect(await applyReleaseDatePlan(db,correction)).toMatchObject({updated:0,alreadyDated:1});
  });
  it('keeps immutable image versions while selecting a replacement and supports a safe replay',async()=>{
    const candidate=await db.catalogCandidate.create({data:{name:'Private image replacement'}});
    const versions:Parameters<typeof recordImageVersion>[1][]=[];
    for(const r of [30,60]){
      const body=await sharp({create:{width:256,height:256,channels:4,background:{r,g:140,b:200,alpha:.8}}}).png().toBuffer();
      const image=await validateImage(body,'image/png','icon');
      const input={candidateId:candidate.id,role:'icon' as const,image,provider:'icy-veins',sourceUrl:'https://static.icy-veins.com/fixture.webp',sourceMime:'image/png',url:`https://fixture.supabase.co/${image.hash}.png`,editorialStatus:'PROVISIONAL' as const,now:new Date()};
      versions.push(input);expect((await db.$transaction(tx=>recordImageVersion(tx,input))).changed).toBe(true);
    }
    expect(await db.catalogAsset.count({where:{candidateId:candidate.id}})).toBe(2);
    expect((await db.$transaction(tx=>recordImageVersion(tx,versions[1]!))).changed).toBe(false);
    expect(await db.catalogAsset.count({where:{candidateId:candidate.id}})).toBe(2);
    await db.catalogAsset.deleteMany({where:{candidateId:candidate.id}});
    await db.catalogCandidate.delete({where:{id:candidate.id}});
  });
  it('dispatches an explicit global manual task while daily automation is OFF, ignoring due-date gates',async()=>{
    const candidate=await db.catalogCandidate.findFirstOrThrow({where:{name:'Private Catalog'}});
    await db.catalogCandidate.update({where:{id:candidate.id},data:{nextCheckAt:new Date('2099-01-01T00:00:00Z')}});
    const off=new CatalogEngine(db,{enabled:false,publish:false,dryRun:true},http);
    const player=await db.player.findFirstOrThrow({where:{displayName:'Private catalog admin'}});
    const admin=new CatalogAdminService(db,{execute:async()=>player} as unknown as GetCurrentPlayer,off);
    const key=randomUUID();
    await admin.queue({} as AuthenticatedIdentity,null,'retry',key);
    const before=await db.character.findMany({orderBy:{id:'asc'}});
    await new CatalogScheduler(db,off).catchUp();
    expect(await db.catalogRun.findUniqueOrThrow({where:{cycleKey:`manual:${key}`}})).toMatchObject({status:'COMPLETED',summary:{mode:'retry',dryRun:false,processed:1}});
    expect(await db.character.findMany({orderBy:{id:'asc'}})).toEqual(before);
  });
  it('resumes all dry-run batches without altering candidates, assets or active Characters', async () => {
    const now = new Date(Date.now() + 86_400_000);
    await db.catalogCandidate.updateMany({ data: { nextCheckAt: new Date(now.getTime() + 86_400_000) } });
    await db.catalogCandidate.createMany({ data: Array.from({ length: 16 }, (_, i) => ({ name: `Private dry run ${i}` })) });
    const before = await db.catalogCandidate.findMany({ orderBy: { id: 'asc' }, include: { assets: true } });
    const characters = await db.character.findMany({ orderBy: { id: 'asc' } });
    const simulation = () => new CatalogEngine(db, { enabled: true, publish: false, dryRun: true }, http, () => now);
    const first = await simulation().run();
    expect(first).toMatchObject({ processed: 15, remaining: 1 });
    if (!('runId' in first)) throw new Error('Expected daily run');
    expect(await simulation().run()).toEqual({ skipped: 'BACKOFF' });
    await db.catalogRun.update({ where: { id: first.runId }, data: { nextAttemptAt: new Date(0) } });
    expect(await simulation().run()).toMatchObject({ runId: first.runId, processed: 1, remaining: 0 });
    expect(await simulation().run()).toEqual({ skipped: 'ALREADY_COMPLETED' });
    expect(await db.catalogCandidate.findMany({ orderBy: { id: 'asc' }, include: { assets: true } })).toEqual(before);
    expect(await db.character.findMany({ orderBy: { id: 'asc' } })).toEqual(characters);
    const run = await db.catalogRun.findUniqueOrThrow({ where: { id: first.runId } });
    expect((run.summary as { processedCandidateIds: string[] }).processedCandidateIds).toHaveLength(16);
  }, 90_000);
  it('admits exactly one concurrent ADMIN request, replays its key and cancels the queued work durably',async()=>{
    const player=await db.player.findFirstOrThrow({where:{displayName:'Private catalog admin'}});
    const admin=new CatalogAdminService(db,{execute:async()=>player} as unknown as GetCurrentPlayer,engine());
    const secondPlayer=await db.player.create({data:{displayName:'Private concurrent ADMIN',elementKey:'hydro'}});
    const secondRole=await db.playerRoleAssignment.create({data:{playerId:secondPlayer.id,role:'ADMIN',grantedByPlayerId:player.id}});
    const secondAdmin=new CatalogAdminService(db,{execute:async()=>secondPlayer} as unknown as GetCurrentPlayer,engine());
    const identity={} as AuthenticatedIdentity,key=randomUUID(),otherKey=randomUUID();
    const results=await Promise.allSettled([admin.queue(identity,null,'retry',key),secondAdmin.queue(identity,null,'audit',otherKey)]);
    expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);
    expect(results.find(result=>result.status==='rejected')).toMatchObject({reason:{code:'CATALOG_BUSY'}});
    const run=await db.catalogRun.findFirstOrThrow({where:{cycleKey:{in:[`manual:${key}`,`manual:${otherKey}`]}}});
    const winner=run.cycleKey.slice(7),mode=(run.summary as {mode:'retry'|'audit'}).mode;
    await (winner===key?admin:secondAdmin).queue(identity,null,mode,winner);
    expect(await db.catalogRun.count({where:{cycleKey:run.cycleKey}})).toBe(1);
    expect(await engine().run('retry')).toMatchObject({skipped:'ACTIVE_RUN',runId:run.id});
    const cancelKey=randomUUID();await admin.cancel(identity,run.id,cancelKey);await admin.cancel(identity,run.id,cancelKey);
    expect(await db.catalogRun.findUniqueOrThrow({where:{id:run.id}})).toMatchObject({status:'CANCELLED',cancelRequestedAt:expect.any(Date)});
    expect(await engine().run(mode,undefined,run.id)).toEqual({skipped:'ALREADY_COMPLETED'});
    await db.playerRoleAssignment.update({where:{id:secondRole.id},data:{revokedAt:new Date()}});
  },60_000);
  it('aborts an in-flight image request after cancellation and retains the field already committed',async()=>{
    const candidate=await db.catalogCandidate.create({data:{name:'Private cancellation',trackingElements:['rarity','icon']}});
    const player=await db.player.findFirstOrThrow({where:{displayName:'Private catalog admin'}});
    let reached!:()=>void;const inFlight=new Promise<void>(resolve=>{reached=resolve});
    const discovery=vi.spyOn(CatalogSources.prototype,'discover').mockResolvedValue([]);
    const structured=vi.spyOn(CatalogSources.prototype,'structured').mockResolvedValue({fields:{rarity:{value:5,provider:'genshin-db',url:'https://fixture.test/rarity',reliability:'STRUCTURED',fetchedAt:new Date().toISOString()}},images:{icon:[{provider:'technical-manifest',url:'https://fixture.test/image.png'}]}});
    const runner=new CatalogEngine(db,{enabled:false,publish:false,dryRun:false},async(_url,options)=>{
      reached();return new Promise((_,reject)=>{const abort=()=>reject(new CatalogFetchError('CANCELLED'));if(options?.signal?.aborted)abort();else options?.signal?.addEventListener('abort',abort,{once:true})});
    });
    const admin=new CatalogAdminService(db,{execute:async()=>player} as unknown as GetCurrentPlayer,runner);
    try{
      const executing=runner.run('retry',candidate.id);
      await Promise.race([inFlight,new Promise((_,reject)=>setTimeout(()=>reject(new Error('HTTP_NOT_REACHED')),10000))]);
      const run=await db.catalogRun.findFirstOrThrow({where:{status:'RUNNING'}});
      await admin.cancel({} as AuthenticatedIdentity,run.id,randomUUID());
      expect(await executing).toMatchObject({runId:run.id,cancelled:true});
      expect(await db.catalogRun.findUniqueOrThrow({where:{id:run.id}})).toMatchObject({status:'CANCELLED',failureCount:0,summary:{changed:1}});
      expect(await db.catalogCandidate.findUniqueOrThrow({where:{id:candidate.id}})).toMatchObject({fields:{rarity:{value:5}}});
      expect(await db.catalogAsset.count({where:{candidateId:candidate.id}})).toBe(0);
      expect(await db.catalogJob.findUniqueOrThrow({where:{id:'R1051'}})).toMatchObject({leaseToken:null,leaseUntil:null});
      expect(await engine().run('retry',candidate.id,run.id)).toEqual({skipped:'ALREADY_COMPLETED'});
      await admin.cancel({} as AuthenticatedIdentity,run.id,randomUUID());
      expect((await db.catalogRun.findUniqueOrThrow({where:{id:run.id}})).status).toBe('CANCELLED');
    }finally{discovery.mockRestore();structured.mockRestore();await db.catalogAttempt.deleteMany({where:{candidateId:candidate.id}});await db.catalogCandidate.delete({where:{id:candidate.id}});}
  },60_000);
  it('recovers durable cancellation after restart and never reruns the cancelled daily date',async()=>{
    const now=new Date('2098-01-01T12:00:00Z');
    const run=await db.catalogRun.create({data:{cycleKey:'daily:2098-01-01',status:'RUNNING',cancelRequestedAt:new Date()}});
    await db.catalogJob.update({where:{id:'R1051'},data:{leaseToken:randomUUID(),leaseUntil:new Date(0)}});
    let calls=0;const restarted=new CatalogEngine(db,{enabled:true,publish:false,dryRun:false},async url=>{calls++;return http(url)},()=>now);
    expect(await restarted.run()).toMatchObject({skipped:'CANCELLED',runId:run.id});
    expect(await restarted.run()).toEqual({skipped:'ALREADY_COMPLETED'});expect(calls).toBe(0);
    expect((await db.catalogRun.findUniqueOrThrow({where:{id:run.id}})).status).toBe('CANCELLED');
  });
  it('groups meaningful events per current ADMIN and preserves replay proof through read/archive',async()=>{
    const candidate=await db.catalogCandidate.create({data:{name:'Private notification group'}});
    const player=await db.player.findFirstOrThrow({where:{displayName:'Private catalog admin'}});
    const event=(signature:string)=>db.$transaction(tx=>notifyCatalogReview(tx,candidate.id,candidate.name,['rarity : nouvelle information'],signature,new Date()));
    await event('first');
    const key=`catalog-review-group:${candidate.id}:${player.id}`;
    const group=await db.notification.findUniqueOrThrow({where:{deduplicationKey:key}});
    expect(group).toMatchObject({state:'UNREAD',actionKey:'OPEN_ADMIN_CANDIDATE',actionTargetId:candidate.id});
    await db.notification.update({where:{id:group.id},data:{state:'READ',readAt:new Date()}});await event('first');
    expect((await db.notification.findUniqueOrThrow({where:{id:group.id}})).state).toBe('READ');
    await db.notification.update({where:{id:group.id},data:{state:'ARCHIVED',archivedAt:new Date()}});await event('first');
    expect((await db.notification.findUniqueOrThrow({where:{id:group.id}})).state).toBe('ARCHIVED');
    await event('second');expect((await db.notification.findUniqueOrThrow({where:{id:group.id}})).state).toBe('UNREAD');
    expect(await db.notification.count({where:{typeKey:'CATALOG_REVIEW_ADMIN',state:{not:'ARCHIVED'},actionTargetId:candidate.id}})).toBe(1);
    expect(await db.notification.count({where:{deduplicationKey:{startsWith:`catalog-review:${candidate.id}:`},state:'ARCHIVED'}})).toBe(2);
    const ordinary=await db.player.findFirstOrThrow({where:{displayName:'Private ordinary'}});
    expect(await db.notification.count({where:{playerId:ordinary.id,typeKey:'CATALOG_REVIEW_ADMIN'}})).toBe(0);
    await db.notification.deleteMany({where:{OR:[{actionTargetId:candidate.id},{deduplicationKey:{startsWith:`catalog-review:${candidate.id}:`}}]}});await db.catalogCandidate.delete({where:{id:candidate.id}});
  });
  it('paginates and searches all matching candidates beyond the former 150-row ceiling',async()=>{
    await db.catalogCandidate.createMany({data:Array.from({length:165},(_,i)=>({name:`Private pagination ${String(i).padStart(3,'0')}`,nextCheckAt:new Date('2099-01-01')}))});
    const player=await db.player.findFirstOrThrow({where:{displayName:'Private catalog admin'}});
    const admin=new CatalogAdminService(db,{execute:async()=>player} as unknown as GetCurrentPlayer,engine());
    try{
      const last=await admin.overview({} as AuthenticatedIdentity,'Private pagination',9,'tracked');
      expect(last).toMatchObject({total:165,totalPages:9,page:9});expect(last.entries).toHaveLength(5);
      expect(await admin.overview({} as AuthenticatedIdentity,'Private pagination 164',1,'tracked')).toMatchObject({total:1,entries:[{name:'Private pagination 164'}]});
    }finally{await db.catalogCandidate.deleteMany({where:{name:{startsWith:'Private pagination'}}});}
  },60_000);
  it.each(['QUEUED','FAILED','RUNNING'])('resumes a %s daily cycle across Paris midnight before collecting the current day',async(status)=>{
    const month=['QUEUED','FAILED','RUNNING'].indexOf(status)+1;
    const currentDate=`2097-0${month}-02`,oldDate=`2097-0${month}-01`,now=new Date(`${currentDate}T12:00:00Z`);
    const postponed=await db.catalogCandidate.findMany({where:{trackingState:'ACTIVE'},select:{id:true,nextCheckAt:true}});
    await db.catalogCandidate.updateMany({where:{id:{in:postponed.map(row=>row.id)}},data:{nextCheckAt:new Date('2099-01-01')}});
    const target=await db.catalogCandidate.create({data:{name:`Private midnight ${status}`,trackingElements:['rarity'],nextCheckAt:new Date(`${oldDate}T00:00:00Z`)}});
    const old=await db.catalogRun.create({data:{cycleKey:`daily:${oldDate}`,status,nextAttemptAt:new Date(0),summary:{mode:'daily',dailyCutoff:`${oldDate}T12:00:00Z`,processedCandidateIds:[]}}});
    if(status==='RUNNING')await db.catalogJob.update({where:{id:'R1051'},data:{leaseToken:randomUUID(),leaseUntil:new Date(0)}});
    const discovery=vi.spyOn(CatalogSources.prototype,'discover').mockResolvedValue([]);
    const structured=vi.spyOn(CatalogSources.prototype,'structured').mockResolvedValue(null);
    const runner=new CatalogEngine(db,{enabled:true,publish:false,dryRun:false},http,()=>now);
    const execute=vi.spyOn(runner,'run');
    try{
      await new CatalogScheduler(db,runner,()=>now).catchUp();
      expect(execute.mock.calls[0]).toEqual(['daily',undefined,old.id]);
      expect((await db.catalogRun.findUniqueOrThrow({where:{id:old.id}})).status).toBe('COMPLETED');
      const current=await db.catalogRun.findUniqueOrThrow({where:{cycleKey:`daily:${currentDate}`}});
      expect(current.status).toBe('COMPLETED');
      expect((await db.catalogJob.findUniqueOrThrow({where:{id:'R1051'}})).lastSuccessDate).toBe(currentDate);
      const calls=execute.mock.calls.length;await new CatalogScheduler(db,runner,()=>now).catchUp();expect(execute.mock.calls).toHaveLength(calls);
    }finally{
      discovery.mockRestore();structured.mockRestore();execute.mockRestore();
      for(const row of postponed)await db.catalogCandidate.update({where:{id:row.id},data:{nextCheckAt:row.nextCheckAt}});
      await db.catalogAttempt.deleteMany({where:{candidateId:target.id}});await db.catalogCandidate.delete({where:{id:target.id}});
      await db.catalogRun.updateMany({where:{cycleKey:{in:[`daily:${oldDate}`,`daily:${currentDate}`]},status:{in:['QUEUED','FAILED','RUNNING']}},data:{status:'CANCELLED'}});
    }
  },60_000);
  it('qualifies the normal engine publication path and keeps provisional, conflicting, early and corrupt candidates unpublished',async()=>{
    const now=new Date('2097-02-01T12:00:00Z'),fields:CatalogFields={};
    const admin=await db.player.create({data:{displayName:'Private normal publication ADMIN',elementKey:'hydro'}});
    await db.playerRoleAssignment.create({data:{playerId:admin.id,role:'ADMIN',grantedByPlayerId:admin.id}});
    for(const[key,value]of [['originalName','Private normal publication'],['rarity',5],['element','electro'],['numericId',19999997],['releaseDate','2097-02-20']]as const)
      fields[key]={value,provider:'hoyoverse',url:'https://www.hoyolab.com/article/1',reliability:'OFFICIAL',fetchedAt:now.toISOString()};
    const candidate=await db.catalogCandidate.create({data:{name:'Private normal publication',fields}});
    const bytes=new Map<string,Buffer>();
    for(const role of ['icon','splash']as const){
      const body=await sharp({create:{width:role==='icon'?256:1024,height:role==='icon'?256:512,channels:4,background:{r:100,g:180,b:200,alpha:.8}}}).png().toBuffer();
      const image=await validateImage(body,'image/png',role),url=`https://fixture.supabase.co/storage/v1/object/public/character-catalog/characters/${candidate.id}/${role}/${image.hash}.png`;
      bytes.set(url,image.body);await db.catalogAsset.create({data:{candidateId:candidate.id,role,hash:image.hash,provider:'fixture',url,mime:'image/png',width:image.width,height:image.height,bytes:image.bytes,status:'AVAILABLE'}});
    }
    const discovery=vi.spyOn(CatalogSources.prototype,'discover').mockResolvedValue([]),structured=vi.spyOn(CatalogSources.prototype,'structured').mockResolvedValue(null);
    let corrupt=false;const runner=new CatalogEngine(db,{enabled:true,publish:true,dryRun:false,storageUrl:'https://fixture.supabase.co',storageKey:'private_fixture'},async url=>({status:200,mime:'image/png',body:corrupt?Buffer.from('wrong'):bytes.get(url)!,url}),()=>now);
    const notPublished=async()=>expect((await db.catalogCandidate.findUniqueOrThrow({where:{id:candidate.id}})).characterId).toBeNull();
    try{
      await runner.run('retry',candidate.id);await notPublished();expect((await db.catalogCandidate.findUniqueOrThrow({where:{id:candidate.id}})).status).toBe('OUT_OF_WINDOW');
      fields.releaseDate={...fields.releaseDate!,value:'2097-02-02'};fields.rarity={...fields.rarity!,reliability:'PROVISIONAL'};
      await db.catalogCandidate.update({where:{id:candidate.id},data:{fields}});await runner.run('retry',candidate.id);await notPublished();
      fields.rarity={...fields.rarity!,reliability:'OFFICIAL',conflict:true};await db.catalogCandidate.update({where:{id:candidate.id},data:{fields}});await runner.run('retry',candidate.id);await notPublished();
      fields.rarity={...fields.rarity!,conflict:false};await db.catalogCandidate.update({where:{id:candidate.id},data:{fields}});corrupt=true;await runner.run('retry',candidate.id);await notPublished();
      expect(await db.catalogAttempt.count({where:{candidateId:candidate.id,errorCode:'STORAGE_VERIFICATION_FAILED'}})).toBeGreaterThan(0);
      corrupt=false;const result=await runner.run('retry',candidate.id);expect(result).toHaveProperty('runId');
      const published=await db.catalogCandidate.findUniqueOrThrow({where:{id:candidate.id}});expect(published.characterId).not.toBeNull();
      expect(await runner.run('retry',candidate.id,result.runId)).toEqual({skipped:'ALREADY_COMPLETED'});
      await runner.run('retry',candidate.id);
      expect(await db.character.count({where:{externalKey:'genshin:19999997'}})).toBe(1);
      expect(await db.catalogImportOutbox.count({where:{candidateId:candidate.id}})).toBe(1);
      expect(await db.notification.count({where:{typeKey:'CHARACTER_IMPORTED_ADMIN',actionTargetId:published.characterId,playerId:admin.id}})).toBe(1);
    }finally{discovery.mockRestore();structured.mockRestore();}
  },60_000);
  it('consolidates only legacy catalogue events, preserves read state and refuses a stale maintenance plan',async()=>{
    const candidate=await db.catalogCandidate.create({data:{name:'Private legacy notification'}});
    const player=await db.player.findFirstOrThrow({where:{displayName:'Private catalog admin'}});
    const old=await db.notification.create({data:{playerId:player.id,domainKey:'character-catalog',typeKey:'CATALOG_REVIEW_ADMIN',state:'READ',readAt:new Date(),deduplicationKey:`catalog-review:${candidate.id}:${'f'.repeat(64)}:${player.id}`,payload:{candidateId:candidate.id,changes:['icon : image disponible'],signature:'f'.repeat(64)}}});
    const unrelated=await db.notification.create({data:{playerId:player.id,domainKey:'fixture',typeKey:'PRIVATE_UNRELATED',payload:{keep:true}}});
    const plan=await planCatalogNotificationReconcile(db);
    expect(await reconcileCatalogNotifications(db,plan.fingerprint)).toMatchObject({groupsCreated:1,eventsArchived:1,proofsDeleted:0});
    expect(await db.notification.findUniqueOrThrow({where:{id:old.id}})).toMatchObject({state:'ARCHIVED',deduplicationKey:old.deduplicationKey,payload:old.payload,readAt:old.readAt});
    const group=await db.notification.findUniqueOrThrow({where:{deduplicationKey:`catalog-review-group:${candidate.id}:${player.id}`}});
    expect(group).toMatchObject({state:'READ',actionKey:'OPEN_ADMIN_CANDIDATE',actionTargetId:candidate.id});
    expect(await db.notification.findUniqueOrThrow({where:{id:unrelated.id}})).toEqual(unrelated);
    await expect(reconcileCatalogNotifications(db,plan.fingerprint)).rejects.toThrow('NOTIFICATION_RECONCILE_PLAN_CHANGED');
    const replay=await planCatalogNotificationReconcile(db);expect(await reconcileCatalogNotifications(db,replay.fingerprint)).toMatchObject({groupsCreated:0,eventsArchived:0});
    await db.notification.deleteMany({where:{id:{in:[old.id,group.id,unrelated.id]}}});await db.catalogCandidate.delete({where:{id:candidate.id}});
  },60_000);
});
