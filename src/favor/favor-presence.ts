import type { FavorDto, FavorPresenceDto } from '../api/types'

export type FavorFeedback = { id: string }
export type FavorPresenceState = { favor: FavorDto | null; error: boolean; feedbacks: readonly FavorFeedback[] }

/** One authenticated game session; transport retries never fabricate a gain. */
export function createFavorPresence(record: () => Promise<FavorPresenceDto>, refreshResources: () => Promise<unknown>) {
  let state: FavorPresenceState = { favor: null, error: false, feedbacks: [] }
  let flight: Promise<void> | null = null, started = false
  const paidDates = new Set<string>(), listeners = new Set<(state: FavorPresenceState) => void>()
  const publish = () => listeners.forEach(listener => listener(state))
  const wake = () => {
    if (flight) return flight
    started = true
    flight = Promise.resolve().then(async () => {
      try {
        const result = await record()
        state = { ...state, favor: result.favor, error: false }
        if (result.status === 'CLAIMED' && result.creditedPrimogems === '800' && !paidDates.has(result.businessDate)) {
          paidDates.add(result.businessDate)
          state = { ...state, feedbacks: [...state.feedbacks, { id: result.businessDate }] }
          publish()
          if (listeners.size) await refreshResources().catch(() => undefined)
        }
      } catch { state = { ...state, error: true } }
      finally { publish(); flight = null }
    })
    return flight
  }
  return {
    subscribe(listener: (value: FavorPresenceState) => void) { listeners.add(listener); listener(state); return () => { listeners.delete(listener) } },
    start() { if (!started) void wake() }, wake,
    finish(id: string) { state = { ...state, feedbacks: state.feedbacks.filter(item => item.id !== id) }; publish() },
  }
}
