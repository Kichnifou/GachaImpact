import { describe, expect, it } from 'vitest'

import { formatResourceAmount, formatWheelResult } from './formatters'

describe('gameplay presentation mapping', () => {
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
