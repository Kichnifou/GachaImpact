import { useEffect, useState, type ReactNode } from 'react'
import { elementKeys, type ElementKey } from '../api/types'
import { apiErrorMessage } from '../utils/formatters'

export type PlayerBrowserQuery = Readonly<{ query: string; elementKey: ElementKey | null; tester?: 'all' | 'tester' | 'non-tester'; sort: 'name' | 'level'; direction: 'asc' | 'desc'; page: number }>
export type PlayerBrowserCandidate = Readonly<{ id: string; displayName: string; level: number; elementKey: ElementKey | null }>
export type PlayerBrowserPage<Candidate extends PlayerBrowserCandidate> = Readonly<{ players: readonly Candidate[]; page: number; pageSize: 10; total: number; totalPages: number }>
type Props<Candidate extends PlayerBrowserCandidate> = Readonly<{
  eyebrow: string; title: string; selectedPlayerId: string
  onListPlayers: (query: PlayerBrowserQuery) => Promise<PlayerBrowserPage<Candidate>>
  onConfirm: (player: Candidate) => void; onClose: () => void
  showTesterFilter?: boolean; renderBadge?: (player: Candidate) => ReactNode; searchOnly?: boolean
}>
const elementLabels: Record<ElementKey, string> = { pyro: 'Pyro', hydro: 'Hydro', cryo: 'Cryo', electro: 'Électro', anemo: 'Anémo', geo: 'Géo', dendro: 'Dendro' }

export default function PlayerSelectionBrowser<Candidate extends PlayerBrowserCandidate>({ eyebrow, title, selectedPlayerId, onListPlayers, onConfirm, onClose, showTesterFilter = false, renderBadge, searchOnly = false }: Props<Candidate>) {
  const [query, setQuery] = useState('')
  const [elementKey, setElementKey] = useState<ElementKey | null>(null)
  const [tester, setTester] = useState<'all' | 'tester' | 'non-tester'>('all')
  const [sort, setSort] = useState<'name' | 'level'>('name')
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<PlayerBrowserPage<Candidate> | null>(null)
  const [temporarySelectionId, setTemporarySelectionId] = useState(selectedPlayerId)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(!searchOnly)
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])
  useEffect(() => {
    let active = true
    if (searchOnly && !query.trim()) return
    const load = () => { void onListPlayers({ query, elementKey, ...(showTesterFilter ? { tester } : {}), sort, direction, page })
      .then((next) => { if (!active) return; setError(null); setResult(next); if (next.page !== page) setPage(next.page) })
      .catch((reason) => { if (active) setError(apiErrorMessage(reason)) })
      .finally(() => { if (active) setLoading(false) }) }
    const timer = searchOnly ? window.setTimeout(load, 250) : undefined
    if (!searchOnly) load()
    return () => { active = false; window.clearTimeout(timer) }
  }, [direction, elementKey, onListPlayers, page, query, showTesterFilter, sort, tester, searchOnly])
  const resetPage = (action: () => void) => { setLoading(true); setPage(1); action() }
  const selected = result?.players.find((candidate) => candidate.id === temporarySelectionId)
  return <div className="modal-layer" role="presentation" onMouseDown={onClose}>
    <section className={`floating-panel moderation-player-browser${showTesterFilter ? '' : ' event-player-browser'}${searchOnly ? ' player-search-only' : ''}`} role="dialog" aria-modal="true" aria-labelledby="player-selection-browser-title" onMouseDown={(event) => event.stopPropagation()}>
      <header className="floating-panel-heading"><div><span className="eyebrow">{eyebrow}</span><h2 id="player-selection-browser-title">{title}</h2></div><button type="button" className="icon-button" aria-label="Fermer le sélecteur" onClick={onClose}><span className="icon-glyph">×</span></button></header>
      <div className="moderation-browser-filters">
        <label className="moderation-target-search"><span>Rechercher</span><input type="search" value={query} autoComplete="off" placeholder="Pseudo du joueur…" onChange={(event) => { const next = event.target.value; resetPage(() => setQuery(next)); if (searchOnly && !next.trim()) { setResult(null); setLoading(false); setError(null) } }} /></label>
        <label><span>Élément</span><select value={elementKey ?? 'all'} onChange={(event) => resetPage(() => setElementKey(event.target.value === 'all' ? null : event.target.value as ElementKey))}><option value="all">Tous</option>{elementKeys.map((element) => <option value={element} key={element}>{elementLabels[element]}</option>)}</select></label>
        {showTesterFilter && <label><span>Rôle Testeur</span><select value={tester} onChange={(event) => resetPage(() => setTester(event.target.value as typeof tester))}><option value="all">Tous</option><option value="tester">Testeur</option><option value="non-tester">Non-testeur</option></select></label>}
        <label><span>Trier par</span><select value={sort} onChange={(event) => resetPage(() => setSort(event.target.value as typeof sort))}><option value="name">Nom</option><option value="level">Niveau</option></select></label>
        <button type="button" className="sort-direction-button" aria-label={`Tri ${direction === 'asc' ? 'croissant' : 'décroissant'}`} onClick={() => resetPage(() => setDirection((value) => value === 'asc' ? 'desc' : 'asc'))}>{direction === 'asc' ? '↑' : '↓'}</button>
      </div>
      <div className="moderation-browser-results" aria-busy={loading}>
        {error ? <p className="moderation-target-empty error" role="alert">{error}</p> : result?.players.length ? <>{result.players.map((candidate) => <button type="button" className={candidate.id === temporarySelectionId ? 'active' : ''} aria-pressed={candidate.id === temporarySelectionId} onClick={() => setTemporarySelectionId(candidate.id)} key={candidate.id}><span className="moderation-player-identity"><strong>{candidate.displayName}</strong><small>Niveau {candidate.level} · {candidate.elementKey ? elementLabels[candidate.elementKey] : 'Élément non choisi'}</small></span>{renderBadge?.(candidate)}</button>)}{Array.from({ length: 10 - result.players.length }, (_, index) => <span className="moderation-browser-placeholder" aria-hidden="true" key={`placeholder-${index}`} />)}</> : <p className="moderation-target-empty" role="status">{loading ? 'Chargement des joueurs…' : 'Aucun joueur trouvé.'}</p>}
      </div>
      <footer className="moderation-browser-footer"><div className="moderation-browser-pagination"><button type="button" disabled={loading || (result?.page ?? 1) <= 1} onClick={() => { setLoading(true); setPage((value) => Math.max(1, value - 1)) }}>Précédent</button><span>Page {result?.page ?? page} / {result?.totalPages ?? 1} · {result?.total ?? 0} joueur{result?.total === 1 ? '' : 's'}</span><button type="button" disabled={loading || (result?.page ?? page) >= (result?.totalPages ?? 1)} onClick={() => { setLoading(true); setPage((value) => value + 1) }}>Suivant</button></div><div className="moderation-browser-actions"><button type="button" onClick={onClose}>Annuler</button><button type="button" className="primary" disabled={loading || !selected} onClick={() => { if (selected) onConfirm(selected) }}>Choisir ce joueur</button></div></footer>
    </section>
  </div>
}
