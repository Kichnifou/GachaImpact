import { useRef, useState } from 'react'
import AppButton from '../components/AppButton'
import type { DailyItem } from './daily-summary'
import type { DailyTracker } from './use-daily-tracker'
import type { DailyClaimController } from './use-daily-claim'
import { dailyTrackerStatus } from './daily-compact-presentation'
import './dailies.css'

export type DailyCompactProps = { items: readonly DailyItem[]; tracker: DailyTracker; claim: DailyClaimController; onOpen: (item: DailyItem) => void; onOverview: () => void; refreshing?: boolean }

export default function DailyTrackerCard({ items, tracker, claim, onOpen, onOverview, refreshing = false }: DailyCompactProps) {
  const [previous, setPrevious] = useState<DailyItem | null>(tracker.selected)
  if (!claim.locked && previous !== tracker.selected) setPrevious(tracker.selected)
  const selected = claim.locked ? previous : tracker.selected
  const position = tracker.suggestions.findIndex(item => item.id === selected?.id) + 1
  const title = position > 0 ? `Quotidiennes [${position}/${tracker.suggestions.length}]` : 'Quotidiennes'
  const heading = useRef<HTMLHeadingElement>(null)
  const activityHeading = useRef<HTMLHeadingElement>(null)
  const hide = () => { if (!selected || claim.locked) return; tracker.hide(selected.id); heading.current?.focus() }
  const restore = () => { tracker.restoreLast(); activityHeading.current?.focus() }
  const isClaim = selected?.id === 'reward' && selected.actionable
  const actionable = Boolean(selected?.destination && selected.state !== 'unknown' && selected.state !== 'error' && !claim.locked)
  const run = () => {
    if (!selected || !actionable) return
    if (isClaim) void claim.run().catch(() => undefined)
    else onOpen(selected)
  }
  const currentMessage = claim.pending ? 'Récupération…' : claim.error || claim.feedback
  const nextDeadline = items.find(item => item.deadline && !tracker.hidden.includes(item.id))?.deadline
  const status = currentMessage || (selected ? dailyTrackerStatus(selected) : nextDeadline ? `Prochaine échéance : ${new Date(nextDeadline).toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' })}` : '')
  const lastHidden = items.find(item => item.id === tracker.hidden.at(-1))
  return <section data-tutorial-anchor="daily-tracker" className="panel daily-card daily-tracker" aria-label="Suivi Quotidiennes" aria-busy={claim.pending || refreshing}>
    <button type="button" className="daily-tracker-hit-target" disabled={!actionable} aria-label={selected ? `${isClaim ? 'Récupérer' : 'Accéder à'} ${selected.title}` : 'Activité indisponible'} onClick={run} />
    <header className="daily-tracker-heading"><div><h2 ref={heading} tabIndex={-1}>{title}</h2></div>
      <AppButton variant="icon" className="daily-tracker-hide" disabled={!selected || !tracker.canHide || claim.locked} aria-label={selected ? `Masquer ${selected.title} pour aujourd’hui` : 'Masquer une activité'} onClick={hide}>×</AppButton>
      <div className="daily-tracker-restore"><button type="button" disabled={!tracker.hidden.length || claim.locked} style={{ visibility: tracker.hidden.length ? 'visible' : 'hidden' }} onClick={restore} aria-label={lastHidden ? `Réafficher ${lastHidden.title}` : 'Réafficher la dernière activité masquée'}>↺</button></div></header>
    <div className="daily-tracker-content">
      <h3 ref={activityHeading} className={selected ? undefined : 'daily-tracker-summary'} tabIndex={-1}>{selected?.title ?? tracker.message}</h3>
      {status && <p className={`daily-tracker-status ${claim.error ? 'error' : selected?.state ?? ''}`} aria-live="polite">{status}</p>}
    </div>
    <footer className="daily-tracker-footer">
      <div className="daily-tracker-navigation"><AppButton variant="icon" disabled={claim.locked || tracker.suggestions.length < 2} aria-label="Activité précédente" onClick={() => tracker.move(-1)}>‹</AppButton>
        <button type="button" className="daily-tracker-all" onClick={onOverview}>Tout voir →</button><AppButton variant="icon" disabled={claim.locked || tracker.suggestions.length < 2} aria-label="Activité suivante" onClick={() => tracker.move(1)}>›</AppButton></div>
    </footer>
  </section>
}
