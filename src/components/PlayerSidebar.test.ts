import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { PlayerProgressionDto } from '../api/types'
import PlayerSidebar from './PlayerSidebar'

const resources = {
  primogems: '0',
  moras: '0',
  particles: { pyro: '0', hydro: '0', cryo: '0', electro: '0', anemo: '0', geo: '0', dendro: '0' },
} as const

function progression(level: number, xpIntoCurrentStep: string): PlayerProgressionDto {
  return {
    totalXp: '0', level, xpIntoCurrentStep, xpPerStep: '30', isMaxLevel: level === 100,
    level100OverflowRewardsClaimed: 0, totalMessages: '0', countedMessages: '0',
  }
}

function renderProgression(value: PlayerProgressionDto) {
  return renderToStaticMarkup(createElement(PlayerSidebar, {
    isOpen: false,
    onClose: vi.fn(),
    onNavigate: vi.fn(),
    playerData: { id: 'p1', displayName: 'Kichnifou', elementKey: 'hydro', status: 'ACTIVE' },
    resources,
    progression: value,
    dailyRewardToday: { claimed: false, businessDate: '2026-09-05', rewards: { primogems: '160', mainElementParticles: '160', moras: '10000' } },
    onClaimDailyReward: vi.fn(),
  }))
}

describe('Player sidebar progression', () => {
  it('renders a fresh real progression at zero', () => {
    const html = renderProgression(progression(0, '0'))
    expect(html).toContain('Niveau 0')
    expect(html).toContain('0 / 30 XP')
    expect(html).toContain('width:0%')
    expect(html).not.toContain('Niveau 42')
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
})
