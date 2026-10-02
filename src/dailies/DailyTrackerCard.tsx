import { useRef, useState } from 'react'
import AppButton from '../components/AppButton'
import type { DailyItem } from './daily-summary'
import type { DailyTracker } from './use-daily-tracker'
import type { DailyClaimController } from './use-daily-claim'
import './dailies.css'

export type DailyCompactProps = { items: readonly DailyItem[]; tracker: DailyTracker; claim: DailyClaimController; onOpen: (item: DailyItem) => void; onOverview: () => void; refreshing?: boolean }

export default function DailyTrackerCard({ items, tracker, claim, onOpen, onOverview, refreshing = false }: DailyCompactProps) {
  const [previous, setPrevious] = useState<DailyItem | null>(tracker.selected)
  if (!claim.locked && previous !== tracker.selected) setPrevious(tracker.selected)
  const selected = claim.locked ? previous : tracker.selected
  const heading = useRef<HTMLHeadingElement>(null)
  const hide = () => { if (!selected || claim.locked) return; tracker.hide(selected.id); heading.current?.focus() }
  const restore = () => { tracker.restore(); heading.current?.focus() }
  const isClaim = selected?.id === 'reward' && selected.actionable
  const run = () => {
    if (!selected || claim.locked) return
    if (isClaim) void claim.run().catch(() => undefined)
    else onOpen(selected)
  }
  const currentMessage = claim.feedback || claim.error || (refreshing ? 'Actualisation…' : '')
  const nextDeadline = items.find(item => item.deadline && !tracker.hidden.includes(item.id))?.deadline
  return <section className="panel daily-card daily-tracker" aria-label="Suivi Quotidiennes" aria-busy={claim.pending}>
    <header className="daily-tracker-heading"><div><h2 ref={heading} tabIndex={-1}>Quotidiennes</h2><small>{tracker.message}</small></div>
      {selected && <AppButton variant="icon" className="daily-tracker-hide" disabled={!tracker.canHide || claim.locked} aria-label={`Masquer ${selected.title} pour aujourd’hui`} onClick={hide}>×</AppButton>}</header>
    <div className="daily-tracker-content">
      {selected ? <><span className="daily-tracker-icon" aria-hidden="true">{selected.icon}</span><h3>{selected.title}</h3><p className={`daily-tracker-status ${selected.state}`}>{selected.status}</p>
        <p className="daily-tracker-detail">{selected.detail || 'Consultez le détail de cette activité dans son écran.'}</p></>
        : <><span className="daily-tracker-icon" aria-hidden="true">{items.every(item => item.state === 'completed') && !tracker.hidden.length ? '✓' : '◇'}</span><h3>{tracker.message}</h3>
          <p className="daily-tracker-detail">{nextDeadline ? `Prochaine échéance : ${new Date(nextDeadline).toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' })}` : 'L’Aperçu conserve toutes les activités du jour.'}</p></>}
      <p className={`daily-tracker-feedback${claim.error ? ' error' : ''}`} aria-live="polite">{currentMessage}</p>
    </div>
    <footer className="daily-tracker-footer">
      <div className="daily-tracker-primary">{selected?.destination && <AppButton disabled={claim.locked || selected.state === 'unknown' || selected.state === 'error'} onClick={run}>{claim.pending && isClaim ? 'Récupération…' : isClaim ? 'Récupérer' : 'Accéder'}</AppButton>}</div>
      <div className="daily-tracker-navigation"><AppButton variant="icon" disabled={claim.locked || tracker.suggestions.length < 2} aria-label="Activité précédente" onClick={() => tracker.move(-1)}>‹</AppButton>
        <button type="button" className="daily-tracker-all" onClick={onOverview}>Tout voir →</button><AppButton variant="icon" disabled={claim.locked || tracker.suggestions.length < 2} aria-label="Activité suivante" onClick={() => tracker.move(1)}>›</AppButton></div>
      <div className="daily-tracker-restore">{tracker.hidden.length > 0 && <button type="button" disabled={claim.locked} onClick={restore} aria-label="Réafficher les activités masquées">Réafficher</button>}</div>
    </footer>
  </section>
}
