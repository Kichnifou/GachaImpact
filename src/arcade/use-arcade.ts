import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, getGameApiClient } from '../api/game-api'
import { isAmbiguousMutationError } from '../api/mutation-errors'
import { apiErrorMessage } from '../utils/formatters'
import type { ArcadeAction, ArcadeGame, ArcadeMutation, ArcadeOverview, ArcadeSession, ArcadeStart } from '../api/arcade-types'

type Intent = { kind: 'START'; input: ArcadeStart } | { kind: 'ACTION'; sessionId: string; input: ArcadeAction }
export function mergeArcadeSession(sessions: ArcadeSession[], incoming: ArcadeSession) {
  const old = sessions.find(row => row.game === incoming.game)
  if (old && (old.id === incoming.id ? old.version > incoming.version : old.createdAt > incoming.createdAt || old.createdAt === incoming.createdAt && old.id > incoming.id)) return sessions
  return [...sessions.filter(row => row.game !== incoming.game), incoming]
}
export function useArcade(playerId: string, onMutation?: (value: ArcadeMutation, playerId: string) => void) {
  const [value, setValue] = useState<ArcadeOverview | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [quitting, setQuitting] = useState(false)
  const inFlight = useRef<Promise<boolean> | null>(null), quitLock = useRef(false)
  const live = useRef(true), sequence = useRef(0)
  const publishRef = useRef(onMutation)
  useEffect(() => { publishRef.current = onMutation }, [onMutation])
  const read = useCallback(async () => {
    const token = ++sequence.current
    setRefreshing(true)
    try {
      const next = await getGameApiClient().getArcade()
      if (live.current && token === sequence.current) { setValue(next); setError(''); return next }
    } catch (reason) { if (live.current && token === sequence.current) setError(apiErrorMessage(reason)) }
    finally { if (live.current && token === sequence.current) setRefreshing(false) }
    return null
  }, [])
  const load = useCallback(() => inFlight.current || quitLock.current ? Promise.resolve(null) : read(), [read])
  useEffect(() => {
    live.current = true; void load()
    const focus = () => { if (document.visibilityState !== 'hidden') void load() }
    window.addEventListener('focus', focus); document.addEventListener('visibilitychange', focus)
    return () => { live.current = false; sequence.current++; window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', focus) }
  }, [load, playerId])
  const execute = useCallback((intent: Intent, fromQuit = false): Promise<boolean> => {
    if (inFlight.current || quitLock.current && !fromQuit) return Promise.resolve(false)
    ++sequence.current; setRefreshing(false); setPending(true); setError('')
    const request = async () => {
      const api = getGameApiClient()
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const next = intent.kind === 'START' ? await api.startArcade(intent.input) : await api.actArcade(intent.sessionId, intent.input)
          // Only a receipt publishes rewards, including a response received after navigation.
          publishRef.current?.(next, playerId)
          if (live.current) setValue(previous => {
            const sessions = mergeArcadeSession(previous?.sessions ?? [], next.session)
            if (previous && (next.alreadyProcessed || sessions === previous.sessions)) return { ...previous, sessions }
            return { ...next, serverNow: new Date().toISOString(), sessions }
          })
          if (next.alreadyProcessed && live.current) await read()
          return true
        } catch (reason) {
          const ambiguous = isAmbiguousMutationError(reason)
          // Exactly one retry of the same object/key, never a newly generated move.
          if (ambiguous && attempt === 0) continue
          if (!live.current) return false
          if (ambiguous || reason instanceof ApiError && reason.status === 409) {
            const latest = await read()
            if (latest) {
              // A newer authoritative version supersedes this intent. A GET never awards XP.
              const advanced = intent.kind === 'START'
                ? latest.sessions.some(row => row.game === intent.input.game && row.id !== intent.input.previousSessionId)
                : latest.sessions.some(row => row.id === intent.sessionId && row.version > intent.input.expectedVersion)
              if (advanced) return true
            }
          }
          setError(apiErrorMessage(reason)); return false
        }
      }
      return false
    }
    const pendingRequest = request().finally(() => {
      if (inFlight.current === pendingRequest) inFlight.current = null
      if (live.current) setPending(false)
    })
    inFlight.current = pendingRequest
    return pendingRequest
  }, [read, playerId])
  const start = (game: ArcadeGame, difficulty: ArcadeStart['difficulty']) => execute({ kind: 'START', input: { game, difficulty, previousSessionId: value?.sessions.find(row => row.game === game)?.id ?? null, expectedVersion: 0, idempotencyKey: crypto.randomUUID() } })
  const act = useCallback((session: ArcadeSession, position?: number) => execute({ kind: 'ACTION', sessionId: session.id,
    input: position === undefined ? { kind: 'ADVANCE', expectedVersion: session.version, idempotencyKey: crypto.randomUUID() }
      : { kind: 'MOVE', position, expectedVersion: session.version, idempotencyKey: crypto.randomUUID() } }), [execute])
  const quit = async (sessionId: string) => {
    if (quitLock.current) return false
    quitLock.current = true; setQuitting(true)
    try {
      await inFlight.current
      if (!live.current) return false
      const latest = await read()
      if (!latest) return false
      const current = latest.sessions.find(row => row.id === sessionId)
      // The confirmation targets an identity, never a different game/session after refresh.
      if (!current || current.status !== 'ACTIVE') return true
      return await execute({ kind: 'ACTION', sessionId, input: { kind: 'QUIT', expectedVersion: current.version, idempotencyKey: crypto.randomUUID() } }, true)
    } finally { quitLock.current = false; if (live.current) setQuitting(false) }
  }
  return { value, pending, refreshing, quitting, error, load, start, act, quit }
}
