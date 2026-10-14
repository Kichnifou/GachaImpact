import type { EventDto } from '../api/types'
import { formatResourceAmount } from '../utils/formatters'
import './event-header.css'

/** Standalone presentation only; authoritative labels and Twitch stay unchanged. */
function milestoneLabel(label: string) {
  return label.replace(/particules d’un élément aléatoire/g, 'particules d’un élément').replace(/Primogemmes/g, 'Primos')
}

export default function EventScreenHeader({ value, period }: { value: EventDto; period: string }) {
  const progress = Math.min(87.5, Math.max(0, (value.milestones.currentPoints - 10) / 70 * 87.5))
  return <header data-tutorial-anchor="screen-entry" className="screen-header panel event-screen-header">
    <div className="event-title"><h1>{value.festival.title}</h1><p>{period}</p></div>
    <section data-tutorial-anchor="event-milestones" className="event-milestone-progress" aria-label="Progression du Festival">
      <div className="event-milestone-summary"><strong>{formatResourceAmount(String(value.milestones.currentPoints))} points</strong><span>Votre progression</span></div>
      <div className="event-milestone-track-scroll"><div className="event-milestone-track">
        <span className="event-milestone-fill" role="progressbar" aria-label="Paliers du Festival" aria-valuemin={0} aria-valuemax={80} aria-valuenow={Math.min(80, value.milestones.currentPoints)} style={{ width: `${progress}%` }} />
        {value.milestones.thresholds.map(threshold => <div className={`event-milestone-marker${threshold.rewarded ? ' rewarded' : threshold.reached ? ' reached' : ''}`} key={threshold.points}><span aria-hidden="true">◆</span><strong>{threshold.points}</strong><small>{milestoneLabel(threshold.rewardLabel)}</small></div>)}
      </div></div>
    </section>
  </header>
}
