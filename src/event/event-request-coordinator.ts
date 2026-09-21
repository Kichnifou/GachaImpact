import type { EventDto } from '../api/types'

export type EventRequestCoordinator = ReturnType<typeof createEventRequestCoordinator>

export type EventMilestoneFeedback = { id: string; points: number; rewardLabel: string }
export function createEventRequestCoordinator(publish: (value: EventDto) => void, onMilestones?: (values: EventMilestoneFeedback[]) => void) {
  let generation = 0
  let revision = 0
  let inFlightRead: Promise<EventDto> | null = null
  let latest: EventDto | null = null
  const announcedMilestones = new Set<string>()

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
      const before = latest
      revision += 1
      inFlightRead = null
      const value = await request()
      if (generation === mutationGeneration) {
        const operation = (value as EventDto & { operation?: { alreadyProcessed: boolean } }).operation
        if (before?.edition.id === value.edition.id && !operation?.alreadyProcessed) {
          const claimed = new Set(before.milestones?.thresholds.filter(t => t.rewarded).map(t => t.points))
          const earned = value.milestones?.thresholds.filter(t => t.rewarded && !claimed.has(t.points) && !announcedMilestones.has(`${value.edition.id}:${t.points}`)) ?? []
          const feedback = earned.sort((a, b) => a.points - b.points).map(t => ({ id: `${value.edition.id}:${t.points}`, points: t.points, rewardLabel: t.rewardLabel }))
          feedback.forEach(item => announcedMilestones.add(item.id))
          if (feedback.length) onMilestones?.(feedback)
        }
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
      announcedMilestones.clear()
    },
  }
}
