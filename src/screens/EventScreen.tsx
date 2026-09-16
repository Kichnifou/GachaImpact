import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import type { EventDto, EventDailyBonusClaimDto, EventGameAAttemptDto, EventGameBAttemptDto, EventGameCRecipientQuery, EventGameCRecipientsDto, EventGameCSendDto, EventJoinDto } from '../api/types'
import { isAmbiguousMutationError } from '../api/mutation-errors'
import ScreenHeader from '../components/ScreenHeader'
import ScrollableScreenPanel from '../components/ScrollableScreenPanel'
import PlayerSelectionBrowser, { type PlayerBrowserQuery } from '../components/PlayerSelectionBrowser'
import { eventGameAExpiredToday, eventPresentation } from '../event/event-presentation'
import { apiErrorMessage, formatResourceAmount } from '../utils/formatters'

type Props = Readonly<{
  value: EventDto
  onLoad: () => Promise<EventDto>
  onJoin: (idempotencyKey: string) => Promise<EventJoinDto>
  onClaimDailyBonus?: (idempotencyKey: string) => Promise<EventDailyBonusClaimDto>
  onAttempt: (idempotencyKey: string) => Promise<EventGameAAttemptDto>
  onAttemptB: (code: string, idempotencyKey: string) => Promise<EventGameBAttemptDto>
  onSearchRecipients?: (query: EventGameCRecipientQuery) => Promise<EventGameCRecipientsDto>
  onSendGameC?: (recipientPlayerId: string, message: string, idempotencyKey: string) => Promise<EventGameCSendDto>
  onConsultMessages?: () => Promise<EventDto>
  openMessagesToken?: number
}>

const periodFormatter = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const timeFormatter = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' })
const unavailableRecipientSearch = async (): Promise<EventGameCRecipientsDto> => ({ page: 1, pageSize: 10, total: 0, totalPages: 1, recipients: [] })
const unavailableGameCSend = async (): Promise<EventGameCSendDto> => { throw new Error('Jeu C indisponible.') }

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

export default function EventScreen({ value, onLoad, onJoin, onClaimDailyBonus, onAttempt, onAttemptB, onSearchRecipients = unavailableRecipientSearch, onSendGameC = unavailableGameCSend, onConsultMessages, openMessagesToken = 0 }: Props) {
  const [section, setSection] = useState<'registration' | 'games'>(openMessagesToken > 0 ? 'games' : 'registration')
  const [gameTab, setGameTab] = useState<0 | 1 | 2>(openMessagesToken > 0 ? 2 : 0)
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [gameBIntent, setGameBIntent] = useState<Readonly<{ code: string; key: string }> | null>(null)
  const [gameBFeedback, setGameBFeedback] = useState<string | null>(null)
  const [recipientBrowserOpen, setRecipientBrowserOpen] = useState(false)
  const [selectedRecipient, setSelectedRecipient] = useState<EventGameCRecipientsDto['recipients'][number] | null>(null)
  const [gameCMessage, setGameCMessage] = useState('')
  const [gameCIntent, setGameCIntent] = useState<Readonly<{ recipientPlayerId: string; message: string; key: string }> | null>(null)
  const [gameCFeedback, setGameCFeedback] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const pendingRef = useRef(false)
  const [intentKey, setIntentKey] = useState<string | null>(null)
  const [dailyBonusIntentKey, setDailyBonusIntentKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attemptFeedback, setAttemptFeedback] = useState<Readonly<{ kind: 'success' | 'failure'; message: string }> | null>(null)
  const boundaryRef = useRef({ businessDate: value.businessDate, editionId: value.edition.id })

  useLayoutEffect(() => {
    const previous = boundaryRef.current
    if (previous.businessDate === value.businessDate && previous.editionId === value.edition.id) return
    boundaryRef.current = { businessDate: value.businessDate, editionId: value.edition.id }
    // oxlint-disable-next-line react(set-state-in-effect) -- A new server business boundary invalidates the previous local attempt.
    setSelectedCode(null)
    setGameBIntent(null)
    setGameBFeedback(null)
    setDailyBonusIntentKey(null)
    setGameCIntent(null)
    setGameCFeedback(null)
    setSelectedRecipient(null)
    setGameCMessage('')
    setError(null)
    if (previous.editionId !== value.edition.id) {
      setSection('registration')
      setGameTab(0)
    }
  }, [value.businessDate, value.edition.id])

  useEffect(() => {
    if (openMessagesToken > 0) return
    let active = true
    void onLoad().catch((reason) => { if (active) setError(apiErrorMessage(reason)) })
    return () => { active = false }
  }, [onLoad, openMessagesToken])

  useEffect(() => {
    if (openMessagesToken === 0) return
    let active = true
    // oxlint-disable-next-line react/set-state-in-effect -- Notification intent selects the inbox before its fresh snapshot arrives.
    setSection('games')
    setGameTab(2)
    void onLoad().then((latest) => { if (active && !latest.gameC.available) { setSection('registration'); setGameTab(0) } }).catch((reason) => { if (active) setError(apiErrorMessage(reason)) })
    return () => { active = false }
  }, [openMessagesToken, onLoad])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- A server snapshot can invalidate the selected Event section.
    if (!value.participation.joined && !value.gameC.available && !openMessagesToken && section === 'games') setSection('registration')
    if (!value.participation.joined && section === 'games' && gameTab !== 2) setGameTab(2)
  }, [section, gameTab, value.participation.joined, value.gameC.available, openMessagesToken])

  const listRecipients = useCallback(async (query: PlayerBrowserQuery) => {
    const result = await onSearchRecipients({ query: query.query, elementKey: query.elementKey, sort: query.sort, direction: query.direction, page: query.page })
    return { ...result, players: result.recipients.map((recipient) => ({ ...recipient, id: recipient.playerId })) }
  }, [onSearchRecipients])

  useEffect(() => {
    if (section !== 'games' || gameTab !== 2 || value.gameC.unviewedCount === 0 || !onConsultMessages) return
    void onConsultMessages().catch((reason) => setError(apiErrorMessage(reason)))
  }, [section, gameTab, value.gameC.unviewedCount, onConsultMessages])

  useEffect(() => {
    if (section !== 'games' || !value.participation.joined || value.gameB.solvedToday) return
    const refresh = () => { if (document.visibilityState === 'visible') void onLoad().catch(() => undefined) }
    const timer = window.setInterval(refresh, 30_000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [section, value.participation.joined, value.gameB.solvedToday, onLoad])

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

  const claimDailyBonus = async () => {
    if (pendingRef.current || !value.dailyBonus.canClaim || !onClaimDailyBonus) return
    const key = dailyBonusIntentKey ?? crypto.randomUUID()
    pendingRef.current = true
    setPending(true)
    setDailyBonusIntentKey(key)
    setError(null)
    try {
      await onClaimDailyBonus(key)
      setDailyBonusIntentKey(null)
    } catch (reason) {
      if (!isAmbiguousMutationError(reason)) setDailyBonusIntentKey(null)
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

  const attemptGameB = async () => {
    if (pendingRef.current || (!value.gameB.canAttempt && !gameBIntent) || (!gameBIntent && (!selectedCode || !value.gameB.remainingCodes.includes(selectedCode)))) return
    const intent = gameBIntent ?? { code: selectedCode!, key: crypto.randomUUID() }
    const requestBoundary = { businessDate: value.businessDate, editionId: value.edition.id }
    const sameBoundary = () => boundaryRef.current.businessDate === requestBoundary.businessDate && boundaryRef.current.editionId === requestBoundary.editionId
    pendingRef.current = true
    setPending(true)
    setGameBIntent(intent)
    setGameBFeedback(null)
    setError(null)
    try {
      const result = await onAttemptB(intent.code, intent.key)
      if (sameBoundary()) {
        setGameBIntent(null)
        setSelectedCode(null)
        setGameBFeedback(result.attempt.kind === 'CORRECT' ? 'Combinaison découverte ! Tous les participants inscrits gagnent 1 point et 1 monnaie du Festival.' : result.attempt.kind === 'ALREADY_TESTED' ? 'Code déjà testé : aucun essai consommé.' : 'Code incorrect : un essai consommé.')
      }
    } catch (reason) {
      if (sameBoundary()) {
        if (!isAmbiguousMutationError(reason)) setGameBIntent(null)
        setError(apiErrorMessage(reason))
      }
    } finally {
      pendingRef.current = false
      setPending(false)
    }
  }

  const sendGameC = async () => {
    if (pendingRef.current || !value.gameC.canSend || (!selectedRecipient && !gameCIntent) || (!gameCMessage.trim() && !gameCIntent)) return
    const intent = gameCIntent ?? { recipientPlayerId: selectedRecipient!.playerId, message: gameCMessage.trim(), key: crypto.randomUUID() }
    pendingRef.current = true
    setPending(true)
    setGameCIntent(intent)
    setError(null)
    try {
      await onSendGameC(intent.recipientPlayerId, intent.message, intent.key)
      setGameCIntent(null)
      setGameCFeedback(`Message envoyé. +1 point et +1 ${presentation.currencyUnit}.`)
    } catch (reason) {
      if (!isAmbiguousMutationError(reason)) setGameCIntent(null)
      setError(apiErrorMessage(reason))
    } finally {
      pendingRef.current = false
      setPending(false)
    }
  }

  const presentation = eventPresentation(value.festival.key)
  const expiredToday = eventGameAExpiredToday(value)
  const milestoneProgress = Math.min(87.5, Math.max(0, (value.milestones.currentPoints - 10) / 70 * 87.5))
  const tabs = <>
    <section className="event-milestone-progress" aria-label="Progression du Festival">
      <div className="event-milestone-summary"><strong>{formatResourceAmount(String(value.milestones.currentPoints))} points</strong><span>{value.milestones.currentPoints >= 80 ? 'Tous les paliers atteints' : 'Progression vers 80 points'}</span></div>
      <div className="event-milestone-track-scroll"><div className="event-milestone-track">
        <span className="event-milestone-fill" role="progressbar" aria-label="Paliers du Festival" aria-valuemin={0} aria-valuemax={80} aria-valuenow={Math.min(80, value.milestones.currentPoints)} style={{ width: `${milestoneProgress}%` }} />
        {value.milestones.thresholds.map((threshold) => <div className={`event-milestone-marker${threshold.rewarded ? ' rewarded' : threshold.reached ? ' reached' : ''}`} key={threshold.points}><span aria-hidden="true">◆</span><strong>{threshold.points}</strong><small>{threshold.rewardLabel}</small></div>)}
      </div></div>
    </section>
    <nav className="activity-inner-tabs event-tabs" aria-label="Sections Événement">
      <button type="button" className={section === 'registration' ? 'active' : ''} aria-current={section === 'registration' ? 'page' : undefined} onClick={() => setSection('registration')}>Inscription</button>
      <button type="button" className={section === 'games' ? 'active' : ''} aria-current={section === 'games' ? 'page' : undefined} disabled={!value.participation.joined && !value.gameC.available} onClick={() => { setGameTab(value.participation.joined ? 0 : 2); setSection('games') }}>Jeux</button>
      {['Shop', 'Classement'].map((tab) => <button type="button" disabled key={tab}>{tab}</button>)}
    </nav>
    {section === 'games' && <nav className="activity-inner-tabs event-game-tabs" aria-label="Jeux du Festival">
      {presentation.games.map((game, index) => <button type="button" className={index === gameTab ? 'active' : ''} aria-current={index === gameTab ? 'page' : undefined} disabled={index < 2 ? !value.participation.joined : !value.gameC.available} onClick={() => { setGameTab(index as 0 | 1 | 2); if (index === 1) void onLoad().catch(() => undefined) }} key={game}>{game}</button>)}
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
      </section>
      {value.participation.joined && <section className="panel event-daily-bonus"><div><span className="eyebrow">Bonus quotidien</span><h2>+1 {presentation.currencyUnit}</h2><p>Une fois par jour pendant le Festival.</p></div>{value.dailyBonus.claimedToday ? <strong>Réclamé aujourd’hui</strong> : <button type="button" className="small-primary-button" disabled={!value.dailyBonus.canClaim || pending || !onClaimDailyBonus} onClick={() => void claimDailyBonus()}>{pending ? 'Réclamation…' : 'Réclamer'}</button>}</section>}</>}
      {section === 'games' && gameTab === 0 && value.participation.joined && <section className="panel event-game-a" data-theme={value.gameA.theme.key}>
        <div className="event-game-a-heading"><div><span className="eyebrow">Jeu du Festival</span><h2>{presentation.games[0]}</h2></div><span className={`event-game-a-day-state${value.gameA.completedToday ? ' complete' : expiredToday ? ' expired' : ''}`}>{value.gameA.completedToday ? 'Réussi aujourd’hui' : expiredToday ? 'Délai dépassé...' : 'À réussir aujourd’hui'}</span></div>
        <div className="event-game-a-windows">
          {value.gameA.windows.map((window, index) => <article className={`event-game-a-window ${value.gameA.completedToday ? 'completed' : window.state.toLowerCase()}`} key={window.startAt} data-window-state={value.gameA.completedToday ? 'COMPLETED' : window.state}>
            <span>Fenêtre {index + 1}</span><strong>{timeFormatter.format(new Date(window.startAt))} – {timeFormatter.format(new Date(window.endAt))}</strong><small>{value.gameA.completedToday || window.state === 'PAST' ? 'Terminée' : window.state === 'ACTIVE' ? 'Active' : 'Prochaine'}</small>
          </article>)}
        </div>
        <div className="event-game-a-action"><span>{value.gameA.attemptsToday} tentative{value.gameA.attemptsToday > 1 ? 's' : ''} aujourd’hui</span>
          {value.gameA.completedToday ? <strong>Votre gain du jour est acquis.</strong> : value.gameA.cooldownRemainingMs > 0 ? <EventCooldownButton durationMs={value.gameA.cooldownRemainingMs} key={`${value.businessDate}-${value.gameA.attemptsToday}-${value.gameA.cooldownRemainingMs}`} /> : value.gameA.canAttempt ? <button type="button" className="small-primary-button" disabled={pending} onClick={() => void attemptGameA()}>{pending ? 'Tentative…' : 'Tenter ma chance'}</button> : expiredToday ? null : <strong>Aucune fenêtre active.</strong>}
        </div>
        <p className={`event-game-a-feedback${attemptFeedback ? ` ${attemptFeedback.kind}` : ''}`} role="status" aria-live="polite">{attemptFeedback?.message ?? ''}</p>
      </section>}
      {section === 'games' && gameTab === 1 && value.participation.joined && <section className="panel event-game-b">
        <div className="event-game-b-heading"><div><span className="eyebrow">Énigme collective du Festival</span><h2>{presentation.games[1]}</h2></div><strong>{value.gameB.solvedToday ? 'Découvert aujourd’hui' : 'Encore à découvrir'}</strong></div>
        <p>{value.gameB.solvedToday ? `Découvert par ${value.gameB.discoveredBy?.displayName ?? 'un participant'}.` : 'Une seule combinaison de cinq chiffres 0 ou 1 est correcte pour tous les participants aujourd’hui.'}</p>
        <p className="event-game-b-attempts">{value.gameB.attemptsRemaining} essai{value.gameB.attemptsRemaining > 1 ? 's' : ''} personnel{value.gameB.attemptsRemaining > 1 ? 's' : ''} restant{value.gameB.attemptsRemaining > 1 ? 's' : ''} · {value.gameB.remainingCodes.length} combinaison{value.gameB.remainingCodes.length > 1 ? 's' : ''} disponible{value.gameB.remainingCodes.length > 1 ? 's' : ''}</p>
        <div className="event-game-b-legend"><span>Disponible</span><span>Déjà testée</span></div>
        <div className="event-game-b-codes" aria-label="Combinaisons du Grenier">{Array.from({ length: 32 }, (_, index) => index.toString(2).padStart(5, '0')).map((code) => {
          const resolved = value.gameB.resolvedCode === code
          const tested = !resolved && value.gameB.testedCodes.includes(code)
          return <button type="button" className={`event-game-b-code${resolved ? ' resolved' : tested ? ' tested' : ''}${selectedCode === code ? ' selected' : ''}`} disabled={resolved || tested || !value.gameB.canAttempt || pending || Boolean(gameBIntent)} aria-pressed={selectedCode === code && !tested && !resolved} onClick={() => setSelectedCode(code)} key={code}>{resolved ? `✓ ${code}` : code}</button>
        })}</div>
        {!value.gameB.solvedToday && <div className="event-game-b-action">{gameBIntent || value.gameB.canAttempt ? <button type="button" className="small-primary-button" disabled={pending || (!gameBIntent && (!selectedCode || !value.gameB.remainingCodes.includes(selectedCode)))} onClick={() => void attemptGameB()}>{pending ? 'Tentative…' : gameBIntent ? `Réessayer ${gameBIntent.code}` : selectedCode ? `Tester ${selectedCode}` : 'Choisissez une combinaison'}</button> : <strong>{value.gameB.attemptsRemaining === 0 ? 'Vos trois essais sont utilisés pour aujourd’hui.' : 'Toutes les combinaisons ont été testées.'}</strong>}</div>}
        <p className={`event-game-b-feedback${value.gameB.solvedToday || gameBFeedback?.startsWith('Combinaison découverte') ? ' success' : ''}`} role="status" aria-live="polite">{gameBFeedback ?? (value.gameB.solvedToday ? 'Combinaison découverte ! Tous les participants inscrits gagnent 1 point et 1 monnaie du Festival.' : '')}</p>
      </section>}
      {section === 'games' && gameTab === 2 && value.gameC.available && <section className="panel event-game-c">
        <header><span className="eyebrow">Message du Festival</span><h2>{presentation.games[2]}</h2></header>
        {value.gameC.canSend ? <div className="event-game-c-send">
          {selectedRecipient ? <p>Destinataire : <strong>{selectedRecipient.displayName}</strong><br /><span>Niveau {selectedRecipient.level} · {selectedRecipient.elementKey ?? 'Élément non choisi'}</span></p> : null}
          <button type="button" className="small-primary-button" onClick={() => setRecipientBrowserOpen(true)}>{selectedRecipient ? 'Changer' : 'Choisir un joueur'}</button>
          <label htmlFor="event-game-c-message">Votre message</label>
          <textarea id="event-game-c-message" value={gameCMessage} maxLength={500} rows={3} onChange={(event) => setGameCMessage(event.target.value)} />
          <button type="button" className="small-primary-button" disabled={pending || !selectedRecipient || !gameCMessage.trim()} onClick={() => void sendGameC()}>{pending ? 'Envoi…' : 'Envoyer'}</button>
        </div> : <p className="event-game-c-sent">{value.gameC.sentToday ? 'Envoyé aujourd’hui' : 'Rejoignez le Festival pour envoyer un message.'}</p>}
        <p className="event-game-c-feedback" role="status">{gameCFeedback ?? ''}</p>
        <div className="event-game-c-inbox"><h3>Messages reçus aujourd’hui</h3>{value.gameC.receivedMessages.length ? value.gameC.receivedMessages.map((entry) => <article key={entry.id}><div><strong>{entry.sender.displayName}</strong><time dateTime={entry.createdAt}>{timeFormatter.format(new Date(entry.createdAt))}</time></div><p>{entry.message}</p></article>) : <p>Aucun message reçu aujourd’hui.</p>}</div>
      </section>}
      <p className="event-feedback" role={error ? 'alert' : 'status'}>{error ?? ''}</p>
    </ScrollableScreenPanel>
    {recipientBrowserOpen && <PlayerSelectionBrowser eyebrow="Événement · Panier" title="Choisir un joueur" selectedPlayerId={selectedRecipient?.playerId ?? ''} onListPlayers={listRecipients} onConfirm={(recipient) => { setSelectedRecipient(recipient); setRecipientBrowserOpen(false) }} onClose={() => setRecipientBrowserOpen(false)} />}
  </div>
}
