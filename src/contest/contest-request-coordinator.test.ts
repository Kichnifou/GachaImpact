import { describe, expect, it, vi } from 'vitest'
import { createContestRequestCoordinator } from './contest-request-coordinator'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

describe('contest request coordinator', () => {
  it('deduplicates concurrent polling, focus and visibility reads', async () => {
    const pending = deferred<number>()
    const load = vi.fn(() => pending.promise)
    const publish = vi.fn()
    const coordinator = createContestRequestCoordinator(publish)

    const readers = Array.from({ length: 10 }, () => coordinator.read(load))
    expect(load).toHaveBeenCalledTimes(1)

    pending.resolve(2)
    await expect(Promise.all(readers)).resolves.toEqual(Array.from({ length: 10 }, () => 2))
    expect(publish).toHaveBeenCalledOnce()
  })

  it('does not let an older read overwrite a confirmed mutation', async () => {
    const staleRead = deferred<number>()
    const publish = vi.fn()
    const coordinator = createContestRequestCoordinator(publish)

    const read = coordinator.read(() => staleRead.promise)
    await expect(coordinator.mutate(async () => 4)).resolves.toBe(4)
    staleRead.resolve(1)
    await expect(read).resolves.toBe(1)
    expect(publish.mock.calls).toEqual([[4]])
  })

  it('starts one fresh revalidation after an external progression change and deduplicates its consumers', async () => {
    const staleRead = deferred<number>()
    const refreshed = deferred<number>()
    const loadFresh = vi.fn(() => refreshed.promise)
    const publish = vi.fn()
    const coordinator = createContestRequestCoordinator(publish)

    const stale = coordinator.read(() => staleRead.promise)
    const refreshes = [coordinator.refresh(loadFresh), coordinator.refresh(loadFresh), coordinator.read(loadFresh)]
    expect(loadFresh).toHaveBeenCalledOnce()

    refreshed.resolve(6)
    await expect(Promise.all(refreshes)).resolves.toEqual([6, 6, 6])
    staleRead.resolve(0)
    await expect(stale).resolves.toBe(0)
    expect(publish.mock.calls).toEqual([[6]])
  })

  it('also invalidates a read started while a mutation is still in flight', async () => {
    const mutationResult = deferred<number>()
    const staleRead = deferred<number>()
    const publish = vi.fn()
    const coordinator = createContestRequestCoordinator(publish)

    const mutation = coordinator.mutate(() => mutationResult.promise)
    const read = coordinator.read(() => staleRead.promise)
    mutationResult.resolve(4)
    await expect(mutation).resolves.toBe(4)
    staleRead.resolve(1)
    await expect(read).resolves.toBe(1)
    expect(publish.mock.calls).toEqual([[4]])
  })

  it('isolates responses from a previous account generation', async () => {
    const previousAccount = deferred<number>()
    const publish = vi.fn()
    const coordinator = createContestRequestCoordinator(publish)

    const read = coordinator.read(() => previousAccount.promise)
    coordinator.reset()
    previousAccount.resolve(1)
    await read
    expect(publish).not.toHaveBeenCalled()
  })
})
