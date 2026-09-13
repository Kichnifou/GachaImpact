export type ContestRequestCoordinator<T> = ReturnType<typeof createContestRequestCoordinator<T>>

export function createContestRequestCoordinator<T>(publish: (value: T) => void) {
  let generation = 0
  let revision = 0
  let inFlightRead: Promise<T> | null = null

  return {
    read(load: () => Promise<T>): Promise<T> {
      if (inFlightRead) return inFlightRead
      const readGeneration = generation
      const readRevision = revision
      const request = load().then((value) => {
        if (generation === readGeneration && revision === readRevision) publish(value)
        return value
      }).finally(() => {
        if (inFlightRead === request) inFlightRead = null
      })
      inFlightRead = request
      return request
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
    },
  }
}
