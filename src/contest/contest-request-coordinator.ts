export type ContestRequestCoordinator<T> = ReturnType<typeof createContestRequestCoordinator<T>>
export type ContestAvailability = Readonly<{ phase: 'loading' | 'ready' | 'unavailable'; pending: boolean }>
export const CONTEST_SLOW_READ_MS = 8_000

export function createContestRequestCoordinator<T>(publish: (value: T) => void, availability?: (value: ContestAvailability) => void, onError?: (error: unknown) => void) {
  let generation = 0
  let revision = 0
  let degraded = false
  let inFlightRead: Promise<T> | null = null
  let inFlightRefresh: Promise<T> | null = null
  let inFlightStatusRevision = 0
  const timers = new Set<ReturnType<typeof setTimeout>>()

  const startRead = (load: () => Promise<T>, refreshed: boolean): Promise<T> => {
    const readGeneration = generation
    const readRevision = revision
    inFlightStatusRevision = revision
    const current = () => generation === readGeneration && revision === readRevision
    availability?.({ phase: degraded ? 'unavailable' : 'loading', pending: true })
    // A UI deadline is not SQL cancellation. Keep the request owned/coalesced until
    // it settles; never race it against a timeout and launch duplicate DB work.
    const timer = setTimeout(() => {
      timers.delete(timer)
      if (generation === readGeneration && inFlightRead === request && revision === inFlightStatusRevision) {
        degraded = true
        availability?.({ phase: 'unavailable', pending: true })
      }
    }, CONTEST_SLOW_READ_MS)
    timers.add(timer)
    const request = (async () => load())().then((value) => {
      if (current()) { degraded = false; publish(value); availability?.({ phase: 'ready', pending: false }) }
      return value
    }, (error: unknown) => {
      if (current()) {
        degraded = true
        availability?.({ phase: 'unavailable', pending: false })
        onError?.(error)
      }
      throw error
    }).finally(() => {
      clearTimeout(timer)
      timers.delete(timer)
      if (inFlightRead === request) inFlightRead = null
      if (inFlightRefresh === request) inFlightRefresh = null
    })
    inFlightRead = request
    if (refreshed) inFlightRefresh = request
    return request
  }

  return {
    read(load: () => Promise<T>): Promise<T> {
      if (inFlightRefresh) return inFlightRefresh
      if (inFlightRead) return inFlightRead
      return startRead(load, false)
    },

    refresh(load: () => Promise<T>): Promise<T> {
      if (inFlightRefresh) return inFlightRefresh
      revision += 1
      if (inFlightRead) {
        const refreshGeneration = generation
        inFlightStatusRevision = revision
        // Invalidate now, but drain the owned read before issuing fresh SQL.
        const queued = inFlightRead.catch(() => undefined).then(() => {
          if (generation !== refreshGeneration) throw new Error('Contest session changed')
          return startRead(load, true)
        }).finally(() => {
          if (inFlightRefresh === queued) inFlightRefresh = null
        })
        inFlightRefresh = queued
        return queued
      }
      return startRead(load, true)
    },

    async mutate(request: () => Promise<T>): Promise<T> {
      const mutationGeneration = generation
      revision += 1
      const value = await request()
      if (generation === mutationGeneration) {
        revision += 1
        degraded = false
        publish(value)
        availability?.({ phase: 'ready', pending: false })
      }
      return value
    },

    reset() {
      generation += 1
      revision += 1
      degraded = false
      inFlightRead = null
      inFlightRefresh = null
      for (const timer of timers) clearTimeout(timer)
      timers.clear()
    },
  }
}
