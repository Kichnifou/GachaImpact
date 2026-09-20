import { useCallback, useEffect, useRef, useState } from 'react'
import type { FriendAction, FriendsSnapshot, FriendSort, SocialActions } from './types'
import { apiErrorMessage } from '../utils/formatters'

/** Shared by Social and Quotidiennes; old polls cannot replace a mutation result. */
export function useFriendships(actions?: SocialActions, active = false) {
  const [value, setValue] = useState<FriendsSnapshot | null>(null)
  const [error, setError] = useState(''), [feedback, setFeedback] = useState(''), [feedbackScope, setFeedbackScope] = useState(''), [pending, setPending] = useState(false), [refreshingState, setRefreshingState] = useState(false)
  const alive = useRef(false), busy = useRef(false), refreshing = useRef<Promise<void> | null>(null), authoritativeDrain = useRef<Promise<void> | null>(null), authoritativeRequested = useRef(0), authoritativeCompleted = useRef(0), revision = useRef(0), intent = useRef<{ signature: string; key: string } | null>(null)
  const clearFeedback = useCallback(() => { setFeedback(''); setFeedbackScope('') }, [])
  const showFeedback = useCallback((scope: string, message: string) => {
    setFeedbackScope(scope); setFeedback(message)
  }, [])
  const refresh = useCallback((authoritative = false) => {
    if (!actions) return Promise.resolve()
    const start = () => {
      if (refreshing.current) return refreshing.current
      const version = ++revision.current
      if (alive.current) setRefreshingState(true)
      const request = (async () => {
        try { const next = await actions.friends(); if (alive.current && version === revision.current) { setValue(next); setError('') } }
        catch (reason) { if (alive.current && version === revision.current) setError(apiErrorMessage(reason)) }
      })()
      refreshing.current = request
      void request.finally(() => { if (refreshing.current === request) { refreshing.current = null; if (alive.current) setRefreshingState(false) } })
      return request
    }
    if (!authoritative) return start()
    authoritativeRequested.current++
    if (authoritativeDrain.current) return authoritativeDrain.current
    const request = (async () => {
      while (authoritativeCompleted.current < authoritativeRequested.current) {
        const requested = authoritativeRequested.current
        const current = refreshing.current
        if (current) await current
        await start()
        authoritativeCompleted.current = requested
      }
    })()
    authoritativeDrain.current = request
    void request.finally(() => { if (authoritativeDrain.current === request) authoritativeDrain.current = null })
    return request
  }, [actions])
  useEffect(() => {
    // GameShell is keyed by Player: a different account starts with fresh state.
    alive.current = true; revision.current++; intent.current = null
    let timer: number | undefined, stopped = false
    const poll = async () => { if (document.visibilityState !== 'hidden' && !busy.current) await refresh(); if (!stopped) timer = window.setTimeout(() => void poll(), active ? 5_000 : 30_000) }
    const refreshVisible = () => { if (active && document.visibilityState !== 'hidden') void refresh() }
    window.addEventListener('focus', refreshVisible)
    document.addEventListener('visibilitychange', refreshVisible)
    void poll()
    return () => { stopped = true; alive.current = false; window.removeEventListener('focus', refreshVisible); document.removeEventListener('visibilitychange', refreshVisible); window.clearTimeout(timer) }
  }, [active, refresh])
  const mutate = async (target: string, action: FriendAction | 'HEART', requestId?: string, scope = 'friends') => {
    if (!actions || busy.current) return
    busy.current = true; revision.current++; setPending(true); setError(''); clearFeedback()
    const signature = `${action}:${target}:${requestId ?? ''}`
    if (intent.current?.signature !== signature) intent.current = { signature, key: crypto.randomUUID() }
    try {
      if (action === 'HEART') {
        const result = await actions.sendHearts(target, intent.current.key)
        if (alive.current) showFeedback(scope, result.sent ? target === 'all' ? `${result.sent} cœur(s) envoyé(s) · +${result.senderReward} Primos pour vous, +5 par destinataire.${result.alreadySent ? ` ${result.alreadySent} déjà envoyé(s).` : ''}` : `${result.message ?? 'Cœur envoyé.'} +5 Primos pour vous, +5 par destinataire.` : result.status === 'NO_FRIENDS' ? 'Aucun ami actif.' : result.status === 'ALL_SENT' ? 'Tous les cœurs ont déjà été envoyés aujourd’hui.' : 'Envoi indisponible pour le moment.')
      } else {
        const result = await actions.friendAction(target, action, intent.current.key, requestId)
        if (alive.current) showFeedback(scope, result.state === 'PENDING' ? 'Demande envoyée.' : result.state === 'ACCEPTED' || result.state === 'ACTIVE' ? 'Vous êtes amis.' : result.state === 'ARCHIVED' ? 'Ami retiré.' : result.state === 'REFUSED' ? 'Demande refusée.' : 'Demande annulée.')
      }
      intent.current = null
      await refresh(true)
    } catch (reason) { if (alive.current) setError(apiErrorMessage(reason)) }
    finally { busy.current = false; if (alive.current) setPending(false) }
  }
  const saveSort = async (sort: FriendSort) => {
    if (!actions || busy.current) return
    busy.current = true; setPending(true); clearFeedback()
    try { await actions.saveFriendSort(sort); await refresh(true) }
    catch (reason) { if (alive.current) setError(apiErrorMessage(reason)) }
    finally { busy.current = false; if (alive.current) setPending(false) }
  }
  return { value, error, feedback, feedbackScope, pending, refreshing: refreshingState, refresh, mutate, saveSort, clearFeedback }
}
export type FriendshipController = ReturnType<typeof useFriendships>
