import { useMemo, useState } from 'react'
import { dailyIds, dailySuggestions, dailySummaryMessage, type DailyId, type DailyItem } from './daily-summary'

export function dailyMaskKey(environment: string, playerId: string, day: string | null) {
  return `gachaimpact:daily-tracker:v1:${encodeURIComponent(environment)}:${playerId}:${day ?? 'unknown'}`
}
export function dailyTrackerEnvironment() {
  return `${import.meta.env.MODE}@${import.meta.env.VITE_API_BASE_URL ?? window.location.origin}`
}
export function readDailyMasks(key: string): DailyId[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(value) ? [...new Set(value.filter((id): id is DailyId => dailyIds.includes(id)))] : []
  } catch { return [] }
}

export function useDailyTracker(items: readonly DailyItem[], playerId: string, day: string | null, environment: string) {
  const key = dailyMaskKey(environment, playerId, day)
  const restored = useMemo(() => day ? readDailyMasks(key) : [], [key, day])
  const [preference, setPreference] = useState<{ key: string; hidden: DailyId[] }>(() => ({ key, hidden: restored }))
  const hidden = preference.key === key ? preference.hidden : restored
  const suggestions = dailySuggestions(items, hidden)
  const [selection, setSelection] = useState<{ key: string; id: DailyId | null }>({ key, id: suggestions[0]?.id ?? null })
  const selected = suggestions.find(item => selection.key === key && item.id === selection.id) ?? suggestions[0] ?? null
  if (selection.key !== key || selection.id !== (selected?.id ?? null)) setSelection({ key, id: selected?.id ?? null })
  const save = (next: DailyId[]) => {
    setPreference({ key, hidden: next })
    if (day) { try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* Memory fallback, no business mutation. */ } }
  }
  const move = (direction: -1 | 1) => {
    if (!selected || !suggestions.length) return
    const index = suggestions.findIndex(item => item.id === selected.id)
    setSelection({ key, id: suggestions[(index + direction + suggestions.length) % suggestions.length]!.id })
  }
  const hide = (id: DailyId) => { if (day && !hidden.includes(id)) save([...hidden, id]) }
  const restoreLast = () => {
    const id = hidden.at(-1)
    if (!id) return
    save(hidden.slice(0, -1))
    setSelection({ key, id })
  }
  return { selected, suggestions, hidden, businessDate: day, message: dailySummaryMessage(items, hidden), move, hide, restoreLast, restoreAll: () => save([]), canHide: Boolean(day) }
}
export type DailyTracker = ReturnType<typeof useDailyTracker>
