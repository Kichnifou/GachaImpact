import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import type { EventDto, EventDailyBonusClaimDto, EventCalendarClaimDto, EventGameAAttemptDto, EventGameBAttemptDto, EventGameCRecipientQuery, EventGameCRecipientsDto, EventGameCSendDto, EventJoinDto, EventRankingDto } from '../api/types'
import { isAmbiguousMutationError } from '../api/mutation-errors'
import ScreenHeader from '../components/ScreenHeader'
import AppButton from '../components/AppButton'
import ScrollableScreenPanel from '../components/ScrollableScreenPanel'
import PlayerQuickSearch from '../components/PlayerQuickSearch'
import PlayerSelectionBrowser, { type PlayerBrowserQuery } from '../components/PlayerSelectionBrowser'
import EventShopSection, { type EventShopIntent, type EventShopTarget } from './EventShopSection'
import EventCalendar from './EventCalendar'
import { useCalendarClaim } from '../event/use-calendar-claim'
import EventRankingSection from './EventRankingSection'
import { eventCurrencyLabel, eventGameAExpiredToday, eventPresentation } from '../event/event-presentation'
import { apiErrorMessage, formatResourceAmount } from '../utils/formatters'

type Props = Readonly<{
  sessionUserId: string
  value: EventDto
  onLoad: () => Promise<EventDto>
  onLoadRanking?: () => Promise<EventRankingDto>
  onJoin: (idempotencyKey: string) => Promise<EventJoinDto>
  onClaimCalendar?: (key: string) => Promise<EventCalendarClaimDto>
  onClaimDailyBonus?: (idempotencyKey: string) => Promise<EventDailyBonusClaimDto>
  onConvertShop?: (target: 'PRIMOGEMS' | 'MORAS', quantity: number, key: string) => Promise<EventDto>
  onPurchaseCollection?: (key: string) => Promise<EventDto>
  onAttempt: (idempotencyKey: string) => Promise<EventGameAAttemptDto>
  onAttemptB: (code: string, idempotencyKey: string) => Promise<EventGameBAttemptDto>
  onSearchRecipients?: (query: EventGameCRecipientQuery) => Promise<EventGameCRecipientsDto>
  onSendGameC?: (recipientPlayerId: string, message: string, idempotencyKey: string) => Promise<EventGameCSendDto>
  onConsultMessages?: () => Promise<EventDto>
  openMessagesToken?: number
  openShopToken?: number
  onOpenCodes?: () => void
  onOpenHistory?: () => void
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
const milestonePreferenceKey = (playerId: string) => `gachaimpact:event:milestones-collapsed:${playerId}`
const readMilestonePreference = (playerId: string) => {
  try { return window.localStorage.getItem(milestonePreferenceKey(playerId)) === 'true' } catch { return false }
}
const saveMilestonePreference = (playerId: string, collapsed: boolean) => {
  try { window.localStorage.setItem(milestonePreferenceKey(playerId), String(collapsed)) } catch { /* Keep the choice for this mounted screen. */ }
}

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

export default function EventScreen({ sessionUserId, value, onLoad, onLoadRanking, onJoin, onClaimCalendar, onClaimDailyBonus, onConvertShop, onPurchaseCollection, onAttempt, onAttemptB, onSearchRecipients = unavailableRecipientSearch, onSendGameC = unavailableGameCSend, onConsultMessages, openMessagesToken = 0, openShopToken = 0, onOpenCodes, onOpenHistory }: Props) {
  const calendarAction = useCalendarClaim(`${sessionUserId}:${value.edition.id}:${value.businessDate}`, onClaimCalendar)
  const [section, setSection] = useState<'registration' | 'games' | 'shop' | 'ranking'>(openShopToken > 0 ? 'shop' : openMessagesToken > 0 ? 'games' : 'registration')
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- Explicit notification navigation intent.
    if (openShopToken > 0) setSection('shop')
  }, [openShopToken])
  const [gameTab, setGameTab] = useState<0 | 1 | 2>(openMessagesToken > 0 ? 2 : 0)
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [gameBIntent, setGameBIntent] = useState<Readonly<{ code: string; key: string }> | null>(null)
  const [gameBFeedback, setGameBFeedback] = useState<string | null>(null)
  const [recipientBrowserOpen, setRecipientBrowserOpen] = useState(false)
  const [milestonePreference, setMilestonePreference] = useState(() => ({ playerId: sessionUserId, collapsed: readMilestonePreference(sessionUserId) }))
  const [selectedRecipient, setSelectedRecipient] = useState<EventGameCRecipientsDto['recipients'][number] | null>(null)
  const [recipientSearchText, setRecipientSearchText] = useState('')
  const [gameCMessage, setGameCMessage] = useState('')
  const [gameCIntent, setGameCIntent] = useState<Readonly<{ recipientPlayerId: string; message: string; key: string }> | null>(null)
  const [gameCFeedback, setGameCFeedback] = useState<string | null>(null)
  const [shopIntent, setShopIntent] = useState<EventShopIntent | null>(null)
  const shopIntentRef = useRef<EventShopIntent | null>(null)
  const [shopPending, setShopPending] = useState(false)
  const shopPendingRef = useRef(false)
  const [shopFeedback, setShopFeedback] = useState('')
  const [shopError, setShopError] = useState('')
  const shopBoundaryRef = useRef({ sessionUserId, editionId: value.edition.id })
  const [pending, setPending] = useState(false)
  const pendingRef = useRef(false)
  const [intentKey, setIntentKey] = useState<string | null>(null)
  const [dailyBonusIntentKey, setDailyBonusIntentKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attemptFeedback, setAttemptFeedback] = useState<Readonly<{ kind: 'success' | 'failure'; message: string }> | null>(null)
  const boundaryRef = useRef({ sessionUserId, businessDate: value.businessDate, editionId: value.edition.id })

  useLayoutEffect(() => {
    const previous = shopBoundaryRef.current
    if (previous.sessionUserId === sessionUserId && previous.editionId === value.edition.id) return
    shopBoundaryRef.current = { sessionUserId, editionId: value.edition.id }
    shopIntentRef.current = null
    shopPendingRef.current = false
    // oxlint-disable-next-line react(set-state-in-effect) -- A different player or edition invalidates the previous Shop operation.
    setShopIntent(null)
    setShopPending(false)
    setShopFeedback('')
    setShopError('')
  }, [sessionUserId, value.edition.id])

  useLayoutEffect(() => {
    const previous = boundaryRef.current
    if (previous.sessionUserId === sessionUserId && previous.businessDate === value.businessDate && previous.editionId === value.edition.id) return
    boundaryRef.current = { sessionUserId, businessDate: value.businessDate, editionId: value.edition.id }
    // oxlint-disable-next-line react(set-state-in-effect) -- A new player, edition or server business boundary invalidates the previous local attempt.
    setSelectedCode(null)
    setGameBIntent(null)
    setGameBFeedback(null)
    setDailyBonusIntentKey(null)
    setGameCIntent(null)
    setGameCFeedback(null)
    setSelectedRecipient(null)
    setRecipientSearchText('')
    setGameCMessage('')
    setError(null)
    if (previous.editionId !== value.edition.id) {
      setSection('registration')
      setGameTab(0)
    }
  }, [sessionUserId, value.businessDate, value.edition.id])

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
        ? { kind: 'success', message: `Réussite ! +1 point et +1 ${value.festival.currency.unit}.` }
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
      setGameCFeedback(`Message envoyé. +1 point et +1 ${value.festival.currency.unit}.`)
    } catch (reason) {
      if (!isAmbiguousMutationError(reason)) setGameCIntent(null)
      setError(apiErrorMessage(reason))
    } finally {
      pendingRef.current = false
      setPending(false)
    }
  }

  const transactShop = async (target: EventShopTarget, quantity: number) => {
    if (shopPendingRef.current || !value.shop.available) return
    const previous = shopIntentRef.current
    if (previous && previous.target !== target) return
    setShopFeedback('')
    setShopError('')
    if (target === 'COLLECTION') {
      if (!onPurchaseCollection || !value.shop.collection.available || value.shop.collection.obtainedThisEdition) return
      if (!previous && BigInt(value.shop.balance) < BigInt(value.shop.collection.cost)) { setShopError('Votre solde est insuffisant pour cet objet.'); return }
    } else {
      if (!onConvertShop) return
      if (!previous && (!Number.isSafeInteger(quantity) || quantity <= 0 || BigInt(quantity) > BigInt(value.shop.balance))) { setShopError('Choisissez une quantité valide, dans la limite de votre solde.'); return }
    }
    const intent = previous ?? { target, quantity, key: crypto.randomUUID() }
    const requestBoundary = { sessionUserId, editionId: value.edition.id }
    const sameBoundary = () => shopBoundaryRef.current.sessionUserId === requestBoundary.sessionUserId && shopBoundaryRef.current.editionId === requestBoundary.editionId
    shopIntentRef.current = intent
    shopPendingRef.current = true
    setShopIntent(intent)
    setShopPending(true)
    try {
      await (intent.target === 'COLLECTION' ? onPurchaseCollection!(intent.key) : onConvertShop!(intent.target, intent.quantity, intent.key))
      if (sameBoundary()) {
        shopIntentRef.current = null
        setShopIntent(null)
        setShopFeedback(intent.target === 'COLLECTION'
          ? `Objet obtenu : ${value.shop.collection.label}`
          : `Échange effectué ! Vous obtenez ${formatResourceAmount((BigInt(intent.quantity) * BigInt(value.shop.rates[intent.target === 'PRIMOGEMS' ? 'primogems' : 'moras'])).toString())} ${intent.target === 'PRIMOGEMS' ? 'Primogemmes' : 'Moras'} contre ${intent.quantity} ${eventCurrencyLabel(intent.quantity, value.festival.currency)}.`)
      }
    } catch (reason) {
      if (sameBoundary()) {
        if (!isAmbiguousMutationError(reason)) { shopIntentRef.current = null; setShopIntent(null) }
        setShopError(apiErrorMessage(reason))
      }
    } finally {
      if (sameBoundary()) { shopPendingRef.current = false; setShopPending(false) }
    }
  }

  const presentation = eventPresentation(value.festival.key)
  const expiredToday = eventGameAExpiredToday(value)
  const milestonesCollapsed = milestonePreference.playerId === sessionUserId ? milestonePreference.collapsed : readMilestonePreference(sessionUserId)
  const toggleMilestones = () => {
    const next = !milestonesCollapsed
    setMilestonePreference({ playerId: sessionUserId, collapsed: next })
    saveMilestonePreference(sessionUserId, next)
  }
  const milestoneProgress = Math.min(87.5, Math.max(0, (value.milestones.currentPoints - 10) / 70 * 87.5))
  const tabs = <>
    <section className="event-milestone-progress" aria-label="Progression du Festival">
      <div className="event-milestone-summary"><strong>{formatResourceAmount(String(value.milestones.currentPoints))} points</strong><span>Votre progression</span><button type="button" aria-expanded={!milestonesCollapsed} aria-controls="event-milestone-track" onClick={toggleMilestones}>{milestonesCollapsed ? 'Afficher les paliers' : 'Rétracter les paliers'}</button></div>
      <div id="event-milestone-track" className="event-milestone-track-scroll" hidden={milestonesCollapsed}><div className="event-milestone-track">
        <span className="event-milestone-fill" role="progressbar" aria-label="Paliers du Festival" aria-valuemin={0} aria-valuemax={80} aria-valuenow={Math.min(80, value.milestones.currentPoints)} style={{ width: `${milestoneProgress}%` }} />
        {value.milestones.thresholds.map((threshold) => <div className={`event-milestone-marker${threshold.rewarded ? ' rewarded' : threshold.reached ? ' reached' : ''}`} key={threshold.points}><span aria-hidden="true">◆</span><strong>{threshold.points}</strong><small>{threshold.rewardLabel}</small></div>)}
      </div></div>
    </section>
    <nav className="activity-inner-tabs event-tabs" aria-label="Sections Événement">
      <button type="button" className={section === 'registration' ? 'active' : ''} aria-current={section === 'registration' ? 'page' : undefined} onClick={() => setSection('registration')}>Inscription</button>
      <button type="button" className={section === 'games' ? 'active' : ''} aria-current={section === 'games' ? 'page' : undefined} disabled={!value.participation.joined && !value.gameC.available} onClick={() => { setGameTab(value.participation.joined ? 0 : 2); setSection('games') }}>Jeux</button>
      <button type="button" className={section === 'shop' ? 'active' : ''} aria-current={section === 'shop' ? 'page' : undefined} onClick={() => setSection('shop')}>Shop</button>
      <button type="button" className={section === 'ranking' ? 'active' : ''} aria-current={section === 'ranking' ? 'page' : undefined} onClick={() => setSection('ranking')}>Classement</button>
    </nav>
    {onOpenHistory && <AppButton onClick={onOpenHistory}>Voir l’historique</AppButton>}
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

      {value.participation.joined && <section className="panel event-daily-bonus"><div><span className="eyebrow">Bonus quotidien</span><h2>+1 {value.festival.currency.unit}</h2><p>Une fois par jour pendant le Festival.</p></div>{value.dailyBonus.claimedToday ? <strong>Réclamé aujourd’hui</strong> : <button type="button" className="small-primary-button" disabled={!value.dailyBonus.canClaim || pending || !onClaimDailyBonus} onClick={() => void claimDailyBonus()}>{pending ? 'Réclamation…' : 'Réclamer'}</button>}</section>}
      <section className="panel event-foundation-card">
        <div><span className="eyebrow">Participation volontaire</span><h2>{value.participation.joined ? 'Votre inscription est enregistrée' : `Recevez 1 ${value.festival.currency.unit}`}</h2><p>Votre solde restera associé à ce Festival entre les années.</p></div>
        {value.participation.joined
          ? <span className="event-joined-status">Événement rejoint</span>
          : <button type="button" className="small-primary-button" disabled={!value.canJoin || pending} onClick={() => void join()}>{pending ? 'Inscription…' : 'Rejoindre l’événement'}</button>}
      </section>
      <EventCalendar value={value} action={calendarAction} enabled={Boolean(onClaimCalendar)} />
      {value.giftCode?.available && <div className="panel"><p>Un code cadeau du Festival est disponible.</p><AppButton onClick={onOpenCodes} disabled={!onOpenCodes}>Voir les Codes</AppButton></div>}
      </>}
      {section === 'shop' && <EventShopSection value={value} intent={shopIntent} pending={shopPending} feedback={shopFeedback} error={shopError} canConvert={Boolean(onConvertShop)} canPurchaseCollection={Boolean(onPurchaseCollection)} onTransact={(target, quantity) => void transactShop(target, quantity)} />}
      {section === 'ranking' && <EventRankingSection editionId={value.edition.id} onLoad={onLoadRanking} />}
      {section === 'games' && gameTab === 0 && value.participation.joined && <section className="panel event-game-a" data-theme={value.gameA.theme.key}>
        <div className="event-game-a-heading"><span className="eyebrow">Jeu du Festival</span><span className={`event-game-a-day-state${value.gameA.completedToday ? ' complete' : expiredToday ? ' expired' : ''}`}>{value.gameA.completedToday ? 'Réussi aujourd’hui' : expiredToday ? 'Délai dépassé...' : 'À réussir aujourd’hui'}</span></div>
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
        <div className="event-game-b-heading"><span className="eyebrow">Énigme collective du Festival</span><strong>{value.gameB.solvedToday ? 'Découvert aujourd’hui' : 'Encore à découvrir'}</strong></div>
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
        <header><span className="eyebrow">Message du Festival</span></header>
        {value.gameC.canSend ? <div className="event-game-c-send">
          <PlayerQuickSearch value={recipientSearchText} onValueChange={(text) => { setRecipientSearchText(text); setSelectedRecipient(null) }} onListPlayers={listRecipients} onSelect={(recipient) => { setSelectedRecipient(recipient); setRecipientSearchText(recipient.displayName) }} action={(closeSuggestions) => <button type="button" className="small-primary-button" onClick={() => { closeSuggestions(); setRecipientBrowserOpen(true) }}>{selectedRecipient ? 'Changer' : 'Choisir un joueur'}</button>} />
          <label htmlFor="event-game-c-message">Votre message</label>
          <textarea id="event-game-c-message" value={gameCMessage} maxLength={500} rows={3} onChange={(event) => setGameCMessage(event.target.value)} />
          <button type="button" className="small-primary-button" disabled={pending || !selectedRecipient || !gameCMessage.trim()} onClick={() => void sendGameC()}>{pending ? 'Envoi…' : 'Envoyer'}</button>
        </div> : <p className="event-game-c-sent">{value.gameC.sentToday ? 'Envoyé aujourd’hui' : 'Rejoignez le Festival pour envoyer un message.'}</p>}
        <p className="event-game-c-feedback" role="status">{gameCFeedback ?? ''}</p>
        <div className="event-game-c-inbox"><h3>Messages reçus aujourd’hui</h3>{value.gameC.receivedMessages.length ? value.gameC.receivedMessages.map((entry) => <article key={entry.id}><div><strong>{entry.sender.displayName}</strong><time dateTime={entry.createdAt}>{timeFormatter.format(new Date(entry.createdAt))}</time></div><p>{entry.message}</p></article>) : <p>Aucun message reçu aujourd’hui.</p>}</div>
      </section>}
      <p className="event-feedback" role={error ? 'alert' : 'status'}>{error ?? ''}</p>
    </ScrollableScreenPanel>
    {recipientBrowserOpen && <PlayerSelectionBrowser eyebrow="Événement · Panier" title="Choisir un joueur" selectedPlayerId={selectedRecipient?.playerId ?? ''} onListPlayers={listRecipients} onConfirm={(recipient) => { setSelectedRecipient(recipient); setRecipientSearchText(recipient.displayName); setRecipientBrowserOpen(false) }} onClose={() => setRecipientBrowserOpen(false)} />}
  </div>
}
