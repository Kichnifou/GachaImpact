import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(scriptDirectory, '..', '..')
const legacyPath = path.join(repositoryRoot, 'legacy', 'streamerbot', 'data', 'genshin_characters.json')
const assetReportPath = path.join(repositoryRoot, 'public', 'assets', 'genshin', 'metadata', 'asset_mapping_report.json')
const outputPath = path.join(scriptDirectory, '..', 'prisma', 'data', 'characters.json')

const elementKeys = new Map([
  ['anemo', 'anemo'], ['cryo', 'cryo'], ['dendro', 'dendro'], ['electro', 'electro'],
  ['geo', 'geo'], ['hydro', 'hydro'], ['pyro', 'pyro'],
])

export function normalize(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
}

export function buildCatalog(legacyDocument, assetReport) {
  const assetsByLegacyId = new Map(
    [...assetReport.matched, ...assetReport.unmatched].map((entry) => [entry.id, entry]),
  )
  const seenExternalKeys = new Set()

  return legacyDocument.characters.map((entry, index) => {
    const externalKey = `legacy:${entry.id}`
    const elementKey = elementKeys.get(normalize(entry.element))
    if (seenExternalKeys.has(externalKey)) throw new Error(`Duplicate external key: ${externalKey}`)
    if (entry.rarete !== 4 && entry.rarete !== 5) throw new Error(`Invalid rarity for ${entry.nom}`)
    if (!elementKey) throw new Error(`Invalid element for ${entry.nom}: ${entry.element}`)
    seenExternalKeys.add(externalKey)
    const assets = assetsByLegacyId.get(entry.id) ?? {}

    return {
      externalKey,
      name: entry.nom,
      rarity: entry.rarete,
      elementKey,
      weaponType: entry.arme || null,
      region: entry.region || null,
      classKey: entry.classe || null,
      iconPath: assets.iconPath ?? null,
      splashPath: assets.splashPath ?? null,
      wishPath: assets.wishPath ?? null,
      fullbodyPath: assets.fullbodyPath ?? null,
      displayOrder: index + 1,
      sourceMetadata: { legacyId: entry.id },
    }
  })
}

const legacyDocument = JSON.parse(await readFile(legacyPath, 'utf8'))
const assetReport = JSON.parse(await readFile(assetReportPath, 'utf8'))
const catalog = buildCatalog(legacyDocument, assetReport)
await mkdir(path.dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')

const fiveStars = catalog.filter(({ rarity }) => rarity === 5).length
console.log(`Generated ${catalog.length} characters (${fiveStars} five-star, ${catalog.length - fiveStars} four-star).`)
