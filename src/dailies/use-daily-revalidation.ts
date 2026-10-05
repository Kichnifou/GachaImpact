import { useEffect, useLayoutEffect, useRef } from 'react'
import { nextParisMidnight } from './daily-clock'

type ReturnRefresh = { refresh: () => Promise<unknown>; canRefresh?: () => boolean }

/** One shell-level listener pair; returning can reread the whole Player, midnight stays daily. */
export function useDailyRevalidation(playerId: string, refresh: () => Promise<unknown>, afterRefresh?: () => Promise<unknown>, onReturn?: ReturnRefresh) {
  const callbacks = useRef({ refresh, afterRefresh, onReturn })
  useLayoutEffect(() => { callbacks.current = { refresh, afterRefresh, onReturn } }, [refresh, afterRefresh, onReturn])
  useEffect(() => {
    let alive = true, flight: Promise<void> | null = null, lastWake = -Infinity, timer: number | undefined, returnTimer: number | undefined, pendingBoundary = false, pendingReturn = false
    const queueReturn = () => {
      if (returnTimer !== undefined) return
      returnTimer = window.setTimeout(() => {
        returnTimer = undefined
        if (pendingReturn) run(false, true)
      }, 750)
    }
    const run = (boundary = false, queued = false) => {
      if (!alive || document.visibilityState === 'hidden') return
      if (flight) {
        if (boundary) pendingBoundary = true
        else if (callbacks.current.onReturn && (queued || performance.now() - lastWake >= 750)) pendingReturn = true
        return
      }
      if (!boundary && !queued && performance.now() - lastWake < 750) return
      if (!boundary && callbacks.current.onReturn?.canRefresh?.() === false) {
        pendingReturn = true; queueReturn(); return
      }
      if (!boundary) pendingReturn = false
      lastWake = performance.now()
      const read = boundary ? callbacks.current.refresh : callbacks.current.onReturn?.refresh ?? callbacks.current.refresh
      // A failed reread leaves the committed server action and the displayed state intact.
      flight = Promise.allSettled([Promise.resolve().then(read), Promise.resolve().then(() => callbacks.current.afterRefresh?.())]).then(() => undefined)
        .finally(() => {
          flight = null
          if (!alive) return
          if (pendingBoundary) { pendingBoundary = false; run(true) }
          else if (pendingReturn) queueReturn()
        })
    }
    const schedule = () => { timer = window.setTimeout(() => { if (!alive) return; run(true); schedule() }, Math.max(1000, nextParisMidnight(Date.now()) - Date.now() + 100)) }
    schedule()
    const wake = () => run()
    window.addEventListener('focus', wake); document.addEventListener('visibilitychange', wake)
    return () => { alive = false; window.clearTimeout(timer); window.clearTimeout(returnTimer); window.removeEventListener('focus', wake); document.removeEventListener('visibilitychange', wake) }
  }, [playerId])
}
