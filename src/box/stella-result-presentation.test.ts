import { describe, expect, it } from 'vitest'
import type { BoxCharacterDto, StellaUseDto } from '../api/types'
import { presentStellaResult } from './stella-result-presentation'

const character = (constellation: number, overrides: Partial<BoxCharacterDto> = {}): BoxCharacterDto => ({
  id: 'furina', externalKey: 'furina', name: 'Furina', rarity: 5, elementKey: 'hydro', weaponType: null, region: null,
  iconPath: null, splashPath: null, wishPath: null, fullbodyPath: null, constellation, copies: constellation + 1,
  firstObtainedAt: '2026-09-09T00:00:00Z', favorite: false, c6CompetitionStats: null, ...overrides,
})

const result = (next: BoxCharacterDto, c6Progression: StellaUseDto['c6Progression']): StellaUseDto => ({
  operation: { id: 'operation-id', alreadyProcessed: false }, character: next, stella: { quantity: '1' }, c6Progression,
})

describe('Stella result presentation', () => {
  it('targets the constellation for a normal C2 → C3 increase', () => {
    expect(presentStellaResult(character(2), result(character(3), null))).toEqual({
      message: 'Stella utilisée avec succès.',
      visual: { operationId: 'operation-id', characterId: 'furina', type: 'constellation' },
    })
  })

  it('targets the constellation when C5 → C6 unlocks competition statistics', () => {
    const stats = { strength: 1, intelligence: 1, beauty: 1, charisma: 1, popularity: 1 }
    expect(presentStellaResult(character(5), result(character(6, { c6CompetitionStats: { ...stats, max: 20 } }), { type: 'unlocked', stats }))).toEqual({
      message: 'Stella utilisée avec succès.',
      visual: { operationId: 'operation-id', characterId: 'furina', type: 'constellation' },
    })
  })

  it('uses the centralized French label for a C6 statistic increase', () => {
    const presentation = presentStellaResult(character(6), result(character(6), { type: 'stat', stat: 'charisma', valueAfter: 7 }))
    expect(presentation.message).toBe('Stella utilisée · Charisme passe à 7.')
    expect(presentation.message).not.toContain('Charisma')
    expect(presentation.visual).toEqual({ operationId: 'operation-id', characterId: 'furina', type: 'stat', stat: 'charisma' })
  })
})
