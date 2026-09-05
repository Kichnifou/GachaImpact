import { describe, expect, it } from 'vitest'

import { formatResourceAmount, formatWheelResult, formatFreshWheelResult } from './formatters'

describe('gameplay presentation mapping', () => {
  it.each([
    [{ resultType: 'nothing', resourceKey: null, amount: null }, 'Pas de gain'],
    [{ resultType: 'particles', resourceKey: 'particles_cryo', amount: '500' }, '✨ Félicitations ! Tu obtiens +500 particules Cryo !'],
    [{ resultType: 'moras', resourceKey: 'moras', amount: '50000' }, '🎉 Félicitations ! Tu obtiens +50 000 Moras !'],
    [{ resultType: 'primogems', resourceKey: 'primogems', amount: '1600' }, '🌟 JACKPOT ! +1 600 Primogemmes !'],
  ] as const)('celebrates only actual fresh rewards', (result, expected) => {
    expect(formatFreshWheelResult(result)).toContain(expected)
    expect(formatFreshWheelResult(result)).not.toContain('Déjà utilisée')
  })
  it('formats lossless bigint strings without converting through number', () => {
    expect(formatResourceAmount('9007199254740993')).toBe(
      9_007_199_254_740_993n.toLocaleString('fr-FR'),
    )
  })

  it.each([
    [{ resultType: 'nothing', resourceKey: null, amount: null }, 'rien aujourd’hui'],
    [{ resultType: 'particles', resourceKey: 'particles_hydro', amount: '500' }, '500 particules Hydro'],
    [{ resultType: 'moras', resourceKey: 'moras', amount: '50000' }, '50 000 Moras'],
    [{ resultType: 'primogems', resourceKey: 'primogems', amount: '1600' }, '1 600 Primogemmes'],
  ] as const)('maps a Wheel result to readable French', (result, expectedText) => {
    expect(
      formatWheelResult(result),
    ).toContain(expectedText)
  })
})
