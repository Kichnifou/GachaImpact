import { useState } from 'react'
import AppButton from '../components/AppButton'
import { dailySuggestions, type DailyItem } from './daily-summary'
import type { DailyCompactProps } from './DailyTrackerCard'
import './dailies.css'

export default function HomeDailySummary({ items, tracker, claim, onOpen, onOverview, refreshing }: DailyCompactProps) {
  const suggestions = dailySuggestions(items, tracker.hidden).slice(0, 3)
  const [confirmed, setConfirmed] = useState<readonly DailyItem[]>(suggestions)
  if (!claim.locked && (confirmed.length !== suggestions.length || confirmed.some((item, index) => item !== suggestions[index]))) setConfirmed(suggestions)
  const shown = claim.locked ? confirmed : suggestions
  const running = items.find(item => item.id === 'expedition' && item.state === 'in_progress')
  return <section className="panel home-daily-summary" aria-label="Aujourd’hui">
    <header><div><h2>Aujourd’hui</h2><p>{tracker.message}{refreshing ? ' · Actualisation…' : ''}</p></div><AppButton onClick={onOverview}>Voir l’Aperçu →</AppButton></header>
    <div className="home-daily-suggestions">{shown.map(item => <article className="home-daily-suggestion" key={item.id} data-daily-id={item.id}>
      <span aria-hidden="true">{item.icon}</span><div><h3>{item.title}</h3><p>{item.status}</p><small>{item.detail}</small></div>
      <AppButton disabled={claim.locked || !item.destination || item.state === 'unknown' || item.state === 'error'} onClick={() => {
        if (claim.locked) return
        if (item.id === 'reward' && item.actionable) void claim.run().catch(() => undefined)
        else onOpen(item)
      }}>{item.id === 'reward' && item.actionable ? claim.pending ? 'Récupération…' : 'Récupérer' : 'Accéder'}</AppButton>
    </article>)}</div>
    {!shown.length && <p className="home-daily-empty">{tracker.message}. L’Aperçu reste disponible pour consulter les détails.</p>}
    <footer>{running && <p>Expédition en cours · {running.detail}</p>}<p className={claim.error ? 'error' : ''} aria-live="polite">{claim.error || claim.feedback}</p>
      {tracker.hidden.length > 0 && <button type="button" className="daily-tracker-all" disabled={claim.locked} onClick={tracker.restore}>Réafficher les activités masquées</button>}</footer>
  </section>
}
