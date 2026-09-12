import { useEffect, useMemo, useRef, useState } from 'react'
import type { BoxCharacterDto, BoxSortPreferenceDto, DailyCombatDto, ElementKey, ExpeditionClaimDto, ExpeditionDto, ExpeditionStartDto, PlayerBoxDto, StellaUseDto } from '../api/types'
import type { BoxConstellationFilter, BoxElementFilter, BoxFilters, BoxRarityTab, BoxSortKey } from '../box/box-presentation'
import { boxElements, initialBoxFiltersWithPreference, presentBoxCharacters } from '../box/box-presentation'
import { useBoxCollection } from '../box/use-box-collection'
import type { StellaResultPresentation } from '../box/stella-result-presentation'
import BoxCharacterCard from '../components/BoxCharacterCard'
import BoxCharacterDetailModal from '../components/BoxCharacterDetailModal'
import GameAssetIcon from '../components/GameAssetIcon'
import ScrollableScreenPanel from '../components/ScrollableScreenPanel'
import { apiErrorMessage, elementLabels, formatResourceAmount } from '../utils/formatters'
import { getElementAssetPath } from '../utils/gameAssets'
import { createExpeditionIdempotencyKey } from '../expedition/expedition-intent'
import { prioritizeReady } from '../expedition/expedition-presentation'

type BoxScreenProps = {
  initialBox: PlayerBoxDto | null
  onLoadBox: () => Promise<PlayerBoxDto>
  onSetFavorite: (characterId: string, favorite: boolean) => Promise<BoxCharacterDto>
  onSetSortPreference: (preference: BoxSortPreferenceDto) => Promise<BoxSortPreferenceDto>
  onUseStella: (characterId: string) => Promise<StellaUseDto>
  stellaRetryCharacterId: string | null
  dailyCombat?: DailyCombatDto
  expedition?: ExpeditionDto
  openCharacterIntent?: { characterId: string; token: string } | null
  onOpenCharacterIntentConsumed?: (token: string) => void
  onLoadExpedition?: () => Promise<ExpeditionDto>
  onStartExpedition?: (characterId: string, idempotencyKey: string) => Promise<ExpeditionStartDto>
  onClaimExpedition?: (idempotencyKey: string) => Promise<ExpeditionClaimDto>
  onNotificationsChanged?: () => Promise<unknown>
}

function BoxScreen({ initialBox, dailyCombat, expedition = idleExpedition, openCharacterIntent = null, onOpenCharacterIntentConsumed = () => undefined, onLoadExpedition = async () => idleExpedition, onStartExpedition = async () => { throw new Error('Expédition indisponible.') }, onClaimExpedition = async () => { throw new Error('Expédition indisponible.') }, onNotificationsChanged = async () => undefined, onLoadBox, onSetFavorite, onSetSortPreference, onUseStella, stellaRetryCharacterId }: BoxScreenProps) {
  const [filters, setFilters] = useState<BoxFilters>(() => initialBoxFiltersWithPreference(initialBox?.preference))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const consumedOpenIntentToken = useRef<string | null>(null)
  const { box, error, setError, load, favoritePendingId, stellaPendingId, stellaFeedback, setStellaFeedback, stellaRetryId, toggleFavorite, useStella } = useBoxCollection({ initialBox, onLoadBox, onSetFavorite, onUseStella, stellaRetryCharacterId })
  const preferenceInteractionRevision = useRef(0)
  const preferenceSaveQueue = useRef(Promise.resolve())
  const [expeditionPending, setExpeditionPending] = useState(false)
  const [expeditionIntent, setExpeditionIntent] = useState<{ action: 'start' | 'claim'; characterId: string; key: string } | null>(null)
  const [expeditionFeedback, setExpeditionFeedback] = useState<string | null>(null)

  useEffect(() => {
    if (!box || preferenceInteractionRevision.current > 0) return
    setFilters((current) => ({ ...current, sort: box.preference.sortKey, direction: box.preference.direction }))
  }, [box])
  useEffect(() => {
    if (!openCharacterIntent || consumedOpenIntentToken.current === openCharacterIntent.token) return
    consumedOpenIntentToken.current = openCharacterIntent.token
    setSelectedId(openCharacterIntent.characterId)
    onOpenCharacterIntentConsumed(openCharacterIntent.token)
  }, [onOpenCharacterIntentConsumed, openCharacterIntent])
  useEffect(() => {
    if (expedition.operationalStatus !== 'RUNNING' || !expedition.readyAt) return
    const delay = Math.max(0, Date.parse(expedition.readyAt) - Date.now()) + 100
    const timer = window.setTimeout(() => { void onLoadExpedition().then(() => onNotificationsChanged()).catch(() => undefined) }, delay)
    return () => window.clearTimeout(timer)
  }, [expedition.operationalStatus, expedition.readyAt, onLoadExpedition, onNotificationsChanged])
  useEffect(() => { const refresh = () => void onLoadExpedition().catch(() => undefined); const visible = () => { if (document.visibilityState === 'visible') refresh() }; window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', visible); return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', visible) } }, [onLoadExpedition])

  const runExpedition = async (action: 'start' | 'claim', character: BoxCharacterDto) => {
    if (expeditionPending) return
    const intent = expeditionIntent?.action === action && expeditionIntent.characterId === character.id ? expeditionIntent : { action, characterId: character.id, key: createExpeditionIdempotencyKey() }
    setExpeditionIntent(intent); setExpeditionPending(true); setExpeditionFeedback(null); setError(null)
    try {
      if (action === 'start') { await onStartExpedition(character.id, intent.key); setExpeditionFeedback(`${character.name} est parti en expédition.`) }
      else { const result = await onClaimExpedition(intent.key); setExpeditionFeedback(expeditionRewardLabel(result)); await onNotificationsChanged() }
      setExpeditionIntent(null)
    } catch (reason) { setError(apiErrorMessage(reason)) }
    finally { setExpeditionPending(false) }
  }

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
  return <BoxView box={box} dailyCombat={dailyCombat} expedition={expedition} expeditionPending={expeditionPending} expeditionFeedback={expeditionFeedback} filters={filters} error={error} favoritePendingId={favoritePendingId} stellaPendingId={stellaPendingId} stellaRetryId={stellaRetryId} stellaFeedback={stellaFeedback} selected={selected} onFilters={changeFilters} onSelect={setSelectedId} onToggleFavorite={toggleFavorite} onUseStella={useStella} onExpedition={runExpedition} onCloseDetail={() => { setSelectedId(null); setStellaFeedback(null); setExpeditionFeedback(null) }} />
}

export function BoxView({ box, dailyCombat, expedition = idleExpedition, expeditionPending = false, expeditionFeedback = null, filters, error, favoritePendingId, stellaPendingId, stellaRetryId, stellaFeedback, selected, onFilters, onSelect, onToggleFavorite, onUseStella, onExpedition = () => undefined, onCloseDetail }: {
  box: PlayerBoxDto
  dailyCombat?: DailyCombatDto
  expedition?: ExpeditionDto
  expeditionPending?: boolean
  expeditionFeedback?: string | null
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
  onExpedition?: (action: 'start' | 'claim', character: BoxCharacterDto) => void
  onCloseDetail: () => void
}) {
  const visibleCharacters = useMemo(() => prioritizeReady(presentBoxCharacters(box.characters, filters), expedition), [box.characters, expedition, filters])
  return <div className="screen-content collection-screen box-screen long-screen-layout">
    <ScrollableScreenPanel className="collection-screen-panel" bodyClassName="collection-results-body" fixed={<>
      <BoxSummary summary={box.summary} />
      <BoxFiltersBar filters={filters} onChange={onFilters} />
      <p className={`box-inline-error${error ? '' : ' empty'}`} role={error ? 'alert' : undefined}>{error ?? '\u00a0'}</p>
    </>}>
    {box.characters.length === 0 ? <BoxStatus kind="empty" title="Votre Box est encore vide" detail="Vos prochains personnages obtenus apparaîtront ici." />
      : visibleCharacters.length === 0 ? <BoxStatus kind="empty" title="Aucun personnage trouvé" detail="Modifiez votre recherche ou vos filtres pour retrouver vos personnages." />
      : <section className="character-grid" aria-label="Personnages possédés">
        {visibleCharacters.map((character) => <BoxCharacterCard character={character} statusLabel={expedition.activeCharacter?.id === character.id ? expedition.operationalStatus === 'READY' ? '✅ À récupérer' : expedition.operationalStatus === 'RUNNING' ? '🧭 En expédition' : undefined : undefined} favoritePending={favoritePendingId === character.id} onOpen={() => onSelect(character.id)} onToggleFavorite={() => onToggleFavorite(character)} key={character.id} />)}
      </section>}
    </ScrollableScreenPanel>
    {selected && <BoxCharacterDetailModal character={selected} combatState={combatStateFor(dailyCombat, selected.id)} expedition={expedition} expeditionPending={expeditionPending} expeditionFeedback={expeditionFeedback} stellaQuantity={box.stella.quantity} stellaRetryAvailable={stellaRetryId === selected.id} favoritePending={favoritePendingId === selected.id} stellaPending={stellaPendingId === selected.id} stellaFeedback={stellaFeedback} actionError={error} onToggleFavorite={() => onToggleFavorite(selected)} onUseStella={() => onUseStella(selected)} onStartExpedition={() => onExpedition('start', selected)} onClaimExpedition={() => onExpedition('claim', selected)} onClose={onCloseDetail} />}
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
function combatStateFor(combat: DailyCombatDto | undefined, characterId: string) { const character = combat?.availableCharacters.find(({ id }) => id === characterId); return combat && character ? { ko: combat.koCharacterIds.includes(characterId), stats: character.combatStats } : undefined }
function expeditionRewardLabel(result: ExpeditionClaimDto) { const amount = formatResourceAmount(result.reward.amount); if (result.reward.kind === 'primogems') return `+${amount} Primogemmes`; if (result.reward.kind === 'moras') return `+${amount} Moras`; const element = result.reward.resourceKey.replace('particles_', '') as ElementKey; return `+${amount} particules ${elementLabels[element] ?? ''}`.trim() }
const idleExpedition: ExpeditionDto = { businessDate: '', operationalStatus: 'IDLE', departureUsedToday: false, canStartToday: false, activeCharacter: null, departedAt: null, readyAt: null, remainingSeconds: 0, startedOnCurrentBusinessDate: false, totalCompleted: '0' }

export default BoxScreen
