import { useEffect, useMemo, useState } from 'react'
import { nextParisMidnight, resetCountdownMessage } from './daily-clock'

/** Display only: midnight revalidation and server snapshots still own daily state. */
export function useDailyResetCountdown(completed: boolean, businessDate: string | null) {
  const [now, setNow] = useState(Date.now)
  // Noon UTC is on the same Paris date in both CET and CEST. Anchor to the confirmed day.
  const resetAt = useMemo(() => completed && businessDate ? nextParisMidnight(Date.parse(`${businessDate}T12:00:00Z`)) : null, [completed, businessDate])
  useEffect(() => {
    if (resetAt === null) return
    let timer: number | undefined
    const tick = () => {
      const instant = Date.now()
      setNow(instant)
      const remaining = resetAt - instant
      if (remaining > 0) timer = window.setTimeout(tick, Math.min(60_000, remaining))
    }
    tick()
    return () => window.clearTimeout(timer)
  }, [resetAt])
  return resetAt === null ? '' : resetCountdownMessage(resetAt, now)
}
