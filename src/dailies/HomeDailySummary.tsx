import { useState } from 'react'
import { dailyActionableSuggestions, type DailyItem } from './daily-summary'
import { homeDailySecondaryItems, homeDailySecondaryText } from './home-daily-presentation'
import type { DailyCompactProps } from './DailyTrackerCard'
import './dailies.css'

export default function HomeDailySummary({ items, tracker, claim, onOpen, onOverview, refreshing }: DailyCompactProps) {
  const suggestions = dailyActionableSuggestions(items, tracker.hidden).slice(0, 3)
  const [confirmed, setConfirmed] = useState<readonly DailyItem[]>(suggestions)
  if (!claim.locked && (confirmed.length !== suggestions.length || confirmed.some((item, index) => item !== suggestions[index]))) setConfirmed(suggestions)
  const shown = claim.locked ? confirmed : suggestions
  const ongoing = homeDailySecondaryItems(items, tracker.hidden, shown.map(item => item.id))
  return <section className="panel home-daily-summary" aria-label="Quotidiennes">
    <header><div><h2>Quotidiennes</h2><p>{tracker.message}{refreshing ? ' · Actualisation…' : ''}</p></div><button type="button" className="daily-tracker-all home-daily-overview" onClick={onOverview}>Voir l’Aperçu →</button></header>
    {shown.length > 0 && <div className="home-daily-actions"><div className="home-daily-suggestions">{shown.map(item => <button type="button" className="home-daily-suggestion" key={item.id} data-daily-id={item.id}
      disabled={claim.locked || !item.destination || item.state === 'unknown' || item.state === 'error'} aria-busy={item.id === 'reward' && claim.pending} onClick={() => {
        if (claim.locked) return
        if (item.id === 'reward' && item.actionable) void claim.run().catch(() => undefined)
        else onOpen(item)
      }}>
      <span className="home-daily-icon" aria-hidden="true">{item.icon}</span><span className="home-daily-copy"><strong>{item.title}</strong><span>{item.status}</span>{item.detail && <small>{item.detail}</small>}</span>
      <span className="home-daily-action-label">{item.id === 'reward' && item.actionable ? claim.pending ? 'Récupération…' : 'Récupérer →' : 'Accéder →'}</span>
    </button>)}</div></div>}
    {ongoing.length > 0 && <div className="home-daily-ongoing"><ul>{ongoing.map(item => <li key={item.id} data-daily-id={item.id}>{homeDailySecondaryText(item)}</li>)}</ul></div>}
    {!shown.length && !ongoing.length && <p className="home-daily-empty">{tracker.message}. L’Aperçu reste disponible pour consulter les détails.</p>}
    <footer><p className={claim.error ? 'error' : ''} aria-live="polite">{claim.error || claim.feedback}</p>
      {tracker.hidden.length > 0 && <button type="button" className="daily-tracker-all" disabled={claim.locked} onClick={tracker.restore}>Réafficher les activités masquées</button>}</footer>
  </section>
}
