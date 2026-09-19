import type { EventDto } from '../api/types'
import AppButton from '../components/AppButton'
import { eventCurrencyLabel } from '../event/event-presentation'
import type { useCalendarClaim } from '../event/use-calendar-claim'
import './EventCalendar.css'

const states = { OPENED: 'Ouverte', AVAILABLE: 'Disponible', MISSED: 'Manquée', FUTURE: 'À venir' } as const

export default function EventCalendar({ value, action, enabled }: Readonly<{ value: EventDto; action: ReturnType<typeof useCalendarClaim>; enabled: boolean }>) {
  const calendar = value.calendar
  if (!calendar) return null
  return <section className="panel event-calendar" aria-labelledby="event-calendar-title">
    <h2 id="event-calendar-title">Calendrier de Noël</h2>
    <p>{calendar.recap ? 'Votre calendrier du mois : les cases manquées ne peuvent plus être ouvertes.' : 'Une case chaque jour du 1er au 25 décembre. Aucun rattrapage des jours manqués.'}</p>
    {!value.participation.joined && !calendar.recap && <p>Rejoignez le Festival pour ouvrir la case du jour.</p>}
    <div className="event-calendar-grid">{calendar.days.map((cell) => {
      const content = <><strong>{cell.day}</strong><span>{states[cell.state]}</span><small>{cell.reward !== null ? `${cell.reward} ${eventCurrencyLabel(cell.reward, value.festival.currency)}` : '—'}</small></>
      const className = `event-calendar-cell${calendar.currentDay === cell.day ? ' current' : ''} ${cell.state.toLowerCase()}`
      return cell.state === 'AVAILABLE' && calendar.canClaimToday
        ? <AppButton key={cell.day} variant="primary" className={className} aria-label={`Ouvrir la case du ${cell.day} décembre`} aria-busy={action.pending} disabled={action.pending || !enabled} onClick={() => void action.claim()}>{content}</AppButton>
        : <div key={cell.day} className={className}>{content}</div>
    })}</div>
    <div className="event-calendar-feedback"><p className="success" role="status" aria-live="polite">{action.success}</p>{action.error && <p role="alert">{action.error}</p>}</div>
  </section>
}
