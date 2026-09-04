import { describe, expect, it } from 'vitest'

import type { WheelRewardDto, WheelTodayDto } from '../api/types'
import {
  createWheelUiState,
  canRequestWheelSpin,
  getWheelAnimatedRotation,
  getWheelRestingRotation,
  getWheelSegmentIndex,
  reduceWheelUi,
  wheelSegments,
  wheelTodayFromSpin,
} from './wheel-presentation'

const moraReward: WheelRewardDto = {
  resultType: 'moras',
  resourceKey: 'moras',
  amount: '50000',
}

describe('Wheel presentation', () => {
  it('maps every server reward to the matching visual segment', () => {
    wheelSegments.forEach((segment, index) => {
      const reward: WheelRewardDto = segment.key === 'nothing'
        ? { resultType: 'nothing', resourceKey: null, amount: null }
        : segment.key === 'moras' || segment.key === 'primogems'
          ? { resultType: segment.key, resourceKey: segment.key, amount: '1' }
          : { resultType: 'particles', resourceKey: segment.key, amount: '500' }

      expect(getWheelSegmentIndex(reward)).toBe(index)
    })
  })

  it('finishes the animation with the server segment centered under the pointer', () => {
    const rotation = getWheelAnimatedRotation(47, moraReward)

    expect(rotation).toBeGreaterThan(47 + 4 * 360)
    expect(((rotation % 360) + 360) % 360).toBe(getWheelRestingRotation(moraReward))
  })

  it('reveals the first server result after one request and one animation', () => {
    const unused: WheelTodayDto = { spun: false, businessDate: '2026-09-05', result: null }
    const requesting = reduceWheelUi(createWheelUiState(unused), { type: 'request' })
    const animating = reduceWheelUi(requesting, {
      type: 'serverResult',
      result: moraReward,
      animate: true,
    })
    const finished = reduceWheelUi(animating, { type: 'animationFinished' })

    expect(requesting.phase).toBe('requesting')
    expect(animating).toMatchObject({ phase: 'animating', pendingResult: moraReward })
    expect(finished).toEqual({
      phase: 'idle',
      displayedResult: moraReward,
      pendingResult: null,
    })
  })

  it('restores an already-used Wheel directly from the reload DTO', () => {
    const today = wheelTodayFromSpin({
      businessDate: '2026-09-05',
      ...moraReward,
      alreadySpun: true,
    })

    expect(today).toEqual({
      spun: true,
      businessDate: '2026-09-05',
      result: moraReward,
    })
    expect(createWheelUiState(today).displayedResult).toEqual(moraReward)
    expect(canRequestWheelSpin(today, createWheelUiState(today))).toBe(false)
  })

  it('prevents another frontend request while the first request or animation is active', () => {
    const today: WheelTodayDto = { spun: false, businessDate: '2026-09-05', result: null }
    const initial = createWheelUiState(today)
    const requesting = reduceWheelUi(initial, { type: 'request' })
    const animating = reduceWheelUi(requesting, {
      type: 'serverResult',
      result: moraReward,
      animate: true,
    })

    expect(canRequestWheelSpin(today, initial)).toBe(true)
    expect(canRequestWheelSpin(today, requesting)).toBe(false)
    expect(canRequestWheelSpin(today, animating)).toBe(false)
  })
})
