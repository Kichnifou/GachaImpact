import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { validateManifest, validatePng, missingAssetPatch, verifyPublishedAssets } from '../../scripts/character-asset-manifest.mjs'
import { backfill } from './backfill-character-assets.mjs'
import pg from 'pg'
import { randomUUID } from 'node:crypto'

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url))
const manifest = JSON.parse(readFileSync(new URL('../../public/assets/genshin/metadata/recovered_character_assets.json', import.meta.url), 'utf8'))
const clone = () => structuredClone(manifest)
test('all recovered identities and local PNGs are unique, correctly typed and unchanged', () => {
  assert.equal(validateManifest(manifest, repositoryRoot).length, 24)
  assert.equal(manifest.entries.reduce((n,e) => n + Object.keys(e.assets).length, 0), 72)
  assert.equal(manifest.entries.find(e => e.name === 'Skirk').technicalName, 'SkirkNew')
  assert.equal(manifest.entries.find(e => e.name === 'Sandrone').technicalName, 'MarionetteNew')
})
test('rejects duplicate identities and a portrait belonging to another ID', () => {
  const duplicate = clone(); duplicate.entries.push(duplicate.entries[0]); assert.throws(() => validateManifest(duplicate), /Ambiguous/)
  const bad = clone(); bad.entries[0].assets.iconPath.path = '/assets/genshin/characters/icons/10000038.png'
  assert.throws(() => validateManifest(bad), /ID conflict/)
})
test('rejects traversal and a splash pretending to be a portrait', () => {
  const bad = clone(); bad.entries[0].assets.iconPath.path = '/assets/genshin/characters/icons/../../bad.png'
  assert.throws(() => validateManifest(bad), /declaration/)
  const role = clone(); role.entries[0].assets.iconPath.width = 2048
  assert.throws(() => validateManifest(role), /role/)
})
test('conservative patch preserves every populated path and requires stable identity', () => {
  const entry = manifest.entries[0]
  const row = { externalKey:entry.externalKey, name:entry.name, iconPath:'/custom/valid.png', fullbodyPath:'/old/fullbody.png', splashPath:null, wishPath:null }
  assert.deepEqual(missingAssetPatch(row,entry), { splashPath:entry.assets.splashPath.path, wishPath:entry.assets.wishPath.path })
  assert.throws(() => missingAssetPatch({...row,name:'Other'},entry), /Identity conflict/)
})
test('rejects corrupt PNG bytes and HTML returned as image', async () => {
  const asset = manifest.entries[0].assets.iconPath
  const bytes = readFileSync(new URL('../../public'+asset.path, import.meta.url)); bytes[50] ^= 1
  assert.throws(() => validatePng(bytes,asset), /Invalid or changed PNG/)
  await assert.rejects(verifyPublishedAssets([manifest.entries[0]], async () => new Response('<html>SPA</html>', {headers:{'content-type':'text/html'}})), /unavailable/)
  await assert.rejects(verifyPublishedAssets([manifest.entries[0]], async () => new Response('<html>bad</html>', {headers:{'content-type':'image/png'}})), /Invalid or changed PNG/)
})
test('provider failure / missing public asset cannot pass the publication gate', async () => {
  await assert.rejects(verifyPublishedAssets([manifest.entries[0]], async () => new Response('',{status:404})), /unavailable/)
  await assert.rejects(verifyPublishedAssets([manifest.entries[0]], async () => {throw Error('network failure')}), /network failure/)
})
test('public gate compares actual binary hashes on the official frontend', async () => {
  let calls = 0
  await verifyPublishedAssets(manifest.entries, async url => {
    assert.ok(url.startsWith('https://gachaimpact.pages.dev/assets/genshin/characters/'))
    calls++
    return new Response(readFileSync(new URL('../../public'+new URL(url).pathname, import.meta.url)), {headers:{'content-type':'image/png'}})
  })
  assert.equal(calls,72)
})
test('transaction rolls back on identity failure; no arbitrary table/schema accepted', async () => {
  const calls=[]
  const client={query:async(sql)=>{calls.push(sql);return {rows:[],rowCount:0}}}
  await assert.rejects(backfill(client,manifest.entries,{apply:true}), /Missing identity/)
  assert.equal(calls.at(-1),'ROLLBACK')
  assert.equal(calls.filter(sql=>sql.startsWith('UPDATE')).length,0)
  await assert.rejects(backfill(client,[],{schema:'public; DELETE'}),/Unsafe schema/)
})
test('isolated PostgreSQL: null-only, metadata preservation, replay and atomic rollback', {skip:process.env.R1051_PRIVATE_DB_TEST !== 'true'}, async () => {
  if (!process.env.DATABASE_URL) throw Error('DATABASE_URL required for isolated schema test')
  const schema = `r1051_test_${randomUUID().replaceAll('-','')}`
  const client = new pg.Client({connectionString:process.env.DATABASE_URL})
  await client.connect()
  try {
    await client.query(`CREATE SCHEMA "${schema}"`)
    await client.query(`REVOKE ALL ON SCHEMA "${schema}" FROM PUBLIC, anon, authenticated`)
    await client.query(`CREATE TABLE "${schema}".characters (external_key text PRIMARY KEY, name text, icon_path text, splash_path text, wish_path text, fullbody_path text, class_key text, source_metadata jsonb, updated_at timestamptz)`)
    const entry = manifest.entries[0]
    await client.query(`INSERT INTO "${schema}".characters VALUES ($1,$2,NULL,NULL,NULL,'/existing/fullbody.png','Déesse','{"admin":true}',now())`,[entry.externalKey,entry.name])
    const first = await backfill(client,[entry],{schema,apply:true})
    assert.equal(first.changedFields,3)
    const row = (await client.query(`SELECT * FROM "${schema}".characters`)).rows[0]
    assert.equal(row.fullbody_path,'/existing/fullbody.png');assert.equal(row.class_key,'Déesse');assert.deepEqual(row.source_metadata,{admin:true})
    assert.equal((await backfill(client,[entry],{schema,apply:true})).changedFields,0)
    await client.query(`UPDATE "${schema}".characters SET icon_path='/admin/portrait.png', splash_path=NULL`)
    await assert.rejects(backfill(client,[entry,manifest.entries[1]],{schema,apply:true}), /Missing identity/)
    const rolled = (await client.query(`SELECT * FROM "${schema}".characters`)).rows[0]
    assert.equal(rolled.splash_path,null);assert.equal(rolled.icon_path,'/admin/portrait.png')
    const plan = await backfill(client,[entry],{schema})
    assert.equal(plan.changedFields,1)
    assert.equal((await client.query(`SELECT splash_path FROM "${schema}".characters`)).rows[0].splash_path,null)
  } finally {
    // Constant prefix + random hex only: never drop public or another test schema.
    assert.match(schema,/^r1051_test_[a-f0-9]+$/)
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
    await client.end()
  }
})
