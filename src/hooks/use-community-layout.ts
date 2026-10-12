import { useSyncExternalStore } from 'react'

const event = 'gachaimpact:community-layout'
const fallback = new Map<string, boolean>()
const memoryOnly = new Set<string>()
const keyFor = (playerId: string) => `gachaimpact.community.expanded.${playerId}`
const subscribe = (listener: () => void) => {
  window.addEventListener('storage', listener)
  window.addEventListener(event, listener)
  return () => { window.removeEventListener('storage', listener); window.removeEventListener(event, listener) }
}
const read = (id: string) => {
  if (memoryOnly.has(id)) return fallback.get(id) ?? false
  try { return localStorage.getItem(keyFor(id)) === 'true' } catch { return fallback.get(id) ?? false }
}
const wideQuery = '(min-width: 1000px)'
const subscribeWidth = (listener: () => void) => {
  const media = window.matchMedia?.(wideQuery)
  media?.addEventListener('change', listener)
  return () => media?.removeEventListener('change', listener)
}
export function useCommunityLayout(playerId: string) {
  const expanded = useSyncExternalStore(subscribe, () => read(playerId))
  const available = useSyncExternalStore(subscribeWidth, () => window.matchMedia?.(wideQuery).matches ?? false)
  const setExpanded = (value: boolean) => {
    fallback.set(playerId, value)
    try { localStorage.setItem(keyFor(playerId), String(value)); memoryOnly.delete(playerId) } catch { memoryOnly.add(playerId) }
    window.dispatchEvent(new Event(event))
  }
  return { expanded, available, setExpanded }
}
