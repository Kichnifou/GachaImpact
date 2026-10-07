import { afterEach, describe, expect, it, vi } from 'vitest'
import { CONTEST_SLOW_READ_MS, createContestRequestCoordinator } from './contest-request-coordinator'

afterEach(() => vi.useRealTimers())

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

describe('contest request coordinator', () => {
  it('marks a slow read unavailable while keeping the one owned request and accepts its recovery', async () => {
    vi.useFakeTimers()
    const pending = deferred<number>(), publish = vi.fn(), status = vi.fn()
    const load = vi.fn(() => pending.promise)
    const coordinator = createContestRequestCoordinator(publish, status)
    const request = coordinator.read(load)
    await vi.advanceTimersByTimeAsync(CONTEST_SLOW_READ_MS)
    expect(status).toHaveBeenLastCalledWith({ phase: 'unavailable', pending: true })
    expect(coordinator.read(load)).toBe(request)
    expect(load).toHaveBeenCalledOnce()
    pending.resolve(8)
    await expect(request).resolves.toBe(8)
    expect(status).toHaveBeenLastCalledWith({ phase: 'ready', pending: false })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('publishes a retryable backend failure, then restores the real value', async () => {
    const status = vi.fn(), publish = vi.fn()
    const coordinator = createContestRequestCoordinator(publish, status)
    await expect(coordinator.read(async () => { throw new Error('backend unavailable') })).rejects.toThrow('backend unavailable')
    expect(status).toHaveBeenLastCalledWith({ phase: 'unavailable', pending: false })
    expect(publish).not.toHaveBeenCalled()
    await coordinator.refresh(async () => 12)
    expect(publish).toHaveBeenLastCalledWith(12)
    expect(status).toHaveBeenLastCalledWith({ phase: 'ready', pending: false })
  })

  it('clears slow timers and rejects publications of late failures from an old session', async () => {
    vi.useFakeTimers()
    let fail!: (error: Error) => void
    const status = vi.fn(), publish = vi.fn()
    const coordinator = createContestRequestCoordinator(publish, status)
    const request = coordinator.read(() => new Promise<number>((_, reject) => { fail = reject }))
    const rejected = expect(request).rejects.toThrow('old session')
    coordinator.reset()
    expect(vi.getTimerCount()).toBe(0)
    await coordinator.read(async () => 20)
    fail(new Error('old session'))
    await rejected
    expect(publish).toHaveBeenCalledExactlyOnceWith(20)
    expect(status).toHaveBeenLastCalledWith({ phase: 'ready', pending: false })
  })
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
