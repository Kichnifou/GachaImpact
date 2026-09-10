import { elementKeys, type GachaCharacterDto } from '../api/types'
import type { CharacterSortKey } from '../components/CollectionFilters'

export function normalizeCharacterSearch(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').trim() }
export function compareCharacters(left: GachaCharacterDto, right: GachaCharacterDto, key: CharacterSortKey) {
  const alpha = left.name.localeCompare(right.name, 'fr', { sensitivity: 'base' })
  if (key === 'rarity') return left.rarity - right.rarity || alpha
  if (key === 'element') return elementKeys.indexOf(left.elementKey) - elementKeys.indexOf(right.elementKey) || alpha
  return alpha
}
