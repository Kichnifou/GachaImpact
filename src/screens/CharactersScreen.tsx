import { useMemo, useState } from 'react'
import { type ElementKey, type GachaCharacterDto } from '../api/types'
import CharacterCard from '../components/CharacterCard'
import CollectionFilters, { type CharacterRarityFilter, type CharacterSortDirection, type CharacterSortKey } from '../components/CollectionFilters'
import { compareCharacters, normalizeCharacterSearch } from '../characters/character-catalog'

function CharactersScreen({ characters }: { characters: readonly GachaCharacterDto[] }) {
  const [query, setQuery] = useState('')
  const [rarity, setRarity] = useState<CharacterRarityFilter>('all')
  const [element, setElement] = useState<ElementKey | null>(null)
  const [sortKey, setSortKey] = useState<CharacterSortKey>('name')
  const [direction, setDirection] = useState<CharacterSortDirection>('asc')
  const filtered = useMemo(() => {
    const needle = normalizeCharacterSearch(query)
    const sign = direction === 'asc' ? 1 : -1
    return characters
      .filter((character) => (!needle || normalizeCharacterSearch(character.name).includes(needle)) && (rarity === 'all' || character.rarity === rarity) && (!element || character.elementKey === element))
      .slice().sort((left, right) => sign * compareCharacters(left, right, sortKey))
  }, [characters, direction, element, query, rarity, sortKey])
  const filtering = normalizeCharacterSearch(query).length > 0 || rarity !== 'all' || element !== null
  const reset = () => { setQuery(''); setRarity('all'); setElement(null); setSortKey('name'); setDirection('asc') }

  return <div className="screen-content collection-screen catalog-screen">
    <div className="collection-summary"><span>{filtering ? `${filtered.length} / ${characters.length} personnages` : `${characters.length} personnages actifs`}</span></div>
    <CollectionFilters placeholder="Rechercher un personnage…" query={query} rarity={rarity} element={element} sortKey={sortKey} direction={direction} onQueryChange={setQuery} onRarityChange={setRarity} onElementChange={setElement} onSortKeyChange={setSortKey} onDirectionChange={() => setDirection((value) => value === 'asc' ? 'desc' : 'asc')} />
    {filtered.length ? <section className="character-grid" aria-label="Catalogue des personnages">{filtered.map((character) => <CharacterCard character={character} key={character.id} />)}</section>
      : <section className="catalog-empty" role="status"><p>Aucun personnage ne correspond à ces filtres.</p><button type="button" onClick={reset}>Réinitialiser</button></section>}
  </div>
}

export default CharactersScreen
