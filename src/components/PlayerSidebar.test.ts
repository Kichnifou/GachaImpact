import { createElement } from 'react'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { ElementKey, PlayerProgressionDto, PlayerTeamsDto } from '../api/types'
import { elementThemes } from '../utils/elementTheme'
import PlayerSidebar from './PlayerSidebar'

const appCssSource = readFileSync('src/App.css', 'utf8')

const resources = {
  primogems: '0',
  moras: '0',
  particles: { pyro: '0', hydro: '0', cryo: '0', electro: '0', anemo: '0', geo: '0', dendro: '0' },
} as const

const target = { id: 'target', externalKey: 'legacy:target', name: 'Mavuika', rarity: 5, elementKey: 'pyro', weaponType: null, region: null, classKey: null, iconPath: '/mavuika.png', splashPath: null, wishPath: null, fullbodyPath: null } as const
const gacha = {
  banner: { id: 'banner', startsAt: '2026-09-01T00:00:00.000Z', endsAt: '2026-09-08T00:00:00.000Z', featuredFiveStars: [target], featuredFourStars: [] },
  playerState: { pity5: 12, pity4: 3, guaranteedFeatured5: true, captureProgress: 2, fiftyFiftyLostStreak: 0, selectedBannerCharacterId: target.id, totalPulls: '0', totalFiveStars: '0', totalFourStars: '0', fiftyFiftyWon: '0', fiftyFiftyLost: '0', capturesTriggered: '0' },
} as const
const teams: PlayerTeamsDto = {
  teams: [{
    id: '00000000-0000-4000-8000-000000000001', position: 1, name: 'Équipe principale', active: true,
    slots: [1, 2, 3, 4].map((position) => ({
      position: position as 1 | 2 | 3 | 4,
      character: { ...target, id: `member-${position}`, externalKey: `legacy:${position}`, constellation: position - 1 },
    })),
    passives: [{ elementKey: 'pyro', displayName: 'Pyro', levelOne: 'Bonus I', levelTwo: 'Bonus II', stacks: 2, description: 'Bonus II' }],
  }],
  availableCharacters: [],
  passiveReference: [],
}

function progression(level: number, xpIntoCurrentStep: string): PlayerProgressionDto {
  return {
    totalXp: '0', level, xpIntoCurrentStep, xpPerStep: '30', isMaxLevel: level === 100,
    level100OverflowRewardsClaimed: 0, totalMessages: '0', countedMessages: '0',
  }
}

function renderProgression(value: PlayerProgressionDto, elementKey: ElementKey | null = 'hydro', teamState: PlayerTeamsDto = teams) {
  return renderToStaticMarkup(createElement(PlayerSidebar, {
    isOpen: false,
    onClose: vi.fn(),
    onNavigate: vi.fn(),
    onOpenParticleConversion: vi.fn(),
    playerData: { id: 'p1', displayName: 'Kichnifou', elementKey, status: 'ACTIVE' },
    resources,
    progression: value,
    dailyRewardToday: { claimed: false, businessDate: '2026-09-05', rewards: { primogems: '160', mainElementParticles: '160', moras: '10000' } },
    onClaimDailyReward: vi.fn(),
    gacha,
    teams: teamState,
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
    expect(html).toContain('Mavuika')
    expect(html).toContain('objective-element-watermark')
    expect(html).toContain('/assets/genshin/elements/pyro.png')
    expect(html).toContain('Garantie 5★ : Oui')
    expect(html).toContain('Capture : <strong>2 / 3</strong>')
    expect(html).toContain('12 / 90')
    expect(html).toContain('3 / 10')
    expect((html.match(/character-showcase-sidebar/g) ?? [])).toHaveLength(4)
    expect((html.match(/character-portrait-badge/g) ?? [])).toHaveLength(4)
    expect((html.match(/character-portrait-frame/g) ?? [])).toHaveLength(4)
    expect((html.match(/class="team-member-copy character-display-copy"/g) ?? [])).toHaveLength(4)
    expect((html.match(/★★★★★/g) ?? [])).toHaveLength(5)
    expect(html).not.toContain('Niv. 90')
    expect(html).toContain('C1')
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
    expect(html).toContain('Primos')
    expect(html).not.toContain('Primogemmes')
    expect((html.match(/>Particules</g) ?? [])).toHaveLength(1)
    expect(html).not.toContain('section-heading-label')
    expect(html).not.toContain('card-chevron')
    expect(html).not.toContain('›')
    expect(html).toContain('<small>Team 1 · Équipe principale · 4 / 4</small>')
    expect(html).toContain('class="resource-item resource-item-action"')
    expect(html).toContain('aria-label="Ouvrir la Banque, 0 Moras"')
    expect(html).not.toContain('bank-shortcut')
    expect(html).toMatch(/particles-card[\s\S]*particles-grid[\s\S]*sidebar-particle-convert[\s\S]*<\/section>/)
    expect(appCssSource).toMatch(/\.sidebar-particle-convert\s*\{[^}]*right:\s*12px;[^}]*bottom:\s*10px;/s)
    expect(appCssSource).not.toMatch(/\.particles-card\s*\{[^}]*padding-bottom:/s)
  })

  it('shows a temporary level delta and profile glow without changing progression data', () => {
    const html = renderToStaticMarkup(createElement(PlayerSidebar, {
      isOpen: false, onClose: vi.fn(), onNavigate: vi.fn(), onOpenParticleConversion: vi.fn(),
      playerData: { id: 'p1', displayName: 'Kichnifou', elementKey: 'hydro', status: 'ACTIVE' },
      resources, progression: progression(12, '4'), levelUpDelta: 3, profileLevelUpActive: true,
      dailyRewardToday: { claimed: false, businessDate: '2026-09-05', rewards: { primogems: '160', mainElementParticles: '160', moras: '10000' } },
      onClaimDailyReward: vi.fn(), gacha, teams,
    }))
    expect(html).toContain('profile-card level-up-active')
    expect(html).toContain('Niveau 12<em class="level-up-delta">+3</em>')
    expect(html).toContain('4 / 30 XP')
  })

  it('renders the authoritative active Team with visible empty slots', () => {
    const second = {
      ...teams.teams[0]!, id: '00000000-0000-4000-8000-000000000002', position: 2,
      name: null, active: true, slots: [{ position: 1 as const, character: teams.teams[0]!.slots[0]!.character }, { position: 2 as const, character: null }, { position: 3 as const, character: null }, { position: 4 as const, character: null }],
    }
    const html = renderProgression(progression(0, '0'), 'hydro', { ...teams, teams: [{ ...teams.teams[0]!, active: false }, second] })
    expect(html).toContain('<small>Team 2 · 1 / 4</small>')
    expect((html.match(/empty-sidebar-team-slot/g) ?? [])).toHaveLength(3)
    expect(html).not.toContain('Furina</strong><span class="character-rarity">★★★★★</span><div class="team-member-copy')
  })

  it('makes the whole active-Team panel an accessible navigation surface', () => {
    const html = renderProgression(progression(0, '0'))
    expect(html).toContain('class="panel team-card team-card-navigable"')
    expect(html).toContain('class="team-card-navigation"')
    expect(html).toContain('aria-label="Ouvrir l’Équipe active, Team 1"')
    expect(html).toContain('class="section-heading"><span>Équipe active</span>')
  })
})
