import { useEffect, useRef, useState } from 'react'
import type { PlayerBoxDto } from '../api/types'

/** One revalidation on entry; shared cache refreshes are reused, never polled. */
export function useCatalogOwnership(initialBox: PlayerBoxDto | null, load: (() => Promise<PlayerBoxDto>) | undefined, refreshToken: number) {
  const [box, setBox] = useState(initialBox)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const cached = useRef(initialBox), lastRetry = useRef(-1)
  cached.current = initialBox
  useEffect(() => {
    let active = true
    const snapshot = cached.current
    // GameShell has already refreshed the cache before changing its token.
    if (lastRetry.current === retry && snapshot) { setBox(snapshot); setError(false); return }
    lastRetry.current = retry
    if (!load) return
    setError(false)
    void load().then(value => { if (active) setBox(value) }).catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [load, refreshToken, retry])
  return { box, error, retry:() => setRetry(value => value + 1) }
}
