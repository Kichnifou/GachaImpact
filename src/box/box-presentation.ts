import type { BoxCharacterDto, BoxSortPreferenceDto, ElementKey } from '../api/types'

export type BoxRarityTab = 'all' | 5 | 4
export type BoxElementFilter = 'all' | ElementKey
export type BoxConstellationFilter = 'all' | 0 | 1 | 2 | 3 | 4 | 5 | 6
export type BoxSortKey = 'alphabetical' | 'obtainedAt' | 'constellation' | 'element'
export type SortDirection = 'asc' | 'desc'

export type BoxFilters = Readonly<{
  tab: BoxRarityTab
  search: string
  element: BoxElementFilter
  constellation: BoxConstellationFilter
  sort: BoxSortKey
  direction: SortDirection
}>

export const initialBoxFilters: BoxFilters = {
  tab: 'all', search: '', element: 'all', constellation: 'all', sort: 'alphabetical', direction: 'asc',
}

export function initialBoxFiltersWithPreference(preference?: BoxSortPreferenceDto): BoxFilters {
  return { ...initialBoxFilters, ...(preference ? { sort: preference.sortKey, direction: preference.direction } : {}) }
}

export const boxElements: readonly ElementKey[] = ['pyro', 'hydro', 'cryo', 'electro', 'anemo', 'geo', 'dendro']

export function presentBoxCharacters(characters: readonly BoxCharacterDto[], filters: BoxFilters): BoxCharacterDto[] {
  const search = normalizeSearch(filters.search)
  return characters
    .filter((character) => filters.tab === 'all' || character.rarity === filters.tab)
    .filter((character) => filters.element === 'all' || character.elementKey === filters.element)
    .filter((character) => filters.constellation === 'all' || character.constellation === filters.constellation)
    .filter((character) => !search || normalizeSearch(character.name).includes(search))
    .sort((left, right) => groupRank(left, filters.tab) - groupRank(right, filters.tab) || compareCharacters(left, right, filters))
}

export function replaceFavorite(characters: readonly BoxCharacterDto[], characterId: string, favorite: boolean) {
  return characters.map((character) => character.id === characterId ? { ...character, favorite } : character)
}

function groupRank(character: BoxCharacterDto, tab: BoxRarityTab) {
  if (tab === 'all') {
    if (character.favorite) return character.rarity === 5 ? 0 : 1
    return character.rarity === 5 ? 2 : 3
  }
  return character.favorite ? 0 : 1
}

function compareCharacters(left: BoxCharacterDto, right: BoxCharacterDto, filters: BoxFilters) {
  let result: number
  switch (filters.sort) {
    case 'obtainedAt': result = Date.parse(left.firstObtainedAt) - Date.parse(right.firstObtainedAt); break
    case 'constellation': result = left.constellation - right.constellation; break
    case 'element': result = left.elementKey.localeCompare(right.elementKey, 'fr'); break
    default: result = left.name.localeCompare(right.name, 'fr', { sensitivity: 'base' })
  }
  if (result === 0) result = left.name.localeCompare(right.name, 'fr', { sensitivity: 'base' })
  return filters.direction === 'asc' ? result : -result
}

function normalizeSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').trim()
}
