import { useEffect, useState, type ReactNode } from 'react'
import type { PlayerBrowserCandidate, PlayerBrowserPage, PlayerBrowserQuery } from './PlayerSelectionBrowser'
import { apiErrorMessage } from '../utils/formatters'

export default function PlayerQuickSearch<Candidate extends PlayerBrowserCandidate>({ value, onValueChange, onListPlayers, onSelect, action }: {
  value: string
  onValueChange: (value: string) => void
  onListPlayers: (query: PlayerBrowserQuery) => Promise<PlayerBrowserPage<Candidate>>
  onSelect: (player: Candidate) => void
  action?: (closeSuggestions: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [players, setPlayers] = useState<readonly Candidate[]>([]), [error, setError] = useState('')
  useEffect(() => {
    if (!open || !value.trim()) return
    let active = true
    const timer = setTimeout(() => {
      void onListPlayers({ query: value, elementKey: null, sort: 'name', direction: 'asc', page: 1 })
        .then(result => { if (active) { setPlayers(result.players); setError('') } })
        .catch(reason => { if (active) setError(apiErrorMessage(reason)) })
    }, 120)
    return () => { active = false; clearTimeout(timer) }
  }, [value, open, onListPlayers])
  return <div className="player-quick-search" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }} onKeyDown={event => { if (event.key === 'Escape') setOpen(false) }}>
    <div className="player-quick-search-heading"><label htmlFor="player-quick-search-input">Recherche rapide d’un joueur</label>{action?.(() => setOpen(false))}</div>
    <input id="player-quick-search-input" type="search" placeholder="Saisir un pseudo…" autoComplete="off" value={value} onChange={event => { onValueChange(event.target.value); setPlayers([]); setError(''); setOpen(true) }} />
    {open && value.trim() && (players.length > 0 || error) && <div className="moderation-target-results">{error ? <p role="alert">{error}</p> : players.map(player => <button type="button" key={player.id} onClick={() => { onSelect(player); setPlayers([]); setOpen(false) }}><strong>{player.displayName}</strong></button>)}</div>}
  </div>
}
