import { describe, expect, it } from 'vitest'
import type { GachaPullResultItemDto } from '../api/types'
import { bestPullRarity, pullDisplayRarity, pullResourcePresentation } from './pull-result-presentation'

const resource = (resourceKey: string): GachaPullResultItemDto => ({ index: 1, resultType: 'resource', character: null, rarity: null, resourceKey, resourceAmount: '42', wasNewCharacter: null, constellationAfter: null, copiesAfter: null, wasFiftyFifty: false, wonFiftyFifty: null, guaranteeConsumed: false, captureTriggered: false, bonusRewards: [], c6Progression: null })

describe('Pull result presentation', () => {
  it('uses canonical currency assets and elemental particle assets', () => {
    expect(pullResourcePresentation('moras')).toMatchObject({ label: 'Moras', assetPath: '/assets/genshin/currencies/mora.png' })
    expect(pullResourcePresentation('primogems')).toMatchObject({ label: 'Primogemmes', assetPath: '/assets/genshin/currencies/primogem.png' })
    const particlePaths = ['pyro', 'hydro', 'cryo', 'electro', 'anemo', 'geo', 'dendro'].map((element) => pullResourcePresentation(`particles_${element}`).assetPath)
    expect(new Set(particlePaths).size).toBe(7)
    expect(particlePaths).toContain('/assets/genshin/elements/cryo.png')
  })

  it('uses a generic fallback only for an actually unknown resource', () => {
    expect(pullResourcePresentation('unknown')).toEqual({ label: 'Ressource', assetPath: null, fallback: '✦' })
  })

  it('presents resources as 3-star and announces the best x10 rarity', () => {
    expect(pullDisplayRarity(resource('moras'))).toBe(3)
    const four = { ...resource('moras'), resultType: 'character' as const, rarity: 4 as const }
    const five = { ...four, rarity: 5 as const }
    expect(bestPullRarity([resource('moras'), four])).toBe(4)
    expect(bestPullRarity([resource('moras'), four, five])).toBe(5)
  })
})
