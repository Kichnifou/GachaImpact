import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { CurrentGachaDto, GachaCharacterDto } from '../api/types'
import BannerHero from './BannerHero'

const character = (id: string, rarity: 4 | 5): GachaCharacterDto => ({ id, externalKey: `legacy:${id}`, name: id, rarity, elementKey: 'hydro', weaponType: null, region: null, classKey: null, iconPath: null, splashPath: null, wishPath: null, fullbodyPath: null })
const five = Array.from({ length: 4 }, (_, index) => character(`Five ${index + 1}`, 5))
const four = Array.from({ length: 6 }, (_, index) => character(`Four ${index + 1}`, 4))
function data(target: string | null): CurrentGachaDto { return { banner: { id: 'banner', startsAt: '2026-09-01T00:00:00Z', endsAt: '2026-09-08T00:00:00Z', featuredFiveStars: five, featuredFourStars: four }, playerState: { pity5: 0, pity4: 0, guaranteedFeatured5: false, captureProgress: 0, fiftyFiftyLostStreak: 0, selectedBannerCharacterId: target, totalPulls: '0', totalFiveStars: '0', totalFourStars: '0', fiftyFiftyWon: '0', fiftyFiftyLost: '0', capturesTriggered: '0' } } }

describe('BannerHero real Gacha state', () => {
  it('offers all four five-star targets and six four-star characters without a default target', () => { const html = renderToStaticMarkup(<BannerHero gacha={data(null)} onSetTarget={vi.fn()} />); expect((html.match(/class="target-choice hydro"/g) ?? [])).toHaveLength(4); expect((html.match(/class="featured-four-image"/g) ?? [])).toHaveLength(6); expect(html).toContain('Choisissez votre cible') })
  it('shows real zero state and disabled pull controls once targeted', () => { const html = renderToStaticMarkup(<BannerHero gacha={data(five[0]!.id)} onSetTarget={vi.fn()} showDetails />); expect(html).toContain('Pity 5★'); expect(html).toContain('Capture'); expect((html.match(/disabled=""/g) ?? [])).toHaveLength(2); expect(html).not.toContain('Disponible en permanence') })
});
