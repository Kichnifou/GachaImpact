import type { BoxConstellationFilter, BoxFilters, BoxSortKey } from './box-presentation'
import CollectionFilterChips from '../components/CollectionFilterChips'
import './box-filter-bar.css'

export default function BoxFiltersBar({ filters, onChange, placeholder = 'Rechercher dans votre Box…' }: { filters: BoxFilters; onChange: (filters: BoxFilters) => void; placeholder?: string }) {
  const update = <Key extends keyof BoxFilters>(key: Key, value: BoxFilters[Key]) => onChange({ ...filters, [key]: value })
  return <div data-tutorial-anchor="box-filters" className="collection-filters box-filter-bar panel">
    <label className="search-field"><span aria-hidden="true">⌕</span><span className="sr-only">Rechercher</span><input type="search" value={filters.search} onChange={event => update('search', event.target.value)} placeholder={placeholder} /></label>
    <CollectionFilterChips rarity={filters.tab === 'all' ? null : filters.tab} elements={filters.element} onRarity={value => update('tab', value ?? 'all')} onElements={value => update('element', value)} />
    <label className="sort-select box-constellation-filter"><span>Constellation</span><select aria-label="Constellation" value={filters.constellation} onChange={event => update('constellation', event.target.value === 'all' ? 'all' : Number(event.target.value) as BoxConstellationFilter)}><option value="all">Toutes</option>{[0,1,2,3,4,5,6].map(value => <option value={value} key={value}>C{value}</option>)}</select></label>
    <label className="sort-select"><span>Trier</span><select aria-label="Critère de tri" value={filters.sort} onChange={event => update('sort', event.target.value as BoxSortKey)}><option value="alphabetical">Alphabétique</option><option value="obtainedAt">Date d’obtention</option><option value="constellation">Constellation</option><option value="element">Élément</option></select></label>
    <button type="button" className="sort-direction-button box-sort-direction" onClick={() => update('direction', filters.direction === 'asc' ? 'desc' : 'asc')} aria-label={'Tri ' + (filters.direction === 'asc' ? 'ascendant' : 'descendant')}>{filters.direction === 'asc' ? '↑' : '↓'}</button>
  </div>
}
