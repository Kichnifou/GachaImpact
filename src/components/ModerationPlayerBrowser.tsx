import { useEffect, useState } from 'react'

import { elementKeys, type ElementKey, type ModerationPlayerListQuery, type ModerationPlayerPageDto } from '../api/types'
import { apiErrorMessage } from '../utils/formatters'

type Props = {
  selectedPlayerId: string
  onListPlayers: (query: ModerationPlayerListQuery) => Promise<ModerationPlayerPageDto>
  onConfirm: (playerId: string) => void
  onClose: () => void
}

const elementLabels: Record<ElementKey, string> = {
  pyro: 'Pyro', hydro: 'Hydro', cryo: 'Cryo', electro: 'Électro', anemo: 'Anémo', geo: 'Géo', dendro: 'Dendro',
}

function ModerationPlayerBrowser({ selectedPlayerId, onListPlayers, onConfirm, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [elementKey, setElementKey] = useState<ElementKey | null>(null)
  const [tester, setTester] = useState<'all' | 'tester' | 'non-tester'>('all')
  const [sort, setSort] = useState<'name' | 'level'>('name')
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<ModerationPlayerPageDto | null>(null)
  const [temporarySelectionId, setTemporarySelectionId] = useState(selectedPlayerId)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  useEffect(() => {
    let active = true
    void onListPlayers({ query, elementKey, tester, sort, direction, page })
      .then((next) => {
        if (!active) return
        setError(null)
        setResult(next)
        if (next.page !== page) setPage(next.page)
      })
      .catch((reason) => { if (active) setError(apiErrorMessage(reason)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [direction, elementKey, onListPlayers, page, query, sort, tester])

  const resetPage = (action: () => void) => { setLoading(true); setPage(1); action() }

  return <div className="modal-layer" role="presentation" onMouseDown={onClose}>
    <section className="floating-panel moderation-player-browser" role="dialog" aria-modal="true" aria-labelledby="moderation-player-browser-title" onMouseDown={(event) => event.stopPropagation()}>
      <header className="floating-panel-heading">
        <div><span className="eyebrow">Modération</span><h2 id="moderation-player-browser-title">Choisir un joueur</h2></div>
        <button type="button" className="icon-button" aria-label="Fermer le sélecteur" onClick={onClose}><span className="icon-glyph">×</span></button>
      </header>
      <div className="moderation-browser-filters">
        <label className="moderation-target-search"><span>Rechercher</span><input type="search" value={query} autoComplete="off" placeholder="Pseudo du joueur…" onChange={(event) => resetPage(() => setQuery(event.target.value))} /></label>
        <label><span>Élément</span><select value={elementKey ?? 'all'} onChange={(event) => resetPage(() => setElementKey(event.target.value === 'all' ? null : event.target.value as ElementKey))}><option value="all">Tous</option>{elementKeys.map((element) => <option value={element} key={element}>{elementLabels[element]}</option>)}</select></label>
        <label><span>Rôle Testeur</span><select value={tester} onChange={(event) => resetPage(() => setTester(event.target.value as typeof tester))}><option value="all">Tous</option><option value="tester">Testeur</option><option value="non-tester">Non-testeur</option></select></label>
        <label><span>Trier par</span><select value={sort} onChange={(event) => resetPage(() => setSort(event.target.value as typeof sort))}><option value="name">Nom</option><option value="level">Niveau</option></select></label>
        <button type="button" className="sort-direction-button" aria-label={`Tri ${direction === 'asc' ? 'croissant' : 'décroissant'}`} onClick={() => resetPage(() => setDirection((value) => value === 'asc' ? 'desc' : 'asc'))}>{direction === 'asc' ? '↑' : '↓'}</button>
      </div>
      <div className="moderation-browser-results" aria-busy={loading}>
        {error ? <p className="moderation-target-empty error" role="alert">{error}</p>
          : result?.players.length ? <>{result.players.map((candidate) => <button type="button" className={candidate.id === temporarySelectionId ? 'active' : ''} aria-pressed={candidate.id === temporarySelectionId} onClick={() => setTemporarySelectionId(candidate.id)} key={candidate.id}>
            <span className="moderation-player-identity"><strong>{candidate.displayName}</strong><small>Niveau {candidate.level} · {candidate.elementKey ? elementLabels[candidate.elementKey] : 'Élément non choisi'}</small></span>
            {candidate.tester && <span className="moderation-tester-badge">Testeur</span>}
          </button>)}{Array.from({ length: 10 - result.players.length }, (_, index) => <span className="moderation-browser-placeholder" aria-hidden="true" key={`placeholder-${index}`} />)}</>
            : <p className="moderation-target-empty" role="status">{loading ? 'Chargement des joueurs…' : 'Aucun joueur trouvé.'}</p>}
      </div>
      <footer className="moderation-browser-footer">
        <div className="moderation-browser-pagination">
          <button type="button" disabled={loading || (result?.page ?? 1) <= 1} onClick={() => { setLoading(true); setPage((value) => Math.max(1, value - 1)) }}>Précédent</button>
          <span>Page {result?.page ?? page} / {result?.totalPages ?? 1} · {result?.total ?? 0} joueur{result?.total === 1 ? '' : 's'}</span>
          <button type="button" disabled={loading || (result?.page ?? page) >= (result?.totalPages ?? 1)} onClick={() => { setLoading(true); setPage((value) => value + 1) }}>Suivant</button>
        </div>
        <div className="moderation-browser-actions"><button type="button" onClick={onClose}>Annuler</button><button type="button" className="primary" disabled={loading || !temporarySelectionId} onClick={() => onConfirm(temporarySelectionId)}>Choisir ce joueur</button></div>
      </footer>
    </section>
  </div>
}

export default ModerationPlayerBrowser
