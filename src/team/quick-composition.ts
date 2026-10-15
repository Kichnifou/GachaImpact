import type { PlayerTeamDto, TeamCharacterDto } from '../api/types'

export const compositionIds = (team: PlayerTeamDto): (string | null)[] =>
  [1, 2, 3, 4].map(position => team.slots.find(slot => slot.position === position)?.character?.id ?? null)

export function toggleComposition(ids: readonly (string | null)[], characterId: string): (string | null)[] {
  const next = [...ids]
  const existing = next.indexOf(characterId)
  if (existing >= 0) next[existing] = null
  else {
    const free = next.indexOf(null)
    if (free >= 0) next[free] = characterId
  }
  return next
}

export function pinOpeningCharacters(opening: readonly TeamCharacterDto[], filtered: readonly TeamCharacterDto[]) {
  const pinnedIds = new Set(opening.map(character => character.id))
  return [...opening, ...filtered.filter(character => !pinnedIds.has(character.id))]
}
