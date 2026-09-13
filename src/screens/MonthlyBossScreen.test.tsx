// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MonthlyBossDto } from '../api/types'
import MonthlyBossScreen from './MonthlyBossScreen'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterEach(() => document.body.replaceChildren())

const value: MonthlyBossDto = {
  businessDate: '2026-09-13', boss: { id: '11111111-1111-1111-1111-111111111111', monthStart: '2026-09-01', name: 'Seigneur des Ruines Oubliées', baseHp: '1500000', hpVariationPercent: 0, maxHp: '1500000', currentHp: '1490000', resistanceElementKey: 'hydro', defeatedAt: null, finalBlowPlayer: null, nextBaseAdjustment: null },
  status: 'ALIVE', attackState: 'AVAILABLE', canAttack: true,
  availableCharacters: [], loadout: { slots: [1, 2, 3, 4].map((position) => ({ position: position as 1 | 2 | 3 | 4, character: null })) },
  preview: { totalDamage: '10000', contributions: [] }, reward: { primogems: '16000', moras: '500000' }, participation: { rank: 4, totalDamage: '30000', attackCount: '3', bestHit: '12000' },
  ranking: [{ rank: 1, playerId: 'p1', displayName: 'Joueur', totalDamage: '50000', attackCount: '4', bestHit: '15000' }],
  playerStats: { totalDamage: '30000', totalAttacks: '3', totalParticipated: '1', totalRewarded: '0', finalBlows: '0', bestHit: '12000' },
}
const callbacks = { onSetSlot: vi.fn(), onRemoveSlot: vi.fn(), onCopyActive: vi.fn(), onClear: vi.fn(), onAttack: vi.fn(), onLoadHistory: vi.fn(async () => ({ page: 1, pageSize: 10, total: 0, totalPages: 1, bosses: [] })) }

describe('MonthlyBossScreen', () => {
  it('shows authoritative identity, HP, resistance, preview and the always-present attack control', () => {
    const container = document.createElement('div'); document.body.append(container); const root = createRoot(container)
    act(() => root.render(<MonthlyBossScreen value={value} {...callbacks} />))
    expect(container.textContent).toContain('Seigneur des Ruines Oubliées')
    expect(container.textContent).toContain('1 490 000 / 1 500 000')
    expect(container.textContent).toContain('Résistance Hydro')
    expect(container.textContent).toContain('Votre place : #4')
    expect(container.querySelector<HTMLButtonElement>('.boss-attack-button')?.disabled).toBe(false)
    act(() => root.unmount())
  })

  it('keeps attack visible but disabled once the Boss is defeated', () => {
    const container = document.createElement('div'); document.body.append(container); const root = createRoot(container)
    act(() => root.render(<MonthlyBossScreen value={{ ...value, status: 'DEFEATED', attackState: 'DEFEATED', canAttack: false, boss: { ...value.boss, currentHp: '0', defeatedAt: '2026-09-13T08:00:00Z', finalBlowPlayer: { id: 'p1', displayName: 'Joueur' }, nextBaseAdjustment: '1275000' } }} {...callbacks} />))
    expect(container.textContent).toContain('✅ Vaincu')
    expect(container.textContent).toContain('récompenses ont été versées automatiquement')
    expect(container.textContent).toContain('Versement automatique effectué.')
    expect(container.textContent).not.toContain('Votre formation Boss')
    expect(container.textContent).not.toContain('Récupérer')
    expect(container.querySelector<HTMLButtonElement>('.boss-attack-button')?.disabled).toBe(true)
    act(() => root.unmount())
  })

  it('renders defeated and failed paginated history without leaving the Boss shell', async () => {
    const container = document.createElement('div'); document.body.append(container); const root = createRoot(container)
    const onLoadHistory = vi.fn(async (page: number) => page === 1 ? { page: 1, pageSize: 10, total: 11, totalPages: 2, bosses: [{ id: 'archived', monthStart: '2026-08-01', name: 'Monstre Abyssal', maxHp: '1500000', currentHp: '0', resistanceElementKey: 'pyro' as const, defeatedAt: '2026-08-20T08:00:00Z', finalBlowPlayer: { id: 'p1', displayName: 'Joueur' }, participantCount: 8 }] } : { page: 2, pageSize: 10, total: 11, totalPages: 2, bosses: [{ id: 'failed', monthStart: '2026-07-01', name: 'Titan du Soleil Brisé', maxHp: '1500000', currentHp: '225000', resistanceElementKey: 'hydro' as const, defeatedAt: null, finalBlowPlayer: null, participantCount: 4 }] })
    act(() => root.render(<MonthlyBossScreen value={value} {...callbacks} onLoadHistory={onLoadHistory} />))
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Historique')!.click(); await Promise.resolve() })
    expect(container.textContent).toContain('Monstre Abyssal')
    expect(container.textContent).toContain('✅ Vaincu')
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Suivant')!.click(); await Promise.resolve() })
    expect(onLoadHistory).toHaveBeenLastCalledWith(2)
    expect(container.textContent).toContain('225 000 PV restants')
    act(() => root.unmount())
  })
})
