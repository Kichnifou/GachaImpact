import { useCallback, useEffect, useRef, useState } from 'react'
import type { FriendAction, FriendsSnapshot, FriendSort, SocialActions } from './types'
import { apiErrorMessage } from '../utils/formatters'

/** Shared by Social and Quotidiennes; old polls cannot replace a mutation result. */
export function useFriendships(actions?: SocialActions) {
  const [value, setValue] = useState<FriendsSnapshot | null>(null)
  const [error, setError] = useState(''), [feedback, setFeedback] = useState(''), [feedbackScope, setFeedbackScope] = useState(''), [pending, setPending] = useState(false)
  const alive = useRef(false), busy = useRef(false), revision = useRef(0), intent = useRef<{ signature: string; key: string } | null>(null), feedbackTimer = useRef<number | undefined>(undefined)
  const clearFeedback = useCallback(() => { window.clearTimeout(feedbackTimer.current); setFeedback(''); setFeedbackScope('') }, [])
  const showFeedback = useCallback((scope: string, message: string) => {
    window.clearTimeout(feedbackTimer.current); setFeedbackScope(scope); setFeedback(message)
    feedbackTimer.current = window.setTimeout(() => { if (alive.current) { setFeedback(''); setFeedbackScope('') } }, 4_000)
  }, [])
  const refresh = useCallback(async () => {
    if (!actions) return
    const version = ++revision.current
    try { const next = await actions.friends(); if (alive.current && version === revision.current) { setValue(next); setError('') } }
    catch (reason) { if (alive.current && version === revision.current) setError(apiErrorMessage(reason)) }
  }, [actions])
  useEffect(() => {
    // GameShell is keyed by Player: a different account starts with fresh state.
    alive.current = true; revision.current++; intent.current = null
    let timer: number | undefined, stopped = false
    const poll = async () => { if (document.visibilityState !== 'hidden' && !busy.current) await refresh(); if (!stopped) timer = window.setTimeout(() => void poll(), 30_000) }
    void poll()
    return () => { stopped = true; alive.current = false; window.clearTimeout(timer); window.clearTimeout(feedbackTimer.current) }
  }, [refresh])
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
      await refresh()
    } catch (reason) { if (alive.current) setError(apiErrorMessage(reason)) }
    finally { busy.current = false; if (alive.current) setPending(false) }
  }
  const saveSort = async (sort: FriendSort) => {
    if (!actions || busy.current) return
    busy.current = true; setPending(true); clearFeedback()
    try { await actions.saveFriendSort(sort); await refresh() }
    catch (reason) { if (alive.current) setError(apiErrorMessage(reason)) }
    finally { busy.current = false; if (alive.current) setPending(false) }
  }
  return { value, error, feedback, feedbackScope, pending, refresh, mutate, saveSort, clearFeedback }
}
export type FriendshipController = ReturnType<typeof useFriendships>
