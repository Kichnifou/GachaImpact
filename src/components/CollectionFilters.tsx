import GameAssetIcon from './GameAssetIcon'
import { getElementAssetPath } from '../utils/gameAssets'

type CollectionFiltersProps = {
  placeholder: string
}

const elementFilters = [
  { label: 'Tous les éléments', element: null, fallback: '✦' },
  { label: 'Hydro', element: 'Hydro', fallback: '●' },
  { label: 'Cryo', element: 'Cryo', fallback: '❄' },
  { label: 'Pyro', element: 'Pyro', fallback: '♨' },
  { label: 'Électro', element: 'Électro', fallback: 'ϟ' },
  { label: 'Anémo', element: 'Anémo', fallback: '⌁' },
  { label: 'Géo', element: 'Géo', fallback: '◆' },
] as const

function CollectionFilters({ placeholder }: CollectionFiltersProps) {
  return (
    <div className="collection-filters panel">
      <label className="search-field">
        <span aria-hidden="true">⌕</span>
        <span className="sr-only">Rechercher</span>
        <input type="search" placeholder={placeholder} />
      </label>
      <div className="filter-group" aria-label="Filtrer par rareté">
        <button type="button" className="filter-chip active">Toutes raretés</button>
        <button type="button" className="filter-chip">5★</button>
        <button type="button" className="filter-chip">4★</button>
      </div>
      <div className="element-filters" aria-label="Filtrer par élément">
        {elementFilters.map((filter, index) => (
          <button type="button" className={index === 0 ? 'active' : ''} aria-label={filter.label} key={filter.label}>
            {filter.element ? (
              <GameAssetIcon
                className="filter-element-icon"
                src={getElementAssetPath(filter.element)}
                fallback={filter.fallback}
              />
            ) : filter.fallback}
          </button>
        ))}
      </div>
      <label className="sort-select">
        <span>Trier</span>
        <select defaultValue="level">
          <option value="level">Niveau</option>
          <option value="rarity">Rareté</option>
          <option value="name">Nom</option>
        </select>
      </label>
    </div>
  )
}

export default CollectionFilters
