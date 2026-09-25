import { describe, expect, it } from 'vitest'
import type { PermanentMissionDto, PermanentMissionProjectionDto } from '../api/types'
import { orderMissionCards, preferredMissionRank } from './mission-presentation'

const item = (rank: 'B' | 'A' | 'S' | 'Z', key: string, status: PermanentMissionDto['status']): PermanentMissionDto => ({
  externalKey: key, rank, displayName: key, description: key, progressLabel: key,
  progress: '0', target: '1', status, rewardPrimogems: '1', completedAt: null,
})
const rank = (name: 'B' | 'A' | 'S', statuses: PermanentMissionDto['status'][]) => statuses.map((status, index) => item(name, `${name}${index}`, status))
const view = (b: PermanentMissionDto['status'][], a: PermanentMissionDto['status'][], s: PermanentMissionDto['status'][], zStatus: 'LOCKED' | 'ACTIVE' | 'COMPLETED' = 'LOCKED'): PermanentMissionProjectionDto => ({
  ranks: { B: rank('B', b), A: rank('A', a), S: rank('S', s) },
  z: zStatus === 'LOCKED' ? { status: 'LOCKED' } : { status: zStatus, unlockedAt: '2026-09-25T00:00:00.000Z', missions: [item('Z', 'Z0', zStatus)] },
})

describe('mission presentation', () => {
  it.each([
    [view(['ACTIVE'], ['LOCKED'], ['LOCKED']), 'B'],
    [view(['COMPLETED'], ['ACTIVE'], ['LOCKED']), 'A'],
    [view(['COMPLETED'], ['COMPLETED'], ['LOCKED']), 'S'],
    [view(['COMPLETED'], ['COMPLETED'], ['COMPLETED']), 'Z'],
    [view(['COMPLETED'], ['COMPLETED'], ['COMPLETED'], 'COMPLETED'), 'Z'],
  ] as const)('selects the first incomplete rank from server statuses', (projection, expected) => {
    expect(preferredMissionRank(projection)).toBe(expected)
  })

  it('stably partitions ACTIVE and LOCKED before COMPLETED', () => {
    const missions = ['done-1', 'active-1', 'locked-1', 'done-2', 'active-2'].map((key, index) =>
      item('B', key, index === 0 || index === 3 ? 'COMPLETED' : index === 2 ? 'LOCKED' : 'ACTIVE'))
    expect(orderMissionCards(missions).map(mission => mission.externalKey)).toEqual(['active-1', 'locked-1', 'active-2', 'done-1', 'done-2'])
  })
})
