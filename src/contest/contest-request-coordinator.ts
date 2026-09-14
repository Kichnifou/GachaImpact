export type ContestRequestCoordinator<T> = ReturnType<typeof createContestRequestCoordinator<T>>

export function createContestRequestCoordinator<T>(publish: (value: T) => void) {
  let generation = 0
  let revision = 0
  let inFlightRead: Promise<T> | null = null
  let inFlightRefresh: Promise<T> | null = null

  const startRead = (load: () => Promise<T>, refreshed: boolean): Promise<T> => {
    const readGeneration = generation
    const readRevision = revision
    const request = load().then((value) => {
      if (generation === readGeneration && revision === readRevision) publish(value)
      return value
    }).finally(() => {
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
      }
      return value
    },

    reset() {
      generation += 1
      revision += 1
      inFlightRead = null
      inFlightRefresh = null
    },
  }
}
