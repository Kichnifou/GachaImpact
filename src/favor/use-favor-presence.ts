import { useEffect, useMemo, useState } from 'react'
import { createFavorPresence, type FavorPresenceState } from './favor-presence'
import type { FavorPresenceDto } from '../api/types'

export function useFavorPresence(playerId: string, record: () => Promise<FavorPresenceDto>, refresh: () => Promise<unknown>) {
  const coordinator = useMemo(() => ({ owner: playerId, presence: createFavorPresence(record, refresh) }), [playerId, record, refresh])
  const [state, setState] = useState<FavorPresenceState>({ favor: null, error: false, feedbacks: [] })
  useEffect(() => {
    const unsubscribe = coordinator.presence.subscribe(setState)
    let hidden = document.visibilityState === 'hidden'
    if (!hidden) coordinator.presence.start()
    const visible = () => {
      if (document.visibilityState !== 'hidden' && hidden) { hidden = false; void coordinator.presence.wake() }
      else if (document.visibilityState === 'hidden') hidden = true
    }
    const pageHide = () => { hidden = true }
    document.addEventListener('visibilitychange', visible)
    window.addEventListener('pagehide', pageHide)
    window.addEventListener('pageshow', visible)
    return () => {
      unsubscribe()
      document.removeEventListener('visibilitychange', visible)
      window.removeEventListener('pagehide', pageHide)
      window.removeEventListener('pageshow', visible)
    }
  }, [coordinator])
  return { ...state, finish: coordinator.presence.finish }
}
