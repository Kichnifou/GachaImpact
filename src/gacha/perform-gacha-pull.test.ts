import { describe, expect, it, vi } from 'vitest'
import { ApiError, type GameApiClient } from '../api/game-api'
import { performGachaPullAndRefresh, shouldPreserveGachaPullIntent } from './perform-gacha-pull'

describe('performGachaPullAndRefresh', () => {
  it('returns the authoritative pull after successful Resources and Gacha refreshes', async () => {
    const order: string[] = []
    const pullGacha = vi.fn(async () => { order.push('pull'); return { operation: { id: 'op' }, results: [], playerState: { pity5: 0 } } })
    const api = {
      pullGacha,
      getResources: vi.fn(async () => { order.push('resources'); return { primogems: '0' } }),
      getCurrentGacha: vi.fn(async () => { order.push('gacha'); return { playerState: { pity5: 1 } } }),
    } as unknown as GameApiClient
    const result = await performGachaPullAndRefresh(api, 1, 'intent')
    expect(order[0]).toBe('pull')
    expect(new Set(order.slice(1))).toEqual(new Set(['resources', 'gacha']))
    expect(pullGacha).toHaveBeenCalledOnce()
    expect(pullGacha).toHaveBeenCalledWith(1, 'intent')
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
    const api = { pullGacha, getResources, getCurrentGacha } as unknown as GameApiClient
    await expect(performGachaPullAndRefresh(api, 1, 'intent')).rejects.toBe(error)
    expect(shouldPreserveGachaPullIntent(error)).toBe(true)
    expect(pullGacha).toHaveBeenCalledOnce()
    expect(getResources).not.toHaveBeenCalled()
    expect(getCurrentGacha).not.toHaveBeenCalled()
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
