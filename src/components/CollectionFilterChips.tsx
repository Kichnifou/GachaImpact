import { elementKeys, type ElementKey } from '../api/types'
import { getElementAssetPath } from '../utils/gameAssets'
import GameAssetIcon from './GameAssetIcon'
import './collection-filter-chips.css'

const labels: Record<ElementKey, string> = { pyro: 'Pyro', hydro: 'Hydro', cryo: 'Cryo', electro: 'Électro', anemo: 'Anémo', geo: 'Géo', dendro: 'Dendro' }

/** Opt-in controls: no caller state or persistence is owned here. */
export default function CollectionFilterChips({ rarity, element, onRarity, onElement }: {
  rarity: 4 | 5 | null
  element: ElementKey | null
  onRarity: (value: 4 | 5 | null) => void
  onElement: (value: ElementKey | null) => void
}) {
  return <>
    <div className="filter-group collection-rarity-chips" aria-label="Filtrer par rareté">
      {([5, 4] as const).map(value => <button type="button" key={value} className={`filter-chip rarity-${value}${rarity === value ? ' active' : ''}`} aria-label={`Filtrer les personnages ${value} étoiles`} aria-pressed={rarity === value} onClick={() => onRarity(rarity === value ? null : value)}><span aria-hidden="true">★</span></button>)}
    </div>
    <div className="element-filters collection-element-chips" aria-label="Filtrer par élément">
      {elementKeys.map(value => <button type="button" key={value} className={element === value ? 'active' : ''} aria-label={labels[value]} aria-pressed={element === value} onClick={() => onElement(element === value ? null : value)}><GameAssetIcon className="filter-element-icon" src={getElementAssetPath(value)} fallback="◆" /></button>)}
    </div>
  </>
}
