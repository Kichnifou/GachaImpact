import { elementKeys, type ElementKey } from '../api/types'
import { getElementAssetPath } from '../utils/gameAssets'
import GameAssetIcon from './GameAssetIcon'

export type CharacterRarityFilter = 'all' | 4 | 5
export type CharacterSortKey = 'name' | 'rarity' | 'element'
export type CharacterSortDirection = 'asc' | 'desc'

type CollectionFiltersProps = {
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

const elementLabels: Record<ElementKey, string> = {
  pyro: 'Pyro', hydro: 'Hydro', cryo: 'Cryo', electro: 'Electro',
  anemo: 'Anemo', geo: 'Geo', dendro: 'Dendro',
}
const elementFilters: readonly { label: string; element: ElementKey | null; fallback: string }[] = [
  { label: 'Tous les éléments', element: null, fallback: '✦' },
  ...elementKeys.map((element) => ({ label: elementLabels[element], element, fallback: '◆' })),
]

function CollectionFilters(props: CollectionFiltersProps) {
  const { placeholder, query, rarity, element, sortKey, direction, onQueryChange, onRarityChange, onElementChange, onSortKeyChange, onDirectionChange } = props
  return <div className="collection-filters panel">
    <label className="search-field"><span aria-hidden="true">⌕</span><span className="sr-only">Rechercher</span><input type="search" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={placeholder} /></label>
    <div className="filter-group" aria-label="Filtrer par rareté">
      {([['all', 'Toutes raretés'], [5, '5★'], [4, '4★']] as const).map(([value, label]) => <button type="button" className={`filter-chip${rarity === value ? ' active' : ''}`} aria-pressed={rarity === value} onClick={() => onRarityChange(value)} key={value}>{label}</button>)}
    </div>
    <div className="element-filters" aria-label="Filtrer par élément">
      {elementFilters.map((filter) => <button type="button" className={element === filter.element ? 'active' : ''} aria-label={filter.label} aria-pressed={element === filter.element} onClick={() => onElementChange(filter.element)} key={filter.label}>
        {filter.element ? <GameAssetIcon className="filter-element-icon" src={getElementAssetPath(filter.element)} fallback={filter.fallback} /> : filter.fallback}
      </button>)}
    </div>
    <label className="sort-select"><span>Trier</span><select value={sortKey} onChange={(event) => onSortKeyChange(event.target.value as CharacterSortKey)} aria-label="Critère de tri">
      <option value="name">Nom</option><option value="rarity">Rareté</option><option value="element">Élément</option>
    </select></label>
    <button type="button" className="sort-direction-button" onClick={onDirectionChange} aria-label={`Tri ${direction === 'asc' ? 'croissant' : 'décroissant'}`}>{direction === 'asc' ? '↑' : '↓'}</button>
  </div>
}

export default CollectionFilters
