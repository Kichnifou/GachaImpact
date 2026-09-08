import type { TeamCharacterDto } from '../api/types'

export const teamElementFilters = ['all', 'pyro', 'hydro', 'cryo', 'electro', 'anemo', 'geo', 'dendro'] as const
export type TeamElementFilter = typeof teamElementFilters[number]
export const teamsPerPage = 10

export function filterTeamCharacters(characters: readonly TeamCharacterDto[], search: string, elementFilter: TeamElementFilter) {
  const normalizedSearch = normalize(search)
  return characters.filter((character) => normalize(character.name).includes(normalizedSearch)
    && (elementFilter === 'all' || character.elementKey === elementFilter))
}

export function teamPassiveStatusLabel(active: boolean) {
  return active ? 'Team active' : 'Aperçu'
}

export function teamPageForPosition(position: number) {
  return Math.max(0, Math.floor((position - 1) / teamsPerPage))
}

export function canOpenNextTeamPage(teamCount: number, page: number) {
  return page === 0 || teamCount >= (page + 1) * teamsPerPage
}

export function swapTeamOrder(teamIds: readonly string[], firstId: string, secondId: string) {
  const next = [...teamIds]
  const first = next.indexOf(firstId)
  const second = next.indexOf(secondId)
  if (first < 0 || second < 0 || first === second) return next
  ;[next[first], next[second]] = [next[second]!, next[first]!]
  return next
}

export function insertTeamOrder(teamIds: readonly string[], draggedId: string, insertionIndex: number) {
  const next = [...teamIds]
  const from = next.indexOf(draggedId)
  if (from < 0) return next
  next.splice(from, 1)
  const adjusted = insertionIndex > from ? insertionIndex - 1 : insertionIndex
  next.splice(Math.max(0, Math.min(adjusted, next.length)), 0, draggedId)
  return next
}

export function swapTeamSlots(characterIds: readonly (string | null)[], first: number, second: number) {
  const next = [...characterIds]
  if (first < 0 || second < 0 || first >= next.length || second >= next.length || first === second) return next
  ;[next[first], next[second]] = [next[second] ?? null, next[first] ?? null]
  return next
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr-FR')
}
