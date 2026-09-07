import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/game-api'
import type { GachaPullRefreshResult } from './perform-gacha-pull'
import { createGachaPresentationCoordinator } from './gacha-presentation-coordinator'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function update(id: string, count: 1 | 10, failedRefreshes: GachaPullRefreshResult['failedRefreshes'] = []): GachaPullRefreshResult {
  return {
    result: {
      operation: { id, pullCount: count, primogemCost: count === 1 ? '160' : '1600', createdAt: '2026-09-07T12:00:00Z', alreadyProcessed: false },
      results: [],
      playerState: { pity5: 12, pity4: 2, guaranteedFeatured5: true, captureProgress: 1, fiftyFiftyLostStreak: 1, selectedBannerCharacterId: 'target', totalPulls: '12', totalFiveStars: '1', totalFourStars: '2', fiftyFiftyWon: '0', fiftyFiftyLost: '1', capturesTriggered: '0' },
    },
    resources: failedRefreshes.includes('resources') ? null : { primogems: '8400', moras: '10000', particles: { pyro: '0', hydro: '0', cryo: '0', electro: '0', anemo: '0', geo: '0', dendro: '0' } },
    gacha: null,
    failedRefreshes,
  }
}

describe('Gacha presentation coordinator', () => {
  it('keeps x10 authoritative state buffered until the summary discloses it exactly once', async () => {
    const pending = deferred<GachaPullRefreshResult>()
    const publish = vi.fn()
    const execute = vi.fn(() => pending.promise)
    const onPendingCountChange = vi.fn()
    const coordinator = createGachaPresentationCoordinator({ execute, publish, createIdempotencyKey: () => 'x10-key', onPendingCountChange })

    const pullPromise = coordinator.requestPull(10)
    expect(coordinator.getSnapshot()).toMatchObject({ phase: 'pending', abandoned: false })
    expect(publish).not.toHaveBeenCalled()

    pending.resolve(update('x10-operation', 10))
    await expect(pullPromise).resolves.toMatchObject({ operation: { id: 'x10-operation' } })
    expect(coordinator.getSnapshot()).toMatchObject({ phase: 'ready' })
    expect(publish).not.toHaveBeenCalled()

    expect(coordinator.disclose('x10-operation')).toBe(true)
    expect(coordinator.disclose('x10-operation')).toBe(false)
    expect(publish).toHaveBeenCalledOnce()
    expect(onPendingCountChange).toHaveBeenNthCalledWith(1, 10)
    expect(onPendingCountChange).toHaveBeenLastCalledWith(null)
  })

  it('keeps an x1 result buffered until its revealed result is closed', async () => {
    const publish = vi.fn()
    const coordinator = createGachaPresentationCoordinator({ execute: async () => update('x1-operation', 1), publish, createIdempotencyKey: () => 'x1-key' })

    await coordinator.requestPull(1)
    expect(coordinator.getSnapshot().phase).toBe('ready')
    expect(publish).not.toHaveBeenCalled()
    expect(coordinator.disclose('x1-operation')).toBe(true)
    expect(publish).toHaveBeenCalledOnce()
  })

  it('publishes immediately when navigation abandons a result that is already ready', async () => {
    const publish = vi.fn()
    const coordinator = createGachaPresentationCoordinator({ execute: async () => update('ready-operation', 10), publish, createIdempotencyKey: () => 'ready-key' })

    await coordinator.requestPull(10)
    expect(coordinator.abandon()).toBe(true)
    expect(publish).toHaveBeenCalledOnce()
    expect(coordinator.getSnapshot()).toEqual({ phase: 'idle' })
  })

  it('marks a pending presentation abandoned and publishes as soon as its response arrives', async () => {
    const pending = deferred<GachaPullRefreshResult>()
    const publish = vi.fn()
    const coordinator = createGachaPresentationCoordinator({ execute: () => pending.promise, publish, createIdempotencyKey: () => 'pending-key' })

    const pullPromise = coordinator.requestPull(10)
    expect(coordinator.abandon()).toBe(true)
    expect(coordinator.getSnapshot()).toMatchObject({ phase: 'pending', abandoned: true })
    pending.resolve(update('abandoned-operation', 10))

    await pullPromise
    expect(publish).toHaveBeenCalledOnce()
    expect(coordinator.getSnapshot()).toEqual({ phase: 'idle' })
  })

  it('blocks a second Pull after returning to Invocation while the abandoned request is pending', async () => {
    const pending = deferred<GachaPullRefreshResult>()
    const execute = vi.fn(() => pending.promise)
    const publish = vi.fn()
    const coordinator = createGachaPresentationCoordinator({ execute, publish, createIdempotencyKey: () => 'original-key' })

    const original = coordinator.requestPull(10)
    coordinator.abandon()
    expect(() => coordinator.requestPull(10)).toThrowError(ApiError)
    expect(execute).toHaveBeenCalledOnce()

    pending.resolve(update('original-operation', 10))
    await original
    expect(publish).toHaveBeenCalledOnce()
    expect(coordinator.getSnapshot()).toEqual({ phase: 'idle' })
  })

  it('preserves an ambiguous retry key without publishing a failed request', async () => {
    const execute = vi.fn()
      .mockRejectedValueOnce(new ApiError('NETWORK_ERROR', 'offline', null))
      .mockResolvedValueOnce(update('retried-operation', 1))
    const createIdempotencyKey = vi.fn(() => 'stable-key')
    const publish = vi.fn()
    const coordinator = createGachaPresentationCoordinator({ execute, publish, createIdempotencyKey })

    await expect(coordinator.requestPull(1)).rejects.toMatchObject({ code: 'NETWORK_ERROR' })
    await coordinator.requestPull(1)

    expect(execute).toHaveBeenNthCalledWith(1, 1, 'stable-key')
    expect(execute).toHaveBeenNthCalledWith(2, 1, 'stable-key')
    expect(createIdempotencyKey).toHaveBeenCalledOnce()
    expect(publish).not.toHaveBeenCalled()
  })

  it('keeps a successful POST publishable when a secondary Resources refresh failed', async () => {
    const partial = update('partial-operation', 1, ['resources', 'gacha'])
    const publish = vi.fn()
    const coordinator = createGachaPresentationCoordinator({ execute: async () => partial, publish, createIdempotencyKey: () => 'partial-key' })

    await coordinator.requestPull(1)
    coordinator.disclose('partial-operation')

    expect(publish).toHaveBeenCalledWith(expect.objectContaining({
      result: expect.objectContaining({ playerState: expect.objectContaining({ pity5: 12 }) }),
      resources: null,
      gacha: null,
      failedRefreshes: ['resources', 'gacha'],
    }))
  })
})
