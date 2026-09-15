import { useEffect, useRef, useState } from 'react'

import type { EventDto, EventGameAAttemptDto, EventJoinDto } from '../api/types'
import { isAmbiguousMutationError } from '../api/mutation-errors'
import ScreenHeader from '../components/ScreenHeader'
import ScrollableScreenPanel from '../components/ScrollableScreenPanel'
import { eventGameAExpiredToday, eventPresentation } from '../event/event-presentation'
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

function EventCooldownButton({ durationMs }: Readonly<{ durationMs: number }>) {
  const [remainingSeconds, setRemainingSeconds] = useState(() => Math.max(1, Math.ceil(durationMs / 1000)))

  useEffect(() => {
    const startedAt = performance.now()
    let timer: number | undefined
    const update = () => {
      const next = Math.max(1, Math.ceil((durationMs - (performance.now() - startedAt)) / 1000))
      setRemainingSeconds(next)
      if (next > 1) timer = window.setTimeout(update, 100)
    }
    timer = window.setTimeout(update, 100)
    return () => window.clearTimeout(timer)
  }, [durationMs])

  return <button type="button" className="small-primary-button event-cooldown-button" disabled>Patientez {remainingSeconds} seconde{remainingSeconds > 1 ? 's' : ''}...</button>
}

export default function EventScreen({ value, onLoad, onJoin, onAttempt }: Props) {
  const [section, setSection] = useState<'registration' | 'games'>('registration')
  const [pending, setPending] = useState(false)
  const pendingRef = useRef(false)
  const [intentKey, setIntentKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attemptFeedback, setAttemptFeedback] = useState<Readonly<{ kind: 'success' | 'failure'; message: string }> | null>(null)

  useEffect(() => {
    let active = true
    void onLoad().catch((reason) => { if (active) setError(apiErrorMessage(reason)) })
    return () => { active = false }
  }, [onLoad])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- A server snapshot can invalidate the selected Event section.
    if (!value.participation.joined && section === 'games') setSection('registration')
  }, [section, value.participation.joined])

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
      const presentation = eventPresentation(result.festival.key)
      setAttemptFeedback(result.attempt.succeeded
        ? { kind: 'success', message: `Réussite ! +1 point et +1 ${presentation.currencyUnit}.` }
        : { kind: 'failure', message: presentation.gameAFailure })
    } catch (reason) {
      if (!isAmbiguousMutationError(reason)) setIntentKey(null)
      setError(apiErrorMessage(reason))
    } finally {
      pendingRef.current = false
      setPending(false)
    }
  }

  const presentation = eventPresentation(value.festival.key)
  const expiredToday = eventGameAExpiredToday(value)
  const tabs = <>
    <nav className="activity-inner-tabs event-tabs" aria-label="Sections Événement">
      <button type="button" className={section === 'registration' ? 'active' : ''} aria-current={section === 'registration' ? 'page' : undefined} onClick={() => setSection('registration')}>Inscription</button>
      <button type="button" className={section === 'games' ? 'active' : ''} aria-current={section === 'games' ? 'page' : undefined} disabled={!value.participation.joined} onClick={() => setSection('games')}>Jeux</button>
      {['Shop', 'Classement'].map((tab) => <button type="button" disabled key={tab}>{tab}</button>)}
    </nav>
    {section === 'games' && <nav className="activity-inner-tabs event-game-tabs" aria-label="Jeux du Festival">
      {presentation.games.map((game, index) => <button type="button" className={index === 0 ? 'active' : ''} aria-current={index === 0 ? 'page' : undefined} disabled={index > 0} key={game}>{game}</button>)}
    </nav>}
  </>
  const startsAt = periodFormatter.format(new Date(value.edition.startsAt))
  const endsAt = periodFormatter.format(new Date(new Date(value.edition.endsAt).getTime() - 1))

  return <div className="screen-content activity-shell event-screen long-screen-layout">
    <ScreenHeader eyebrow="Activités · Événement" title={value.festival.title} description={`Édition ${value.edition.year} · du ${startsAt} au ${endsAt}`} />
    <ScrollableScreenPanel className="event-frame" fixed={tabs}>
      {section === 'registration' && <><section className="event-hero panel" data-event-key={value.festival.key}>
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
        <div><span className="eyebrow">Participation volontaire</span><h2>{value.participation.joined ? 'Votre inscription est enregistrée' : `Recevez 1 ${presentation.currencyUnit}`}</h2><p>Votre solde restera associé à ce Festival entre les années.</p></div>
        {value.participation.joined
          ? <span className="event-joined-status">Événement rejoint</span>
          : <button type="button" className="small-primary-button" disabled={!value.canJoin || pending} onClick={() => void join()}>{pending ? 'Inscription…' : 'Rejoindre l’événement'}</button>}
      </section></>}
      {section === 'games' && value.participation.joined && <section className="panel event-game-a" data-theme={value.gameA.theme.key}>
        <div className="event-game-a-heading"><div><span className="eyebrow">Jeu du Festival</span><h2>{presentation.games[0]}</h2></div><span className={`event-game-a-day-state${value.gameA.completedToday ? ' complete' : expiredToday ? ' expired' : ''}`}>{value.gameA.completedToday ? 'Réussi aujourd’hui' : expiredToday ? 'Délai dépassé...' : 'À réussir aujourd’hui'}</span></div>
        <div className="event-game-a-windows">
          {value.gameA.windows.map((window, index) => <article className={`event-game-a-window ${window.state.toLowerCase()}`} key={window.startAt} data-window-state={window.state}>
            <span>Fenêtre {index + 1}</span><strong>{timeFormatter.format(new Date(window.startAt))} – {timeFormatter.format(new Date(window.endAt))}</strong><small>{window.state === 'ACTIVE' ? 'Active' : window.state === 'PAST' ? 'Terminée' : 'Prochaine'}</small>
          </article>)}
        </div>
        <div className="event-game-a-action"><span>{value.gameA.attemptsToday} tentative{value.gameA.attemptsToday > 1 ? 's' : ''} aujourd’hui</span>
          {value.gameA.completedToday ? <strong>Votre gain du jour est acquis.</strong> : value.gameA.cooldownRemainingMs > 0 ? <EventCooldownButton durationMs={value.gameA.cooldownRemainingMs} key={`${value.businessDate}-${value.gameA.attemptsToday}-${value.gameA.cooldownRemainingMs}`} /> : value.gameA.canAttempt ? <button type="button" className="small-primary-button" disabled={pending} onClick={() => void attemptGameA()}>{pending ? 'Tentative…' : 'Tenter ma chance'}</button> : expiredToday ? null : <strong>Aucune fenêtre active.</strong>}
        </div>
        <p className={`event-game-a-feedback${attemptFeedback ? ` ${attemptFeedback.kind}` : ''}`} role="status" aria-live="polite">{attemptFeedback?.message ?? ''}</p>
      </section>}
      <p className="event-feedback" role={error ? 'alert' : 'status'}>{error ?? ''}</p>
    </ScrollableScreenPanel>
  </div>
}
