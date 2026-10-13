import type { EventDto } from '../api/types'
import { useState } from 'react'
import { useShortDesktop } from '../hooks/use-short-desktop'
import AppButton from '../components/AppButton'
import { eventCurrencyLabel } from '../event/event-presentation'
import type { useCalendarClaim } from '../event/use-calendar-claim'
import './EventCalendar.css'

const states = { OPENED: 'Ouverte', AVAILABLE: 'Disponible', MISSED: 'Manquée', FUTURE: 'À venir' } as const

export default function EventCalendar({ value, action, enabled }: Readonly<{ value: EventDto; action: ReturnType<typeof useCalendarClaim>; enabled: boolean }>) {
  const calendar = value.calendar
  const shortDesktop = useShortDesktop(820)
  const [selectedPage, setPage] = useState<number | null>(null)
  const pages = Math.max(1, Math.ceil((calendar?.days.length ?? 0) / 10))
  const page = Math.min(pages - 1, selectedPage ?? Math.floor(((calendar?.currentDay ?? 1) - 1) / 10))
  if (!calendar) return null
  return <section className="panel event-calendar" aria-labelledby="event-calendar-title">
    <h2 id="event-calendar-title">Calendrier de Noël</h2>
    <p>{calendar.recap ? 'Votre calendrier du mois : les cases manquées ne peuvent plus être ouvertes.' : 'Une case chaque jour du 1er au 25 décembre. Aucun rattrapage des jours manqués.'}</p>
    {!value.participation.joined && !calendar.recap && <p>Rejoignez le Festival pour ouvrir la case du jour.</p>}
    {shortDesktop && <nav className="event-calendar-pagination" aria-label="Pages du calendrier"><AppButton aria-label="Jours précédents" disabled={page === 0} onClick={() => setPage(page - 1)}>‹</AppButton><span>{page + 1} / {pages}</span><AppButton aria-label="Jours suivants" disabled={page === pages - 1} onClick={() => setPage(page + 1)}>›</AppButton></nav>}
    <div data-tutorial-anchor="event-calendar" className="event-calendar-grid">{(shortDesktop ? calendar.days.slice(page * 10, page * 10 + 10) : calendar.days).map((cell) => {
      const content = <><strong>{cell.day}</strong><span>{states[cell.state]}</span><small>{cell.reward !== null ? `${cell.reward} ${eventCurrencyLabel(cell.reward, value.festival.currency)}` : '—'}</small></>
      const className = `event-calendar-cell${calendar.currentDay === cell.day ? ' current' : ''} ${cell.state.toLowerCase()}`
      return cell.state === 'AVAILABLE' && calendar.canClaimToday
        ? <AppButton key={cell.day} variant="primary" className={className} aria-label={`Ouvrir la case du ${cell.day} décembre`} aria-busy={action.pending} disabled={action.pending || !enabled} onClick={() => void action.claim()}>{content}</AppButton>
        : <div key={cell.day} className={className}>{content}</div>
    })}</div>
    <div className="event-calendar-feedback"><p className="success" role="status" aria-live="polite">{action.success}</p>{action.error && <p role="alert">{action.error}</p>}</div>
  </section>
}
