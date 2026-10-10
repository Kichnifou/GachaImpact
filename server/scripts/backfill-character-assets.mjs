// Operator-only bounded R1051 backfill. Never called by startup, seed or scheduler.
import pg from 'pg'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { pathToFileURL } from 'node:url'
import { validateManifest, verifyPublishedAssets, missingAssetPatch } from '../../scripts/character-asset-manifest.mjs'

const columns = { iconPath: 'icon_path', splashPath: 'splash_path', wishPath: 'wish_path', fullbodyPath: 'fullbody_path' }
export async function backfill(client, entries, { apply = false, schema = 'public' } = {}) {
  if (schema !== 'public' && !/^r1051_test_[a-f0-9]+$/.test(schema)) throw new Error('Unsafe schema')
  await client.query(apply ? 'BEGIN ISOLATION LEVEL SERIALIZABLE' : 'BEGIN READ ONLY')
  try {
    await client.query("SET LOCAL lock_timeout = '3s'")
    await client.query("SET LOCAL statement_timeout = '15s'")
    const changes = []
    for (const entry of entries) {
      const result = await client.query(`SELECT external_key AS "externalKey", name, icon_path AS "iconPath", splash_path AS "splashPath", wish_path AS "wishPath", fullbody_path AS "fullbodyPath" FROM "${schema}".characters WHERE external_key = $1 ${apply ? 'FOR UPDATE' : ''}`, [entry.externalKey])
      if (result.rows.length !== 1) throw new Error(`Missing identity: ${entry.externalKey}`)
      const patch = missingAssetPatch(result.rows[0], entry)
      for (const [field, value] of Object.entries(patch)) {
        if (apply) {
          const updated = await client.query(`UPDATE "${schema}".characters SET ${columns[field]} = $1, updated_at = now() WHERE external_key = $2 AND ${columns[field]} IS NULL`, [value, entry.externalKey])
          if (updated.rowCount !== 1) throw new Error('Concurrent asset change; rollback')
        }
        changes.push({ externalKey: entry.externalKey, name: entry.name, field, before: null, after: value })
      }
    }
    await client.query('COMMIT')
    return { apply, changedCharacters: new Set(changes.map(c => c.externalKey)).size, changedFields: changes.length, changes }
  } catch (error) { await client.query('ROLLBACK'); throw error }
}

async function main() {
  if (process.argv.slice(2).some(arg => !['--apply'].includes(arg))) throw new Error('Usage: node --env-file=.env scripts/backfill-character-assets.mjs [--apply]')
  const apply = process.argv.includes('--apply')
  const root = fileURLToPath(new URL('../../', import.meta.url))
  const manifest = JSON.parse(readFileSync(new URL('../../public/assets/genshin/metadata/recovered_character_assets.json', import.meta.url), 'utf8'))
  const entries = validateManifest(manifest, root)
  // Verify the actual official frontend bytes before any write. SPA HTTP 200 is insufficient.
  if (apply) await verifyPublishedAssets(entries)
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required')
  await client.connect()
  try { console.log(JSON.stringify(await backfill(client, entries, { apply }), null, 2)) }
  finally { await client.end() }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main()
