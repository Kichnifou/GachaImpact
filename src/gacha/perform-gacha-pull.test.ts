import { describe, expect, it, vi } from 'vitest'
import { ApiError, type GameApiClient } from '../api/game-api'
import {
  performGachaPullAndRefresh,
  selectGachaPullIntent,
  settleGachaPullIntent,
  shouldPreserveGachaPullIntent,
  type GachaPullIntent,
} from './perform-gacha-pull'

describe('performGachaPullAndRefresh', () => {
  it('returns the authoritative pull after successful Resources and Gacha refreshes', async () => {
    const order: string[] = []
    const pullGacha = vi.fn(async () => { order.push('pull'); return { operation: { id: 'op' }, results: [], playerState: { pity5: 0 } } })
    const api = {
      pullGacha,
      getResources: vi.fn(async () => { order.push('resources'); return { primogems: '0' } }),
      getCurrentGacha: vi.fn(async () => { order.push('gacha'); return { playerState: { pity5: 1 } } }),
    } as unknown as GameApiClient
    const onPullSucceeded = vi.fn(() => { order.push('confirmed') })
    const result = await performGachaPullAndRefresh(api, 1, 'intent', onPullSucceeded)
    expect(order[0]).toBe('pull')
    expect(order[1]).toBe('confirmed')
    expect(new Set(order.slice(2))).toEqual(new Set(['resources', 'gacha']))
    expect(pullGacha).toHaveBeenCalledOnce()
    expect(pullGacha).toHaveBeenCalledWith(1, 'intent')
    expect(onPullSucceeded).toHaveBeenCalledOnce()
    expect(result).toMatchObject({ result: { operation: { id: 'op' } }, resources: { primogems: '0' }, gacha: { playerState: { pity5: 1 } }, failedRefreshes: [] })
  })

  it('keeps the successful Pull result when the Resources refresh fails', async () => {
    const pullGacha = vi.fn(async () => ({ operation: { id: 'op' }, results: [{ index: 1 }], playerState: { pity5: 0 } }))
    const api = {
      pullGacha,
      getResources: vi.fn(async () => { throw new Error('resources unavailable') }),
      getCurrentGacha: vi.fn(async () => ({ playerState: { pity5: 1 } })),
    } as unknown as GameApiClient
    const result = await performGachaPullAndRefresh(api, 1, 'intent')
    expect(result).toMatchObject({ result: { operation: { id: 'op' }, results: [{ index: 1 }] }, resources: null, gacha: { playerState: { pity5: 1 } }, failedRefreshes: ['resources'] })
    expect(pullGacha).toHaveBeenCalledOnce()
  })

  it('keeps the successful Pull and its server playerState when the Gacha refresh fails', async () => {
    const pullGacha = vi.fn(async () => ({ operation: { id: 'op' }, results: [{ index: 1 }], playerState: { pity5: 12 } }))
    const api = {
      pullGacha,
      getResources: vi.fn(async () => ({ primogems: '840' })),
      getCurrentGacha: vi.fn(async () => { throw new Error('gacha unavailable') }),
    } as unknown as GameApiClient
    const result = await performGachaPullAndRefresh(api, 1, 'intent')
    expect(result).toMatchObject({ result: { operation: { id: 'op' }, playerState: { pity5: 12 } }, resources: { primogems: '840' }, gacha: null, failedRefreshes: ['gacha'] })
    expect(pullGacha).toHaveBeenCalledOnce()
  })

  it.each([
    ['NETWORK_ERROR', 'offline', null],
    ['INTERNAL_ERROR', 'unknown outcome', 500],
    ['HTTP_502', 'gateway failure', 502],
  ])('preserves the same intention when the Pull POST outcome remains ambiguous: %s', async (code, message, status) => {
    const error = new ApiError(code, message, status)
    const pullGacha = vi.fn(async () => { throw error })
    const getResources = vi.fn()
    const getCurrentGacha = vi.fn()
    const onPullSucceeded = vi.fn()
    const api = { pullGacha, getResources, getCurrentGacha } as unknown as GameApiClient
    await expect(performGachaPullAndRefresh(api, 1, 'intent', onPullSucceeded)).rejects.toBe(error)
    expect(shouldPreserveGachaPullIntent(error)).toBe(true)
    expect(pullGacha).toHaveBeenCalledOnce()
    expect(getResources).not.toHaveBeenCalled()
    expect(getCurrentGacha).not.toHaveBeenCalled()
    expect(onPullSucceeded).not.toHaveBeenCalled()
  })

  it.each([
    ['INSUFFICIENT_PRIMOGEMS', 409],
    ['GACHA_TARGET_REQUIRED', 409],
    ['GACHA_TARGET_INVALID', 422],
    ['GACHA_BANNER_UNAVAILABLE', 503],
    ['GACHA_BANNER_INVALID', 409],
  ])('releases the intention after definitive Pull POST business error %s', async (code, status) => {
    const error = new ApiError(code, 'definitive failure', status)
    const pullGacha = vi.fn(async () => { throw error })
    const getResources = vi.fn()
    const getCurrentGacha = vi.fn()
    const api = { pullGacha, getResources, getCurrentGacha } as unknown as GameApiClient
    await expect(performGachaPullAndRefresh(api, 1, 'intent')).rejects.toBe(error)
    expect(shouldPreserveGachaPullIntent(error)).toBe(false)
    expect(pullGacha).toHaveBeenCalledOnce()
    expect(getResources).not.toHaveBeenCalled()
    expect(getCurrentGacha).not.toHaveBeenCalled()
  })
})

describe('Gacha Pull retry intention', () => {
  const readyIntent = (selection: ReturnType<typeof selectGachaPullIntent>): GachaPullIntent => {
    expect(selection.status).toBe('ready')
    return selection.intent
  }

  it('retries an ambiguous x1 with the same key and blocks x10 without a POST or a new key', () => {
    const createKey = vi.fn(() => 'key-x1')
    const post = vi.fn()
    const firstIntent = readyIntent(selectGachaPullIntent(null, 1, createKey))
    post(firstIntent.count, firstIntent.key)
    const activeIntent = settleGachaPullIntent(firstIntent, { status: 'failure', error: new ApiError('NETWORK_ERROR', 'offline', null) })
    const retryIntent = readyIntent(selectGachaPullIntent(activeIntent, 1, createKey))
    post(retryIntent.count, retryIntent.key)
    const blocked = selectGachaPullIntent(activeIntent, 10, createKey)
    if (blocked.status === 'ready') post(blocked.intent.count, blocked.intent.key)

    expect(retryIntent).toBe(firstIntent)
    expect(blocked).toEqual({ status: 'blocked', intent: firstIntent })
    expect(createKey).toHaveBeenCalledOnce()
    expect(post).toHaveBeenCalledTimes(2)
    expect(post).not.toHaveBeenCalledWith(10, expect.any(String))
  })

  it('blocks x1 while an ambiguous x10 remains active', () => {
    const createKey = vi.fn(() => 'key-x10')
    const post = vi.fn()
    const firstIntent = readyIntent(selectGachaPullIntent(null, 10, createKey))
    post(firstIntent.count, firstIntent.key)
    const activeIntent = settleGachaPullIntent(firstIntent, { status: 'failure', error: new ApiError('HTTP_503', 'unavailable', 503) })
    const blocked = selectGachaPullIntent(activeIntent, 1, createKey)
    if (blocked.status === 'ready') post(blocked.intent.count, blocked.intent.key)

    expect(blocked).toEqual({ status: 'blocked', intent: firstIntent })
    expect(createKey).toHaveBeenCalledOnce()
    expect(post).toHaveBeenCalledOnce()
  })

  it('releases an x1 intention after a definitive business error and allows a new x10 key', () => {
    const createKey = vi.fn()
      .mockReturnValueOnce('key-x1')
      .mockReturnValueOnce('key-x10')
    const firstIntent = readyIntent(selectGachaPullIntent(null, 1, createKey))
    const activeIntent = settleGachaPullIntent(firstIntent, { status: 'failure', error: new ApiError('INSUFFICIENT_PRIMOGEMS', 'not enough', 409) })
    const nextIntent = readyIntent(selectGachaPullIntent(activeIntent, 10, createKey))

    expect(activeIntent).toBeNull()
    expect(nextIntent).toEqual({ count: 10, key: 'key-x10' })
    expect(createKey).toHaveBeenCalledTimes(2)
  })

  it('releases a successful x1 intention and allows a new x10 key', () => {
    const createKey = vi.fn()
      .mockReturnValueOnce('key-x1')
      .mockReturnValueOnce('key-x10')
    const completedIntent = readyIntent(selectGachaPullIntent(null, 1, createKey))
    const activeIntent = settleGachaPullIntent(completedIntent, { status: 'success' })
    const nextIntent = readyIntent(selectGachaPullIntent(activeIntent, 10, createKey))

    expect(completedIntent).toEqual({ count: 1, key: 'key-x1' })
    expect(nextIntent).toEqual({ count: 10, key: 'key-x10' })
    expect(createKey).toHaveBeenCalledTimes(2)
  })
})
