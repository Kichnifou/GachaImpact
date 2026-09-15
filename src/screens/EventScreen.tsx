import { useEffect, useRef, useState } from 'react'

import type { EventDto, EventJoinDto } from '../api/types'
import { isAmbiguousMutationError } from '../api/mutation-errors'
import ScreenHeader from '../components/ScreenHeader'
import ScrollableScreenPanel from '../components/ScrollableScreenPanel'
import { apiErrorMessage, formatResourceAmount } from '../utils/formatters'

type Props = Readonly<{
  value: EventDto
  onLoad: () => Promise<EventDto>
  onJoin: (idempotencyKey: string) => Promise<EventJoinDto>
}>

const periodFormatter = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export default function EventScreen({ value, onLoad, onJoin }: Props) {
  const [pending, setPending] = useState(false)
  const pendingRef = useRef(false)
  const [intentKey, setIntentKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  const tabs = <nav className="activity-inner-tabs event-tabs" aria-label="Sections Événement">
    {['Jeux', 'Shop', 'Classement'].map((tab) => <button type="button" disabled key={tab} title="À venir">{tab}<small>À venir</small></button>)}
  </nav>
  const startsAt = periodFormatter.format(new Date(value.edition.startsAt))
  const endsAt = periodFormatter.format(new Date(value.edition.endsAt))

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
        <section className="panel event-stat"><span>Points de l’édition</span><strong>{formatResourceAmount(String(value.participation.points))}</strong><small>Compteur autoritatif</small></section>
        <section className="panel event-stat"><span>{value.festival.currency.label}</span><strong>{value.festival.currency.emoji} {formatResourceAmount(value.currency.amount)}</strong><small>Solde durable de ce Festival</small></section>
        <section className="panel event-stat"><span>Collection de l’édition</span><strong>{value.festival.collection.label}</strong><small>Objet descriptif · acquisition à venir</small></section>
      </div>

      <section className="panel event-foundation-card">
        <div><span className="eyebrow">Participation volontaire</span><h2>{value.participation.joined ? 'Votre inscription est enregistrée' : `Recevez 1 ${value.festival.currency.label}`}</h2><p>{value.participation.joined ? 'Votre bonus d’inscription est inclus dans le solde affiché. Les activités du Festival arriveront dans les prochains lots.' : 'La première inscription à cette édition crédite exactement une monnaie saisonnière. Votre solde restera associé à ce Festival entre les années.'}</p></div>
        {value.participation.joined
          ? <button type="button" className="small-primary-button" disabled>Événement rejoint</button>
          : <button type="button" className="small-primary-button" disabled={!value.canJoin || pending} onClick={() => void join()}>{pending ? 'Inscription…' : 'Rejoindre l’événement'}</button>}
      </section>
      <p className="event-feedback" role={error ? 'alert' : 'status'}>{error ?? ''}</p>
      <section className="panel event-coming-soon"><strong>La suite du Festival</strong><p>Jeux, Shop et Classement sont encore indisponibles. Aucun progrès ni résultat fictif n’est affiché.</p></section>
    </ScrollableScreenPanel>
  </div>
}
