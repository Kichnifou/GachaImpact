import { describe, expect, it, vi } from 'vitest'
import { ApiError, type GameApiClient } from '../api/game-api'
import { performGachaPullAndRefresh, shouldPreserveGachaPullIntent } from './perform-gacha-pull'

describe('performGachaPullAndRefresh', () => {
  it('waits for the authoritative pull then reloads resources and Gacha state', async () => {
    const order: string[] = []
    const api = {
      pullGacha: vi.fn(async () => { order.push('pull'); return { operation: { id: 'op' }, results: [], playerState: {} } }),
      getResources: vi.fn(async () => { order.push('resources'); return { primogems: '0' } }),
      getCurrentGacha: vi.fn(async () => { order.push('gacha'); return { playerState: { pity5: 1 } } }),
    } as unknown as GameApiClient
    const result = await performGachaPullAndRefresh(api, 1, 'intent')
    expect(order[0]).toBe('pull')
    expect(new Set(order.slice(1))).toEqual(new Set(['resources', 'gacha']))
    expect(api.pullGacha).toHaveBeenCalledWith(1, 'intent')
    expect(result).toMatchObject({ resources: { primogems: '0' }, gacha: { playerState: { pity5: 1 } } })
  })

  it('preserves an intention only for an ambiguous transport or server failure', () => {
    expect(shouldPreserveGachaPullIntent(new ApiError('NETWORK_ERROR', 'offline', null))).toBe(true)
    expect(shouldPreserveGachaPullIntent(new ApiError('INTERNAL_ERROR', 'unknown outcome', 500))).toBe(true)
    expect(shouldPreserveGachaPullIntent(new ApiError('HTTP_502', 'gateway failure', 502))).toBe(true)
    expect(shouldPreserveGachaPullIntent(new Error('local failure'))).toBe(false)
  })

  it.each([
    ['INSUFFICIENT_PRIMOGEMS', 409],
    ['GACHA_TARGET_REQUIRED', 409],
    ['GACHA_TARGET_INVALID', 422],
    ['GACHA_BANNER_UNAVAILABLE', 503],
    ['GACHA_BANNER_INVALID', 409],
  ])('releases the intention after definitive business error %s', (code, status) => {
    expect(shouldPreserveGachaPullIntent(new ApiError(code, 'definitive failure', status))).toBe(false)
  })
})
