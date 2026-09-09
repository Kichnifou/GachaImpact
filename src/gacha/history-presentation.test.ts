import { describe, expect, it } from 'vitest'
import type { GachaHistoryResultDto } from '../api/types'
import { historyEventLabel, historyPityLabel, historyProgressionLabel, historyResultLabel } from './history-presentation'

const arlecchino: GachaHistoryResultDto = {
  operationId: 'op', operationPullCount: 1, occurredAt: '2026-09-06T20:25:20.778Z',
  index: 1, resultType: 'character', character: { id: 'c', externalKey: 'c', name: 'Arlecchino', rarity: 5, elementKey: 'pyro', weaponType: null, region: null, classKey: null, iconPath: null, splashPath: null, wishPath: null, fullbodyPath: null }, rarity: 5, resourceKey: null, resourceAmount: null,
  wasNewCharacter: true, constellationAfter: 0, copiesAfter: 1, wasFiftyFifty: true, wonFiftyFifty: true, guaranteeConsumed: false, captureTriggered: false,
  bonusRewards: [], c6Progression: null, pity5AtPull: 1, pity4AtPull: 1,
}

describe('Gacha history presentation', () => {
  it('formats result, pull-number pity, event and progression from the persisted row', () => {
    expect(historyResultLabel(arlecchino)).toBe('Arlecchino')
    expect(historyPityLabel(arlecchino)).toBe('1')
    expect(historyEventLabel(arlecchino)).toBe('50/50 gagné')
    expect(historyProgressionLabel(arlecchino)).toBe('Nouveau')
  })

  it('formats a secondary reward as text without progression', () => {
    const moras = { ...arlecchino, resultType: 'resource' as const, character: null, rarity: null, resourceKey: 'moras', resourceAmount: '6614', wasNewCharacter: null, constellationAfter: null, copiesAfter: null, wasFiftyFifty: false, wonFiftyFifty: null, pity5AtPull: 1, pity4AtPull: 2 }
    expect(historyResultLabel(moras)).toBe('6 614 Moras')
    expect(historyPityLabel(moras)).toBe('1')
    expect(historyEventLabel(moras)).toBe('—')
    expect(historyProgressionLabel(moras)).toBe('—')
  })

  it('uses an em dash when the five-star pity snapshot is unavailable', () => {
    expect(historyPityLabel({ ...arlecchino, pity5AtPull: null })).toBe('—')
  })

  it('shows only Cx for duplicates and caps player-facing progression at C6', () => {
    const c1 = { ...arlecchino, wasNewCharacter: false, constellationAfter: 1, copiesAfter: 2 }
    const c6Plus = { ...arlecchino, wasNewCharacter: false, constellationAfter: 6, copiesAfter: 14, bonusRewards: [{ resourceKey: 'primogems', amount: '80', causeKey: 'gacha.c6-duplicate-refund' }] }

    expect(historyProgressionLabel(c1)).toBe('C1')
    expect(historyProgressionLabel(c6Plus)).toBe('C6 · +80 Primos')
    expect(historyProgressionLabel(c1)).not.toContain('Copie')
    expect(historyProgressionLabel(c6Plus)).not.toContain('Copie')
  })
})
