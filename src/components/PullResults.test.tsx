import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { GachaPullDto } from '../api/types'
import PullResults from './PullResults'

const state = { pity5: 0, pity4: 0, guaranteedFeatured5: false, captureProgress: 0, fiftyFiftyLostStreak: 0, selectedBannerCharacterId: 'target', totalPulls: '10', totalFiveStars: '1', totalFourStars: '1', fiftyFiftyWon: '1', fiftyFiftyLost: '0', capturesTriggered: '0' }
const character = { id: 'c1', externalKey: 'c1', name: 'Furina', rarity: 5 as const, elementKey: 'hydro' as const, weaponType: null, region: null, classKey: null, iconPath: '/furina.png', splashPath: null, wishPath: null, fullbodyPath: null }

describe('PullResults', () => {
  it('renders all ten persisted results in server order with a visible five-star', () => {
    const pull: GachaPullDto = {
      operation: { id: 'op', pullCount: 10, primogemCost: '1600', createdAt: '2026-09-06T12:00:00Z', alreadyProcessed: false },
      results: Array.from({ length: 10 }, (_, index) => index === 3
        ? { index: 4, resultType: 'character' as const, character, rarity: 5 as const, resourceKey: null, resourceAmount: null, wasNewCharacter: true, constellationAfter: 0, copiesAfter: 1, wasFiftyFifty: true, wonFiftyFifty: true, guaranteeConsumed: false, captureTriggered: false, bonusRewards: [] }
        : { index: index + 1, resultType: 'resource' as const, character: null, rarity: null, resourceKey: 'moras', resourceAmount: '5000', wasNewCharacter: null, constellationAfter: null, copiesAfter: null, wasFiftyFifty: false, wonFiftyFifty: null, guaranteeConsumed: false, captureTriggered: false, bonusRewards: [] }),
      playerState: state,
    }
    const html = renderToStaticMarkup(<PullResults pull={pull} onClose={vi.fn()} />)
    expect((html.match(/pull-result-card/g) ?? [])).toHaveLength(10)
    expect(html.indexOf('#1')).toBeLessThan(html.indexOf('#4'))
    expect(html.indexOf('#4')).toBeLessThan(html.indexOf('#10'))
    expect(html).toContain('rarity-5')
    expect(html).toContain('Furina')
    expect(html).toContain('Nouveau · C0')
  })
})
