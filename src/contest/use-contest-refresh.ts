import { useEffect, useState } from 'react'
import { ApiError } from '../api/game-api'

// Mounted only by the visible Contest surface (loaded or initial recovery).
export function useContestRefresh(refresh: (() => Promise<unknown>) | undefined, activeContestId?: string) {
  const [syncError, setSyncError] = useState<string | null>(null)
  useEffect(() => {
    if (!refresh) return
    let mounted = true
    let authenticationFailed = false
    let pollTimer: number | null = null
    let inFlight: Promise<void> | null = null
    let failures = 0
    const clearPoll = () => { if (pollTimer !== null) window.clearTimeout(pollTimer); pollTimer = null }
    const schedule = (delay: number) => {
      clearPoll()
      if (mounted && document.visibilityState !== 'hidden') pollTimer = window.setTimeout(() => { void revalidate() }, delay)
    }
    const revalidate = () => {
      if (!mounted || authenticationFailed || document.visibilityState === 'hidden') return Promise.resolve()
      if (inFlight) return inFlight
      const request = refresh().then(() => {
        if (!mounted) return
        failures = 0
        setSyncError(null)
      }).catch((reason: unknown) => {
        if (!mounted) return
        if (reason instanceof ApiError && (reason.status === 401 || reason.status === 403)) {
          authenticationFailed = true
          setSyncError(reason.status === 401 ? 'Session expirée. Reconnectez-vous.' : 'Accès au Concours refusé.')
          return
        }
        failures = Math.min(failures + 1, 4)
        setSyncError(reason instanceof ApiError && reason.status !== null ? 'Le serveur du Concours ne répond pas correctement. Reprise automatique.' : 'La connexion au Concours est interrompue. Reprise automatique.')
      }).finally(() => {
        if (inFlight === request) inFlight = null
        if (mounted && !authenticationFailed) schedule(Math.min(15_000, (activeContestId ? 2_000 : 3_000) * 2 ** failures))
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
    window.addEventListener('online', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)
    void revalidate()
    return () => {
      mounted = false
      clearPoll()
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('online', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [activeContestId, refresh])

  return syncError
}
