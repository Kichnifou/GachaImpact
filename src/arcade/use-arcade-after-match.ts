import { useEffect, useRef } from 'react'
import { getGameApiClient } from '../api/game-api'
import type { ArcadeAfterMatchPresence, ArcadeSession } from '../api/arcade-types'
import { useLatestRef } from '../hooks/use-latest-ref'
/** One narrow, serialized heartbeat only while this mounted Arcade window waits. */
export function useArcadeAfterMatch(playerId: string, session: ArcadeSession | undefined, onUpdate: (value: ArcadeAfterMatchPresence) => void) {
  const tabKey = useRef(crypto.randomUUID()), sequence = useRef(0), update = useLatestRef(onUpdate)
  const id = session?.id, waiting = session?.afterMatch?.status === 'WAITING'
  useEffect(() => {
    if (!id || !waiting) return
    let active = true, departed = false, timer: number | undefined, flight: Promise<void> | null = null
    const send = (visible: boolean, detached = false): Promise<void> => {
      const input = { tabKey: tabKey.current, sequence: ++sequence.current, visible }
      return getGameApiClient().arcadeAfterMatchPresence(id, input).then(result => { if (active && !detached) update.current(result) }).catch(() => undefined)
    }
    const schedule = () => { window.clearTimeout(timer); if (active && !departed && document.visibilityState !== 'hidden') timer = window.setTimeout(() => void tick(), 2000) }
    const tick = () => {
      if (!active || departed || document.visibilityState === 'hidden') return Promise.resolve()
      if (flight) return flight
      const request = send(true).finally(() => { if (flight === request) flight = null; schedule() })
      flight = request; return request
    }
    const visibility = () => { window.clearTimeout(timer); if (document.visibilityState === 'hidden') void send(false); else void tick() }
    const leave = () => { departed = true; window.clearTimeout(timer); void send(false, true) }
    const arrive = () => { departed = false; if (document.visibilityState !== 'hidden') void tick() }
    window.addEventListener('pageshow', arrive); document.addEventListener('visibilitychange', visibility); window.addEventListener('pagehide', leave)
    if (document.visibilityState !== 'hidden') void tick()
    return () => { active = false; window.clearTimeout(timer); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pagehide', leave); window.removeEventListener('pageshow', arrive); void send(false, true) }
  }, [playerId, id, waiting, update])
  return { tabKey: tabKey.current, nextSequence: () => ++sequence.current }
}
