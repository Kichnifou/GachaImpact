import { useEffect, useState } from 'react'

export type CharacterAssetKind = 'iconPath' | 'splashPath' | 'wishPath' | 'fullbodyPath'

type CharacterAssetEntry = {
  nom: string
  iconPath?: string
  splashPath?: string
  wishPath?: string
  fullbodyPath?: string
}

type CharacterAssetReport = {
  matched: CharacterAssetEntry[]
  unmatched: CharacterAssetEntry[]
}

export const DEFAULT_CHARACTER_ASSET_ORDER: readonly CharacterAssetKind[] = [
  'iconPath',
  'splashPath',
  'wishPath',
  'fullbodyPath',
]

export const BANNER_CHARACTER_ASSET_ORDER: readonly CharacterAssetKind[] = [
  'splashPath',
  'fullbodyPath',
  'wishPath',
  'iconPath',
]

export const currencyAssetPaths = {
  primogem: '/assets/genshin/currencies/primogem.png',
  mora: '/assets/genshin/currencies/mora.png',
  intertwinedFate: '/assets/genshin/currencies/intertwined-fate.png',
  acquaintFate: '/assets/genshin/currencies/acquaint-fate.png',
} as const

let characterAssets: Map<string, CharacterAssetEntry> | null = null
let characterAssetsRequest: Promise<Map<string, CharacterAssetEntry>> | null = null

function normalizeName(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function loadCharacterAssets() {
  if (characterAssets) return Promise.resolve(characterAssets)

  characterAssetsRequest ??= fetch('/assets/genshin/metadata/asset_mapping_report.json')
    .then((response) => {
      if (!response.ok) throw new Error(`Rapport d’assets indisponible (${response.status})`)
      return response.json() as Promise<CharacterAssetReport>
    })
    .then((report) => {
      characterAssets = new Map(
        [...report.matched, ...report.unmatched].map((entry) => [normalizeName(entry.nom), entry]),
      )
      return characterAssets
    })

  return characterAssetsRequest
}

export function useCharacterAssetPaths(
  characterName: string,
  order: readonly CharacterAssetKind[] = DEFAULT_CHARACTER_ASSET_ORDER,
) {
  const [entry, setEntry] = useState<CharacterAssetEntry | null>(
    () => characterAssets?.get(normalizeName(characterName)) ?? null,
  )

  useEffect(() => {
    let active = true

    loadCharacterAssets()
      .then((assets) => {
        if (active) setEntry(assets.get(normalizeName(characterName)) ?? null)
      })
      .catch(() => {
        if (active) setEntry(null)
      })

    return () => {
      active = false
    }
  }, [characterName])

  if (!entry) return []

  return order
    .map((kind) => entry[kind])
    .filter((assetPath): assetPath is string => Boolean(assetPath))
}

export function getElementAssetPath(element: string, variant: 'icon' | 'badge' = 'icon') {
  const normalizedElement = normalizeName(element)
  const suffix = variant === 'badge' ? '-badge' : ''
  return `/assets/genshin/elements/${normalizedElement}${suffix}.png`
}
