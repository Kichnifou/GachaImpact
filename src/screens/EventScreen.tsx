import { useEffect, useRef, useState } from 'react'

import type { EventDto, EventGameAAttemptDto, EventJoinDto } from '../api/types'
import { isAmbiguousMutationError } from '../api/mutation-errors'
import ScreenHeader from '../components/ScreenHeader'
import ScrollableScreenPanel from '../components/ScrollableScreenPanel'
import { apiErrorMessage, formatResourceAmount } from '../utils/formatters'

type Props = Readonly<{
  value: EventDto
  onLoad: () => Promise<EventDto>
  onJoin: (idempotencyKey: string) => Promise<EventJoinDto>
  onAttempt: (idempotencyKey: string) => Promise<EventGameAAttemptDto>
}>

const periodFormatter = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const timeFormatter = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' })

export default function EventScreen({ value, onLoad, onJoin, onAttempt }: Props) {
  const [pending, setPending] = useState(false)
  const pendingRef = useRef(false)
  const [intentKey, setIntentKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attemptFeedback, setAttemptFeedback] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void onLoad().catch((reason) => { if (active) setError(apiErrorMessage(reason)) })
    return () => { active = false }
  }, [onLoad])

  const join = async () => {
    if (pendingRef.current || !value.canJoin) return
    const key = intentKey ?? crypto.randomUUID()
    pendingRef.current = true
    setPending(true)
    setIntentKey(key)
    setError(null)
    try {
      await onJoin(key)
      setIntentKey(null)
    } catch (reason) {
      if (!isAmbiguousMutationError(reason)) setIntentKey(null)
      setError(apiErrorMessage(reason))
    } finally {
      pendingRef.current = false
      setPending(false)
    }
  }

  const attemptGameA = async () => {
    if (pendingRef.current || !value.gameA.canAttempt) return
    const key = intentKey ?? crypto.randomUUID()
    pendingRef.current = true
    setPending(true)
    setIntentKey(key)
    setError(null)
    setAttemptFeedback(null)
    try {
      const result = await onAttempt(key)
      setIntentKey(null)
      setAttemptFeedback(result.attempt.succeeded ? `Réussite ! +1 point et +1 ${result.festival.currency.label}.` : 'Pas cette fois. Vous pourrez retenter après le court délai.')
    } catch (reason) {
      if (!isAmbiguousMutationError(reason)) setIntentKey(null)
      setError(apiErrorMessage(reason))
    } finally {
      pendingRef.current = false
      setPending(false)
    }
  }

  const tabs = <nav className="activity-inner-tabs event-tabs" aria-label="Sections Événement">
    <button type="button" className="active" aria-current="page">Jeux</button>
    {['Shop', 'Classement'].map((tab) => <button type="button" disabled key={tab}>{tab}</button>)}
  </nav>
  const startsAt = periodFormatter.format(new Date(value.edition.startsAt))
  const endsAt = periodFormatter.format(new Date(new Date(value.edition.endsAt).getTime() - 1))

  return <div className="screen-content activity-shell event-screen long-screen-layout">
    <ScreenHeader eyebrow="Activités · Événement" title={value.festival.title} description={`Édition ${value.edition.year} · du ${startsAt} au ${endsAt}`} />
    <ScrollableScreenPanel className="event-frame" fixed={tabs}>
      <section className="event-hero panel" data-event-key={value.festival.key}>
        <div className="event-hero-symbol" aria-hidden="true">{value.festival.emoji}</div>
        <div className="event-hero-copy">
          <span className="eyebrow">Festival du mois</span>
          <h2>{value.festival.title}</h2>
          <p>{value.participation.joined ? 'Vous participez à cette édition.' : 'Le Festival est consultable librement. Rejoignez-le lorsque vous êtes prêt.'}</p>
        </div>
        <span className={`event-membership ${value.participation.joined ? 'joined' : ''}`}>{value.participation.joined ? 'Inscrit' : 'Non inscrit'}</span>
      </section>

      <div className="event-stat-grid">
        <section className="panel event-stat"><span>Points de l’édition</span><strong>{formatResourceAmount(String(value.participation.points))}</strong></section>
        <section className="panel event-stat"><span>{value.festival.currency.label}</span><strong>{value.festival.currency.emoji} {formatResourceAmount(value.currency.amount)}</strong></section>
        <section className="panel event-stat"><span>Collection de l’édition</span><strong>{value.festival.collection.label}</strong></section>
      </div>

      <section className="panel event-foundation-card">
        <div><span className="eyebrow">Participation volontaire</span><h2>{value.participation.joined ? 'Votre inscription est enregistrée' : `Recevez 1 ${value.festival.currency.label}`}</h2><p>Votre solde restera associé à ce Festival entre les années.</p></div>
        {value.participation.joined
          ? <span className="event-joined-status">Événement rejoint</span>
          : <button type="button" className="small-primary-button" disabled={!value.canJoin || pending} onClick={() => void join()}>{pending ? 'Inscription…' : 'Rejoindre l’événement'}</button>}
      </section>
      {value.participation.joined && <section className="panel event-game-a" data-theme={value.gameA.theme.key}>
        <div className="event-game-a-heading"><div><span className="eyebrow">Jeu du Festival</span><h2>{value.gameA.theme.label}</h2></div><span className={`event-game-a-day-state${value.gameA.completedToday ? ' complete' : ''}`}>{value.gameA.completedToday ? 'Réussi aujourd’hui' : 'À réussir aujourd’hui'}</span></div>
        <div className="event-game-a-windows">
          {value.gameA.windows.map((window, index) => <article className={`event-game-a-window ${window.state.toLowerCase()}`} key={window.startAt} data-window-state={window.state}>
            <span>Fenêtre {index + 1}</span><strong>{timeFormatter.format(new Date(window.startAt))} – {timeFormatter.format(new Date(window.endAt))}</strong><small>{window.state === 'ACTIVE' ? 'Active' : window.state === 'PAST' ? 'Terminée' : 'Prochaine'}</small>
          </article>)}
        </div>
        <div className="event-game-a-action"><span>{value.gameA.attemptsToday} tentative{value.gameA.attemptsToday > 1 ? 's' : ''} aujourd’hui</span>
          {value.gameA.completedToday ? <strong>Votre gain du jour est acquis.</strong> : value.gameA.cooldownRemainingMs > 0 ? <button type="button" className="small-primary-button" disabled>Patientez {Math.ceil(value.gameA.cooldownRemainingMs / 1000)} s</button> : value.gameA.canAttempt ? <button type="button" className="small-primary-button" disabled={pending} onClick={() => void attemptGameA()}>{pending ? 'Tentative…' : 'Tenter ma chance'}</button> : <strong>Aucune fenêtre active.</strong>}
        </div>
        <p className="event-game-a-feedback" role="status" aria-live="polite">{attemptFeedback ?? ''}</p>
      </section>}
      <p className="event-feedback" role={error ? 'alert' : 'status'}>{error ?? ''}</p>
    </ScrollableScreenPanel>
  </div>
}
