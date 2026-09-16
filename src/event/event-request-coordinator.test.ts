import { describe, expect, it, vi } from 'vitest'

import type { EventDto } from '../api/types'
import { createEventRequestCoordinator } from './event-request-coordinator'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

function snapshot(businessDate: string, solvedToday = false, editionId = 'edition-1'): EventDto {
  return {
    businessDate,
    edition: { id: editionId, startsAt: editionId === 'edition-1' ? '2026-09-01T00:00:00.000Z' : '2026-10-01T00:00:00.000Z' },
    participation: { joined: true },
    gameA: { completedToday: false },
    gameB: { solvedToday },
  } as EventDto
}

describe('Event request coordinator', () => {
  it('deduplicates simultaneous ordinary reads', async () => {
    const pending = deferred<EventDto>()
    const load = vi.fn(() => pending.promise)
    const publish = vi.fn()
    const requests = createEventRequestCoordinator(publish)
    const reads = [requests.read(load), requests.read(load), requests.read(load)]
    expect(load).toHaveBeenCalledOnce()
    const result = snapshot('2026-09-16')
    pending.resolve(result)
    await expect(Promise.all(reads)).resolves.toEqual([result, result, result])
    expect(publish).toHaveBeenCalledExactlyOnceWith(result)
  })

  it('publishes a newer refresh and never republishes the older GET', async () => {
    const old = deferred<EventDto>()
    const fresh = deferred<EventDto>()
    const publish = vi.fn()
    const requests = createEventRequestCoordinator(publish)
    const first = requests.read(() => old.promise)
    const second = requests.refresh(() => fresh.promise)
    const solved = snapshot('2026-09-16', true)
    fresh.resolve(solved)
    await expect(second).resolves.toBe(solved)
    old.resolve(snapshot('2026-09-16'))
    await first
    expect(publish.mock.calls).toEqual([[solved]])
  })

  it('keeps a successful Game B mutation ahead of an older unsolved GET', async () => {
    const old = deferred<EventDto>()
    const publish = vi.fn()
    const requests = createEventRequestCoordinator(publish)
    const read = requests.read(() => old.promise)
    const solved = snapshot('2026-09-16', true)
    await expect(requests.mutate(async () => solved)).resolves.toBe(solved)
    old.resolve(snapshot('2026-09-16'))
    await read
    expect(publish.mock.calls).toEqual([[solved]])
  })

  it('invalidates a GET started while a mutation is in flight', async () => {
    const mutationResult = deferred<EventDto>()
    const staleRead = deferred<EventDto>()
    const publish = vi.fn()
    const requests = createEventRequestCoordinator(publish)
    const mutation = requests.mutate(() => mutationResult.promise)
    const read = requests.read(() => staleRead.promise)
    const solved = snapshot('2026-09-16', true)
    mutationResult.resolve(solved)
    await expect(mutation).resolves.toBe(solved)
    staleRead.resolve(snapshot('2026-09-16'))
    await read
    expect(publish.mock.calls).toEqual([[solved]])
  })

  it('isolates an old session while still returning its completed request to its caller', async () => {
    const previous = deferred<EventDto>()
    const publish = vi.fn()
    const requests = createEventRequestCoordinator(publish)
    const oldRead = requests.read(() => previous.promise)
    requests.reset()
    const current = snapshot('2026-09-16')
    await requests.read(async () => current)
    const oldValue = snapshot('2026-09-15')
    previous.resolve(oldValue)
    await expect(oldRead).resolves.toBe(oldValue)
    expect(publish.mock.calls).toEqual([[current]])
  })

  it('returns a completed old-session mutation without publishing it', async () => {
    const pending = deferred<EventDto>()
    const publish = vi.fn()
    const requests = createEventRequestCoordinator(publish)
    const mutation = requests.mutate(() => pending.promise)
    requests.reset()
    const oldResult = snapshot('2026-09-16', true)
    pending.resolve(oldResult)
    await expect(mutation).resolves.toBe(oldResult)
    expect(publish).not.toHaveBeenCalled()
  })

  it('never rolls back to a previous business date or edition', async () => {
    const publish = vi.fn()
    const requests = createEventRequestCoordinator(publish)
    const nextDay = snapshot('2026-09-17')
    await requests.read(async () => nextDay)
    const previousDay = snapshot('2026-09-16', true)
    await expect(requests.refresh(async () => previousDay)).resolves.toBe(previousDay)
    const newEdition = snapshot('2026-10-01', false, 'edition-2')
    await requests.refresh(async () => newEdition)
    await expect(requests.refresh(async () => snapshot('2026-10-01', true, 'edition-1'))).resolves.toMatchObject({ edition: { id: 'edition-1' } })
    expect(publish.mock.calls).toEqual([[nextDay], [newEdition]])
  })
})
