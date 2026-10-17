import { elementKeys, type GachaCharacterDto } from '../api/types'
import type { CharacterSortKey } from '../components/CollectionFilters'

export function normalizeCharacterSearch(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').trim() }
export function compareCharacterOwnership(left: GachaCharacterDto, right: GachaCharacterDto, owned: ReadonlySet<string> | null, direction: 'asc' | 'desc') {
  return (direction === 'asc' ? 1 : -1) * (Number(owned?.has(right.id) ?? false) - Number(owned?.has(left.id) ?? false))
    || left.name.localeCompare(right.name, 'fr', { sensitivity:'base' }) || left.id.localeCompare(right.id)
}
export function compareCharacters(left: GachaCharacterDto, right: GachaCharacterDto, key: CharacterSortKey) {
  const alpha = left.name.localeCompare(right.name, 'fr', { sensitivity: 'base' })
  if (key === 'rarity') return left.rarity - right.rarity || alpha
  if (key === 'element') return elementKeys.indexOf(left.elementKey) - elementKeys.indexOf(right.elementKey) || alpha
  return alpha
}
/** Canonical calendar days, no browser timezone conversion. Missing dates stay last in both directions. */
export function compareReleaseDates(left: GachaCharacterDto, right: GachaCharacterDto, direction: 'asc' | 'desc') {
  const a = left.releaseDate?.slice(0,10), b = right.releaseDate?.slice(0,10)
  const stable = () => left.name.localeCompare(right.name,'fr',{sensitivity:'base'}) || left.id.localeCompare(right.id)
  if (!a || !b) return a === b ? stable() : a ? -1 : 1
  return (direction === 'asc' ? 1 : -1) * a.localeCompare(b) || stable()
}
