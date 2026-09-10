import { describe, expect, it } from 'vitest'
import type { PlayerProgressionDto } from '../api/types'
import { publishProgressionUpdate } from './publish-progression-update'

const progression = (level: number): PlayerProgressionDto => ({
  totalXp: String(level * 30), level, xpIntoCurrentStep: '0', xpPerStep: '30', isMaxLevel: false,
  level100OverflowRewardsClaimed: 0, totalMessages: '0', countedMessages: '0',
})

describe('publishProgressionUpdate', () => {
  it('emits an authoritative level-up independently from the caller screen', () => {
    expect(publishProgressionUpdate(progression(2), progression(3), { id: 'gacha:1' }).feedback).toMatchObject({ id: 'gacha:1', levelsGained: 1 })
  })

  it('keeps administrative progression mutations silent', () => {
    expect(publishProgressionUpdate(progression(2), progression(3), { id: 'moderation:1', emitLevelUpFeedback: false }).feedback).toBeNull()
  })
})
