import { describe, expect, it } from 'vitest'

import type { PlayerProgressionDto } from '../api/types'
import { getProgressionPercent } from './presentation'

function progression(xpIntoCurrentStep: string, level = 0): PlayerProgressionDto {
  return {
    totalXp: xpIntoCurrentStep,
    level,
    xpIntoCurrentStep,
    xpPerStep: '30',
    isMaxLevel: level === 100,
    level100OverflowRewardsClaimed: 0,
    totalMessages: '0',
    countedMessages: '0',
  }
}

describe('Player progression presentation', () => {
  it.each([
    ['0', 0],
    ['15', 50],
    ['29', 29 / 30 * 100],
  ])('turns %s XP in the current step into a dynamic percentage', (xp, percent) => {
    expect(getProgressionPercent(progression(xp))).toBeCloseTo(percent)
  })

  it('uses the server-provided overflow cycle at level 100', () => {
    expect(getProgressionPercent(progression('15', 100))).toBe(50)
  })
})
