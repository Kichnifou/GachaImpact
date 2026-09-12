import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import DailyRewardCard from './DailyRewardCard'
import { formatDailyRewardDetails } from '../daily-reward/presentation'

const rewards = { primogems: '160', mainElementParticles: '160', moras: '10000' } as const

describe('daily reward card', () => {
  it('turns the preserved sidebar card into one accessible Quotidiennes shortcut', () => {
    const html = renderToStaticMarkup(createElement(DailyRewardCard, { onOpenOverview: vi.fn() }))
    expect(html).toContain('class="panel daily-card daily-card-navigation"')
    expect(html).toContain('Quotidiennes')
    expect(html).toContain('Aperçu du jour')
    expect(html).toContain('Ouvrir l’aperçu →')
    expect(html).not.toContain('Récupérer')
    expect((html.match(/<button/g) ?? [])).toHaveLength(1)
  })

  it('shows the persisted done state after reload without a CTA', () => {
    const html = renderToStaticMarkup(createElement(DailyRewardCard, { variant: 'overview', today: { claimed: true, businessDate: '2026-09-05', rewards }, elementKey: 'hydro', onClaim: vi.fn() }))
    expect(html).toContain('✅ Terminé')
    expect(html).toContain('Récompense récupérée aujourd’hui.')
    expect(html).toContain('Obtenu : +160 Primos · +160 particules Hydro · +10 000 Moras')
    expect(html).not.toContain('<button')
    expect(html).not.toContain('daily-overview-action-slot')
  })

  it('formats all three fresh rewards with the main element', () => {
    expect(formatDailyRewardDetails({ claimed: true, businessDate: '2026-09-05', rewards }, 'cryo')).toBe('+160 Primos · +160 particules Cryo · +10 000 Moras')
  })

  it('renders the overview variant without the sidebar diamond', () => {
    const html = renderToStaticMarkup(createElement(DailyRewardCard, { variant: 'overview', today: { claimed: false, businessDate: '2026-09-05', rewards }, elementKey: 'hydro', onClaim: vi.fn() }))
    expect(html).toContain('daily-reward-overview-card')
    expect(html).toContain('Disponible aujourd’hui.')
    expect(html).toContain('Récupérer')
    expect(html).not.toContain('daily-icon')
    expect(html).not.toContain('♢')
  })

  it('reserves the same overview height before and after the claim mutation', () => {
    const css = readFileSync('src/App.css', 'utf8')
    expect(css).toMatch(/\.daily-overview-card\s*\{[^}]*height:\s*167px;[^}]*min-height:\s*167px;/s)
  })
})
