import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { GachaPullDto } from '../api/types'
import PullResults, { PullResultCard } from './PullResults'

const state = { pity5: 0, pity4: 0, guaranteedFeatured5: false, captureProgress: 0, fiftyFiftyLostStreak: 0, selectedBannerCharacterId: 'target', totalPulls: '10', totalFiveStars: '1', totalFourStars: '1', fiftyFiftyWon: '1', fiftyFiftyLost: '0', capturesTriggered: '0' }
const character = { id: 'c1', externalKey: 'c1', name: 'Furina', rarity: 5 as const, elementKey: 'hydro' as const, weaponType: null, region: null, classKey: null, iconPath: '/icon/furina.png', splashPath: '/splash/furina.png', wishPath: '/wish/furina.png', fullbodyPath: '/fullbody/furina.png' }
const characterResult = { index: 4, resultType: 'character' as const, character, rarity: 5 as const, resourceKey: null, resourceAmount: null, wasNewCharacter: false, constellationAfter: 6, copiesAfter: 8, wasFiftyFifty: true, wonFiftyFifty: true, guaranteeConsumed: false, captureTriggered: false, bonusRewards: [{ resourceKey: 'primogems', amount: '80', causeKey: 'gacha.c6-duplicate-refund' }], c6Progression: { type: 'stat' as const, stat: 'beauty' as const, valueAfter: 8 } }

describe('PullResults', () => {
  it('renders all ten persisted results in server order with a visible five-star', () => {
    const pull: GachaPullDto = {
      operation: { id: 'op', pullCount: 10, primogemCost: '1600', createdAt: '2026-09-06T12:00:00Z', alreadyProcessed: false },
      results: Array.from({ length: 10 }, (_, index) => index === 3
        ? characterResult
        : { index: index + 1, resultType: 'resource' as const, character: null, rarity: null, resourceKey: 'moras', resourceAmount: '5000', wasNewCharacter: null, constellationAfter: null, copiesAfter: null, wasFiftyFifty: false, wonFiftyFifty: null, guaranteeConsumed: false, captureTriggered: false, bonusRewards: [], c6Progression: null }),
      playerState: state,
    }
    const html = renderToStaticMarkup(<PullResults pull={pull} />)
    expect((html.match(/pull-result-card/g) ?? [])).toHaveLength(10)
    expect(html.indexOf('#1')).toBeLessThan(html.indexOf('#4'))
    expect(html.indexOf('#4')).toBeLessThan(html.indexOf('#10'))
    expect(html).toContain('rarity-5')
    expect(html).toContain('Furina')
    expect(html).toContain('Copie 8 · C6')
    expect(html).toContain('+80 Primogemmes')
    expect(html).toContain('Beauté +1')
    expect(html).toContain('/assets/genshin/currencies/mora.png')
    expect(html).toContain('src="/icon/furina.png"')
    expect(html).not.toContain('src="/splash/furina.png"')
    expect(html).toContain('★★★')
  })

  it('uses a clean full-stage reveal with only Nouveau or capped Cx progression', () => {
    const newCharacter = { ...characterResult, wasNewCharacter: true, constellationAfter: 0, copiesAfter: 1, bonusRewards: [], c6Progression: null }
    const reveal = renderToStaticMarkup(<PullResultCard result={newCharacter} />)
    expect(reveal).toContain('character-result')
    expect(reveal).toContain('src="/splash/furina.png"')
    expect(reveal).not.toContain('pull-result-backdrop-image')
    expect((reveal.match(/src="\/splash\/furina.png"/g) ?? [])).toHaveLength(1)
    expect(reveal).not.toContain('src="/icon/furina.png"')
    expect(reveal).toContain('pull-result-progression">Nouveau')
    expect(reveal).not.toContain('Copie')
    expect(reveal).not.toContain('pull-event')

    const c6Reveal = renderToStaticMarkup(<PullResultCard result={characterResult} />)
    expect(c6Reveal).toContain('pull-result-progression">C6')
    expect(c6Reveal).not.toContain('Copie 8')
    expect(c6Reveal).not.toContain('+80 Primogemmes')
    expect(c6Reveal).not.toContain('Beauté +1')

    const resource = renderToStaticMarkup(<PullResultCard result={{ ...characterResult, resultType: 'resource', character: null, rarity: null, resourceKey: 'moras', resourceAmount: '6614', wasNewCharacter: null, constellationAfter: null, copiesAfter: null, wasFiftyFifty: false, wonFiftyFifty: null, c6Progression: null }} />)
    expect(resource).toContain('resource-result')
    expect(resource).toContain('pull-resource-content')
    expect(resource).toContain('/assets/genshin/currencies/mora.png')
    expect(resource).not.toContain('+80 Primogemmes')
  })
})
