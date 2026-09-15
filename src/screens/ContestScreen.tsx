import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ContestDto, ContestHistoryDto, ContestLatestScoreChangeDto, ContestLegendDto, ContestSnapshotDto, ElementKey } from '../api/types'
import { isAmbiguousMutationError } from '../api/mutation-errors'
import { apiErrorMessage, elementLabels, formatResourceAmount } from '../utils/formatters'
import CharacterAssetImage from '../components/CharacterAssetImage'
import AppButton, { type AppButtonVariant } from '../components/AppButton'
import ModalCloseButton from '../components/ModalCloseButton'
import ScreenHeader from '../components/ScreenHeader'
import ScrollableScreenPanel from '../components/ScrollableScreenPanel'
import { useModalDialog } from '../components/useModalDialog'

type Props = {
  value: ContestDto
  onRefresh: () => Promise<ContestDto>
  onOpen: (characterId: string, key: string) => Promise<ContestDto>
  onJoin: (characterId: string, key: string) => Promise<ContestDto>
  onSelectLegend: (characterId: string, key: string) => Promise<ContestDto>
  onReady: (ready: boolean, key: string) => Promise<ContestDto>
  onStart: (key: string) => Promise<ContestDto>
  onSpectate: (key: string) => Promise<ContestDto>
  onLeave: (key: string) => Promise<ContestDto>
  onCancel: (key: string) => Promise<ContestDto>
  onPlay: (action: 'BASIC' | 'RISK', key: string) => Promise<ContestDto>
  onSupport: (slot: number, key: string) => Promise<ContestDto>
  onRemoveParticipant: (playerId: string, key: string) => Promise<ContestDto>
  onRemoveSpectator: (playerId: string, key: string) => Promise<ContestDto>
  onLoadHistory: (page: number) => Promise<ContestHistoryDto>
  onLoadHistoryDetail: (contestId: string) => Promise<ContestSnapshotDto>
}

type Intent = { signature: string; key: string }
type Runner = (signature: string, request: (key: string) => Promise<ContestDto>) => Promise<ContestDto | null>

export default function ContestScreen(props: Props) {
  const [legendDraftId, setSelectedLegendId] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const [, setIntent] = useState<Intent | null>(null)
  const pendingRef = useRef<string | null>(null)
  const intentRef = useRef<Intent | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [legendsOpen, setLegendsOpen] = useState(false)
  const [history, setHistory] = useState<ContestHistoryDto | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const activeContestId = props.value.active?.id
  const refresh = props.onRefresh
  const authoritativeLegendId = props.value.active?.status === 'LOBBY' ? props.value.active.viewer.selectedCharacterId : null
  const selectedLegendId = authoritativeLegendId ?? (props.value.legends.some((legend) => legend.character.id === legendDraftId) ? legendDraftId : '')
  const scoreFeedback = useLatestScoreFeedback(props.value.active)

  useEffect(() => {
    let mounted = true
    let pollTimer: number | null = null
    let inFlight: Promise<void> | null = null
    let failures = 0
    const clearPoll = () => { if (pollTimer !== null) window.clearTimeout(pollTimer); pollTimer = null }
    const schedule = (delay: number) => {
      clearPoll()
      if (mounted && document.visibilityState !== 'hidden') pollTimer = window.setTimeout(() => { void revalidate() }, delay)
    }
    const revalidate = () => {
      if (!mounted || document.visibilityState === 'hidden') return Promise.resolve()
      if (inFlight) return inFlight
      const request = refresh().then(() => {
        if (!mounted) return
        failures = 0
        setSyncError(null)
      }).catch(() => {
        if (!mounted) return
        failures += 1
        setSyncError('Synchronisation temporairement indisponible. Nouvel essai automatique.')
      }).finally(() => {
        if (inFlight === request) inFlight = null
        if (mounted) schedule(Math.min(15_000, (activeContestId ? 2_000 : 3_000) * 2 ** failures))
      })
      inFlight = request
      return request
    }
    const onFocus = () => { void revalidate() }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') clearPoll()
      else void revalidate()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)
    void revalidate()
    return () => {
      mounted = false
      clearPoll()
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [activeContestId, refresh])

  useEffect(() => {
    if (!activeContestId) return
    const clock = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(clock)
  }, [activeContestId])

  const run: Runner = async (signature, request) => {
    if (pendingRef.current) return null
    if (intentRef.current && intentRef.current.signature !== signature) {
      setError('Réessayez d’abord l’action précédente afin de vérifier son résultat serveur.')
      return null
    }
    const current = intentRef.current ?? { signature, key: crypto.randomUUID() }
    intentRef.current = current
    pendingRef.current = signature
    setIntent(current)
    setPending(signature)
    setError(null)
    try {
      const value = await request(current.key)
      intentRef.current = null
      setIntent(null)
      return value
    } catch (reason) {
      if (!isAmbiguousMutationError(reason)) {
        intentRef.current = null
        setIntent(null)
      }
      setError(apiErrorMessage(reason))
    } finally {
      pendingRef.current = null
      setPending(null)
    }
    return null
  }
  const openHistory = async (page = 1) => {
    setHistoryOpen(true)
    setHistoryError(null)
    try { setHistory(await props.onLoadHistory(page)) } catch (reason) { setHistoryError(apiErrorMessage(reason)) }
  }
  const toolbarTheme = props.value.active?.theme ?? props.value.theme
  const fixed = <div className="contest-toolbar"><div><span className="eyebrow">{props.value.active ? 'Thème du Concours' : 'Thème du jour'}</span><strong>{toolbarTheme.label}</strong></div><div className="contest-toolbar-actions"><AppButton onClick={() => setLegendsOpen(true)}>Mes Légendes</AppButton><AppButton onClick={() => void openHistory()}>Historique</AppButton></div></div>

  return <div className="screen-content contest-screen long-screen-layout">
    <ScreenHeader eyebrow="Activités" title="Concours" />
    <ScrollableScreenPanel className="contest-frame" bodyClassName="contest-scroll-body" fixed={fixed}>
      <div className="contest-body">
        {!props.value.active && !props.value.lastResult && <ContestEmpty value={props.value} selectedLegendId={selectedLegendId} onSelect={setSelectedLegendId} pending={pending} onOpen={() => void run(`open:${selectedLegendId}`, (key) => props.onOpen(selectedLegendId, key))} />}
        {props.value.active?.status === 'LOBBY' && <ContestLobby {...props} contest={props.value.active} selectedLegendId={selectedLegendId} onSelect={setSelectedLegendId} pending={pending} run={run} now={now} />}
        {props.value.active?.status === 'RUNNING' && <ContestRunning {...props} contest={props.value.active} pending={pending} run={run} now={now} scoreFeedback={scoreFeedback} />}
        {!props.value.active && props.value.lastResult && <ContestResult contest={props.value.lastResult} legends={props.value.legends} theme={props.value.theme} canOpen={props.value.permissions.canOpen} selectedLegendId={selectedLegendId} onSelect={setSelectedLegendId} pending={pending} onOpen={() => void run(`open:${selectedLegendId}`, (key) => props.onOpen(selectedLegendId, key))} />}
        {(error || syncError) && <div className="contest-feedback-region">{error && <p className="contest-feedback error" role="alert">{error}</p>}{syncError && !error && <p className="contest-sync-feedback error" role="status">{syncError}</p>}</div>}
      </div>
    </ScrollableScreenPanel>
    {legendsOpen && <LegendsModal legends={props.value.legends} theme={toolbarTheme} onClose={() => setLegendsOpen(false)} />}
    {historyOpen && <HistoryModal history={history} error={historyError} onPage={openHistory} onLoadDetail={props.onLoadHistoryDetail} onClose={() => setHistoryOpen(false)} />}
  </div>
}

type ScoreFeedback = ContestLatestScoreChangeDto
type ScoreFeedbackState = Readonly<{ contestId: string; events: readonly ScoreFeedback[] }>
const emptyScoreChanges: readonly ScoreFeedback[] = []

function useLatestScoreFeedback(contest: ContestSnapshotDto | null): ScoreFeedback | null {
  const seen = useRef<{ contestId: string; eventIds: Set<string> } | null>(null)
  const baselineNextProjection = useRef(false)
  const [feedback, setFeedback] = useState<ScoreFeedbackState | null>(null)
  const contestId = contest?.id ?? null
  const events = contest?.recentScoreChanges ?? emptyScoreChanges

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'hidden') return
      baselineNextProjection.current = true
      setFeedback(null)
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  useEffect(() => {
    if (!contestId) {
      seen.current = null
      baselineNextProjection.current = false
      return
    }
    if (!seen.current || seen.current.contestId !== contestId) {
      seen.current = { contestId, eventIds: new Set(events.map((event) => event.eventId)) }
      baselineNextProjection.current = false
      return
    }
    if (baselineNextProjection.current) {
      seen.current = { contestId, eventIds: new Set(events.map((event) => event.eventId)) }
      baselineNextProjection.current = false
      return
    }
    const unseen = events.filter((event) => !seen.current!.eventIds.has(event.eventId))
    seen.current = { contestId, eventIds: new Set(events.map((event) => event.eventId)) }
    if (unseen.length > 0) setFeedback((current) => ({ contestId, events: [...(current?.contestId === contestId ? current.events : []), ...unseen] }))
  }, [contestId, events])

  useEffect(() => {
    const currentEvent = feedback?.events[0]
    if (!currentEvent) return
    const timer = window.setTimeout(() => setFeedback((current) => {
      if (!current || current.contestId !== feedback.contestId || current.events[0]?.eventId !== currentEvent.eventId) return current
      const remaining = current.events.slice(1)
      return remaining.length > 0 ? { ...current, events: remaining } : null
    }), 1_200)
    return () => window.clearTimeout(timer)
  }, [feedback])

  return feedback?.contestId === contestId ? feedback.events[0] ?? null : null
}

function ContestEmpty({ value, selectedLegendId, onSelect, pending, onOpen }: { value: ContestDto; selectedLegendId: string; onSelect: (id: string) => void; pending: string | null; onOpen: () => void }) {
  const loading = pending?.startsWith('open:') ?? false
  return <section className="panel contest-empty"><span className="contest-theme-glyph" aria-hidden="true">✦</span><h2>Aucun Concours actif</h2><p>Ouvrez un lobby et devenez son premier participant.</p>
    {value.legends.length > 0 ? <LegendSelect legends={value.legends} theme={value.theme} value={selectedLegendId} onChange={onSelect} disabled={Boolean(pending)} /> : <p className="contest-empty-note">Une Légende 5★ C6 active est nécessaire pour participer.</p>}
    {value.dailyUsed && <p className="contest-empty-note">Votre participation quotidienne est déjà utilisée.</p>}
    <AppButton variant="primary" className="contest-mutation-button" disabled={!value.permissions.canOpen || Boolean(pending) || !selectedLegendId} aria-busy={loading} onClick={onOpen}>{loading ? 'Ouverture…' : 'Ouvrir un lobby'}</AppButton>
  </section>
}

function ContestLobby(props: Props & { contest: ContestSnapshotDto; selectedLegendId: string; onSelect: (id: string) => void; pending: string | null; run: Runner; now: number }) {
  const { contest, value } = props
  const [confirmingStart, setConfirmingStart] = useState<string | null>(null)
  const me = contest.participants.find((item) => item.slot === contest.viewer.participantSlot)
  const startContext = contestConfirmationContext(contest, value.permissions, 'start')
  const startIsCurrent = confirmingStart === startContext && value.permissions.canStart && !deadlineElapsed(contest.lobbyDeadlineAt, props.now)
  useEffect(() => {
    if (confirmingStart && !startIsCurrent) setConfirmingStart(null)
  }, [confirmingStart, startIsCurrent])
  const changeLegend = async (characterId: string) => {
    const previous = contest.viewer.selectedCharacterId ?? ''
    props.onSelect(characterId)
    const updated = await props.run(`legend:${characterId}`, (key) => props.onSelectLegend(characterId, key))
    if (updated?.active?.viewer.selectedCharacterId) props.onSelect(updated.active.viewer.selectedCharacterId)
    else if (!updated) {
      try { const refreshed = await props.onRefresh(); props.onSelect(refreshed.active?.viewer.selectedCharacterId ?? previous) }
      catch { props.onSelect(previous) }
    }
  }
  const readySignature = `ready:${!me?.ready}`
  return <div className="contest-active-layout">
    <section className="panel contest-state-header"><div><span className="eyebrow">Lobby public</span><h2>En attente des participants</h2></div><Countdown label="Fermeture" deadline={contest.lobbyDeadlineAt} now={props.now} /></section>
    <ParticipantGrid contest={contest} organizerCanRemove={contest.viewer.organizer} onRemove={(playerId) => void props.run(`remove:${playerId}`, (key) => props.onRemoveParticipant(playerId, key))} pending={props.pending} />
    <SpectatorStrip contest={contest} organizerCanRemove={contest.viewer.organizer} onRemove={(playerId) => void props.run(`remove-spectator:${playerId}`, (key) => props.onRemoveSpectator(playerId, key))} pending={props.pending} />
    <section className="panel contest-action-region">
      {!me ? <div className="contest-join-panel"><LegendSelect legends={value.legends} theme={contest.theme} value={props.selectedLegendId} onChange={props.onSelect} disabled={Boolean(props.pending) || value.dailyUsed} /><div className="contest-inline-actions"><PendingButton signature={`join:${props.selectedLegendId}`} pending={props.pending} pendingLabel="Enregistrement…" variant="primary" disabled={!value.permissions.canJoin || !props.selectedLegendId} onClick={() => void props.run(`join:${props.selectedLegendId}`, (key) => props.onJoin(props.selectedLegendId, key))}>Participer</PendingButton>{value.permissions.canSpectate && <PendingButton signature="spectate" pending={props.pending} pendingLabel="Enregistrement…" onClick={() => void props.run('spectate', props.onSpectate)}>Regarder activement</PendingButton>}</div>{value.dailyUsed && <p className="contest-join-unavailable" role="status">Participation quotidienne déjà utilisée.</p>}</div>
        : <div className="contest-lobby-controls"><LegendSelect legends={value.legends} theme={contest.theme} value={props.selectedLegendId} onChange={(id) => void changeLegend(id)} disabled={Boolean(props.pending)} /><div className="contest-inline-actions"><PendingButton signature={readySignature} pending={props.pending} pendingLabel="Enregistrement…" className={me.ready ? 'contest-ready active' : 'contest-ready'} onClick={() => void props.run(readySignature, (key) => props.onReady(!me.ready, key))}>{me.ready ? '✓ Prêt' : 'Je suis prêt'}</PendingButton>{contest.viewer.organizer && <PendingButton signature="start" pending={props.pending} pendingLabel="Lancement…" variant="primary" disabled={!value.permissions.canStart} onClick={() => setConfirmingStart(startContext)}>Lancer</PendingButton>}</div>{props.pending?.startsWith('legend:') && <span className="contest-inline-pending" role="status">Changement de Légende…</span>}</div>}
    </section>
    <div className="contest-footer-actions">{value.permissions.canLeave && <PendingButton signature="leave" pending={props.pending} pendingLabel="Sortie…" onClick={() => void props.run('leave', props.onLeave)}>{contest.viewer.spectator ? 'Quitter le rôle de spectateur' : 'Quitter'}</PendingButton>}{value.permissions.canCancel && <PendingButton signature="cancel" pending={props.pending} pendingLabel="Annulation…" variant="danger" onClick={() => void props.run('cancel', props.onCancel)}>Annuler le lobby</PendingButton>}</div>
    {confirmingStart && <ContestConfirmation title="Lancer le Concours ?" message="Le lancement consommera la participation quotidienne de tous les joueurs participants. Continuer ?" confirmLabel="Lancer le Concours" onCancel={() => setConfirmingStart(null)} onConfirm={() => { if (!startIsCurrent) { setConfirmingStart(null); return } setConfirmingStart(null); void props.run('start', props.onStart) }} />}
  </div>
}

function ContestRunning(props: Props & { contest: ContestSnapshotDto; pending: string | null; run: Runner; now: number; scoreFeedback: ScoreFeedback | null }) {
  const { contest, value } = props
  type Confirmation = { kind: 'leave' | 'cancel' | 'remove-spectator'; playerId?: string; context: string }
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const deadline = contest.phase === 'SUPPORT' ? contest.supportDeadlineAt : contest.turnDeadlineAt
  const status = value.permissions.canPlay
    ? 'À votre tour !'
    : value.permissions.canSupport
      ? 'À vous de soutenir un participant.'
      : contest.viewer.spectator
        ? 'En attente des joueurs...'
        : 'En attente du prochain tour.'
  const confirmationIsCurrent = confirmation ? confirmation.context === contestConfirmationContext(contest, value.permissions, confirmation.kind, confirmation.playerId) && confirmationAllowed(confirmation, contest, value.permissions, props.now) : false
  useEffect(() => {
    if (confirmation && !confirmationIsCurrent) setConfirmation(null)
  }, [confirmation, confirmationIsCurrent])
  const ask = (kind: Confirmation['kind'], playerId?: string) => setConfirmation({ kind, playerId, context: contestConfirmationContext(contest, value.permissions, kind, playerId) })
  return <div className="contest-active-layout running">
    <section className="panel contest-state-header contest-running-header"><div className="contest-running-round"><span className="eyebrow">Manche {contest.currentRound}</span><h2>{contest.phase === 'SUPPORT' ? 'Soutien du public' : 'Concours en cours'}</h2></div><p className="contest-running-status">{status}</p><div className="contest-running-phase"><span>{contest.phase === 'SUPPORT' ? 'Soutien' : `Tour ${contest.currentTurnOrder ?? '—'}`}</span><Countdown label="Temps restant" deadline={deadline} now={props.now} /></div></section>
    <ParticipantGrid contest={contest} scoreFeedback={props.scoreFeedback} playSlot={value.permissions.canPlay ? contest.viewer.participantSlot : null} canSupport={value.permissions.canSupport} pending={props.pending} onPlay={(action) => void props.run(`play:${action}`, (key) => props.onPlay(action, key))} onSupport={(slot) => void props.run(`support:${slot}`, (key) => props.onSupport(slot, key))} />
    <SpectatorStrip contest={contest} organizerCanRemove={contest.viewer.organizer} onRemove={(playerId) => ask('remove-spectator', playerId)} pending={props.pending} />
    <div className="contest-footer-actions">{value.permissions.canLeave && <PendingButton signature="leave" pending={props.pending} pendingLabel="Sortie…" onClick={() => contest.viewer.participantSlot ? ask('leave') : void props.run('leave', props.onLeave)}>Quitter le Concours</PendingButton>}{value.permissions.canCancel && <PendingButton signature="cancel" pending={props.pending} pendingLabel="Annulation…" variant="danger" onClick={() => ask('cancel')}>Annuler le Concours</PendingButton>}</div>
    {confirmation?.kind === 'leave' && <ContestConfirmation title="Quitter le Concours ?" message="Votre participation quotidienne a déjà été consommée au lancement. Si vous quittez maintenant, elle ne sera pas récupérée et vous ne pourrez plus participer à un Concours aujourd’hui. Êtes-vous sûr ?" confirmLabel="Quitter le Concours" danger onCancel={() => setConfirmation(null)} onConfirm={() => { if (!confirmationIsCurrent) { setConfirmation(null); return } setConfirmation(null); void props.run('leave', props.onLeave) }} />}
    {confirmation?.kind === 'cancel' && <ContestConfirmation title="Annuler le Concours ?" message="Votre propre participation restera consommée. Les autres participants humains récupéreront la leur. Aucun podium, aucune récompense et aucun résultat sportif ne seront produits." confirmLabel="Annuler le Concours" danger onCancel={() => setConfirmation(null)} onConfirm={() => { if (!confirmationIsCurrent) { setConfirmation(null); return } setConfirmation(null); void props.run('cancel', props.onCancel) }} />}
    {confirmation?.kind === 'remove-spectator' && confirmation.playerId && <ContestConfirmation title="Retirer ce spectateur ?" message="Le spectateur sera retiré immédiatement du Concours en cours. Cette action ne modifie pas les participations quotidiennes." confirmLabel="Retirer" danger onCancel={() => setConfirmation(null)} onConfirm={() => { if (!confirmationIsCurrent) { setConfirmation(null); return } const playerId = confirmation.playerId!; setConfirmation(null); void props.run(`remove-spectator:${playerId}`, (key) => props.onRemoveSpectator(playerId, key)) }} />}
  </div>
}

function ContestConfirmation({ title, message, confirmLabel, danger = false, onCancel, onConfirm }: { title: string; message: string; confirmLabel: string; danger?: boolean; onCancel: () => void; onConfirm: () => void }) {
  const dialogRef = useModalDialog<HTMLElement>(onCancel)
  return createPortal(<div className="modal-layer contest-confirmation-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel() }}><section ref={dialogRef} tabIndex={-1} className="panel contest-confirmation" role="alertdialog" aria-modal="true" aria-labelledby="contest-confirmation-title"><AppButton variant="icon" className="contest-confirmation-close" aria-label="Fermer" onClick={onCancel}>×</AppButton><span className="eyebrow">Confirmation</span><h2 id="contest-confirmation-title">{title}</h2><p>{message}</p><div><AppButton onClick={onCancel}>Non</AppButton><AppButton variant={danger ? 'danger' : 'primary'} aria-label={confirmLabel} onClick={onConfirm}>Oui</AppButton></div></section></div>, document.body)
}

function PendingButton({ signature, pending, pendingLabel, disabled = false, variant, className, ariaLabel, onClick, children }: { signature: string; pending: string | null; pendingLabel: string; disabled?: boolean; variant?: AppButtonVariant; className?: string; ariaLabel?: string; onClick: () => void; children: string }) {
  const loading = pending === signature
  return <AppButton variant={variant} className={`${className ?? ''} contest-mutation-button`.trim()} disabled={disabled || Boolean(pending)} aria-busy={loading} aria-label={ariaLabel} onClick={onClick}>{loading ? pendingLabel : children}</AppButton>
}

function ParticipantGrid({ contest, organizerCanRemove = false, onRemove, pending, scoreFeedback = null, playSlot = null, canSupport = false, onPlay, onSupport }: { contest: ContestSnapshotDto; organizerCanRemove?: boolean; onRemove?: (playerId: string) => void; pending?: string | null; scoreFeedback?: ScoreFeedback | null; playSlot?: number | null; canSupport?: boolean; onPlay?: (action: 'BASIC' | 'RISK') => void; onSupport?: (slot: number) => void }) {
  const bySlot = new Map(contest.participants.map((participant) => [participant.slot, participant]))
  const displayedSlots = contest.status === 'LOBBY' ? [1, 2, 3, 4] : contest.participants.map((participant) => participant.slot)
  return <div className="contest-participant-grid">{displayedSlots.map((slot) => {
    const item = bySlot.get(slot)
    if (!item) return <article className="panel contest-participant contest-free-slot" aria-label={`Place ${slot} libre`} key={slot}><span className="contest-slot">#{slot}</span><span aria-hidden="true">＋</span><h3>Place libre</h3><p>Disponible avant lancement</p></article>
    const canPlayHere = playSlot === item.slot
    const actionable = canPlayHere || canSupport
    return <article className={`panel contest-participant${item.activeTurn ? ' active-turn' : ''}${item.finalRank === 1 ? ' winner' : ''}${item.titleRank >= 1 && item.titleRank <= 4 ? ` contest-title-rank-${item.titleRank}` : ''}${actionable ? ' contest-participant-actionable' : ''}`} key={item.slot}>
      <div className="contest-avatar"><CharacterAssetImage characterName={item.characterName ?? item.displayName} className="contest-avatar-image" assetPaths={item.kind === 'HUMAN' ? [item.avatar] : []} fallback={item.kind === 'BOT' ? <span>◆</span> : null} /></div>
      <span className="contest-slot">#{item.slot}{item.turnOrder ? ` · tour ${item.turnOrder}` : ''}</span><h3>{item.displayName}</h3><p>{item.characterName}</p>
      {item.basePoints !== null && <div className="contest-score"><div className="contest-score-value"><strong>{item.score}</strong>{scoreFeedback?.slot === item.slot && <span className="contest-score-change" role="status" aria-label={`Gain de ${scoreFeedback.points} point${scoreFeedback.points === 1 ? '' : 's'}`} data-event-id={scoreFeedback.eventId}>+{scoreFeedback.points}</span>}</div><span>points · base +{item.basePoints}</span></div>}
      {item.title && <span className="contest-title">{item.title}</span>}{contest.status === 'LOBBY' && <span className={item.ready ? 'contest-ready-state ready' : 'contest-ready-state'}>{item.ready ? 'Prêt' : 'Pas prêt'}</span>}
      {item.replaced && <span className="contest-replaced">Remplacement IA</span>}
      {contest.status === 'RUNNING' && item.liveRank && <strong className="contest-live-rank" aria-label={`Classement en direct : ${rankLabel(item.liveRank)}`}>{rankLabel(item.liveRank)}</strong>}
      {item.finalRank && <strong className="contest-rank">{item.finalRank}<sup>e</sup> · {formatResourceAmount(item.rewardPrimogems ?? '0')} Primos</strong>}
      {organizerCanRemove && item.playerId && item.playerId !== contest.organizerPlayerId && <PendingButton signature={`remove:${item.playerId}`} pending={pending ?? null} pendingLabel="Retrait…" variant="danger" className="contest-remove" onClick={() => onRemove?.(item.playerId!)}>Retirer</PendingButton>}
      {actionable && <div className="contest-card-actions" aria-label={`Actions pour ${item.displayName}`}>{canPlayHere ? <><PendingButton signature="play:BASIC" pending={pending ?? null} pendingLabel="Action en cours…" variant="primary" onClick={() => onPlay?.('BASIC')}>Action de base</PendingButton><PendingButton signature="play:RISK" pending={pending ?? null} pendingLabel="Action en cours…" variant="danger" onClick={() => onPlay?.('RISK')}>Prendre un risque</PendingButton></> : <PendingButton signature={`support:${item.slot}`} pending={pending ?? null} pendingLabel="Soutien…" variant="primary" onClick={() => onSupport?.(item.slot)}>Soutenir</PendingButton>}</div>}
    </article>
  })}</div>
}

function SpectatorStrip({ contest, organizerCanRemove = false, onRemove, pending }: { contest: ContestSnapshotDto; organizerCanRemove?: boolean; onRemove?: (playerId: string) => void; pending?: string | null }) {
  return <section className="panel contest-spectators" aria-label="Spectateurs"><span className="eyebrow">Spectateurs</span><div>{Array.from({ length: 10 }, (_, index) => {
    const spectator = contest.spectators[index]
    return spectator ? <span className={`${spectator.selected ? 'selected ' : ''}${organizerCanRemove ? 'removable' : ''}`.trim()} key={spectator.playerId}><span>{spectator.displayName}{spectator.selected ? ' · soutien sélectionné' : ''}</span>{organizerCanRemove && <PendingButton signature={`remove-spectator:${spectator.playerId}`} pending={pending ?? null} pendingLabel="…" variant="danger" className="contest-spectator-remove" ariaLabel={`Retirer ${spectator.displayName} des spectateurs`} onClick={() => onRemove?.(spectator.playerId)}>×</PendingButton>}</span> : <span className="contest-spectator-placeholder" aria-hidden="true" key={`empty-${index}`} />
  })}</div></section>
}

function ContestResult({ contest, legends, theme, canOpen, selectedLegendId, onSelect, pending, onOpen }: { contest: ContestSnapshotDto; legends: readonly ContestLegendDto[]; theme: ContestDto['theme']; canOpen: boolean; selectedLegendId: string; onSelect: (id: string) => void; pending: string | null; onOpen: () => void }) {
  const winner = contest.participants.find((item) => item.slot === contest.winnerSlot)
  const loading = pending?.startsWith('open:') ?? false
  return <><section className="panel contest-result-hero"><span className="eyebrow">Dernier résultat</span><h2>{winner?.displayName ?? 'Concours terminé'} remporte le Concours</h2><p>{contest.theme.label} · {contest.currentRound} manche{contest.currentRound > 1 ? 's' : ''}</p>{contest.promotions.length > 0 && <div className="contest-promotions" aria-label="Promotions de titre">{contest.promotions.map((promotion) => <strong key={`${promotion.playerId}:${promotion.slot}`}>✨ {promotion.characterName ?? 'Légende'} devient {promotion.title} !</strong>)}</div>}{canOpen && <div className="contest-new-lobby"><LegendSelect legends={legends} theme={theme} value={selectedLegendId} onChange={onSelect} disabled={Boolean(pending)} /><AppButton variant="primary" className="contest-mutation-button" disabled={!selectedLegendId || Boolean(pending)} aria-busy={loading} onClick={onOpen}>{loading ? 'Ouverture…' : 'Ouvrir un nouveau lobby'}</AppButton></div>}</section><ParticipantGrid contest={contest} /></>
}

function LegendSelect({ legends, theme, value, onChange, disabled = false }: { legends: readonly ContestLegendDto[]; theme: ContestDto['theme']; value: string; onChange: (id: string) => void; disabled?: boolean }) {
  return <label className="contest-legend-select"><span>Légende participante</span><select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled || legends.length === 0}><option value="">Choisir une Légende</option>{legends.map((legend) => <option key={legend.character.id} value={legend.character.id}>{legend.character.name} — {legend.stats[theme.statKey]}/20</option>)}</select></label>
}

function Countdown({ label, deadline, now }: { label: string; deadline: string | null; now: number }) {
  const remaining = deadline ? Math.max(0, Math.ceil((Date.parse(deadline) - now) / 1_000)) : 0
  return <div className="contest-countdown"><span>{label}</span><strong>{Math.floor(remaining / 60).toString().padStart(2, '0')}:{(remaining % 60).toString().padStart(2, '0')}</strong></div>
}

type ContestPermissions = ContestDto['permissions']
type ConfirmationKind = 'start' | 'leave' | 'cancel' | 'remove-spectator'

function contestConfirmationContext(contest: ContestSnapshotDto, permissions: ContestPermissions, kind: ConfirmationKind, playerId?: string) {
  return JSON.stringify({
    contestId: contest.id,
    status: contest.status,
    phase: contest.phase,
    round: contest.currentRound,
    turn: contest.currentTurnOrder,
    deadline: kind === 'start' ? contest.lobbyDeadlineAt : contest.phase === 'SUPPORT' ? contest.supportDeadlineAt : contest.turnDeadlineAt,
    viewer: contest.viewer,
    permissions,
    target: playerId ? contest.spectators.some((spectator) => spectator.playerId === playerId) : null,
    playerId: playerId ?? null,
  })
}

function confirmationAllowed(confirmation: { kind: Exclude<ConfirmationKind, 'start'>; playerId?: string }, contest: ContestSnapshotDto, permissions: ContestPermissions, now: number) {
  if (contest.status !== 'RUNNING' || deadlineElapsed(contest.phase === 'SUPPORT' ? contest.supportDeadlineAt : contest.turnDeadlineAt, now)) return false
  if (confirmation.kind === 'leave') return permissions.canLeave && contest.viewer.participantSlot !== null
  if (confirmation.kind === 'cancel') return permissions.canCancel
  return contest.viewer.organizer && Boolean(confirmation.playerId) && contest.spectators.some(({ playerId }) => playerId === confirmation.playerId)
}

function deadlineElapsed(deadline: string | null, now: number) {
  return Boolean(deadline && Date.parse(deadline) <= now)
}

type LegendSort = 'name' | 'power' | 'theme' | 'contests' | 'wins'
const legendThemeLabels: Record<keyof ContestLegendDto['themes'], string> = { STRENGTH: 'Force', INTELLIGENCE: 'Intelligence', BEAUTY: 'Beauté', CHARISMA: 'Charisme', POPULARITY: 'Popularité' }
const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true })

function LegendsModal({ legends, theme, onClose }: { legends: readonly ContestLegendDto[]; theme: ContestDto['theme']; onClose: () => void }) {
  const dialogRef = useModalDialog<HTMLElement>(onClose)
  const [search, setSearch] = useState('')
  const [element, setElement] = useState<'all' | ElementKey>('all')
  const [sort, setSort] = useState<LegendSort>('name')
  const [descending, setDescending] = useState(false)
  const [page, setPage] = useState(1)
  const normalizedSearch = normalizeSearch(search)
  const filtered = useMemo(() => legends.filter((legend) => (element === 'all' || legend.character.elementKey === element) && normalizeSearch(legend.character.name).includes(normalizedSearch)), [element, legends, normalizedSearch])
  const ordered = useMemo(() => filtered.map((legend, index) => ({ legend, index })).sort((left, right) => {
    let comparison = 0
    if (sort === 'name') comparison = collator.compare(left.legend.character.name, right.legend.character.name)
    if (sort === 'power') comparison = totalPower(left.legend) - totalPower(right.legend)
    if (sort === 'theme') comparison = left.legend.stats[theme.statKey] - right.legend.stats[theme.statKey]
    if (sort === 'contests') comparison = compareBigInt(left.legend.totals.contests, right.legend.totals.contests)
    if (sort === 'wins') comparison = compareBigInt(left.legend.totals.wins, right.legend.totals.wins)
    if (comparison !== 0) return descending ? -comparison : comparison
    return collator.compare(left.legend.character.name, right.legend.character.name) || left.index - right.index
  }).map(({ legend }) => legend), [descending, filtered, sort, theme.statKey])
  const pageCount = Math.max(1, Math.ceil(ordered.length / 3))
  const currentPage = Math.min(page, pageCount)
  const entries = ordered.slice((currentPage - 1) * 3, currentPage * 3)
  return <div className="history-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section ref={dialogRef} tabIndex={-1} className="panel history-modal contest-legends-modal" role="dialog" aria-modal="true" aria-label="Mes Légendes" aria-labelledby="contest-legends-title"><header><div><span className="eyebrow">Concours</span><h2 id="contest-legends-title">Mes Légendes</h2></div><ModalCloseButton onClose={onClose} /></header><div className="contest-legends-controls"><label><span>Rechercher</span><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Nom" /></label><label><span>Élément</span><select value={element} onChange={(event) => { setElement(event.target.value as 'all' | ElementKey); setPage(1) }}><option value="all">Tous</option>{(Object.keys(elementLabels) as ElementKey[]).map((key) => <option value={key} key={key}>{elementLabels[key]}</option>)}</select></label><label><span>Tri</span><select value={sort} onChange={(event) => { setSort(event.target.value as LegendSort); setPage(1) }}><option value="name">Nom</option><option value="power">Puissance totale</option><option value="theme">Statistique du thème</option><option value="contests">Participations</option><option value="wins">Victoires</option></select></label><AppButton className="contest-sort-direction" aria-label={descending ? 'Tri descendant' : 'Tri ascendant'} onClick={() => { setDescending((value) => !value); setPage(1) }}>{descending ? '↓' : '↑'}</AppButton></div><div className="history-modal-body contest-legends-list">{Array.from({ length: 3 }, (_, index) => { const legend = entries[index]; return legend ? <LegendCard legend={legend} key={legend.character.id} /> : <div className="contest-legend-placeholder" aria-hidden="true" key={`empty-${index}`} /> })}{ordered.length === 0 && <p className="contest-modal-empty">Aucune Légende ne correspond à ces filtres.</p>}</div><footer className="history-modal-pagination"><AppButton disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Précédent</AppButton><span>Page {currentPage} / {pageCount} · {ordered.length} Légende{ordered.length > 1 ? 's' : ''}</span><AppButton disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>Suivant</AppButton></footer></section></div>
}

function LegendCard({ legend }: { legend: ContestLegendDto }) {
  return <article><h3>{legend.character.name}</h3><div className="contest-five-stats"><span>Force <strong>{legend.stats.strength}/20</strong></span><span>Intelligence <strong>{legend.stats.intelligence}/20</strong></span><span>Beauté <strong>{legend.stats.beauty}/20</strong></span><span>Charisme <strong>{legend.stats.charisma}/20</strong></span><span>Popularité <strong>{legend.stats.popularity}/20</strong></span></div><p className="contest-legend-totals">{legend.totals.contests} participations · {legend.totals.wins} victoires</p><div className="contest-title-list">{(Object.entries(legend.themes) as [keyof ContestLegendDto['themes'], ContestLegendDto['themes'][keyof ContestLegendDto['themes']]][]).map(([key, value]) => <span key={key}><b>{legendThemeLabels[key]}</b>{value.title ?? 'Aucun titre'} · {value.participations} / {value.wins}</span>)}</div></article>
}

function HistoryModal({ history, error, onPage, onLoadDetail, onClose }: { history: ContestHistoryDto | null; error: string | null; onPage: (page: number) => Promise<void>; onLoadDetail: (contestId: string) => Promise<ContestSnapshotDto>; onClose: () => void }) {
  const dialogRef = useModalDialog<HTMLElement>(onClose)
  const [detail, setDetail] = useState<ContestSnapshotDto | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detailPending, setDetailPending] = useState(false)
  const loadDetail = async (contestId: string) => { setDetailPending(true); setDetailError(null); try { setDetail(await onLoadDetail(contestId)) } catch (reason) { setDetailError(apiErrorMessage(reason)) } finally { setDetailPending(false) } }
  const changePage = async (nextPage: number) => { setDetail(null); setDetailError(null); await onPage(nextPage) }
  return <div className="history-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section ref={dialogRef} tabIndex={-1} className="panel history-modal contest-history-modal" role="dialog" aria-modal="true" aria-label="Historique des Concours" aria-labelledby="contest-history-title"><header><div><span className="eyebrow">Concours terminés</span><h2 id="contest-history-title">{detail ? 'Détail du Concours' : 'Historique'}</h2></div><ModalCloseButton onClose={onClose} /></header>{detail ? <ContestHistoryDetail contest={detail} onBack={() => setDetail(null)} /> : <><div className="history-modal-body contest-history-list">{(error || detailError) && <p className="contest-modal-status" role="alert">{error ?? detailError}</p>}{!history && !error && <p className="contest-modal-status" role="status">Chargement…</p>}{Array.from({ length: 10 }, (_, index) => { const contest = history?.contests[index]; return contest ? <article key={contest.id}><div><strong>{formatBusinessDate(contest.businessDate)} · {contest.theme.label}</strong><span>{contest.currentRound} manche{contest.currentRound > 1 ? 's' : ''} · vainqueur {contest.winner?.displayName ?? '—'}</span></div><AppButton disabled={detailPending} onClick={() => void loadDetail(contest.id)}>Détails →</AppButton></article> : <div className="contest-history-placeholder" aria-hidden="true" key={`empty-${index}`} /> })}{history?.contests.length === 0 && <p className="contest-modal-empty">Aucun Concours terminé.</p>}</div><footer className="history-modal-pagination"><AppButton disabled={!history || history.page <= 1} onClick={() => history && void changePage(history.page - 1)}>Précédent</AppButton><span>Page {history?.page ?? 1} / {history?.pageCount ?? 1}</span><AppButton disabled={!history || history.page >= history.pageCount} onClick={() => history && void changePage(history.page + 1)}>Suivant</AppButton></footer></>}</section></div>
}

function ContestHistoryDetail({ contest, onBack }: { contest: ContestSnapshotDto; onBack: () => void }) {
  const ranked = [...contest.participants].sort((left, right) => (left.finalRank ?? 99) - (right.finalRank ?? 99))
  const ordered = [...contest.participants].sort((left, right) => (left.turnOrder ?? 99) - (right.turnOrder ?? 99))
  const importantEvents = contest.historyEvents.filter((event) => event.kind !== 'TITLE_PROMOTED')
  return <><div className="history-modal-body contest-history-detail"><AppButton className="contest-history-back" onClick={onBack}>← Retour à la liste</AppButton><dl><div><dt>Date métier</dt><dd>{formatBusinessDate(contest.businessDate)}</dd></div><div><dt>Début</dt><dd>{formatContestTime(contest.startedAt)}</dd></div><div><dt>Fin</dt><dd>{formatContestTime(contest.finishedAt)}</dd></div><div><dt>Durée</dt><dd>{formatDuration(contest.startedAt, contest.finishedAt)}</dd></div><div><dt>Thème</dt><dd>{contest.theme.label}</dd></div><div><dt>Manches</dt><dd>{contest.currentRound}</dd></div></dl><section><h3>Ordre de tour</h3><p>{ordered.map((item) => `${item.turnOrder ?? '—'}. ${item.displayName}`).join(' · ')}</p></section><section><h3>Classement complet</h3><div className="contest-history-ranking">{ranked.map((item) => <article className={item.slot === contest.winnerSlot ? 'winner' : ''} key={item.slot}><strong>#{item.finalRank} {item.displayName}{item.slot === contest.winnerSlot ? ' · vainqueur' : ''}</strong><span>{item.kind === 'HUMAN' ? `Humain · ${item.characterName ?? 'Légende inconnue'}` : 'Bot'}</span><span>{item.score} points · {formatResourceAmount(item.rewardPrimogems ?? '0')} Primos</span>{item.replaced && <span>Remplacé par l’IA · {replacementReason(item.replacementReason)}</span>}</article>)}</div></section>{contest.promotions.length > 0 && <section><h3>Promotions de titre</h3><div className="contest-promotions">{contest.promotions.map((promotion) => <strong key={`${promotion.playerId}:${promotion.slot}`}>✨ {promotion.characterName ?? 'Légende'} devient {promotion.title} !</strong>)}</div></section>}<section><h3>Moments importants</h3>{importantEvents.length ? <ul>{importantEvents.map((event, index) => <li key={`${event.kind}:${event.occurredAt}:${index}`}>{historyEventLabel(event)}</li>)}</ul> : <p>Aucun départ, remplacement ou soutien à signaler.</p>}</section></div><footer className="history-modal-pagination"><AppButton onClick={onBack}>Retour</AppButton><span>Résultat terminé</span><span /></footer></>
}

function totalPower(legend: ContestLegendDto) { return Object.values(legend.stats).reduce((total, value) => total + value, 0) }
function compareBigInt(left: string, right: string) { const a = BigInt(left); const b = BigInt(right); return a < b ? -1 : a > b ? 1 : 0 }
function normalizeSearch(value: string) { return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('fr') }
function historyEventLabel(event: ContestSnapshotDto['historyEvents'][number]) {
  if (event.kind === 'PARTICIPANT_LEFT') return `${event.playerName ?? 'Un participant'} a quitté le Concours${event.slot ? ` (slot ${event.slot})` : ''}.`
  if (event.kind === 'PARTICIPANT_REPLACED') return `${event.playerName ?? 'Un participant'}${event.characterName ? ` · ${event.characterName}` : ''} a été remplacé par ${event.botName ?? 'un Bot'} pour ${replacementReason(event.reason)}${event.score !== null ? ` · score conservé : ${event.score}` : ''}.`
  if (event.kind === 'SPECTATOR_REMOVED') return `${event.playerName ?? 'Un spectateur'} a été retiré du rôle de spectateur${event.selectedForSupport ? ' pendant sa fenêtre de soutien' : ''}.`
  if (event.kind === 'SUPPORT_SELECTED') return `${event.playerName ?? 'Un spectateur'} a été sélectionné pour le soutien${event.round ? ` à la manche ${event.round}` : ''}.`
  if (event.kind === 'SUPPORT_PLAYED') return `${event.playerName ?? 'Un spectateur'} a soutenu ${event.targetName ?? `le slot ${event.slot ?? '—'}`} de ${event.points ?? 0} point${event.points === 1 ? '' : 's'}.`
  if (event.kind === 'SUPPORT_SKIPPED') return `Le soutien${event.round ? ` de la manche ${event.round}` : ''} n’a pas été joué.`
  return `${event.characterName ?? 'Une Légende'} devient ${event.title}.`
}
function rankLabel(rank: number) { return rank === 1 ? '1er' : `${rank}e` }
function replacementReason(reason: ContestSnapshotDto['participants'][number]['replacementReason'] | string | null | undefined) {
  if (reason === 'LEFT') return 'départ volontaire'
  if (reason === 'INACTIVE') return 'inactivité'
  if (reason === 'ADMIN_REMOVAL') return 'retrait administratif'
  return 'remplacement'
}
function formatBusinessDate(value: string) { return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'Europe/Paris' }).format(new Date(`${value}T12:00:00Z`)) }
function formatContestTime(value: string | null) { return value ? new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Paris' }).format(new Date(value)) : '—' }
function formatDuration(startedAt: string | null, finishedAt: string | null) {
  if (!startedAt || !finishedAt) return '—'
  const seconds = Math.max(0, Math.round((Date.parse(finishedAt) - Date.parse(startedAt)) / 1_000))
  return `${Math.floor(seconds / 60)} min ${seconds % 60} s`
}
