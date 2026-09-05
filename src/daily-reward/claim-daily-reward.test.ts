import { describe, expect, it, vi } from 'vitest'
import { claimDailyRewardAndRefresh } from './claim-daily-reward'

describe('daily reward frontend flow', () => {
  it('claims first, then returns refreshed resources for immediate display', async () => {
    const calls: string[] = []
    const result = { claimed: true, alreadyClaimed: false, businessDate: '2026-09-05', rewards: { primogems: '160', mainElementParticles: '160', moras: '10000' } } as const
    const resources = { primogems: '160', moras: '10000', particles: { pyro: '0', hydro: '160', cryo: '0', electro: '0', anemo: '0', geo: '0', dendro: '0' } } as const
    const output = await claimDailyRewardAndRefresh({
      claimDailyReward: vi.fn(async () => { calls.push('claim'); return result }),
      getResources: vi.fn(async () => { calls.push('resources'); return resources }),
    })
    expect(calls).toEqual(['claim', 'resources'])
    expect(output).toEqual({ result, resources })
  })

  it('does not request resources when the claim fails', async () => {
    const getResources = vi.fn()
    await expect(claimDailyRewardAndRefresh({ claimDailyReward: async () => { throw new Error('offline') }, getResources })).rejects.toThrow('offline')
    expect(getResources).not.toHaveBeenCalled()
  })
})
