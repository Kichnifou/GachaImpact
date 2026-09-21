import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ApiError } from '../api/game-api'
import { apiErrorMessage } from '../utils/formatters'
import type { TradeActions, TradePartners, TradeSnapshot } from './types'

export function useTrades(actions: TradeActions, onSnapshot: (value: TradeSnapshot) => void, query: string, page: number, partnersActive = true) {
  const [snapshot, setSnapshot] = useState<TradeSnapshot | null>(null)
  const [partners, setPartners] = useState<TradePartners | null>(null)
  const [pending, setPending] = useState(false), [error, setError] = useState<string | null>(null), [feedback, setFeedback] = useState('')
  const [syncError, setSyncError] = useState(''), [partnerRevision, setPartnerRevision] = useState(0)
  const partnerRequest = useRef<{ controller: AbortController } | null>(null)
  const partnerInput = useRef<{ query: string; page: number } | null>(null)
  const alive = useRef(false), busy = useRef(false), revision = useRef(0), requested = useRef(0), completed = useRef(0)
  const flight = useRef<Promise<void> | null>(null)
  const latest = useRef({ actions, onSnapshot, query, page, partnersActive })
  useLayoutEffect(() => { latest.current = { actions, onSnapshot, query, page, partnersActive } }, [actions, onSnapshot, query, page, partnersActive])
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
          const value = await current.actions.snapshot()
          if (alive.current && version === revision.current) {
            setSnapshot(value); current.onSnapshot(value); setSyncError('')
          }
        } catch { if (alive.current && version === revision.current) setSyncError('Actualisation indisponible. Nouvelle tentative automatique.') }
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
  useEffect(() => {
    if (!partnersActive) return
    const previousInput = partnerInput.current
    const isUserSearch = previousInput === null || previousInput.query !== query || previousInput.page !== page
    partnerInput.current = { query, page }
    const load = () => {
      // A typed search supersedes an older query. Background refreshes never interrupt it.
      if (!isUserSearch && partnerRequest.current) return
      partnerRequest.current?.controller.abort()
      const controller = new AbortController(), request = { controller }
      partnerRequest.current = request
      void latest.current.actions.partners(query, page, controller.signal)
        .then(list => { if (alive.current && !controller.signal.aborted && partnerRequest.current === request) { setPartners(list); setSyncError('') } })
        .catch(() => { if (alive.current && !controller.signal.aborted && partnerRequest.current === request) setSyncError('Recherche indisponible. Réessayez dans un instant.') })
        .finally(() => { if (partnerRequest.current === request) partnerRequest.current = null })
    }
    const timer = query ? setTimeout(load, 250) : undefined
    if (!query) load()
    return () => { clearTimeout(timer) }
  }, [query, page, partnersActive, partnerRevision])
  useEffect(() => {
    if (!partnersActive) return
    const refreshPartners = () => {
      if (document.visibilityState !== 'hidden' && !busy.current && !partnerRequest.current) setPartnerRevision(value => value + 1)
    }
    const timer = setInterval(refreshPartners, 15_000)
    window.addEventListener('focus', refreshPartners)
    document.addEventListener('visibilitychange', refreshPartners)
    return () => { clearInterval(timer); window.removeEventListener('focus', refreshPartners); document.removeEventListener('visibilitychange', refreshPartners) }
  }, [partnersActive])
  useEffect(() => {
    if (!partnersActive) partnerRequest.current?.controller.abort()
  }, [partnersActive])
  useEffect(() => () => { partnerRequest.current?.controller.abort() }, [])
  const mutate = async (signature: string, run: (key: string) => Promise<string>) => {
    if (busy.current) return
    // Ambiguous retries keep their exact intent; changing it requires a definite result.
    if (intent.current && intent.current.signature !== signature) { setError('Réessayez d’abord l’action précédente pour confirmer son résultat.'); return }
    busy.current = true; revision.current++; setPending(true); setError(null); setFeedback('')
    intent.current ??= { signature, key: crypto.randomUUID() }
    retryAction.current = { signature, run }; setCanRetry(false)
    try {
      const message = await run(intent.current.key)
      intent.current = null
      retryAction.current = null
      if (alive.current) { setFeedback(message); setPartnerRevision(value => value + 1); void refresh() }
    } catch (reason) {
      if (reason instanceof ApiError && reason.status !== null && reason.status < 500) intent.current = null
      if (alive.current) { setError(apiErrorMessage(reason)); setCanRetry(intent.current !== null) }
    } finally { busy.current = false; if (alive.current) setPending(false) }
  }
  const retry = () => { const action = retryAction.current; if (action) void mutate(action.signature, action.run) }
  const clearFeedback = useCallback(() => { setFeedback(''); setError(null) }, [])
  return { snapshot, partners, pending, error, syncError, feedback, mutate, refresh, canRetry, retry, clearFeedback }
}
