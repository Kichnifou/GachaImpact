import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDirectory, '..')
const metadataDirectory = path.join(projectRoot, 'public', 'assets', 'genshin', 'metadata')
const charactersDirectory = path.join(projectRoot, 'public', 'assets', 'genshin', 'characters')

const gachaimpactPath = path.join(metadataDirectory, 'gachaimpact_characters.json')
const hoyoPath = path.join(metadataDirectory, 'gi_characters.json')
const reportPath = path.join(metadataDirectory, 'asset_mapping_report.json')

const hoyoAliases = {
  alhaitham: 'Alhatham',
  amber: 'Ambor',
  baizhu: 'Baizhuer',
  heizou: 'Heizo',
  jean: 'Qin',
  kirara: 'Momoka',
  kuki: 'Shinobu',
  lynette: 'Linette',
  lyney: 'Liney',
  noelle: 'Noel',
  nomade: 'Wanderer',
  ororon: 'Olorun',
  raiden: 'Shougun',
  rosalia: 'Rosaria',
  thomas: 'Tohma',
  xianyun: 'Liuyun',
  yaemiko: 'Yae',
  yanfei: 'Feiyan',
}

const fullbodyAliases = {
  ...hoyoAliases,
  sandrone: 'MarionetteNew',
  skirk: 'SkirkNew',
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function normalizeName(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function publicAssetPath(category, hoyoId) {
  return `/assets/genshin/characters/${category}/${hoyoId}.png`
}

function diskAssetPath(category, hoyoId) {
  return path.join(charactersDirectory, category, `${hoyoId}.png`)
}

function publicFullbodyPath(fileName) {
  return `/assets/genshin/characters/fullbody/${fileName}`
}

const gachaimpactSource = readJson(gachaimpactPath)
const hoyoCharacters = readJson(hoyoPath)
const gachaimpactCharacters = gachaimpactSource.characters
const fullbodyDirectory = path.join(charactersDirectory, 'fullbody')
const fullbodyFiles = fs
  .readdirSync(fullbodyDirectory)
  .filter((fileName) => fileName.toLowerCase().endsWith('.png'))
  .sort()

if (!Array.isArray(gachaimpactCharacters)) {
  throw new TypeError('gachaimpact_characters.json doit contenir un tableau "characters".')
}

const hoyoByNormalizedName = new Map()
const fullbodyByNormalizedName = new Map()

for (const [hoyoId, hoyoName] of Object.entries(hoyoCharacters)) {
  const normalizedName = normalizeName(hoyoName)
  const entries = hoyoByNormalizedName.get(normalizedName) ?? []
  entries.push({ hoyoId, hoyoName })
  hoyoByNormalizedName.set(normalizedName, entries)
}

for (const fileName of fullbodyFiles) {
  const technicalName = fileName
    .replace(/^UI_Gacha_AvatarImg_/i, '')
    .replace(/\.png$/i, '')
  const normalizedName = normalizeName(technicalName)
  const entries = fullbodyByNormalizedName.get(normalizedName) ?? []
  entries.push({ fileName, technicalName })
  fullbodyByNormalizedName.set(normalizedName, entries)
}

const matched = []
const unmatched = []
const ambiguous = []
const fullbodyUnmatched = []
const fullbodyAmbiguous = []
const fullbodyByCharacterId = new Map()
const missingAssets = []

for (const character of gachaimpactCharacters) {
  const normalizedGachaimpactName = normalizeName(character.nom)
  const alias = fullbodyAliases[normalizedGachaimpactName]
  const lookupName = normalizeName(alias ?? character.nom)
  const candidates = fullbodyByNormalizedName.get(lookupName) ?? []

  if (candidates.length === 0) {
    fullbodyUnmatched.push({
      id: character.id,
      nom: character.nom,
      rarete: character.rarete,
      element: character.element,
    })
    continue
  }

  if (candidates.length > 1) {
    fullbodyAmbiguous.push({
      id: character.id,
      nom: character.nom,
      candidates,
    })
    continue
  }

  const [{ fileName }] = candidates
  const assetPath = path.join(fullbodyDirectory, fileName)

  if (!fs.existsSync(assetPath)) {
    missingAssets.push(assetPath)
  }

  fullbodyByCharacterId.set(character.id, publicFullbodyPath(fileName))
}

for (const character of gachaimpactCharacters) {
  const normalizedGachaimpactName = normalizeName(character.nom)
  const alias = hoyoAliases[normalizedGachaimpactName]
  const lookupName = normalizeName(alias ?? character.nom)
  const candidates = hoyoByNormalizedName.get(lookupName) ?? []
  const fullbodyPath = fullbodyByCharacterId.get(character.id)

  if (candidates.length === 0) {
    unmatched.push({
      id: character.id,
      nom: character.nom,
      rarete: character.rarete,
      element: character.element,
      ...(fullbodyPath ? { fullbodyPath } : {}),
    })
    continue
  }

  if (candidates.length > 1) {
    ambiguous.push({
      id: character.id,
      nom: character.nom,
      candidates,
    })
    continue
  }

  const [{ hoyoId, hoyoName }] = candidates
  const paths = {
    iconPath: publicAssetPath('icons', hoyoId),
    splashPath: publicAssetPath('splash', hoyoId),
    wishPath: publicAssetPath('wish', hoyoId),
  }

  for (const category of ['icons', 'splash', 'wish']) {
    const assetPath = diskAssetPath(category, hoyoId)
    if (!fs.existsSync(assetPath)) {
      missingAssets.push(assetPath)
    }
  }

  matched.push({
    id: character.id,
    nom: character.nom,
    hoyoId,
    hoyoName,
    ...paths,
    ...(fullbodyPath ? { fullbodyPath } : {}),
  })
}

if (missingAssets.length > 0) {
  throw new Error(`Assets manquants :\n${missingAssets.join('\n')}`)
}

const report = {
  summary: {
    gachaimpactCharacters: gachaimpactCharacters.length,
    hoyoCharacters: Object.keys(hoyoCharacters).length,
    matched: matched.length,
    unmatched: unmatched.length,
    ambiguous: ambiguous.length,
    fullbodyFiles: fullbodyFiles.length,
    fullbodyMatched: fullbodyByCharacterId.size,
    fullbodyUnmatched: fullbodyUnmatched.length,
    fullbodyAmbiguous: fullbodyAmbiguous.length,
    allGeneratedAssetPathsExist: true,
    allGeneratedFullbodyPathsExist: true,
  },
  matched,
  unmatched,
  ambiguous,
  fullbodyUnmatched,
  fullbodyAmbiguous,
}

fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

console.log(`Rapport créé : ${path.relative(projectRoot, reportPath)}`)
console.log(`Matched : ${matched.length}`)
console.log(`Unmatched : ${unmatched.length}`)
console.log(`Ambiguous : ${ambiguous.length}`)
console.log(`Fullbody matched : ${fullbodyByCharacterId.size}`)
console.log(`Fullbody unmatched : ${fullbodyUnmatched.length}`)
console.log(`Fullbody ambiguous : ${fullbodyAmbiguous.length}`)
console.log('Tous les chemins d’assets générés existent sur disque.')
