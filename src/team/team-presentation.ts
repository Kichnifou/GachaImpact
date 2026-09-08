import type { TeamCharacterDto } from '../api/types'

export const teamElementFilters = ['all', 'pyro', 'hydro', 'cryo', 'electro', 'anemo', 'geo', 'dendro'] as const
export type TeamElementFilter = typeof teamElementFilters[number]

export function filterTeamCharacters(characters: readonly TeamCharacterDto[], search: string, elementFilter: TeamElementFilter) {
  const normalizedSearch = normalize(search)
  return characters.filter((character) => normalize(character.name).includes(normalizedSearch)
    && (elementFilter === 'all' || character.elementKey === elementFilter))
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr-FR')
}
