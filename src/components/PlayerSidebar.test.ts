import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { ElementKey, PlayerProgressionDto } from '../api/types'
import { elementThemes } from '../utils/elementTheme'
import PlayerSidebar from './PlayerSidebar'

const resources = {
  primogems: '0',
  moras: '0',
  particles: { pyro: '0', hydro: '0', cryo: '0', electro: '0', anemo: '0', geo: '0', dendro: '0' },
} as const

const gacha = {
  banner: { id: 'banner', startsAt: '2026-09-01T00:00:00.000Z', endsAt: '2026-09-08T00:00:00.000Z', featuredFiveStars: [], featuredFourStars: [] },
  playerState: { pity5: 0, pity4: 0, guaranteedFeatured5: false, captureProgress: 0, fiftyFiftyLostStreak: 0, selectedBannerCharacterId: null, totalPulls: '0', totalFiveStars: '0', totalFourStars: '0', fiftyFiftyWon: '0', fiftyFiftyLost: '0', capturesTriggered: '0' },
} as const

function progression(level: number, xpIntoCurrentStep: string): PlayerProgressionDto {
  return {
    totalXp: '0', level, xpIntoCurrentStep, xpPerStep: '30', isMaxLevel: level === 100,
    level100OverflowRewardsClaimed: 0, totalMessages: '0', countedMessages: '0',
  }
}

function renderProgression(value: PlayerProgressionDto, elementKey: ElementKey | null = 'hydro') {
  return renderToStaticMarkup(createElement(PlayerSidebar, {
    isOpen: false,
    onClose: vi.fn(),
    onNavigate: vi.fn(),
    playerData: { id: 'p1', displayName: 'Kichnifou', elementKey, status: 'ACTIVE' },
    resources,
    progression: value,
    dailyRewardToday: { claimed: false, businessDate: '2026-09-05', rewards: { primogems: '160', mainElementParticles: '160', moras: '10000' } },
    onClaimDailyReward: vi.fn(),
    gacha,
  }))
}

describe('Player sidebar progression', () => {
  it('renders a fresh real progression at zero', () => {
    const html = renderProgression(progression(0, '0'))
    expect(html).toContain('Niveau 0')
    expect(html).toContain('0 / 30 XP')
    expect(html).toContain('width:0%')
    expect(html).not.toContain('Niveau 42')
    expect(html).toContain('profile-element-watermark')
    expect(html).toContain('Aucune cible sélectionnée')
  })

  it('renders a level transition and its dynamic bar', () => {
    const html = renderProgression(progression(1, '15'))
    expect(html).toContain('Niveau 1')
    expect(html).toContain('15 / 30 XP')
    expect(html).toContain('width:50%')
  })

  it('never displays a level above the server-provided maximum', () => {
    const html = renderProgression(progression(100, '29'))
    expect(html).toContain('Niveau 100')
    expect(html).toContain('29 / 30 XP')
    expect(html).not.toContain('Niveau 101')
  })

  it('uses the typed element theme and handles a missing element', () => {
    const elements = Object.keys(elementThemes) as ElementKey[]
    expect(elements).toHaveLength(7)
    for (const element of elements) {
      const html = renderProgression(progression(0, '0'), element)
      expect(html).toContain(`--profile-element:${elementThemes[element].color}`)
      expect(html).toContain(`--profile-watermark-brightness:${elementThemes[element].watermarkBrightness}`)
      expect(html).toContain(`/assets/genshin/elements/${element}.png`)
    }
    expect(renderProgression(progression(0, '0'), null)).not.toContain('profile-element-watermark')
  })

  it('composes one priority summary before one secondary panel group', () => {
    const html = renderProgression(progression(0, '0'))
    expect((html.match(/player-priority/g) ?? [])).toHaveLength(1)
    expect((html.match(/player-secondary/g) ?? [])).toHaveLength(1)
    expect(html.indexOf('player-priority')).toBeLessThan(html.indexOf('player-secondary'))
    expect((html.match(/Ressources principales/g) ?? [])).toHaveLength(1)
    expect((html.match(/>Particules</g) ?? [])).toHaveLength(1)
  })
})
