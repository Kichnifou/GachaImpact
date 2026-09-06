import { describe, expect, it } from 'vitest'
import { fiveStarChanceBasisPoints, fiveStarProbabilityRows, fourStarChanceBasisPoints } from './probabilities'

describe('Gacha probability presentation', () => {
  it('matches the server domain thresholds and generates the soft-pity rows', () => {
    expect([fiveStarChanceBasisPoints(1), fiveStarChanceBasisPoints(73), fiveStarChanceBasisPoints(74), fiveStarChanceBasisPoints(75), fiveStarChanceBasisPoints(90)]).toEqual([60, 60, 660, 1260, 10000])
    expect([fourStarChanceBasisPoints(1), fourStarChanceBasisPoints(8), fourStarChanceBasisPoints(9), fourStarChanceBasisPoints(10)]).toEqual([150, 150, 1950, 10000])
    expect(fiveStarProbabilityRows.at(-1)).toEqual({ pity: '90', chance: 10000 })
  })
})
