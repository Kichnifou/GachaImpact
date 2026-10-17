import { useEffect, useState } from 'react'
import type { SharedInvocationApi } from '../api/shared-invocations-types'

/** A lightweight read only while Invocation is visible; never polls the picker list. */
export function useSharedInvocationCount(api: SharedInvocationApi | undefined, visible: boolean, ownerKey?: string) {
  const [count, setCount] = useState<number | null>(null)
  useEffect(() => {
    // oxlint-disable-next-line react(set-state-in-effect) -- A new owner or screen invalidates the prior badge.
    setCount(null)
    if (!api?.availableCount || !visible) return
    let disposed = false, reading = false, lastStartedAt: number | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    const clear = () => { clearTimeout(timer); timer = undefined }
    const schedule = (delay = 30_000 + Math.round(Math.random() * 5_000)) => {
      clear()
      if (!disposed && document.visibilityState !== 'hidden') timer = setTimeout(() => void read(), delay)
    }
    const read = async () => {
      if (disposed || reading || document.visibilityState === 'hidden') return
      const elapsed = lastStartedAt === null ? Infinity : Date.now() - lastStartedAt
      if (elapsed < 30_000) { schedule(30_000 - elapsed); return }
      reading = true; lastStartedAt = Date.now()
      try {
        const result = await api.availableCount!()
        if (!disposed) setCount(Number.isSafeInteger(result.count) && result.count >= 0 ? result.count : null)
      } catch { if (!disposed) setCount(null) }
      finally { reading = false; schedule() }
    }
    const visibility = () => { clear(); if (document.visibilityState !== 'hidden') void read() }
    document.addEventListener('visibilitychange', visibility)
    void read()
    return () => { disposed = true; clear(); document.removeEventListener('visibilitychange', visibility) }
  }, [api, visible, ownerKey])
  return count
}
