import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'

export const assetFields = ['iconPath', 'splashPath', 'wishPath', 'fullbodyPath']
const categories = { iconPath: 'icons', splashPath: 'splash', wishPath: 'wish', fullbodyPath: 'fullbody' }

export function validatePng(bytes, asset) {
  if (bytes.length < 33 || bytes.length > 8 * 1024 * 1024 ||
      !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
      bytes.toString('ascii', 12, 16) !== 'IHDR' || bytes.readUInt32BE(16) !== asset.width ||
      bytes.readUInt32BE(20) !== asset.height ||
      createHash('sha256').update(bytes).digest('hex') !== asset.sha256) {
    throw new Error(`Invalid or changed PNG: ${asset.path}`)
  }
}

export function validateManifest(manifest, repositoryRoot) {
  const keys = new Set(), ids = new Set(), names = new Set()
  for (const entry of manifest.entries) {
    const normalized = entry.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    if (!/^legacy:\d+$/.test(entry.externalKey) || !/^\d{8}$/.test(entry.genshinId) ||
        keys.has(entry.externalKey) || ids.has(entry.genshinId) || names.has(normalized)) {
      throw new Error(`Ambiguous asset identity: ${entry.externalKey}`)
    }
    keys.add(entry.externalKey); ids.add(entry.genshinId); names.add(normalized)
    for (const [field, asset] of Object.entries(entry.assets)) {
      const category = categories[field]
      if (!category || !new RegExp(`^/assets/genshin/characters/${category}/[A-Za-z0-9_]+\\.png$`).test(asset.path) ||
          !/^https:\/\/(enka\.network|upload-os-bbs\.mihoyo\.com)\//.test(asset.url) ||
          !/^[a-f0-9]{64}$/.test(asset.sha256)) throw new Error(`Invalid asset declaration: ${field}`)
      if (field !== 'fullbodyPath' && asset.path !== `/assets/genshin/characters/${category}/${entry.genshinId}.png`) throw new Error(`Asset ID conflict: ${entry.externalKey}`)
      const expected = field === 'iconPath' ? [256, 256] : field === 'wishPath' ? [320, 1024] : [2048, 1024]
      if (asset.width !== expected[0] || asset.height !== expected[1]) throw new Error(`Wrong asset role: ${field}`)
      if (repositoryRoot) validatePng(readFileSync(path.join(repositoryRoot, 'public', asset.path)), asset)
    }
  }
  return manifest.entries
}

export async function verifyPublishedAssets(entries, fetcher = fetch) {
  for (const entry of entries) for (const asset of Object.values(entry.assets)) {
    const response = await fetcher(`https://gachaimpact.pages.dev${asset.path}`, { signal: AbortSignal.timeout(15000), redirect: 'error' })
    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/png')) throw new Error(`Asset unavailable in production: ${asset.path}`)
    validatePng(Buffer.from(await response.arrayBuffer()), asset)
  }
}

export function missingAssetPatch(row, entry) {
  if (row.externalKey !== entry.externalKey || row.name !== entry.name) throw new Error(`Identity conflict: ${entry.externalKey}`)
  return Object.fromEntries(assetFields.filter(field => row[field] === null && entry.assets[field])
    .map(field => [field, entry.assets[field].path]))
}
