import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, getGameApiClient } from '../api/game-api'
import { isAmbiguousMutationError } from '../api/mutation-errors'
import { apiErrorMessage } from '../utils/formatters'
import type { ArcadeAction, ArcadeGame, ArcadeMutation, ArcadeOverview, ArcadeSession, ArcadeStart, ArcadeInvite, ArcadeInviteAction, ArcadeParticipant } from '../api/arcade-types'

type Intent = { kind: 'START'; input: ArcadeStart } | { kind: 'ACTION'; sessionId: string; input: ArcadeAction }
  | { kind: 'INVITE'; input: ArcadeInvite } | { kind: 'INVITATION_ACTION'; invitationId: string; input: ArcadeInviteAction }
export function mergeArcadeSession(sessions: ArcadeSession[], incoming: ArcadeSession) {
  const old = sessions.find(row => row.game === incoming.game)
  if (old && (old.id === incoming.id ? old.version > incoming.version : old.createdAt > incoming.createdAt || old.createdAt === incoming.createdAt && old.id > incoming.id)) return sessions
  return [...sessions.filter(row => row.game !== incoming.game), incoming]
}
export function useArcade(playerId: string, onMutation?: (value: ArcadeMutation, playerId: string) => void) {
  const [value, setValue] = useState<ArcadeOverview | null>(null)
  const [opponents, setOpponents] = useState<ArcadeParticipant[]>([])
  const [friendsOnly, setFriendsOnly] = useState(false)
  const [error, setError] = useState(''), [feedback, setFeedback] = useState('')
  const [opponentsRefreshing, setOpponentsRefreshing] = useState(false), [opponentsError, setOpponentsError] = useState('')
  const opponentsFlight = useRef<Promise<void> | null>(null), opponentsSequence = useRef(0), opponentsFailures = useRef(0)
  const pollWake = useRef<() => void>(() => undefined)
  const [pending, setPending] = useState(false), [refreshing, setRefreshing] = useState(false), [quitting, setQuitting] = useState(false)
  const inFlight = useRef<Promise<boolean> | null>(null), readFlight = useRef<Promise<ArcadeOverview | null> | null>(null), quitLock = useRef(false)
  const live = useRef(true), sequence = useRef(0), owner = useRef(0), failures = useRef(0)
  const snapshot = useRef(value), friendsFilter = useRef(friendsOnly), publishRef = useRef(onMutation)
  useEffect(() => { snapshot.current = value; friendsFilter.current = friendsOnly; publishRef.current = onMutation }, [value, friendsOnly, onMutation])
  const readOpponents = useCallback((): Promise<void> => {
    const idle = () => snapshot.current && !snapshot.current.invitation && !snapshot.current.sessions.some(row => row.status === 'ACTIVE')
    if (!live.current || document.visibilityState === 'hidden' || !idle()) return Promise.resolve()
    if (opponentsFlight.current) return opponentsFlight.current
    const generation = owner.current, token = opponentsSequence.current, filter = friendsFilter.current
    setOpponentsRefreshing(true)
    const request = (async () => {
      try {
        const next = await getGameApiClient().getArcadeOpponents(filter)
        if (live.current && generation === owner.current && token === opponentsSequence.current && filter === friendsFilter.current && idle()) {
          setOpponents(next.opponents); setOpponentsError(''); opponentsFailures.current = 0
        }
      } catch (reason) {
        if (live.current && generation === owner.current && token === opponentsSequence.current && idle()) {
          setOpponentsError(apiErrorMessage(reason)); opponentsFailures.current++
        }
      } finally { if (live.current && generation === owner.current) setOpponentsRefreshing(false) }
    })().finally(() => { if (opponentsFlight.current === request) opponentsFlight.current = null })
    opponentsFlight.current = request
    return request
  }, [])
  const read = useCallback((fresh = false): Promise<ArcadeOverview | null> => {
    if (!live.current) return Promise.resolve(null)
    if (readFlight.current) {
      const generation = owner.current
      return fresh ? readFlight.current.then(() => live.current && generation === owner.current ? read() : null) : readFlight.current
    }
    const token = ++sequence.current, generation = owner.current
    if (!snapshot.current) setRefreshing(true)
    const request = (async () => {
      try {
        const api = getGameApiClient(), next = await api.getArcade()
        if (live.current && generation === owner.current && token === sequence.current) {
          failures.current = 0
          snapshot.current = next; setValue(next); setError('')
          if (next.invitation || next.sessions.some(row => row.status === 'ACTIVE')) setOpponents([])

          return next
        }
      } catch (reason) {
        if (live.current && generation === owner.current && token === sequence.current) failures.current++
        if (live.current && generation === owner.current && token === sequence.current) setError(apiErrorMessage(reason))
      } finally { if (live.current && generation === owner.current && token === sequence.current) setRefreshing(false) }
      return null
    })().finally(() => { if (readFlight.current === request) readFlight.current = null })
    readFlight.current = request
    return request
  }, [])
  const load = useCallback(() => inFlight.current || quitLock.current || document.visibilityState === 'hidden' ? Promise.resolve(null) : read(), [read])
  useEffect(() => {
    live.current = true; owner.current++; snapshot.current = null; readFlight.current = null; opponentsFlight.current = null; inFlight.current = null
    failures.current = 0; opponentsFailures.current = 0; quitLock.current = false
    setValue(null); setOpponents([]); setPending(false); setQuitting(false); setOpponentsError(''); setFeedback(''); setError('')
    let timer: number | undefined, opponentTimer: number | undefined, stopped = false
    const schedule = () => {
      window.clearTimeout(timer)
      if (stopped || document.visibilityState === 'hidden') return
      const active = snapshot.current?.sessions.find(row => row.status === 'ACTIVE')
      if (active && active.mode !== 'MULTIPLAYER') return
      const nominal = active ? 600 : snapshot.current?.invitation ? 900 : 2500
      timer = window.setTimeout(tick, Math.min(16000, nominal * 2 ** Math.min(failures.current, 5)))
    }
    const tick = async () => { await load(); schedule() }
    const opponentsTick = async () => {
      await readOpponents()
      window.clearTimeout(opponentTimer)
      if (!stopped && document.visibilityState !== 'hidden') opponentTimer = window.setTimeout(opponentsTick, Math.min(16000, 2500 * 2 ** Math.min(opponentsFailures.current, 3)))
    }
    pollWake.current = schedule
    void tick().then(() => { if (!stopped) void opponentsTick() })
    const focus = () => {
      window.clearTimeout(timer); window.clearTimeout(opponentTimer)
      if (document.visibilityState !== 'hidden') { void tick(); void opponentsTick() }
    }
    window.addEventListener('focus', focus); document.addEventListener('visibilitychange', focus); window.addEventListener('arcade:refresh', focus)
    return () => { stopped = true; live.current = false; sequence.current++; opponentsSequence.current++; owner.current++; window.clearTimeout(timer); window.clearTimeout(opponentTimer); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', focus); window.removeEventListener('arcade:refresh', focus) }
  }, [load, readOpponents, playerId])
  useEffect(() => {
    friendsFilter.current = friendsOnly; opponentsSequence.current++; setOpponents([])
    const waiting = opponentsFlight.current
    const generation = owner.current
    if (waiting) void waiting.then(() => { if (live.current && generation === owner.current) void readOpponents() })
    else void readOpponents()
  }, [friendsOnly, readOpponents])
  const execute = useCallback((intent: Intent, fromQuit = false): Promise<boolean> => {
    if (inFlight.current || quitLock.current && !fromQuit) return Promise.resolve(false)
    const generation = owner.current
    ++sequence.current; ++opponentsSequence.current; setRefreshing(false); setPending(true); setError(''); setFeedback('')
    const request = async () => {
      const api = getGameApiClient()
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          if (intent.kind === 'INVITE' || intent.kind === 'INVITATION_ACTION') {
            const next = intent.kind === 'INVITE' ? await api.inviteArcade(intent.input) : await api.actArcadeInvitation(intent.invitationId, intent.input)
            if (live.current && generation === owner.current) {
              if (next.unavailable) setFeedback('Cette invitation est indisponible. Choisissez un autre adversaire.')
              const previous = snapshot.current
              if (previous) {
                const invitation = next.invitation.status === 'PENDING' ? next.invitation : null
                const sessions = next.session ? mergeArcadeSession(previous.sessions, next.session) : previous.sessions
                const updated = { ...previous, invitation, sessions }
                snapshot.current = updated; setValue(updated)
                if (invitation || next.session) setOpponents([])
              }
              void read(true).then(() => { if (live.current && generation === owner.current) void readOpponents() })
            }
          } else {
            const next = intent.kind === 'START' ? await api.startArcade(intent.input) : await api.actArcade(intent.sessionId, intent.input)
            // A durable receipt alone publishes XP, including after screen navigation.
            publishRef.current?.(next, playerId)
            if (live.current && generation === owner.current) setValue(previous => {
              const sessions = mergeArcadeSession(previous?.sessions ?? [], next.session)
              const result = previous && (next.alreadyProcessed || sessions === previous.sessions) ? { ...previous, sessions } : { ...next, invitation: null, serverNow: new Date().toISOString(), sessions }
              snapshot.current = result; return result
            })
            if (next.alreadyProcessed && live.current && generation === owner.current) void read(true)
          }
          return true
        } catch (reason) {
          const ambiguous = isAmbiguousMutationError(reason)
          if (ambiguous && attempt === 0) continue
          if (!live.current || generation !== owner.current) return false
          if (ambiguous || reason instanceof ApiError && reason.status === 409) {
            const latest = await read(true)
            if (latest) {
              const advanced = intent.kind === 'START' ? latest.sessions.some(row => row.game === intent.input.game && row.id !== intent.input.previousSessionId)
                : intent.kind === 'ACTION' ? latest.sessions.some(row => row.id === intent.sessionId && row.version > intent.input.expectedVersion)
                : intent.kind === 'INVITATION_ACTION' ? latest.invitation?.id !== intent.invitationId
                : Boolean(latest.invitation || latest.sessions.some(row => row.status === 'ACTIVE'))
              if (advanced) return true
            }
          }
          if (intent.kind === 'INVITE') { setFeedback(apiErrorMessage(reason)); return false }
          setError(apiErrorMessage(reason)); return false
        }
      }
      return false
    }
    const pendingRequest = request().finally(() => {
      if (inFlight.current === pendingRequest) inFlight.current = null
      if (live.current && generation === owner.current) { setPending(false); pollWake.current() }
    })
    inFlight.current = pendingRequest
    return pendingRequest
  }, [read, readOpponents, playerId])
  const start = (game: ArcadeGame, difficulty: ArcadeStart['difficulty']) => execute({ kind: 'START', input: { game, difficulty, previousSessionId: value?.sessions.find(row => row.game === game)?.id ?? null, expectedVersion: 0, idempotencyKey: crypto.randomUUID() } })
  const invite = (input: Omit<ArcadeInvite, 'idempotencyKey' | 'friendsOnly'>) => execute({ kind: 'INVITE', input: { ...input, friendsOnly, idempotencyKey: crypto.randomUUID() } })
  const actInvitation = (invitationId: string, kind: ArcadeInviteAction['kind']) => execute({ kind: 'INVITATION_ACTION', invitationId, input: { kind, idempotencyKey: crypto.randomUUID() } })
  const act = useCallback((session: ArcadeSession, position?: number) => execute({ kind: 'ACTION', sessionId: session.id,
    input: position === undefined ? { kind: 'ADVANCE', expectedVersion: session.version, idempotencyKey: crypto.randomUUID() }
      : { kind: 'MOVE', position, expectedVersion: session.version, idempotencyKey: crypto.randomUUID() } }), [execute])
  const quit = async (sessionId: string) => {
    if (quitLock.current) return false
    quitLock.current = true; setQuitting(true)
    try {
      await inFlight.current
      if (!live.current) return false
      const latest = await read(true)
      if (!latest) return false
      const current = latest.sessions.find(row => row.id === sessionId)
      if (!current || current.status !== 'ACTIVE') return true
      return await execute({ kind: 'ACTION', sessionId, input: { kind: 'QUIT', expectedVersion: current.version, idempotencyKey: crypto.randomUUID() } }, true)
    } finally { quitLock.current = false; if (live.current) setQuitting(false) }
  }
  return { value, opponents, opponentsRefreshing, opponentsError, friendsOnly, setFriendsOnly, feedback, pending, refreshing, quitting, error, load, start, invite, actInvitation, act, quit }
}
