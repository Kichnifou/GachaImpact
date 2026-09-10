import { useCallback, useEffect, useMemo, useState } from 'react'
import type { BoxCharacterDto, InventoryItemDto, InventoryResourceDto, PlayerBoxDto, PlayerInventoryDto, PlayerResourcesDto, PlayerTeamsDto, StellaUseDto } from '../api/types'
import { isAmbiguousMutationError } from '../api/mutation-errors'
import { presentStellaResult, type StellaResultPresentation } from '../box/stella-result-presentation'
import { MASTERLESS_STELLA_FORTUNA_KEY } from '../inventory/inventory-memory-cache'
import { collectionCompletion, inventoryCategoryCount, presentInventory, type InventoryCategory, type InventoryEntry } from '../inventory/inventory-presentation'
import BoxCharacterCard from '../components/BoxCharacterCard'
import BoxCharacterDetailModal from '../components/BoxCharacterDetailModal'
import GameAssetIcon from '../components/GameAssetIcon'
import { apiErrorMessage, elementLabels, formatResourceAmount } from '../utils/formatters'
import { currencyAssetPaths, getElementAssetPath } from '../utils/gameAssets'

type InventoryScreenProps = {
  initialInventory: PlayerInventoryDto | null
  resources: PlayerResourcesDto
  onLoad: () => Promise<PlayerInventoryDto>
  onNavigateBank: () => void
  onLoadBox: () => Promise<PlayerBoxDto>
  onSetBoxFavorite: (characterId: string, favorite: boolean) => Promise<BoxCharacterDto>
  onUseStella: (characterId: string) => Promise<StellaUseDto>
  stellaRetryCharacterId: string | null
  onLoadTeams: () => Promise<PlayerTeamsDto>
}

const categories: readonly { id: InventoryCategory; label: string; icon: string }[] = [
  { id: 'all', label: 'Tout', icon: '✦' },
  { id: 'resources', label: 'Ressources', icon: '◇' },
  { id: 'objects', label: 'Objets', icon: '◆' },
  { id: 'collection', label: 'Collection', icon: '▣' },
]

function InventoryScreen({ initialInventory, resources, onLoad, onNavigateBank, onLoadBox, onSetBoxFavorite, onUseStella, stellaRetryCharacterId, onLoadTeams }: InventoryScreenProps) {
  const [inventory, setInventory] = useState(initialInventory)
  const [activeCategory, setActiveCategory] = useState<InventoryCategory>('all')
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<InventoryItemDto | null>(null)
  const [stellaPickerOpen, setStellaPickerOpen] = useState(false)
  const [box, setBox] = useState<PlayerBoxDto | null>(null)
  const [boxError, setBoxError] = useState<string | null>(null)
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null)
  const [favoritePendingId, setFavoritePendingId] = useState<string | null>(null)
  const [stellaPendingId, setStellaPendingId] = useState<string | null>(null)
  const [stellaFeedback, setStellaFeedback] = useState<StellaResultPresentation | null>(null)
  const [stellaRetryId, setStellaRetryId] = useState(stellaRetryCharacterId)

  const load = useCallback(async () => {
    try {
      const next = await onLoad()
      setInventory(next)
      setError(null)
      return next
    } catch (reason) {
      setError(apiErrorMessage(reason))
      throw reason
    }
  }, [onLoad])

  useEffect(() => {
    let active = true
    void onLoad().then((next) => { if (active) { setInventory(next); setError(null) } })
      .catch((reason) => { if (active) setError(apiErrorMessage(reason)) })
    return () => { active = false }
  }, [onLoad])

  useEffect(() => {
    if (!stellaFeedback) return
    const timer = window.setTimeout(() => setStellaFeedback(null), 3_600)
    return () => window.clearTimeout(timer)
  }, [stellaFeedback])

  const entries = useMemo(() => inventory ? presentInventory(inventory.resources, inventory.items, resources, activeCategory, query) : [], [activeCategory, inventory, query, resources])
  const groups = useMemo(() => groupInventoryEntries(entries, activeCategory), [activeCategory, entries])
  const completion = inventory ? collectionCompletion(inventory.items) : { owned: 0, total: 0 }
  const stella = inventory?.items.find(({ externalKey }) => externalKey === MASTERLESS_STELLA_FORTUNA_KEY) ?? null
  const selectedCharacter = box?.characters.find(({ id }) => id === selectedCharacterId) ?? null

  const openStellaPicker = async () => {
    setSelectedItem(null)
    setStellaPickerOpen(true)
    setBoxError(null)
    try { setBox(await onLoadBox()) }
    catch (reason) { setBoxError(apiErrorMessage(reason)) }
  }

  const toggleFavorite = async (character: BoxCharacterDto) => {
    if (favoritePendingId) return
    setFavoritePendingId(character.id)
    try {
      const updated = await onSetBoxFavorite(character.id, !character.favorite)
      setBox((current) => current ? { ...current, characters: current.characters.map((item) => item.id === updated.id ? updated : item) } : current)
    } catch (reason) { setBoxError(apiErrorMessage(reason)) }
    finally { setFavoritePendingId(null) }
  }

  const submitStella = async (character: BoxCharacterDto) => {
    if (stellaPendingId) return
    setStellaPendingId(character.id)
    setStellaFeedback(null)
    try {
      const result = await onUseStella(character.id)
      setInventory((current) => current ? applyStellaToInventory(current, result) : current)
      setBox((current) => current ? applyStellaToBox(current, result) : current)
      setStellaFeedback(presentStellaResult(character, result))
      setStellaRetryId(null)
      setError(null)
      try { await onLoadTeams() }
      catch { setBoxError('Stella utilisée, mais l’équipe n’a pas pu être actualisée. Rouvrez cet écran pour la synchroniser.') }
    } catch (reason) {
      if (isAmbiguousMutationError(reason)) {
        setStellaRetryId(character.id)
        setBoxError('Résultat incertain : réessayez sur ce même personnage pour reprendre la même opération sans double utilisation.')
      } else {
        setStellaRetryId(null)
        setBoxError(apiErrorMessage(reason))
      }
    } finally { setStellaPendingId(null) }
  }

  if (!inventory && !error) return <InventoryStatus title="Ouverture de votre Sac…" detail="Synchronisation de vos ressources et objets." />
  if (!inventory) return <InventoryStatus title="Impossible de charger votre Sac" detail={error ?? 'Erreur inconnue'} onRetry={() => void load()} />

  return <div className="screen-content inventory-screen">
    <div className="inventory-layout">
      <nav className="inventory-categories panel" aria-label="Catégories du Sac">
        {categories.map((category) => <button type="button" className={activeCategory === category.id ? 'active' : ''} onClick={() => setActiveCategory(category.id)} key={category.id}>
          <span aria-hidden="true">{category.icon}</span><strong>{category.label}</strong><small>{inventoryCategoryCount(inventory, category.id)}</small>
        </button>)}
      </nav>

      <section className={`inventory-content inventory-${activeCategory} panel`}>
        <div className="inventory-heading">
          <div><span className="eyebrow">Sac personnel</span><h2>{categories.find(({ id }) => id === activeCategory)?.label}</h2></div>
          <label className="search-field compact-search"><span aria-hidden="true">⌕</span><span className="sr-only">Rechercher dans le Sac</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher…" /></label>
        </div>
        {activeCategory === 'collection' && <div className="inventory-collection-summary"><span>Collection connue</span><strong>{completion.owned} / {completion.total}</strong></div>}
        {error && <p className="inventory-inline-error" role="alert">{error}</p>}
        {entries.length ? <div className="inventory-groups">{groups.map((group) => <section className="inventory-group" aria-labelledby={`inventory-group-${group.id}`} key={group.id}>
          <header className="inventory-group-heading"><span id={`inventory-group-${group.id}`}>{group.label}</span></header>
          <div className="inventory-grid">{group.entries.map((entry) => <InventoryCard entry={entry} onNavigateBank={onNavigateBank} onSelectItem={setSelectedItem} onUseStella={() => void openStellaPicker()} key={entry.type === 'resource' ? entry.resource.key : entry.item.id} />)}</div>
        </section>)}</div>
          : <div className="inventory-empty" role="status"><span aria-hidden="true">◇</span><strong>{query ? 'Aucun résultat' : emptyTitle(activeCategory)}</strong><p>{query ? 'Modifiez votre recherche pour retrouver une entrée.' : emptyDetail(activeCategory)}</p></div>}
      </section>
    </div>
    {selectedItem && <ItemDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} onUseStella={selectedItem.externalKey === MASTERLESS_STELLA_FORTUNA_KEY ? () => void openStellaPicker() : undefined} />}
    {stellaPickerOpen && <StellaPicker box={box} error={boxError} stellaQuantity={stella?.quantity ?? '0'} favoritePendingId={favoritePendingId} onClose={() => { setStellaPickerOpen(false); setSelectedCharacterId(null); setBoxError(null); setStellaFeedback(null) }} onSelect={setSelectedCharacterId} onRetry={() => void openStellaPicker()} onToggleFavorite={toggleFavorite} />}
    {selectedCharacter && <BoxCharacterDetailModal character={selectedCharacter} stellaQuantity={stella?.quantity ?? '0'} stellaRetryAvailable={stellaRetryId === selectedCharacter.id} favoritePending={favoritePendingId === selectedCharacter.id} stellaPending={stellaPendingId === selectedCharacter.id} stellaFeedback={stellaFeedback} actionError={boxError} onToggleFavorite={() => void toggleFavorite(selectedCharacter)} onUseStella={() => void submitStella(selectedCharacter)} onClose={() => { setSelectedCharacterId(null); setStellaFeedback(null); setBoxError(null) }} />}
  </div>
}

function InventoryCard({ entry, onNavigateBank, onSelectItem, onUseStella }: { entry: InventoryEntry; onNavigateBank: () => void; onSelectItem: (item: InventoryItemDto) => void; onUseStella: () => void }) {
  if (entry.type === 'resource') {
    const content = <><ResourceIcon resource={entry.resource} /><div><strong>{entry.resource.displayName}</strong><p>{resourceDetail(entry.resource, entry.amount)}</p></div><span className="item-amount">× {formatResourceAmount(entry.amount)}</span></>
    return entry.resource.key === 'moras'
      ? <button type="button" className="inventory-item inventory-resource-card mora" onClick={onNavigateBank}>{content}<small className="inventory-card-action">Accéder à la Banque →</small></button>
      : <article className="inventory-item inventory-resource-card">{content}</article>
  }
  const owned = BigInt(entry.item.quantity) > 0n
  return <article className={`inventory-item inventory-object-card${owned ? '' : ' unowned'}`} title={entry.item.acquisitionHint ?? undefined}>
    <button type="button" className="inventory-item-main" onClick={() => onSelectItem(entry.item)}>
      <span className="item-icon violet" aria-hidden="true"><span className="item-icon-glyph">{owned ? '✦' : '?'}</span></span><div><strong>{entry.item.displayName}</strong><p>{entry.item.description ?? 'Aucune description disponible.'}</p></div><span className="item-amount">× {formatResourceAmount(entry.item.quantity)}</span>
    </button>
    {entry.item.externalKey === MASTERLESS_STELLA_FORTUNA_KEY && <button type="button" className="inventory-use-button" disabled={!owned} onClick={onUseStella}>Utiliser</button>}
  </article>
}

function ResourceIcon({ resource }: { resource: InventoryResourceDto }) {
  const src = resource.key === 'primogems' ? currencyAssetPaths.primogem : resource.key === 'moras' ? currencyAssetPaths.mora : getElementAssetPath(resource.elementKey ?? resource.key.slice(10))
  return <span className={`item-icon${resource.elementKey ? ` ${resource.elementKey}` : resource.key === 'moras' ? ' gold' : ' blue'}`}><GameAssetIcon className="inventory-resource-icon" src={src} fallback="✦" /></span>
}

function groupInventoryEntries(entries: readonly InventoryEntry[], category: InventoryCategory) {
  const resources = entries.filter((entry) => entry.type === 'resource')
  const primaryResources = resources.filter((entry) => entry.type === 'resource' && (entry.resource.key === 'primogems' || entry.resource.key === 'moras'))
  const particles = resources.filter((entry) => entry.type === 'resource' && entry.resource.key.startsWith('particles_'))
  const objects = entries.filter((entry) => entry.type === 'item' && entry.item.section === 'objects')
  const collection = entries.filter((entry) => entry.type === 'item' && entry.item.section === 'collection')
  if (category === 'resources') return [
    { id: 'currencies', label: 'Monnaie', entries: primaryResources },
    { id: 'particles', label: 'Particules', entries: particles },
  ].filter(({ entries: groupEntries }) => groupEntries.length > 0)
  if (category === 'all') return [
    { id: 'resources', label: 'Ressources', entries: resources },
    { id: 'objects', label: 'Progression', entries: objects },
    { id: 'collection', label: 'Objets rares', entries: collection },
  ].filter(({ entries: groupEntries }) => groupEntries.length > 0)
  return [{ id: category, label: category === 'objects' ? 'Progression' : 'Objets rares', entries }]
}

function StellaPicker({ box, error, stellaQuantity, favoritePendingId, onClose, onSelect, onRetry, onToggleFavorite }: { box: PlayerBoxDto | null; error: string | null; stellaQuantity: string; favoritePendingId: string | null; onClose: () => void; onSelect: (id: string) => void; onRetry: () => void; onToggleFavorite: (character: BoxCharacterDto) => void }) {
  const eligible = box?.characters.filter(({ rarity }) => rarity === 5) ?? []
  return <div className="modal-layer inventory-stella-layer" role="presentation" onMouseDown={onClose}>
    <section className="floating-panel inventory-stella-picker" role="dialog" aria-modal="true" aria-labelledby="inventory-stella-title" onMouseDown={(event) => event.stopPropagation()}>
      <header className="floating-panel-heading"><div><span className="eyebrow">Masterless Stella Fortuna × {stellaQuantity}</span><h2 id="inventory-stella-title">Choisir un personnage 5★</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fermer le choix"><span className="icon-glyph">×</span></button></header>
      {error && <p className="inventory-picker-error" role="alert">{error}</p>}
      {!box && !error ? <InventoryStatus title="Ouverture de votre Box…" detail="Recherche des personnages 5★ possédés." />
        : !box ? <InventoryStatus title="Box indisponible" detail={error ?? 'Erreur inconnue'} onRetry={onRetry} />
        : eligible.length === 0 ? <InventoryStatus title="Aucun personnage 5★ éligible" detail="Obtenez un personnage 5★ avant d’utiliser une Stella." />
        : <div className="inventory-stella-grid">{eligible.map((character) => <BoxCharacterCard character={character} favoritePending={favoritePendingId === character.id} onOpen={() => onSelect(character.id)} onToggleFavorite={() => onToggleFavorite(character)} key={character.id} />)}</div>}
    </section>
  </div>
}

function ItemDetailModal({ item, onClose, onUseStella }: { item: InventoryItemDto; onClose: () => void; onUseStella?: () => void }) {
  return <div className="modal-layer" role="presentation" onMouseDown={onClose}><section className="floating-panel inventory-item-detail" role="dialog" aria-modal="true" aria-labelledby="inventory-item-title" onMouseDown={(event) => event.stopPropagation()}>
    <header className="floating-panel-heading"><span className="eyebrow">{item.section === 'collection' ? 'Collection' : 'Objet'}</span><button type="button" className="icon-button" onClick={onClose} aria-label="Fermer la fiche"><span className="icon-glyph">×</span></button></header>
    <span className="item-icon violet" aria-hidden="true">{BigInt(item.quantity) > 0n ? '✦' : '?'}</span><h2 id="inventory-item-title">{item.displayName}</h2><strong>× {formatResourceAmount(item.quantity)}</strong><p>{item.description ?? 'Aucune description disponible.'}</p>{item.acquisitionHint && <small>{item.acquisitionHint}</small>}{onUseStella && <button type="button" className="inventory-use-button" disabled={BigInt(item.quantity) === 0n} onClick={onUseStella}>Utiliser</button>}
  </section></div>
}

function InventoryStatus({ title, detail, onRetry }: { title: string; detail: string; onRetry?: () => void }) {
  return <section className="panel inventory-status" role={onRetry ? 'alert' : 'status'}><span aria-hidden="true">◇</span><h2>{title}</h2><p>{detail}</p>{onRetry && <button type="button" onClick={onRetry}>Réessayer</button>}</section>
}

function applyStellaToInventory(inventory: PlayerInventoryDto, result: StellaUseDto): PlayerInventoryDto {
  return { ...inventory, items: inventory.items.map((item) => item.externalKey === MASTERLESS_STELLA_FORTUNA_KEY ? { ...item, quantity: result.stella.quantity } : item) }
}

function applyStellaToBox(box: PlayerBoxDto, result: StellaUseDto): PlayerBoxDto {
  const previous = box.characters.find(({ id }) => id === result.character.id)
  return { ...box, characters: box.characters.map((character) => character.id === result.character.id ? result.character : character), stella: result.stella, summary: { ...box.summary, c6: box.summary.c6 + (previous?.constellation !== 6 && result.character.constellation === 6 ? 1 : 0) } }
}

function resourceDetail(resource: InventoryResourceDto, amount: string) {
  if (resource.key === 'primogems') return `${BigInt(amount) / 160n} vœux possibles`
  if (resource.key === 'moras') return 'Monnaie du jeu'
  return `Particules ${resource.elementKey ? elementLabels[resource.elementKey] : ''}`
}

function emptyTitle(category: InventoryCategory) { return category === 'collection' ? 'Collection encore vide' : category === 'objects' ? 'Aucun objet disponible' : 'Aucune entrée disponible' }
function emptyDetail(category: InventoryCategory) { return category === 'collection' ? 'Les éléments de collection connus apparaîtront ici.' : category === 'objects' ? 'Vos objets actifs apparaîtront ici.' : 'Le serveur ne retourne actuellement aucune entrée.' }

export default InventoryScreen
