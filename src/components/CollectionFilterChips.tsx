import { elementKeys, type ElementKey } from '../api/types'
import { getElementAssetPath } from '../utils/gameAssets'
import GameAssetIcon from './GameAssetIcon'
import './collection-filter-chips.css'

const labels: Record<ElementKey, string> = { pyro: 'Pyro', hydro: 'Hydro', cryo: 'Cryo', electro: 'Électro', anemo: 'Anémo', geo: 'Géo', dendro: 'Dendro' }

export type ElementSelection =
  | { element: ElementKey | null; onElement: (value: ElementKey | null) => void; elements?: never; onElements?: never }
  | { elements: readonly ElementKey[]; onElements: (value: readonly ElementKey[]) => void; element?: never; onElement?: never }

/** Opt-in controls: no caller state or persistence is owned here. */
export default function CollectionFilterChips({ rarity, onRarity, ...selection }: {
  rarity: 4 | 5 | null
  onRarity: (value: 4 | 5 | null) => void
} & ElementSelection) {
  const selected = (value: ElementKey) => selection.elements ? selection.elements.includes(value) : selection.element === value
  const toggle = (value: ElementKey) => {
    if (selection.elements) selection.onElements(selected(value) ? selection.elements.filter(item => item !== value) : [...selection.elements, value])
    else selection.onElement(selected(value) ? null : value)
  }
  return <>
    <div className="filter-group collection-rarity-chips" aria-label="Filtrer par rareté">
      {([5, 4] as const).map(value => <button type="button" key={value} className={`filter-chip rarity-${value}${rarity === value ? ' active' : ''}`} aria-label={`Filtrer les personnages ${value} étoiles`} aria-pressed={rarity === value} onClick={() => onRarity(rarity === value ? null : value)}><span aria-hidden="true">★</span></button>)}
    </div>
    <span className="collection-filter-separator" aria-hidden="true" />
    <div className="element-filters collection-element-chips" aria-label="Filtrer par élément">
      {elementKeys.map(value => <button type="button" key={value} className={selected(value) ? 'active' : ''} aria-label={labels[value]} aria-pressed={selected(value)} onClick={() => toggle(value)}><GameAssetIcon className="filter-element-icon" src={getElementAssetPath(value)} fallback="◆" /></button>)}
    </div>
  </>
}
