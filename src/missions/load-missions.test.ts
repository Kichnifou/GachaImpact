import { describe, expect, it, vi } from 'vitest'
import type { PlayerMissionsDto } from '../api/types'
import { createMissionLoader } from './load-missions'

const projection = (catchUpApplied: boolean): PlayerMissionsDto => ({
  catchUpApplied,
  ranks: { B: [], A: [], S: [] },
  z: { status: 'LOCKED' },
})

describe('Mission resource publication', () => {
  it('refreshes Resources exactly once only when the one-shot catch-up applied rewards', async () => {
    const refresh = vi.fn(async () => undefined)
    const load = createMissionLoader(async () => projection(true), refresh)
    await expect(load()).resolves.toEqual(projection(true))
    expect(refresh).toHaveBeenCalledOnce()
  })

  it('does not refresh Resources for a pure projection', async () => {
    const refresh = vi.fn(async () => undefined)
    const load = createMissionLoader(async () => projection(false), refresh)
    await load()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('keeps a failed catch-up resource refresh pending for the next screen retry', async () => {
    const loadMissions = vi.fn<() => Promise<PlayerMissionsDto>>().mockResolvedValueOnce(projection(true)).mockResolvedValueOnce(projection(false))
    const refresh = vi.fn<() => Promise<void>>().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined)
    const load = createMissionLoader(loadMissions, refresh)

    await expect(load()).rejects.toThrow('offline')
    await expect(load()).resolves.toEqual(projection(false))
    expect(refresh).toHaveBeenCalledTimes(2)
  })
})
