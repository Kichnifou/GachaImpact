import { useEffect, useState } from 'react'
import type { PlayerBrowserCandidate, PlayerBrowserPage, PlayerBrowserQuery } from './PlayerSelectionBrowser'
import { apiErrorMessage } from '../utils/formatters'

export default function PlayerQuickSearch<Candidate extends PlayerBrowserCandidate>({ onListPlayers, onSelect }: {
  onListPlayers: (query: PlayerBrowserQuery) => Promise<PlayerBrowserPage<Candidate>>
  onSelect: (player: Candidate) => void
}) {
  const [query, setQuery] = useState(''), [open, setOpen] = useState(false)
  const [players, setPlayers] = useState<readonly Candidate[]>([]), [error, setError] = useState('')
  useEffect(() => {
    if (!open || !query.trim()) return
    let active = true
    const timer = setTimeout(() => {
      void onListPlayers({ query, elementKey: null, sort: 'name', direction: 'asc', page: 1 })
        .then(result => { if (active) { setPlayers(result.players); setError('') } })
        .catch(reason => { if (active) setError(apiErrorMessage(reason)) })
    }, 120)
    return () => { active = false; clearTimeout(timer) }
  }, [query, open, onListPlayers])
  return <div className="player-quick-search" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }} onKeyDown={event => { if (event.key === 'Escape') setOpen(false) }}>
    <label className="moderation-target-search"><span>Recherche rapide d’un joueur</span><input type="search" placeholder="Saisir un pseudo…" autoComplete="off" value={query} onChange={event => { setQuery(event.target.value); setPlayers([]); setError(''); setOpen(true) }} /></label>
    {open && query.trim() && (players.length > 0 || error) && <div className="moderation-target-results">{error ? <p role="alert">{error}</p> : players.map(player => <button type="button" key={player.id} onClick={() => { onSelect(player); setQuery(player.displayName); setOpen(false) }}><strong>{player.displayName}</strong></button>)}</div>}
  </div>
}
