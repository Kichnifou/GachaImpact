// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MonthlyBossDto } from '../api/types'
import MonthlyBossScreen from './MonthlyBossScreen'

const appCss = readFileSync(`${process.cwd()}/src/App.css`, 'utf8')

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterEach(() => document.body.replaceChildren())

const value: MonthlyBossDto = {
  businessDate: '2026-09-13', boss: { id: '11111111-1111-1111-1111-111111111111', monthStart: '2026-09-01', name: 'Seigneur des Ruines Oubliées', baseHp: '1500000', hpVariationPercent: 0, maxHp: '1500000', currentHp: '1490000', resistanceElementKey: 'hydro', defeatedAt: null, finalBlowPlayer: null, nextBaseAdjustment: null },
  status: 'ALIVE', attackState: 'AVAILABLE', canAttack: true,
  availableCharacters: [], loadout: { slots: [1, 2, 3, 4].map((position) => ({ position: position as 1 | 2 | 3 | 4, character: null })) },
  preview: { totalDamage: '10000', contributions: [] }, reward: { primogems: '16000', moras: '500000' }, participation: { rank: 4, totalDamage: '30000', attackCount: '3', bestHit: '12000', contributionBasisPoints: '200' },
  ranking: [{ rank: 1, playerId: 'p1', displayName: 'Joueur', totalDamage: '50000', attackCount: '4', bestHit: '15000' }],
  defeatedSummary: null,
  playerStats: { totalDamage: '30000', totalAttacks: '3', totalParticipated: '1', totalRewarded: '0', finalBlows: '0', bestHit: '12000' },
}
const callbacks = { onSetSlot: vi.fn(), onRemoveSlot: vi.fn(), onCopyActive: vi.fn(), onClear: vi.fn(), onAttack: vi.fn(), onLoadHistory: vi.fn(async () => ({ page: 1, pageSize: 10, total: 0, totalPages: 1, bosses: [] })) }
const defeatedSummary = {
  victoryDayCount: 13, daysRemainingAfterVictory: 17,
  community: { participantCount: 3, attackCount: '5', totalDamage: '1500000', averageDamage: '300000' },
  records: {
    topContributor: { rank: 1, playerId: 'p1', displayName: 'Alpha', totalDamage: '700000', attackCount: '2', bestHit: '400000' },
    biggestHit: { playerId: 'p2', displayName: 'Bravo', damage: '500000', createdAt: '2026-09-12T08:00:00Z' },
    mostAttacks: { rank: 1, playerId: 'p1', displayName: 'Alpha', totalDamage: '700000', attackCount: '2', bestHit: '400000' },
    finalBlow: { id: 'p3', displayName: 'Charlie' },
    topThree: [
      { rank: 1, playerId: 'p1', displayName: 'Alpha', totalDamage: '700000', attackCount: '2', bestHit: '400000' },
      { rank: 2, playerId: 'p2', displayName: 'Bravo', totalDamage: '500000', attackCount: '2', bestHit: '500000' },
      { rank: 3, playerId: 'p3', displayName: 'Charlie', totalDamage: '300000', attackCount: '1', bestHit: '300000' },
    ],
  },
} as const

describe('MonthlyBossScreen', () => {
  it('shows the compact authoritative identity, HP, resistance and always-present attack control', () => {
    const container = document.createElement('div'); document.body.append(container); const root = createRoot(container)
    act(() => root.render(<MonthlyBossScreen value={value} {...callbacks} />))
    expect(container.textContent).toContain('Seigneur des Ruines Oubliées')
    expect(container.textContent).toContain('1 490 000 / 1 500 000')
    expect(container.querySelector('[aria-label="Résistance Hydro — dégâts ×0,5"]')).not.toBeNull()
    expect(container.querySelector('.boss-resistance-label')?.textContent).toBe('Res :')
    expect(container.querySelector('.boss-resistance')?.children).toHaveLength(2)
    expect(container.querySelector('.boss-state-badge')?.textContent).toBe('Boss actif')
    expect(appCss).toMatch(/\.boss-identity-status \.boss-state-badge \{ position: absolute; top: 13px; right: 15px; \}/)
    expect(appCss).toContain('.boss-resistance { display: inline-flex; align-items: center; gap: 4px; }')
    expect(container.querySelector<HTMLImageElement>('.boss-element-icon img')?.getAttribute('src')).toBe('/assets/genshin/elements/hydro.png')
    expect(container.textContent).toContain('Bilan →')
    expect(container.textContent).not.toContain('Votre place : #4')
    expect(container.querySelector<HTMLButtonElement>('.boss-attack-button')?.disabled).toBe(false)
    act(() => root.unmount())
  })

  it('shows the complete live personal contribution and Top 3 from authoritative values', () => {
    const container = document.createElement('div'); document.body.append(container); const root = createRoot(container)
    act(() => root.render(<MonthlyBossScreen value={value} {...callbacks} />))
    act(() => Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Bilan →')!.click())
    expect(container.querySelector('[aria-label="Fermer"]')?.classList.contains('modal-close-button')).toBe(true)
    const text = container.querySelector('[aria-label="Bilan Boss"]')?.textContent ?? ''
    expect(text).toContain('Rang#4')
    expect(text).toContain('Dégâts totaux30 000')
    expect(text).toContain('Attaques3')
    expect(text).toContain('Meilleur coup12 000')
    expect(text).toContain('Part des PV max2,00 % sur 1 500 000 PV')
    expect(text).toContain('Top 3')
    expect(text).toContain('Joueur')
    act(() => root.unmount())
  })

  it('keeps an honest live contribution empty state while retaining the Top 3', () => {
    const container = document.createElement('div'); document.body.append(container); const root = createRoot(container)
    act(() => root.render(<MonthlyBossScreen value={{ ...value, participation: null }} {...callbacks} />))
    act(() => Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Bilan →')!.click())
    const text = container.querySelector('[aria-label="Bilan Boss"]')?.textContent ?? ''
    expect(text).toContain('Vous n’avez pas encore participé à ce Boss.')
    expect(text).toContain('Top 3')
    expect(text).toContain('Joueur')
    expect(text).not.toContain('Dégâts totaux30 000')
    act(() => root.unmount())
  })

  it('keeps attack visible but disabled once the Boss is defeated', () => {
    const container = document.createElement('div'); document.body.append(container); const root = createRoot(container)
    act(() => root.render(<MonthlyBossScreen value={{ ...value, status: 'DEFEATED', attackState: 'DEFEATED', canAttack: false, defeatedSummary, participation: { ...value.participation!, contributionBasisPoints: '164' }, boss: { ...value.boss, currentHp: '0', defeatedAt: '2026-09-13T08:00:00Z', finalBlowPlayer: { id: 'p3', displayName: 'Charlie' }, nextBaseAdjustment: '1275000' } }} {...callbacks} />))
    expect(container.textContent).toContain('✅ Vaincu')
    expect(container.textContent).toContain('✅ Boss vaincu ce mois-ci.')
    act(() => Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Bilan →')!.click())
    expect(container.textContent).toContain('Boss')
    expect(container.textContent).toContain('Communauté')
    expect(container.textContent).toContain('Records')
    expect(container.textContent).toContain('Votre contribution')
    expect(container.textContent).toContain('Participants3')
    expect(container.textContent).toContain('Attaques5')
    expect(container.textContent).toContain('17 jours d’avance → +1 275 000 baseHp le mois prochain')
    expect(container.textContent).toContain('1,64 % · #4')
    expect(container.textContent).not.toContain('Votre formation Boss')
    expect(container.textContent).not.toContain('Récupérer')
    expect(container.querySelector<HTMLButtonElement>('.boss-attack-button')?.disabled).toBe(true)
    act(() => root.unmount())
  })

  it('shows a sober defeated state for a non-participant without invented personal stats', () => {
    const container = document.createElement('div'); document.body.append(container); const root = createRoot(container)
    act(() => root.render(<MonthlyBossScreen value={{ ...value, status: 'DEFEATED', attackState: 'DEFEATED', canAttack: false, defeatedSummary, participation: null, boss: { ...value.boss, currentHp: '0', defeatedAt: '2026-09-13T08:00:00Z', finalBlowPlayer: { id: 'p3', displayName: 'Charlie' }, nextBaseAdjustment: '1275000' } }} {...callbacks} />))
    act(() => Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Bilan →')!.click())
    expect(container.textContent).toContain('Vous n’avez pas participé à ce Boss.')
    expect(container.textContent).not.toContain('1,64 %')
    act(() => root.unmount())
  })

  it('renders defeated and failed paginated history without leaving the Boss shell', async () => {
    const container = document.createElement('div'); document.body.append(container); const root = createRoot(container)
    const archived = { id: 'archived', monthStart: '2026-08-01', name: 'Monstre Abyssal', baseHp: '1500000', maxHp: '1600000', currentHp: '0', resistanceElementKey: 'pyro' as const, status: 'DEFEATED' as const, defeatedAt: '2026-08-20T08:00:00Z', finalBlowPlayer: { id: 'p1', displayName: 'Joueur' }, victoryDayCount: 20, daysRemainingAfterVictory: 11, nextBaseAdjustment: '825000', community: defeatedSummary.community, records: defeatedSummary.records }
    const failed = { ...archived, id: 'failed', monthStart: '2026-07-01', name: 'Titan du Soleil Brisé', baseHp: '1200000', maxHp: '1500000', currentHp: '225000', resistanceElementKey: 'hydro' as const, status: 'FAILED' as const, defeatedAt: null, finalBlowPlayer: null, victoryDayCount: null, daysRemainingAfterVictory: null, nextBaseAdjustment: '-225000', records: { ...defeatedSummary.records, finalBlow: null } }
    const onLoadHistory = vi.fn(async (page: number) => page === 1 ? { page: 1, pageSize: 10, total: 11, totalPages: 2, bosses: Array.from({ length: 10 }, (_, index) => ({ ...archived, id: `archived-${index}` })) } : { page: 2, pageSize: 10, total: 11, totalPages: 2, bosses: [failed] })
    act(() => root.render(<MonthlyBossScreen value={value} {...callbacks} onLoadHistory={onLoadHistory} />))
    act(() => Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Bilan →')!.click())
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Historique')!.click(); await Promise.resolve() })
    expect(container.textContent).toContain('Monstre Abyssal')
    expect(container.textContent).toContain('✅ Vaincu')
    expect(container.querySelectorAll('.boss-history article')).toHaveLength(10)
    await act(async () => { container.querySelector<HTMLButtonElement>('.boss-history article button')!.click() })
    expect(container.textContent).toContain('1 500 000 PV')
    expect(container.textContent).toContain('Dégâts totaux')
    await act(async () => { container.querySelector<HTMLButtonElement>('.boss-history-details .icon-button')!.click() })
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Suivant')!.click(); await Promise.resolve() })
    expect(onLoadHistory).toHaveBeenLastCalledWith(2)
    expect(container.textContent).toContain('225 000 PV restants')
    await act(async () => { container.querySelector<HTMLButtonElement>('.boss-history article button')!.click() })
    expect(container.textContent).toContain('225 000 PV restants → −225 000 baseHp le mois suivant')
    act(() => root.unmount())
  })

  it('keeps an empty history state and stable one-page pagination', async () => {
    const container = document.createElement('div'); document.body.append(container); const root = createRoot(container)
    act(() => root.render(<MonthlyBossScreen value={value} {...callbacks} />))
    act(() => Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Bilan →')!.click())
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Historique')!.click(); await Promise.resolve() })
    expect(container.textContent).toContain('Aucun Boss archivé.')
    expect(container.textContent).toContain('1 / 1')
    act(() => root.unmount())
  })
})
