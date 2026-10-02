import { useEffect, useLayoutEffect, useRef } from 'react'
import { nextParisMidnight } from './daily-clock'

/** One shell-level refresh on focus, visible return and Paris midnight. No periodic domain polling. */
export function useDailyRevalidation(playerId: string, refresh: () => Promise<unknown>, afterRefresh?: () => Promise<unknown>) {
  const callbacks = useRef({ refresh, afterRefresh })
  useLayoutEffect(() => { callbacks.current = { refresh, afterRefresh } }, [refresh, afterRefresh])
  useEffect(() => {
    let alive = true, flight: Promise<void> | null = null, lastWake = -Infinity, timer: number | undefined, pendingBoundary = false
    const run = (boundary = false) => {
      if (!alive || document.visibilityState === 'hidden') return
      if (flight) { if (boundary) pendingBoundary = true; return }
      if (!boundary && performance.now() - lastWake < 750) return
      lastWake = performance.now()
      flight = Promise.allSettled([callbacks.current.refresh(), callbacks.current.afterRefresh?.()]).then(() => undefined)
        .finally(() => { flight = null; if (pendingBoundary) { pendingBoundary = false; run(true) } })
    }
    const schedule = () => { timer = window.setTimeout(() => { if (!alive) return; run(true); schedule() }, Math.max(1000, nextParisMidnight(Date.now()) - Date.now() + 100)) }
    schedule()
    const wake = () => run()
    window.addEventListener('focus', wake); document.addEventListener('visibilitychange', wake)
    return () => { alive = false; window.clearTimeout(timer); window.removeEventListener('focus', wake); document.removeEventListener('visibilitychange', wake) }
  }, [playerId])
}
