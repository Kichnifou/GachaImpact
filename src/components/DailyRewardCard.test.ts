import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import DailyRewardCard from './DailyRewardCard'
import { formatDailyRewardDetails } from '../daily-reward/presentation'

const rewards = { primogems: '160', mainElementParticles: '160', moras: '10000' } as const

describe('daily reward card', () => {
  it('shows the CTA for an available bootstrap state', () => {
    const html = renderToStaticMarkup(createElement(DailyRewardCard, { today: { claimed: false, businessDate: '2026-09-05', rewards }, elementKey: 'hydro', onClaim: vi.fn() }))
    expect(html).toContain('Récupérer')
    expect(html).not.toContain('Déjà récupérée')
  })

  it('shows the persisted done state after reload without a CTA', () => {
    const html = renderToStaticMarkup(createElement(DailyRewardCard, { today: { claimed: true, businessDate: '2026-09-05', rewards }, elementKey: 'hydro', onClaim: vi.fn() }))
    expect(html).toContain('Déjà récupérée aujourd’hui')
    expect(html).not.toContain('<button')
  })

  it('formats all three fresh rewards with the main element', () => {
    expect(formatDailyRewardDetails({ claimed: true, businessDate: '2026-09-05', rewards }, 'cryo')).toBe('+160 Primogemmes · +160 particules Cryo · +10 000 Moras')
  })
})
