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
    expect(html).toContain('>C6</small>')
    expect(html).not.toContain('Copie')
    expect(html).not.toContain('Nouveau · C0')
    expect(html).toContain('+80 Primos')
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
    expect(c6Reveal).not.toContain('+80 Primos')
    expect(c6Reveal).not.toContain('Beauté +1')

    const resource = renderToStaticMarkup(<PullResultCard result={{ ...characterResult, resultType: 'resource', character: null, rarity: null, resourceKey: 'moras', resourceAmount: '6614', wasNewCharacter: null, constellationAfter: null, copiesAfter: null, wasFiftyFifty: false, wonFiftyFifty: null, c6Progression: null }} />)
    expect(resource).toContain('resource-result')
    expect(resource).toContain('pull-resource-content')
    expect(resource).toContain('/assets/genshin/currencies/mora.png')
    expect(resource).not.toContain('+80 Primos')
  })

  it('reserves vertical room for descenders in individual character reveal names', () => {
    const ningguang = { ...characterResult, character: { ...character, name: 'Ningguang' } }
    const reveal = renderToStaticMarkup(<PullResultCard result={ningguang} />)
    const compact = renderToStaticMarkup(<PullResultCard result={ningguang} compact />)
    expect(reveal).toContain('line-height:1.12')
    expect(reveal).toContain('padding-bottom:0.12em')
    expect(compact).not.toContain('padding-bottom:0.12em')
  })

  it('renders triggered passive feedback but never attributes a five-star causally to Hydro', () => {
    const result = {
      ...characterResult,
      passiveEffects: [
        { elementKey: 'hydro' as const, type: 'five_star_chance_bonus' as const, basisPoints: 30 },
        { elementKey: 'cryo' as const, type: 'xp' as const, amount: '1', xpAfter: '30', levelsReached: [1], overflowRewardsGranted: 0 },
        { elementKey: 'electro' as const, type: 'pity5' as const, amount: 2, requestedAmount: 2 as const },
      ],
    }
    const html = renderToStaticMarkup(<PullResultCard result={result} />)
    expect(html).toContain('Cryo · +1 XP')
    expect(html).toContain('Electro · +2 Pity 5★')
    expect(html).not.toContain('Hydro ·')
  })

  it('shows an Anemo recovery once instead of duplicating its economy bonus', () => {
    const result = {
      ...characterResult,
      bonusRewards: [{ resourceKey: 'primogems', amount: '80', causeKey: 'team.passive.anemo.primogem-recovery' }],
      c6Progression: null,
      passiveEffects: [{ elementKey: 'anemo' as const, type: 'primogem_recovery' as const, amount: '80' }],
    }
    const html = renderToStaticMarkup(<PullResultCard result={result} compact />)
    expect((html.match(/\+80 Primos/g) ?? [])).toHaveLength(1)
    expect(html).not.toContain('Anemo ·')
    expect(html).not.toContain('class="pull-bonus">+80 Primos')
  })

  it('shows one compact Dendro feedback instead of its nine generic economy rewards', () => {
    const rewards = [
      { resourceKey: 'primogems', amount: '40' },
      { resourceKey: 'moras', amount: '1000' },
      ...['pyro', 'hydro', 'cryo', 'electro', 'anemo', 'geo', 'dendro'].map((element) => ({ resourceKey: `particles_${element}`, amount: '5' })),
    ]
    const result = {
      ...characterResult,
      bonusRewards: rewards.map((reward) => ({ ...reward, causeKey: 'team.passive.dendro.bundle' })),
      c6Progression: null,
      passiveEffects: [{ elementKey: 'dendro' as const, type: 'resource_bundle' as const, rewards }],
    }
    const html = renderToStaticMarkup(<PullResultCard result={result} compact />)
    expect(html).toContain('Bundle élémentaire')
    expect(html).not.toContain('Dendro ·')
    expect(html).not.toContain('class="pull-bonus"')
  })

  it('keeps C6 and XP level rewards visible when passive rewards are deduplicated', () => {
    const result = {
      ...characterResult,
      bonusRewards: [
        { resourceKey: 'primogems', amount: '80', causeKey: 'gacha.c6-duplicate-refund' },
        { resourceKey: 'moras', amount: '10000', causeKey: 'player.xp.level-reward' },
      ],
      c6Progression: null,
      passiveEffects: [{ elementKey: 'cryo' as const, type: 'xp' as const, amount: '1', xpAfter: '30', levelsReached: [1], overflowRewardsGranted: 0 }],
    }
    const html = renderToStaticMarkup(<PullResultCard result={result} compact />)
    expect(html).toContain('class="pull-bonus pull-c6-refund">+80 Primos')
    expect(html).toContain('class="pull-bonus">+10 000 Moras')
    expect(html).toContain('+1 XP')
    expect(html).not.toContain('Cryo ·')
  })

  it('hides a clamped Electro proc with no actual pity gain', () => {
    const renderElectro = (amount: number) => renderToStaticMarkup(<PullResultCard result={{
      ...characterResult,
      bonusRewards: [],
      c6Progression: null,
      passiveEffects: [{ elementKey: 'electro' as const, type: 'pity5' as const, amount, requestedAmount: 2 as const }],
    }} compact />)
    expect(renderElectro(2)).toContain('+2 Pity 5★')
    expect(renderElectro(1)).toContain('+1 Pity 5★')
    expect(renderElectro(0)).not.toContain('Pity 5★')
  })

  it('centers a dedicated passive text wrapper independently from its icon while preserving character alignment', () => {
    const result = {
      ...characterResult,
      bonusRewards: [],
      c6Progression: null,
      passiveEffects: [
        { elementKey: 'geo' as const, type: 'secondary_reward_multiplier' as const, numerator: 5, denominator: 4, amountBefore: '5000', amountAfter: '6250' },
        { elementKey: 'pyro' as const, type: 'secondary_reward_multiplier' as const, numerator: 5, denominator: 4, amountBefore: '20', amountAfter: '25' },
        { elementKey: 'electro' as const, type: 'pity5' as const, amount: 2, requestedAmount: 2 as const },
      ],
    }
    const characterReveal = renderToStaticMarkup(<PullResultCard result={result} />)
    const compactCharacter = renderToStaticMarkup(<PullResultCard result={result} compact />)
    const resourceResult = { ...result, resultType: 'resource' as const, character: null, rarity: null, resourceKey: 'moras', resourceAmount: '6250', wasNewCharacter: null, constellationAfter: null, copiesAfter: null }
    const resourceReveal = renderToStaticMarkup(<PullResultCard result={resourceResult} />)
    const compactResource = renderToStaticMarkup(<PullResultCard result={resourceResult} compact />)

    expect(characterReveal).toContain('pull-passive-effects passive-feedback-character')
    expect(characterReveal).not.toContain('passive-feedback-centered')
    for (const html of [resourceReveal, compactCharacter, compactResource]) {
      expect(html).toContain('pull-passive-effects passive-feedback-centered')
      expect(html).not.toContain('passive-feedback-character')
    }
    for (const html of [characterReveal, resourceReveal]) {
      expect((html.match(/class="pull-passive-effect-line"/g) ?? [])).toHaveLength(3)
      expect((html.match(/class="pull-passive-effect"/g) ?? [])).toHaveLength(3)
      expect((html.match(/class="pull-passive-label"/g) ?? [])).toHaveLength(3)
      expect((html.match(/class="pull-passive-icon"/g) ?? [])).toHaveLength(3)
      expect((html.match(/class="pull-passive-text"/g) ?? [])).toHaveLength(3)
      expect(html).toMatch(/pull-passive-label[\s\S]*pull-passive-icon[\s\S]*pull-passive-text">Geo · Moras ×1,25/)
      expect(html).toMatch(/pull-passive-label[\s\S]*pull-passive-icon[\s\S]*pull-passive-text">Pyro · Particules ×1,25/)
      expect(html).toMatch(/pull-passive-label[\s\S]*pull-passive-icon[\s\S]*pull-passive-text">Electro · \+2 Pity 5★/)
    }
    for (const html of [compactCharacter, compactResource]) {
      expect((html.match(/class="pull-passive-effect-line"/g) ?? [])).toHaveLength(3)
      expect(html).toContain('Moras ×1,25')
      expect(html).toContain('Particules ×1,25')
      expect(html).toContain('+2 Pity 5★')
      expect(html).not.toMatch(/Geo ·|Pyro ·|Electro ·/)
    }
  })

  it('keeps 4★ and 5★ identity in a dedicated structure regardless of passive count', () => {
    const passiveSets = [
      [],
      [{ elementKey: 'cryo' as const, type: 'xp' as const, amount: '1', xpAfter: '1', levelsReached: [], overflowRewardsGranted: 0 }],
      [
        { elementKey: 'cryo' as const, type: 'xp' as const, amount: '1', xpAfter: '1', levelsReached: [], overflowRewardsGranted: 0 },
        { elementKey: 'electro' as const, type: 'pity5' as const, amount: 2, requestedAmount: 2 as const },
        { elementKey: 'anemo' as const, type: 'primogem_recovery' as const, amount: '80' },
      ],
      [
        { elementKey: 'pyro' as const, type: 'secondary_reward_multiplier' as const, numerator: 5, denominator: 4, amountBefore: '20', amountAfter: '25' },
        { elementKey: 'geo' as const, type: 'secondary_reward_multiplier' as const, numerator: 5, denominator: 4, amountBefore: '100', amountAfter: '125' },
        { elementKey: 'cryo' as const, type: 'xp' as const, amount: '1', xpAfter: '1', levelsReached: [], overflowRewardsGranted: 0 },
        { elementKey: 'electro' as const, type: 'pity5' as const, amount: 2, requestedAmount: 2 as const },
        { elementKey: 'anemo' as const, type: 'primogem_recovery' as const, amount: '80' },
      ],
    ]
    for (const rarity of [4, 5] as const) for (const passiveEffects of passiveSets) {
      const html = renderToStaticMarkup(<PullResultCard result={{ ...characterResult, rarity, character: { ...character, rarity }, passiveEffects }} />)
      expect(html).toMatch(/pull-character-identity[\s\S]*pull-result-progression">C6[\s\S]*Furina[\s\S]*pull-result-rarity/)
      expect((html.match(/pull-character-identity/g) ?? [])).toHaveLength(1)
      expect(html.indexOf('pull-character-identity')).toBeLessThan(html.indexOf('pull-passive-effects') === -1 ? Number.POSITIVE_INFINITY : html.indexOf('pull-passive-effects'))
    }
  })

  it('uses all compact passive labels without repeating element names', () => {
    const result = {
      ...characterResult,
      bonusRewards: [],
      c6Progression: null,
      passiveEffects: [
        { elementKey: 'pyro' as const, type: 'secondary_reward_multiplier' as const, numerator: 5, denominator: 4, amountBefore: '20', amountAfter: '25' },
        { elementKey: 'geo' as const, type: 'secondary_reward_multiplier' as const, numerator: 5, denominator: 4, amountBefore: '100', amountAfter: '125' },
        { elementKey: 'cryo' as const, type: 'xp' as const, amount: '1', xpAfter: '1', levelsReached: [], overflowRewardsGranted: 0 },
        { elementKey: 'electro' as const, type: 'pity5' as const, amount: 2, requestedAmount: 2 as const },
        { elementKey: 'anemo' as const, type: 'primogem_recovery' as const, amount: '80' },
        { elementKey: 'dendro' as const, type: 'resource_bundle' as const, rewards: [] },
      ],
    }
    const html = renderToStaticMarkup(<PullResultCard result={result} compact />)
    for (const label of ['Particules ×1,25', 'Moras ×1,25', '+1 XP', '+2 Pity 5★', '+80 Primos', 'Bundle élémentaire']) expect(html).toContain(label)
    expect(html).not.toMatch(/Pyro ·|Geo ·|Cryo ·|Electro ·|Anemo ·|Dendro ·/)
  })

  it('uses the same Nouveau or capped Cx rule in the x10 summary', () => {
    const newCharacter = { ...characterResult, wasNewCharacter: true, constellationAfter: 0, copiesAfter: 1, bonusRewards: [], c6Progression: null }
    const c1Character = { ...characterResult, constellationAfter: 1, copiesAfter: 2, bonusRewards: [], c6Progression: null }
    const c6PlusCharacter = { ...characterResult, constellationAfter: 6, copiesAfter: 19 }

    const newHtml = renderToStaticMarkup(<PullResultCard result={newCharacter} compact />)
    const c1Html = renderToStaticMarkup(<PullResultCard result={c1Character} compact />)
    const c6Html = renderToStaticMarkup(<PullResultCard result={c6PlusCharacter} compact />)

    expect(newHtml).toContain('>Nouveau</small>')
    expect(newHtml).not.toContain('C0')
    expect(c1Html).toContain('>C1</small>')
    expect(c6Html).toContain('>C6</small>')
    expect(c6Html).toContain('+80 Primos')
    for (const html of [newHtml, c1Html, c6Html]) expect(html).not.toContain('Copie')
  })

  it('shrinks only the compact C6 refund identified by its server cause', () => {
    const compact = renderToStaticMarkup(<PullResultCard result={characterResult} compact />)
    const reveal = renderToStaticMarkup(<PullResultCard result={characterResult} />)
    const sameAmountDifferentCause = renderToStaticMarkup(<PullResultCard result={{
      ...characterResult,
      bonusRewards: [{ resourceKey: 'primogems', amount: '80', causeKey: 'player.xp.level-reward' }],
    }} compact />)
    expect(compact).toContain('pull-bonus pull-c6-refund')
    expect(reveal).not.toContain('pull-c6-refund')
    expect(sameAmountDifferentCause).toContain('class="pull-bonus">+80 Primos')
    expect(sameAmountDifferentCause).not.toContain('pull-c6-refund')
  })

  it('uses a dedicated compact class for C6 stats without changing refund styling', () => {
    const html = renderToStaticMarkup(<PullResultCard result={{ ...characterResult, c6Progression: { type: 'stat', stat: 'charisma', valueAfter: 2 } }} compact />)
    expect(html).toContain('class="pull-c6-stat">Charisme +1')
    expect(html).toContain('pull-bonus pull-c6-refund')
  })
})
