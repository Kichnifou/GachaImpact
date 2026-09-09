import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/game-api'
import type { GachaPullDto, PlayerResourcesDto } from '../api/types'
import type { GachaPullRefreshResult } from './perform-gacha-pull'
import {
  abandonGachaPresentationBeforeSignOut,
  applyGachaPrimogemCostPreview,
  createGachaPresentationCoordinator,
  type GachaPrimogemCostPreview,
} from './gacha-presentation-coordinator'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function update(
  id: string,
  count: 1 | 10,
  finalPrimogems = count === 1 ? '9840' : '8400',
  failedRefreshes: GachaPullRefreshResult['failedRefreshes'] = [],
): GachaPullRefreshResult {
  return {
    result: {
      operation: { id, pullCount: count, primogemCost: count === 1 ? '160' : '1600', createdAt: '2026-09-07T12:00:00Z', alreadyProcessed: false },
      results: [],
      playerState: { pity5: 12, pity4: 2, guaranteedFeatured5: true, captureProgress: 1, fiftyFiftyLostStreak: 1, selectedBannerCharacterId: 'target', totalPulls: '12', totalFiveStars: '1', totalFourStars: '2', fiftyFiftyWon: '0', fiftyFiftyLost: '1', capturesTriggered: '0' },
    },
    resources: failedRefreshes.includes('resources') ? null : { primogems: finalPrimogems, moras: '10000', particles: { pyro: '0', hydro: '0', cryo: '0', electro: '0', anemo: '0', geo: '0', dendro: '0' } },
    gacha: null,
    progression: failedRefreshes.includes('progression') ? null : {
      totalXp: '30', level: 1, xpIntoCurrentStep: '0', xpPerStep: '30', isMaxLevel: false,
      level100OverflowRewardsClaimed: 0, totalMessages: '0', countedMessages: '0',
    },
    failedRefreshes,
  }
}

const resolveExecution = (result: GachaPullRefreshResult) => (
  _count: 1 | 10,
  _key: string,
  onPullSucceeded: (pull: GachaPullDto) => void,
) => {
  onPullSucceeded(result.result)
  return Promise.resolve(result)
}

describe('Gacha presentation coordinator', () => {
  it('shows only the authoritative x1 cost before publishing the final state on close', async () => {
    const refreshed = update('x1-operation', 1)
    const publish = vi.fn()
    const preview = vi.fn()
    const clearPreview = vi.fn()
    const coordinator = createGachaPresentationCoordinator({
      execute: resolveExecution(refreshed),
      publish,
      createIdempotencyKey: () => 'x1-key',
      onPrimogemCostPreview: preview,
      onPrimogemCostPreviewCleared: clearPreview,
    })
    coordinator.setSession('player-a')

    await coordinator.requestPull(1, '10000')

    expect(preview).toHaveBeenLastCalledWith({ sessionId: 'player-a', primogemsBefore: '10000', primogemCost: '160', visiblePrimogems: '9840' })
    expect(coordinator.getSnapshot().phase).toBe('ready')
    expect(publish).not.toHaveBeenCalled()

    expect(coordinator.disclose('x1-operation')).toBe(true)
    expect(clearPreview).toHaveBeenLastCalledWith('player-a')
    expect(publish).toHaveBeenCalledWith(refreshed)
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({ progression: expect.objectContaining({ totalXp: '30', level: 1 }) }))
  })

  it('shows only the x10 cost through intro and reveal, then publishes at summary', async () => {
    const refreshed = update('x10-operation', 10)
    const publish = vi.fn()
    const preview = vi.fn()
    const coordinator = createGachaPresentationCoordinator({
      execute: resolveExecution(refreshed),
      publish,
      createIdempotencyKey: () => 'x10-key',
      onPrimogemCostPreview: preview,
    })
    coordinator.setSession('player-a')

    await coordinator.requestPull(10, '10000')

    expect(preview).toHaveBeenLastCalledWith(expect.objectContaining({ visiblePrimogems: '8400' }))
    expect(publish).not.toHaveBeenCalled()
    expect(coordinator.getSnapshot().phase).toBe('ready')

    expect(coordinator.disclose('x10-operation')).toBe(true)
    expect(publish).toHaveBeenCalledWith(refreshed)
  })

  it('hides a C6 refund until disclosure instead of previewing the final Primogem balance', async () => {
    const refunded = update('refund-operation', 10, '8480')
    let costPreview: GachaPrimogemCostPreview | null = null
    const publish = vi.fn()
    const coordinator = createGachaPresentationCoordinator({
      execute: resolveExecution(refunded),
      publish,
      createIdempotencyKey: () => 'refund-key',
      onPrimogemCostPreview: (preview) => { costPreview = preview },
    })
    coordinator.setSession('player-a')

    await coordinator.requestPull(10, '10000')

    const before: PlayerResourcesDto = { primogems: '10000', moras: '777', particles: { pyro: '1', hydro: '2', cryo: '3', electro: '4', anemo: '5', geo: '6', dendro: '7' } }
    expect(applyGachaPrimogemCostPreview(before, costPreview, 'player-a')).toEqual({ ...before, primogems: '8400' })
    expect(applyGachaPrimogemCostPreview(before, costPreview, 'player-b')).toBe(before)
    expect(publish).not.toHaveBeenCalled()

    coordinator.disclose('refund-operation')
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({ resources: expect.objectContaining({ primogems: '8480' }) }))
  })

  it('does not change the Primogem preview when the Pull POST fails', async () => {
    const error = new ApiError('INSUFFICIENT_PRIMOGEMS', 'not enough', 409)
    const preview = vi.fn()
    const publish = vi.fn()
    const coordinator = createGachaPresentationCoordinator({
      execute: async () => { throw error },
      publish,
      createIdempotencyKey: () => 'failed-key',
      onPrimogemCostPreview: preview,
    })
    coordinator.setSession('player-a')

    await expect(coordinator.requestPull(1, '10000')).rejects.toBe(error)

    expect(preview).not.toHaveBeenCalled()
    expect(publish).not.toHaveBeenCalled()
    expect(coordinator.getSnapshot()).toEqual({ phase: 'idle' })
  })

  it('publishes immediately when navigation abandons a result that is already ready', async () => {
    const refreshed = update('ready-operation', 10)
    const publish = vi.fn()
    const coordinator = createGachaPresentationCoordinator({ execute: resolveExecution(refreshed), publish, createIdempotencyKey: () => 'ready-key' })

    await coordinator.requestPull(10, '10000')
    expect(coordinator.abandon()).toBe(true)
    expect(publish).toHaveBeenCalledWith(refreshed)
    expect(coordinator.getSnapshot()).toEqual({ phase: 'idle' })
  })

  it('publishes a pending navigation result as soon as its response arrives', async () => {
    const pending = deferred<GachaPullRefreshResult>()
    const publish = vi.fn()
    const coordinator = createGachaPresentationCoordinator({ execute: () => pending.promise, publish, createIdempotencyKey: () => 'pending-key' })

    const pullPromise = coordinator.requestPull(10, '10000')
    expect(coordinator.abandon()).toBe(true)
    expect(() => coordinator.requestPull(10, '10000')).toThrowError(ApiError)
    pending.resolve(update('abandoned-operation', 10))

    await pullPromise
    expect(publish).toHaveBeenCalledOnce()
    expect(coordinator.getSnapshot()).toEqual({ phase: 'idle' })
  })

  it('keeps the same player locked through logout and login until the original Pull resolves', async () => {
    const pending = deferred<GachaPullRefreshResult>()
    const onPendingCountChange = vi.fn()
    const publish = vi.fn()
    const coordinator = createGachaPresentationCoordinator({ execute: () => pending.promise, publish, createIdempotencyKey: () => 'player-a-key', onPendingCountChange })
    coordinator.setSession('player-a')
    const pullPromise = coordinator.requestPull(10, '10000')
    const signOut = vi.fn(async () => undefined)

    await abandonGachaPresentationBeforeSignOut(coordinator, signOut)
    expect(coordinator.getSnapshot()).toEqual({ phase: 'idle' })

    coordinator.setSession('player-a')
    expect(coordinator.getSnapshot()).toMatchObject({ phase: 'pending', abandoned: true })
    expect(() => coordinator.requestPull(1, '10000')).toThrowError(ApiError)
    expect(onPendingCountChange).toHaveBeenCalledWith(10, 'player-a')

    pending.resolve(update('player-a-operation', 10))
    await pullPromise

    expect(publish).toHaveBeenCalledOnce()
    expect(coordinator.getSnapshot()).toEqual({ phase: 'idle' })
  })

  it('does not block another player or publish the first player late response into their session', async () => {
    const playerAPending = deferred<GachaPullRefreshResult>()
    const playerBPending = deferred<GachaPullRefreshResult>()
    const publish = vi.fn()
    const execute = vi.fn()
      .mockImplementationOnce(() => playerAPending.promise)
      .mockImplementationOnce(() => playerBPending.promise)
    const createIdempotencyKey = vi.fn()
      .mockReturnValueOnce('player-a-key')
      .mockReturnValueOnce('player-b-key')
    const coordinator = createGachaPresentationCoordinator({ execute, publish, createIdempotencyKey })

    coordinator.setSession('player-a')
    const playerAPull = coordinator.requestPull(10, '10000')
    coordinator.abandon()
    coordinator.setSession(null)
    coordinator.setSession('player-b')

    const playerBPull = coordinator.requestPull(1, '5000')
    expect(execute).toHaveBeenNthCalledWith(2, 1, 'player-b-key', expect.any(Function))

    playerAPending.resolve(update('late-player-a-operation', 10))
    await playerAPull
    expect(publish).not.toHaveBeenCalled()
    expect(coordinator.getSnapshot()).toMatchObject({ phase: 'pending', intent: { key: 'player-b-key' } })

    playerBPending.resolve(update('player-b-operation', 1, '4840'))
    await playerBPull
    coordinator.disclose('player-b-operation')
    expect(publish).toHaveBeenCalledOnce()
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({ result: expect.objectContaining({ operation: expect.objectContaining({ id: 'player-b-operation' }) }) }))
  })

  it('restores the same player pending cost preview when they return before refresh completion', async () => {
    const refreshPending = deferred<GachaPullRefreshResult>()
    let confirmPull!: (pull: GachaPullDto) => void
    const preview = vi.fn()
    const coordinator = createGachaPresentationCoordinator({
      execute: (_count, _key, onPullSucceeded) => { confirmPull = onPullSucceeded; return refreshPending.promise },
      publish: vi.fn(),
      createIdempotencyKey: () => 'return-key',
      onPrimogemCostPreview: preview,
    })
    coordinator.setSession('player-a')
    const pullPromise = coordinator.requestPull(10, '10000')
    coordinator.abandon()
    coordinator.setSession(null)

    confirmPull(update('return-operation', 10).result)
    expect(preview).not.toHaveBeenCalled()

    coordinator.setSession('player-a')
    expect(preview).toHaveBeenLastCalledWith(expect.objectContaining({ sessionId: 'player-a', visiblePrimogems: '8400' }))
    expect(coordinator.getSnapshot()).toMatchObject({ phase: 'pending' })

    refreshPending.resolve(update('return-operation', 10))
    await pullPromise
    expect(coordinator.getSnapshot()).toEqual({ phase: 'idle' })
  })

  it('publishes a ready presentation and frees it before sign-out', async () => {
    const refreshed = update('ready-sign-out-operation', 1)
    const publish = vi.fn()
    const coordinator = createGachaPresentationCoordinator({ execute: resolveExecution(refreshed), publish, createIdempotencyKey: () => 'sign-out-ready-key' })
    coordinator.setSession('player-a')
    const signOut = vi.fn(async () => {
      expect(coordinator.getSnapshot()).toEqual({ phase: 'idle' })
    })

    await coordinator.requestPull(1, '10000')
    await abandonGachaPresentationBeforeSignOut(coordinator, signOut)

    expect(publish).toHaveBeenCalledOnce()
    expect(signOut).toHaveBeenCalledOnce()
  })

  it('preserves an ambiguous retry key per player without blocking a different player', async () => {
    const execute = vi.fn()
      .mockRejectedValueOnce(new ApiError('NETWORK_ERROR', 'offline', null))
      .mockResolvedValueOnce(update('player-b-operation', 10))
      .mockResolvedValueOnce(update('retried-operation', 1))
    const createIdempotencyKey = vi.fn()
      .mockReturnValueOnce('player-a-stable-key')
      .mockReturnValueOnce('player-b-key')
    const coordinator = createGachaPresentationCoordinator({ execute, publish: vi.fn(), createIdempotencyKey })

    coordinator.setSession('player-a')
    await expect(coordinator.requestPull(1, '10000')).rejects.toMatchObject({ code: 'NETWORK_ERROR' })
    coordinator.setSession('player-b')
    await coordinator.requestPull(10, '10000')
    coordinator.disclose('player-b-operation')
    coordinator.setSession('player-a')
    await coordinator.requestPull(1, '10000')

    expect(execute).toHaveBeenNthCalledWith(1, 1, 'player-a-stable-key', expect.any(Function))
    expect(execute).toHaveBeenNthCalledWith(2, 10, 'player-b-key', expect.any(Function))
    expect(execute).toHaveBeenNthCalledWith(3, 1, 'player-a-stable-key', expect.any(Function))
    expect(createIdempotencyKey).toHaveBeenCalledTimes(2)
  })

  it('keeps a successful POST publishable when secondary refreshes fail', async () => {
    const partial = update('partial-operation', 1, '9840', ['resources', 'gacha'])
    const publish = vi.fn()
    const coordinator = createGachaPresentationCoordinator({ execute: resolveExecution(partial), publish, createIdempotencyKey: () => 'partial-key' })

    await coordinator.requestPull(1, '10000')
    coordinator.disclose('partial-operation')

    expect(publish).toHaveBeenCalledWith(expect.objectContaining({
      result: expect.objectContaining({ playerState: expect.objectContaining({ pity5: 12 }) }),
      resources: null,
      gacha: null,
      failedRefreshes: ['resources', 'gacha'],
    }))
  })
})
