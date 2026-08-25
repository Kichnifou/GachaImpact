type CollectionFiltersProps = {
  placeholder: string
}

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
        {['✦', '●', '❄', '♨', 'ϟ', '⌁', '◆'].map((element, index) => (
          <button type="button" className={index === 0 ? 'active' : ''} key={`${element}-${index}`}>{element}</button>
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
