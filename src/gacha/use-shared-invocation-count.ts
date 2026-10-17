import { useEffect, useRef, useState } from 'react'
import type { SharedInvocationApi } from '../api/shared-invocations-types'

/** One lightweight read at a time; local transitions and visible returns coalesce within 2 s. */
export function useSharedInvocationCount(api: SharedInvocationApi | undefined, visible: boolean, ownerKey?: string, localTransition?: string) {
  const [count, setCount] = useState<number | null>(null)
  const wake = useRef<() => void>(() => undefined)
  const previousTransition = useRef(localTransition)
  useEffect(() => {
    // oxlint-disable-next-line react(set-state-in-effect) -- Owner/screen changes invalidate the badge.
    setCount(null)
    if (!api?.availableCount || !visible) return
    let disposed = false, reading = false, requested = false, lastStartedAt: number | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    const clear = () => { clearTimeout(timer); timer = undefined }
    const schedule = (delay = 12_000 + Math.round(Math.random() * 3_000), force = false) => {
      clear()
      if (!disposed && document.visibilityState !== 'hidden') timer = setTimeout(() => void read(force), delay)
    }
    const read = async (force = false) => {
      if (disposed || document.visibilityState === 'hidden') return
      if (reading) { requested ||= force; return }
      const elapsed = lastStartedAt === null ? Infinity : Date.now() - lastStartedAt
      const minimum = force ? 2_000 : 12_000
      if (elapsed < minimum) { schedule(minimum - elapsed, force); return }
      reading = true; requested = false; lastStartedAt = Date.now()
      try {
        const result = await api.availableCount!()
        if (!disposed) setCount(Number.isSafeInteger(result.count) && result.count >= 0 ? result.count : null)
      } catch { if (!disposed) setCount(null) }
      finally {
        reading = false
        if (requested) schedule(Math.max(0, 2_000 - (Date.now() - lastStartedAt)), true)
        else schedule()
      }
    }
    const refresh = () => { clear(); void read(true) }
    const visibility = () => { clear(); if (document.visibilityState !== 'hidden') refresh() }
    wake.current = refresh
    document.addEventListener('visibilitychange', visibility)
    void read()
    return () => { disposed = true; wake.current = () => undefined; clear(); document.removeEventListener('visibilitychange', visibility) }
  }, [api, visible, ownerKey])
  useEffect(() => { if (previousTransition.current !== localTransition) { previousTransition.current = localTransition; wake.current() } }, [localTransition])
  return count
}
