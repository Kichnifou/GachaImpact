import { describe, expect, it } from 'vitest'

import type { ExpeditionDto } from '../api/types'
import { createExpeditionClientSnapshot, expeditionRemainingSeconds } from './expedition-client-snapshot'

const running: ExpeditionDto = {
  businessDate: '2040-01-01', operationalStatus: 'RUNNING', departureUsedToday: true, canStartToday: false,
  activeCharacter: null, departedAt: '2040-01-01T00:00:00Z', readyAt: '2040-01-01T20:00:00Z',
  remainingSeconds: 71_420, startedOnCurrentBusinessDate: true, totalCompleted: '0',
}

describe('Expedition client snapshot', () => {
  it('derives elapsed seconds from the shared monotonic anchor and never below zero', () => {
    const snapshot = createExpeditionClientSnapshot(running, 500)
    expect(expeditionRemainingSeconds(snapshot, 5_500)).toBe(71_415)
    expect(expeditionRemainingSeconds(snapshot, 100)).toBe(71_420)
    expect(expeditionRemainingSeconds(snapshot, 100_000_000)).toBe(0)
  })

  it('reanchors a fresh server projection independently of the previous snapshot', () => {
    const previous = createExpeditionClientSnapshot(running, 500)
    const fresh = createExpeditionClientSnapshot({ ...running, remainingSeconds: 71_390 }, 5_500)
    expect(expeditionRemainingSeconds(previous, 5_500)).toBe(71_415)
    expect(expeditionRemainingSeconds(fresh, 5_500)).toBe(71_390)
  })
})
