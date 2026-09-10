import { useEffect, useMemo, useRef, useState } from 'react'
import type { BoxCharacterDto, BoxSortPreferenceDto, ElementKey, PlayerBoxDto, StellaUseDto } from '../api/types'
import type { BoxConstellationFilter, BoxElementFilter, BoxFilters, BoxRarityTab, BoxSortKey } from '../box/box-presentation'
import { boxElements, initialBoxFiltersWithPreference, presentBoxCharacters } from '../box/box-presentation'
import { useBoxCollection } from '../box/use-box-collection'
import type { StellaResultPresentation } from '../box/stella-result-presentation'
import BoxCharacterCard from '../components/BoxCharacterCard'
import BoxCharacterDetailModal from '../components/BoxCharacterDetailModal'
import GameAssetIcon from '../components/GameAssetIcon'
import { apiErrorMessage } from '../utils/formatters'
import { getElementAssetPath } from '../utils/gameAssets'

type BoxScreenProps = {
  initialBox: PlayerBoxDto | null
  onLoadBox: () => Promise<PlayerBoxDto>
  onSetFavorite: (characterId: string, favorite: boolean) => Promise<BoxCharacterDto>
  onSetSortPreference: (preference: BoxSortPreferenceDto) => Promise<BoxSortPreferenceDto>
  onUseStella: (characterId: string) => Promise<StellaUseDto>
  stellaRetryCharacterId: string | null
}

function BoxScreen({ initialBox, onLoadBox, onSetFavorite, onSetSortPreference, onUseStella, stellaRetryCharacterId }: BoxScreenProps) {
  const [filters, setFilters] = useState<BoxFilters>(() => initialBoxFiltersWithPreference(initialBox?.preference))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { box, error, setError, load, favoritePendingId, stellaPendingId, stellaFeedback, setStellaFeedback, stellaRetryId, toggleFavorite, useStella } = useBoxCollection({ initialBox, onLoadBox, onSetFavorite, onUseStella, stellaRetryCharacterId })
  const preferenceInteractionRevision = useRef(0)
  const preferenceSaveQueue = useRef(Promise.resolve())

  useEffect(() => {
    if (!box || preferenceInteractionRevision.current > 0) return
    setFilters((current) => ({ ...current, sort: box.preference.sortKey, direction: box.preference.direction }))
  }, [box])

  const changeFilters = (next: BoxFilters) => {
    const sortChanged = next.sort !== filters.sort || next.direction !== filters.direction
    setFilters(next)
    if (!sortChanged) return
    preferenceInteractionRevision.current += 1
    const preference = { sortKey: next.sort, direction: next.direction } as const
    preferenceSaveQueue.current = preferenceSaveQueue.current
      .catch(() => undefined)
      .then(async () => {
        try {
          await onSetSortPreference(preference)
          setError(null)
        } catch (reason) {
          setError(`Tri appliqué, mais non sauvegardé : ${apiErrorMessage(reason)}`)
        }
      })
  }

  if (!box && !error) return <BoxStatus kind="loading" title="Ouverture de votre Box…" detail="Synchronisation de vos personnages possédés." />
  if (!box && error) return <BoxStatus kind="error" title="Impossible de charger votre Box" detail={error} onRetry={() => void load()} />
  if (!box) return null

  const selected = box.characters.find(({ id }) => id === selectedId) ?? null
  return <BoxView box={box} filters={filters} error={error} favoritePendingId={favoritePendingId} stellaPendingId={stellaPendingId} stellaRetryId={stellaRetryId} stellaFeedback={stellaFeedback} selected={selected} onFilters={changeFilters} onSelect={setSelectedId} onToggleFavorite={toggleFavorite} onUseStella={useStella} onCloseDetail={() => { setSelectedId(null); setStellaFeedback(null) }} />
}

export function BoxView({ box, filters, error, favoritePendingId, stellaPendingId, stellaRetryId, stellaFeedback, selected, onFilters, onSelect, onToggleFavorite, onUseStella, onCloseDetail }: {
  box: PlayerBoxDto
  filters: BoxFilters
  error: string | null
  favoritePendingId: string | null
  stellaPendingId: string | null
  stellaRetryId: string | null
  stellaFeedback: StellaResultPresentation | null
  selected: BoxCharacterDto | null
  onFilters: (filters: BoxFilters) => void
  onSelect: (characterId: string) => void
  onToggleFavorite: (character: BoxCharacterDto) => void
  onUseStella: (character: BoxCharacterDto) => void
  onCloseDetail: () => void
}) {
  const visibleCharacters = useMemo(() => presentBoxCharacters(box.characters, filters), [box.characters, filters])
  return <div className="screen-content collection-screen box-screen">
    <BoxSummary summary={box.summary} />
    <BoxFiltersBar filters={filters} onChange={onFilters} />
    {error && <p className="box-inline-error" role="alert">{error}</p>}
    {box.characters.length === 0 ? <BoxStatus kind="empty" title="Votre Box est encore vide" detail="Vos prochains personnages obtenus apparaîtront ici." />
      : visibleCharacters.length === 0 ? <BoxStatus kind="empty" title="Aucun personnage trouvé" detail="Modifiez votre recherche ou vos filtres pour retrouver vos personnages." />
      : <section className="character-grid" aria-label="Personnages possédés">
        {visibleCharacters.map((character) => <BoxCharacterCard character={character} favoritePending={favoritePendingId === character.id} onOpen={() => onSelect(character.id)} onToggleFavorite={() => onToggleFavorite(character)} key={character.id} />)}
      </section>}
    {selected && <BoxCharacterDetailModal character={selected} stellaQuantity={box.stella.quantity} stellaRetryAvailable={stellaRetryId === selected.id} favoritePending={favoritePendingId === selected.id} stellaPending={stellaPendingId === selected.id} stellaFeedback={stellaFeedback} actionError={error} onToggleFavorite={() => onToggleFavorite(selected)} onUseStella={() => onUseStella(selected)} onClose={onCloseDetail} />}
  </div>
}

function BoxSummary({ summary }: { summary: PlayerBoxDto['summary'] }) {
  return <div className="collection-summary box-summary" aria-label="Résumé de la Box"><span><strong>{summary.totalOwned}</strong> obtenus</span><span><strong>{summary.fiveStars}</strong> 5★</span><span><strong>{summary.fourStars}</strong> 4★</span><span><strong>{summary.c6}</strong> C6</span></div>
}

function BoxFiltersBar({ filters, onChange }: { filters: BoxFilters; onChange: (filters: BoxFilters) => void }) {
  const update = <Key extends keyof BoxFilters>(key: Key, value: BoxFilters[Key]) => onChange({ ...filters, [key]: value })
  return <div className="box-filter-stack panel">
    <div className="box-filter-primary">
      <label className="search-field"><span aria-hidden="true">⌕</span><span className="sr-only">Rechercher</span><input type="search" value={filters.search} onChange={(event) => update('search', event.target.value)} placeholder="Rechercher dans votre Box…" /></label>
      <div className="filter-group box-tabs" role="tablist" aria-label="Rareté des personnages">{([['all', 'Tous'], [5, '5★'], [4, '4★']] as const).map(([value, label]) => <button type="button" role="tab" aria-selected={filters.tab === value} className={`filter-chip${filters.tab === value ? ' active' : ''}`} onClick={() => update('tab', value as BoxRarityTab)} key={label}>{label}</button>)}</div>
      <label className="sort-select"><span>Trier</span><select value={filters.sort} onChange={(event) => update('sort', event.target.value as BoxSortKey)}><option value="alphabetical">Alphabétique</option><option value="obtainedAt">Date d’obtention</option><option value="constellation">Constellation</option><option value="element">Élément</option></select></label>
      <button type="button" className="box-sort-direction" onClick={() => update('direction', filters.direction === 'asc' ? 'desc' : 'asc')} aria-label={`Tri ${filters.direction === 'asc' ? 'ascendant' : 'descendant'}`}>{filters.direction === 'asc' ? '↑' : '↓'}</button>
    </div>
    <div className="box-filter-secondary">
      <div className="element-filters" aria-label="Filtrer par élément"><button type="button" className={filters.element === 'all' ? 'active' : ''} aria-label="Tous les éléments" onClick={() => update('element', 'all')}>✦</button>{boxElements.map((element) => <button type="button" className={filters.element === element ? 'active' : ''} aria-label={elementLabel(element)} onClick={() => update('element', element as BoxElementFilter)} key={element}><GameAssetIcon className="filter-element-icon" src={getElementAssetPath(element)} fallback="✦" /></button>)}</div>
      <label className="box-constellation-filter"><span>Constellation</span><select value={filters.constellation} onChange={(event) => update('constellation', event.target.value === 'all' ? 'all' : Number(event.target.value) as BoxConstellationFilter)}><option value="all">Toutes</option>{[0,1,2,3,4,5,6].map((value) => <option value={value} key={value}>C{value}</option>)}</select></label>
    </div>
  </div>
}

export function BoxStatus({ kind, title, detail, onRetry }: { kind: 'loading' | 'error' | 'empty'; title: string; detail: string; onRetry?: () => void }) {
  return <section className={`panel box-status ${kind}`} role={kind === 'error' ? 'alert' : 'status'}><span aria-hidden="true">{kind === 'loading' ? '✦' : kind === 'error' ? '!' : '◇'}</span><h2>{title}</h2><p>{detail}</p>{onRetry && <button type="button" onClick={onRetry}>Réessayer</button>}</section>
}

function elementLabel(element: ElementKey) { return ({ pyro: 'Pyro', hydro: 'Hydro', cryo: 'Cryo', electro: 'Électro', anemo: 'Anémo', geo: 'Géo', dendro: 'Dendro' } as const)[element] }

export default BoxScreen
