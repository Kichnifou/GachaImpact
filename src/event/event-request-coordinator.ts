import type { EventDto } from '../api/types'

export type EventRequestCoordinator = ReturnType<typeof createEventRequestCoordinator>

export function createEventRequestCoordinator(publish: (value: EventDto) => void) {
  let generation = 0
  let revision = 0
  let inFlightRead: Promise<EventDto> | null = null
  let latest: EventDto | null = null

  const publishCurrent = (value: EventDto) => {
    if (latest) {
      if (value.businessDate < latest.businessDate) return
      if (value.businessDate === latest.businessDate && value.edition.startsAt < latest.edition.startsAt) return
      if (value.businessDate === latest.businessDate && value.edition.id === latest.edition.id) {
        if (latest.gameB.solvedToday && !value.gameB.solvedToday) return
        if (latest.participation.joined && !value.participation.joined) return
        if (latest.gameA.completedToday && !value.gameA.completedToday) return
      }
    }
    latest = value
    publish(value)
  }

  const startRead = (load: () => Promise<EventDto>): Promise<EventDto> => {
    const readGeneration = generation
    const readRevision = revision
    const request = load().then((value) => {
      if (generation === readGeneration && revision === readRevision) publishCurrent(value)
      return value
    }).finally(() => {
      if (inFlightRead === request) inFlightRead = null
    })
    inFlightRead = request
    return request
  }

  return {
    read(load: () => Promise<EventDto>): Promise<EventDto> {
      if (inFlightRead) return inFlightRead
      return startRead(load)
    },

    refresh(load: () => Promise<EventDto>): Promise<EventDto> {
      revision += 1
      inFlightRead = null
      return startRead(load)
    },

    async mutate<TResult extends EventDto>(request: () => Promise<TResult>): Promise<TResult> {
      const mutationGeneration = generation
      revision += 1
      inFlightRead = null
      const value = await request()
      if (generation === mutationGeneration) {
        revision += 1
        inFlightRead = null
        publishCurrent(value)
      }
      return value
    },

    reset() {
      generation += 1
      revision += 1
      inFlightRead = null
      latest = null
    },
  }
}
