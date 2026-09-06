import { describe, expect, it } from 'vitest'
import type { GachaPullDto, GachaPullResultItemDto } from '../api/types'
import { acquirePullLock, idleInvocationSequence, invocationSequenceReducer } from './invocation-sequence'

const state = { pity5: 0, pity4: 0, guaranteedFeatured5: false, captureProgress: 0, fiftyFiftyLostStreak: 0, selectedBannerCharacterId: 'target', totalPulls: '10', totalFiveStars: '1', totalFourStars: '1', fiftyFiftyWon: '1', fiftyFiftyLost: '0', capturesTriggered: '0' }
const resource = (index: number, resourceKey = 'moras'): GachaPullResultItemDto => ({ index, resultType: 'resource', character: null, rarity: null, resourceKey, resourceAmount: '5000', wasNewCharacter: null, constellationAfter: null, copiesAfter: null, wasFiftyFifty: false, wonFiftyFifty: null, guaranteeConsumed: false, captureTriggered: false, bonusRewards: [], c6Progression: null })
const pull = (count: 1 | 10, results: readonly GachaPullResultItemDto[]): GachaPullDto => ({ operation: { id: 'op', pullCount: count, primogemCost: count === 1 ? '160' : '1600', createdAt: '2026-09-06T12:00:00Z', alreadyProcessed: false }, results, playerState: state })

describe('Invocation sequence state machine', () => {
  it('runs x1 through submitting, intro, one reveal and close without changing its intent', () => {
    const key = 'intent-x1'
    const submitting = invocationSequenceReducer(idleInvocationSequence, { type: 'submit', count: 1, idempotencyKey: key })
    expect(submitting).toEqual({ phase: 'submitting', count: 1, idempotencyKey: key })
    const intro = invocationSequenceReducer(submitting, { type: 'resolved', pull: pull(1, [resource(1)]) })
    expect(intro).toMatchObject({ phase: 'intro', bestRarity: 3, idempotencyKey: key })
    const reveal = invocationSequenceReducer(intro, { type: 'advance' })
    expect(reveal).toMatchObject({ phase: 'reveal', resultIndex: 0, idempotencyKey: key })
    expect(invocationSequenceReducer(reveal, { type: 'advance' })).toBe(reveal)
    expect(invocationSequenceReducer(reveal, { type: 'close' })).toEqual({ phase: 'idle' })
  })

  it('reveals x10 in server order, then enters summary on the click after result ten', () => {
    const results = Array.from({ length: 10 }, (_, index) => resource(index + 1))
    let sequence = invocationSequenceReducer(idleInvocationSequence, { type: 'submit', count: 10, idempotencyKey: 'intent-x10' })
    sequence = invocationSequenceReducer(sequence, { type: 'resolved', pull: pull(10, results) })
    sequence = invocationSequenceReducer(sequence, { type: 'advance' })
    for (let index = 0; index < 10; index += 1) {
      expect(sequence).toMatchObject({ phase: 'reveal', resultIndex: index })
      if (sequence.phase === 'reveal') expect(sequence.pull.results[sequence.resultIndex]?.index).toBe(index + 1)
      sequence = invocationSequenceReducer(sequence, { type: 'advance' })
    }
    expect(sequence).toMatchObject({ phase: 'summary', idempotencyKey: 'intent-x10' })
    expect(invocationSequenceReducer(sequence, { type: 'close' })).toEqual({ phase: 'idle' })
  })

  it('skips intro or reveal to the same persisted x10 summary without a new intention', () => {
    const results = Array.from({ length: 10 }, (_, index) => resource(index + 1))
    const submitting = invocationSequenceReducer(idleInvocationSequence, { type: 'submit', count: 10, idempotencyKey: 'same-key' })
    const intro = invocationSequenceReducer(submitting, { type: 'resolved', pull: pull(10, results) })
    expect(invocationSequenceReducer(intro, { type: 'skip' })).toMatchObject({ phase: 'summary', idempotencyKey: 'same-key', pull: { operation: { id: 'op' } } })
    const reveal = invocationSequenceReducer(intro, { type: 'advance' })
    expect(invocationSequenceReducer(reveal, { type: 'skip' })).toMatchObject({ phase: 'summary', idempotencyKey: 'same-key', pull: { operation: { id: 'op' } } })
  })

  it('announces the best persisted rarity and rejects a second synchronous pull lock', () => {
    const fiveStar = { ...resource(8), resultType: 'character' as const, character: { id: 'c', externalKey: 'c', name: 'Arlecchino', rarity: 5 as const, elementKey: 'pyro' as const, weaponType: null, region: null, classKey: null, iconPath: null, splashPath: null, wishPath: null, fullbodyPath: null }, rarity: 5 as const, resourceKey: null, resourceAmount: null, wasNewCharacter: true, constellationAfter: 0, copiesAfter: 1 }
    const submitting = invocationSequenceReducer(idleInvocationSequence, { type: 'submit', count: 10, idempotencyKey: 'gold' })
    expect(invocationSequenceReducer(submitting, { type: 'resolved', pull: pull(10, [...Array.from({ length: 7 }, (_, index) => resource(index + 1)), fiveStar, resource(9), resource(10)]) })).toMatchObject({ phase: 'intro', bestRarity: 5 })
    const lock = { current: false }
    expect(acquirePullLock(lock)).toBe(true)
    expect(acquirePullLock(lock)).toBe(false)
  })
})
