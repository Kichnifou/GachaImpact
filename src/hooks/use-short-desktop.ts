import { useSyncExternalStore } from 'react'

const query = '(min-width: 1121px) and (max-height: 650px)'
const snapshot = () => window.matchMedia?.(query).matches ?? false
const subscribe = (listener: () => void) => {
  const media = window.matchMedia?.(query)
  media?.addEventListener('change', listener)
  return () => media?.removeEventListener('change', listener)
}

/** Presentation only; narrow/mobile layouts retain their existing navigation. */
export function useShortDesktop() { return useSyncExternalStore(subscribe, snapshot, () => false) }
