import { useState } from 'react'
import AppButton from '../components/AppButton'
import { dailyActionableSuggestions, dailyOngoingItems, type DailyItem } from './daily-summary'
import type { DailyCompactProps } from './DailyTrackerCard'
import './dailies.css'

export default function HomeDailySummary({ items, tracker, claim, onOpen, onOverview, refreshing }: DailyCompactProps) {
  const suggestions = dailyActionableSuggestions(items, tracker.hidden).slice(0, 3)
  const [confirmed, setConfirmed] = useState<readonly DailyItem[]>(suggestions)
  if (!claim.locked && (confirmed.length !== suggestions.length || confirmed.some((item, index) => item !== suggestions[index]))) setConfirmed(suggestions)
  const shown = claim.locked ? confirmed : suggestions
  const ongoing = dailyOngoingItems(items, tracker.hidden, shown.map(item => item.id)).slice(0, 2)
  return <section className="panel home-daily-summary" aria-label="Aujourd’hui">
    <header><div><h2>Aujourd’hui</h2><p>{tracker.message}{refreshing ? ' · Actualisation…' : ''}</p></div><AppButton onClick={onOverview}>Voir l’Aperçu →</AppButton></header>
    {shown.length > 0 && <section className="home-daily-actions" aria-label="À faire maintenant"><h3>À faire maintenant</h3><div className="home-daily-suggestions">{shown.map(item => <article className="home-daily-suggestion" key={item.id} data-daily-id={item.id}>
      <span aria-hidden="true">{item.icon}</span><div><h3>{item.title}</h3><p>{item.status}</p><small>{item.detail}</small></div>
      <AppButton disabled={claim.locked || !item.destination || item.state === 'unknown' || item.state === 'error'} onClick={() => {
        if (claim.locked) return
        if (item.id === 'reward' && item.actionable) void claim.run().catch(() => undefined)
        else onOpen(item)
      }}>{item.id === 'reward' && item.actionable ? claim.pending ? 'Récupération…' : 'Récupérer' : 'Accéder'}</AppButton>
    </article>)}</div></section>}
    {ongoing.length > 0 && <section className="home-daily-ongoing" aria-label="En cours"><h3>En cours</h3><ul>{ongoing.map(item => <li key={item.id} data-daily-id={item.id}><strong>{item.title}</strong> · {item.detail || item.status}</li>)}</ul></section>}
    {!shown.length && !ongoing.length && <p className="home-daily-empty">{tracker.message}. L’Aperçu reste disponible pour consulter les détails.</p>}
    <footer><p className={claim.error ? 'error' : ''} aria-live="polite">{claim.error || claim.feedback}</p>
      {tracker.hidden.length > 0 && <button type="button" className="daily-tracker-all" disabled={claim.locked} onClick={tracker.restore}>Réafficher les activités masquées</button>}</footer>
  </section>
}
