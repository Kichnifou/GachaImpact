export type ContestRequestCoordinator<T> = ReturnType<typeof createContestRequestCoordinator<T>>
export type ContestAvailability = Readonly<{ phase: 'loading' | 'ready' | 'unavailable'; pending: boolean }>
export const CONTEST_SLOW_READ_MS = 8_000

export function createContestRequestCoordinator<T>(publish: (value: T) => void, availability?: (value: ContestAvailability) => void) {
  let generation = 0
  let revision = 0
  let inFlightRead: Promise<T> | null = null
  let inFlightRefresh: Promise<T> | null = null
  const timers = new Set<ReturnType<typeof setTimeout>>()

  const startRead = (load: () => Promise<T>, refreshed: boolean): Promise<T> => {
    const readGeneration = generation
    const readRevision = revision
    const current = () => generation === readGeneration && revision === readRevision
    availability?.({ phase: 'loading', pending: true })
    // A UI deadline is not SQL cancellation. Keep the request owned/coalesced until
    // it settles; never race it against a timeout and launch duplicate DB work.
    const timer = setTimeout(() => {
      timers.delete(timer)
      if (current()) availability?.({ phase: 'unavailable', pending: true })
    }, CONTEST_SLOW_READ_MS)
    timers.add(timer)
    const request = (async () => load())().then((value) => {
      if (current()) { publish(value); availability?.({ phase: 'ready', pending: false }) }
      return value
    }, (error: unknown) => {
      if (current()) availability?.({ phase: 'unavailable', pending: false })
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
      if (inFlightRead) return inFlightRead
      return startRead(load, false)
    },

    refresh(load: () => Promise<T>): Promise<T> {
      if (inFlightRefresh) return inFlightRefresh
      revision += 1
      inFlightRead = null
      return startRead(load, true)
    },

    async mutate(request: () => Promise<T>): Promise<T> {
      const mutationGeneration = generation
      revision += 1
      const value = await request()
      if (generation === mutationGeneration) {
        revision += 1
        publish(value)
        availability?.({ phase: 'ready', pending: false })
      }
      return value
    },

    reset() {
      generation += 1
      revision += 1
      inFlightRead = null
      inFlightRefresh = null
      for (const timer of timers) clearTimeout(timer)
      timers.clear()
    },
  }
}
