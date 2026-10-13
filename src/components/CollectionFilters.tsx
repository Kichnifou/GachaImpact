import type { ElementKey } from '../api/types'
import CollectionFilterChips from './CollectionFilterChips'

export type CharacterRarityFilter = 'all' | 4 | 5
export type CharacterSortKey = 'name' | 'rarity' | 'element' | 'votes' | 'releaseDate'
export type CharacterSortDirection = 'asc' | 'desc'

type CollectionFiltersProps = {
  tutorialAnchor?: string
  allowVotes?: boolean
  allowReleaseDate?: boolean
  placeholder: string
  query: string
  rarity: CharacterRarityFilter
  element: ElementKey | null
  sortKey: CharacterSortKey
  direction: CharacterSortDirection
  onQueryChange: (value: string) => void
  onRarityChange: (value: CharacterRarityFilter) => void
  onElementChange: (value: ElementKey | null) => void
  onSortKeyChange: (value: CharacterSortKey) => void
  onDirectionChange: () => void
}

function CollectionFilters(props: CollectionFiltersProps) {
  const { placeholder, query, rarity, element, sortKey, direction, onQueryChange, onRarityChange, onElementChange, onSortKeyChange, onDirectionChange } = props
  return <div data-tutorial-anchor={props.tutorialAnchor} className="collection-filters panel">
    <label className="search-field"><span aria-hidden="true">⌕</span><span className="sr-only">Rechercher</span><input type="search" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={placeholder} /></label>
    <CollectionFilterChips rarity={rarity === 'all' ? null : rarity} element={element} onRarity={value => onRarityChange(value ?? 'all')} onElement={onElementChange} />
    <label className="sort-select"><span>Trier</span><select value={sortKey} onChange={(event) => onSortKeyChange(event.target.value as CharacterSortKey)} aria-label="Critère de tri">
      <option value="name">Nom</option><option value="rarity">Rareté</option><option value="element">Élément</option>{props.allowVotes && <option value="votes">Votes</option>}{props.allowReleaseDate && <option value="releaseDate">Date de sortie</option>}
    </select></label>
    <button type="button" className="sort-direction-button" onClick={onDirectionChange} aria-label={sortKey === 'releaseDate' ? direction === 'asc' ? 'Plus ancien en premier' : 'Plus récent en premier' : `Tri ${direction === 'asc' ? 'croissant' : 'décroissant'}`}>{direction === 'asc' ? '↑' : '↓'}</button>
  </div>
}

export default CollectionFilters
