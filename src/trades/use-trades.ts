import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ApiError } from '../api/game-api'
import { apiErrorMessage } from '../utils/formatters'
import type { TradeActions, TradePartners, TradeSnapshot } from './types'

export function useTrades(actions: TradeActions, onSnapshot: (value: TradeSnapshot) => void, query: string, page: number) {
  const [snapshot, setSnapshot] = useState<TradeSnapshot | null>(null)
  const [partners, setPartners] = useState<TradePartners | null>(null)
  const [pending, setPending] = useState(false), [error, setError] = useState<string | null>(null), [feedback, setFeedback] = useState('')
  const alive = useRef(false), busy = useRef(false), revision = useRef(0), requested = useRef(0), completed = useRef(0)
  const flight = useRef<Promise<void> | null>(null)
  const latest = useRef({ actions, onSnapshot, query, page })
  useLayoutEffect(() => { latest.current = { actions, onSnapshot, query, page } }, [actions, onSnapshot, query, page])
  const invalidate = useCallback(() => { revision.current++ }, [])
  const intent = useRef<{ signature: string; key: string } | null>(null)
  const retryAction = useRef<{ signature: string; run: (key: string) => Promise<string> } | null>(null)
  const [canRetry, setCanRetry] = useState(false)
  const refresh = useCallback(() => {
    requested.current++
    if (flight.current) return flight.current
    const run = (async () => {
      while (alive.current && completed.current < requested.current) {
        const target = requested.current, version = revision.current, current = latest.current
        try {
          const [value, list] = await Promise.all([current.actions.snapshot(), current.actions.partners(current.query, current.page)])
          if (alive.current && version === revision.current && current.query === latest.current.query && current.page === latest.current.page) {
            setSnapshot(value); setPartners(list); current.onSnapshot(value); setError(null)
          }
        } catch (reason) { if (alive.current && version === revision.current) setError(apiErrorMessage(reason)) }
        completed.current = target
      }
    })()
    flight.current = run
    void run.finally(() => { if (flight.current === run) flight.current = null })
    return run
  }, [])
  useEffect(() => {
    alive.current = true
    let disposed = false
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => { if (document.visibilityState !== 'hidden' && !busy.current) await refresh(); if (!disposed) timer = setTimeout(() => void poll(), 3000) }
    const focus = () => { if (document.visibilityState !== 'hidden' && !busy.current) void refresh() }
    void poll(); window.addEventListener('focus', focus); document.addEventListener('visibilitychange', focus)
    return () => { disposed = true; alive.current = false; invalidate(); clearTimeout(timer); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', focus) }
  }, [refresh, invalidate])
  useEffect(() => { revision.current++; if (!busy.current) void refresh() }, [query, page, refresh])
  const mutate = async (signature: string, run: (key: string) => Promise<string>) => {
    if (busy.current) return
    // Ambiguous retries keep their exact intent; changing it requires a definite result.
    if (intent.current && intent.current.signature !== signature) { setError('Réessayez d’abord l’action précédente pour confirmer son résultat.'); return }
    busy.current = true; revision.current++; setPending(true); setError(null); setFeedback('')
    intent.current ??= { signature, key: crypto.randomUUID() }
    retryAction.current = { signature, run }; setCanRetry(false)
    try {
      await flight.current
      const message = await run(intent.current.key)
      intent.current = null
      retryAction.current = null
      if (alive.current) { setFeedback(message); await refresh() }
    } catch (reason) {
      if (reason instanceof ApiError && reason.status !== null && reason.status < 500) intent.current = null
      if (alive.current) { setError(apiErrorMessage(reason)); setCanRetry(intent.current !== null) }
    } finally { busy.current = false; if (alive.current) setPending(false) }
  }
  const retry = () => { const action = retryAction.current; if (action) void mutate(action.signature, action.run) }
  return { snapshot, partners, pending, error, feedback, mutate, refresh, canRetry, retry }
}
