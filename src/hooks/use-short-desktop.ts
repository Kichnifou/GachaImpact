import { useCallback, useSyncExternalStore } from 'react'

/** Presentation only; narrow/mobile layouts retain their existing navigation. */
export function useShortDesktop(maxHeight = 650) {
  const query = `(min-width: 1121px) and (max-height: ${maxHeight}px)`
  const snapshot = useCallback(() => window.matchMedia?.(query).matches ?? false, [query])
  const subscribe = useCallback((listener: () => void) => {
    const media = window.matchMedia?.(query)
    media?.addEventListener('change', listener)
    return () => media?.removeEventListener('change', listener)
  }, [query])
  return useSyncExternalStore(subscribe, snapshot, () => false)
}
