import { describe, expect, it } from 'vitest'
import type { WheelRewardDto, WheelTodayDto } from '../api/types'
import { createWheelSegments, createWheelUiState, canRequestWheelSpin, getWheelAnimatedRotation, getWheelRestingRotation, getWheelSegmentIndex, reduceWheelUi, wheelTodayFromSpin, wheelSectorPath } from './wheel-presentation'
import { testWheelProbabilities } from './wheel-test-fixture'
const segments = createWheelSegments(testWheelProbabilities)
const moraReward: WheelRewardDto = { resultType: 'moras', resourceKey: 'moras', amount: '50000' }
describe('Wheel presentation', () => {
  it('represents the supplied 100 percent distribution with exact weighted angles', () => {
    expect(segments[0]!.endAngle - segments[0]!.startAngle).toBeCloseTo(7.2)
    expect(segments[9]!.endAngle).toBeCloseTo(360)
    expect(segments[9]!.endAngle - segments[9]!.startAngle).toBeCloseTo(28.8)
    expect(segments[8]!.endAngle - segments[8]!.startAngle).toBeCloseTo(72)
    expect(segments.reduce((sum, segment) => sum + segment.probabilityPercent, 0)).toBe(100)
    expect(wheelSectorPath(segments[0]!)).toMatch(/^M 200 200 L /)
  })
  it('never invents a distribution when the server projection is missing or invalid', () => {
    expect(createWheelSegments(undefined)).toEqual([])
    expect(createWheelSegments([{ ...testWheelProbabilities[0]!, probabilityPercent: 101 }])).toEqual([])
    expect(createWheelSegments([{ ...testWheelProbabilities[0]!, probabilityPercent: NaN }])).toEqual([])
    expect(createWheelSegments([{ resultType: 'particles', resourceKey: 'particles_unknown', amount: '500', probabilityPercent: 100 }])).toEqual([])
  })
  it.each(testWheelProbabilities)('centers each server reward including its real element: $resourceKey', reward => {
    const index = getWheelSegmentIndex(reward, segments)
    expect(index).toBeGreaterThanOrEqual(0)
    expect(segments[index]!.resourceKey).toBe(reward.resourceKey)
    const rotation = getWheelAnimatedRotation(47, reward, segments)
    expect(rotation).toBeGreaterThan(47 + 4 * 360)
    expect((rotation + segments[index]!.centerAngle) % 360).toBeCloseTo(0)
    expect(((rotation % 360) + 360) % 360).toBeCloseTo(getWheelRestingRotation(reward, segments))
  })
  it('does not map an unknown element onto the no-gain sector', () => {
    expect(getWheelSegmentIndex({ resultType: 'particles', resourceKey: 'particles_unknown', amount: '500' }, segments)).toBe(-1)
    expect(getWheelSegmentIndex({ ...moraReward, amount: '123' }, segments)).toBe(-1)
  })
  it('reveals the committed result after animation or skip without changing it', () => {
    const unused: WheelTodayDto = { spun: false, businessDate: '2026-09-05', result: null }
    const requesting = reduceWheelUi(createWheelUiState(unused), { type: 'request' })
    const animating = reduceWheelUi(requesting, { type: 'serverResult', result: moraReward, animate: true })
    expect(canRequestWheelSpin(unused, requesting)).toBe(false)
    expect(canRequestWheelSpin(unused, animating)).toBe(false)
    expect(reduceWheelUi(animating, { type: 'animationFinished' })).toEqual({ phase: 'idle', displayedResult: moraReward, pendingResult: null })
  })
  it('restores already-used results directly and opens only the server next day', () => {
    const today = wheelTodayFromSpin({ businessDate: '2026-09-05', ...moraReward, alreadySpun: true })
    expect(createWheelUiState(today).displayedResult).toEqual(moraReward)
    expect(canRequestWheelSpin(today, createWheelUiState(today))).toBe(false)
    const nextDay = { spun: false, businessDate: '2026-09-06', result: null }
    expect(canRequestWheelSpin(nextDay, createWheelUiState(nextDay))).toBe(true)
  })
  it('keeps the server probability projection when applying a confirmed spin to bootstrap', () => {
    const next = wheelTodayFromSpin({ ...moraReward, businessDate: '2026-10-11', alreadySpun: false }, testWheelProbabilities)
    expect(next.probabilities).toBe(testWheelProbabilities)
    expect(createWheelSegments(next.probabilities)).toHaveLength(10)
  })
})
