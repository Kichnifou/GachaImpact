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
  const [retry, setRetry] = useState<Intent | null>(null)
  const lock = useRef(false), live = useRef(true), sequence = useRef(0)
  const publishRef = useRef(onMutation)
  useEffect(() => { publishRef.current = onMutation }, [onMutation])
  const load = useCallback(async () => {
    if (lock.current) return
    const token = ++sequence.current
    try { const next = await getGameApiClient().getArcade(); if (live.current && token === sequence.current) { setValue(next); setError('') } }
    catch (reason) { if (live.current && token === sequence.current) setError(apiErrorMessage(reason)) }
  }, [])
  useEffect(() => {
    live.current = true; void load()
    const focus = () => { if (document.visibilityState !== 'hidden') void load() }
    window.addEventListener('focus', focus); document.addEventListener('visibilitychange', focus)
    return () => { live.current = false; sequence.current++; window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', focus) }
  }, [load, playerId])
  const execute = useCallback(async (intent: Intent) => {
    if (lock.current) return false
    lock.current = true; ++sequence.current; setPending(true); setError(''); setRetry(intent)
    try {
      const api = getGameApiClient()
      const next = intent.kind === 'START' ? await api.startArcade(intent.input) : await api.actArcade(intent.sessionId, intent.input)
      // Global progression still publishes if the player navigated away during the request.
      publishRef.current?.(next, playerId)
      if (live.current) {
        setValue(previous => {
          const sessions = mergeArcadeSession(previous?.sessions ?? [], next.session)
          if (previous && (next.alreadyProcessed || sessions === previous.sessions)) return { ...previous, sessions }
          return { ...next, serverNow: new Date().toISOString(), sessions }
        })
        setRetry(null)
      }
      if (next.alreadyProcessed && live.current) { lock.current = false; await load() }
      return true
    } catch (reason) {
      if (live.current) {
        setError(apiErrorMessage(reason))
        if (!isAmbiguousMutationError(reason)) setRetry(null)
        if (reason instanceof ApiError && reason.status === 409) { lock.current = false; await load() }
      }
      return false
    } finally { lock.current = false; if (live.current) setPending(false) }
  }, [load, playerId])
  const start = (game: ArcadeGame, difficulty: ArcadeStart['difficulty']) => execute({ kind: 'START', input: { game, difficulty, previousSessionId: value?.sessions.find(row => row.game === game)?.id ?? null, expectedVersion: 0, idempotencyKey: crypto.randomUUID() } })
  const act = useCallback((session: ArcadeSession, position?: number) => execute({ kind: 'ACTION', sessionId: session.id,
    input: position === undefined ? { kind: 'ADVANCE', expectedVersion: session.version, idempotencyKey: crypto.randomUUID() }
      : { kind: 'MOVE', position, expectedVersion: session.version, idempotencyKey: crypto.randomUUID() } }), [execute])
  return { value, pending, error, load, start, act, retry: retry ? () => execute(retry) : null }
}
