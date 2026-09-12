// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DailyCombatCharacterDto, DailyCombatDto, DailyCombatFightDto } from '../api/types'
import DailyCombatScreen from './DailyCombatScreen'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const roots: Root[] = []
afterEach(() => { act(() => roots.splice(0).forEach((root) => root.unmount())); document.body.replaceChildren() })

const characters: DailyCombatCharacterDto[] = Array.from({ length: 8 }, (_, index) => ({
  id: `character-${index + 1}`, externalKey: `fixture:${index + 1}`, name: `Personnage ${index + 1}`,
  rarity: index < 4 ? 5 : 4, elementKey: (['pyro', 'hydro', 'cryo', 'electro', 'anemo', 'geo', 'dendro', 'hydro'] as const)[index]!,
  weaponType: null, region: null, iconPath: null, splashPath: null, wishPath: null, fullbodyPath: null,
  constellation: index, copies: index + 1, firstObtainedAt: '2026-09-12T00:00:00.000Z', favorite: false, displayOrder: index,
  combatStats: { fights: String(index + 2), wins: String(index + 1), losses: '1', winRatePercent: 75 },
}))

function combat(overrides: Partial<DailyCombatDto> = {}): DailyCombatDto {
  return {
    businessDate: '2026-09-12', status: 'TODO',
    encounter: { id: 'encounter', enemies: characters.slice(0, 4).map((character, index) => ({ position: (index + 1) as 1 | 2 | 3 | 4, character })) },
    loadout: { nextAttemptMode: 'MANUAL', slots: [1, 2, 3, 4].map((position) => ({ position: position as 1 | 2 | 3 | 4, character: null, ko: false })) },
    availableCharacters: characters, koCharacterIds: [], availableCharacterCount: 8, preview: null, canFight: false,
    reward: { primogems: '800', moras: '20000' }, lastAttempt: null,
    playerStats: { totalFights: '0', totalWins: '0', totalLosses: '0', totalManualWins: '0' },
    ...overrides,
  }
}

function mount(value: DailyCombatDto, overrides: Partial<React.ComponentProps<typeof DailyCombatScreen>> = {}) {
  const props = {
    value,
    onSetSlot: vi.fn(async () => value), onRemoveSlot: vi.fn(async () => value), onCopyActive: vi.fn(async () => value),
    onAuto: vi.fn(async () => value), onClear: vi.fn(async () => value),
    onFight: vi.fn(async (): Promise<DailyCombatFightDto> => ({ operation: { id: 'operation', alreadyProcessed: false }, result: { won: true, mode: 'MANUAL', chanceHalfPoints: 148 }, view: { ...value, status: 'COMPLETED' }, resources: { primogems: '800', moras: '20000', particles: { pyro: '0', hydro: '0', cryo: '0', electro: '0', anemo: '0', geo: '0', dendro: '0' } } })),
    ...overrides,
  }
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container); roots.push(root)
  act(() => root.render(<DailyCombatScreen {...props} />))
  return { container, props }
}

describe('Daily Combat screen', () => {
  it('renders the global encounter and an empty persistent loadout, then opens the real picker', async () => {
    const { container, props } = mount(combat())
    expect(container.querySelectorAll('.combat-enemy-card')).toHaveLength(4)
    expect(container.querySelectorAll('.combat-empty-slot')).toHaveLength(4)
    act(() => container.querySelector<HTMLButtonElement>('.combat-empty-slot')!.click())
    expect(container.querySelectorAll('.combat-picker .box-character-card')).toHaveLength(8)
    await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label="Ouvrir la fiche de Personnage 1"]')!.click(); await Promise.resolve() })
    expect(props.onSetSlot).toHaveBeenCalledWith(1, 'character-1')
  })

  it('shows the exact half-point preview, details, pending Auto mode and KO stats in the shared character detail', () => {
    const value = combat({
      status: 'IN_PROGRESS', koCharacterIds: ['character-1'],
      loadout: { nextAttemptMode: 'AUTO', slots: characters.slice(0, 4).map((character, index) => ({ position: (index + 1) as 1 | 2 | 3 | 4, character, ko: index === 0 })) },
      preview: { baseHalfPoints: 100, rarityBonusHalfPoints: 48, constellationBonusHalfPoints: 12, favorableMatchups: 2, favorableBonusHalfPoints: 16, unfavorableMatchups: 2, unfavorableMalusHalfPoints: 16, rawHalfPoints: 160, clamp: null, finalHalfPoints: 160, memberContributions: characters.slice(0, 4).map((character) => ({ characterId: character.id, halfPoints: 40 })) },
      canFight: false,
    })
    const { container } = mount(value)
    expect(container.textContent).toContain('80 %')
    expect(container.textContent).toContain('Prochaine tentative : Auto')
    act(() => container.querySelector<HTMLDetailsElement>('.combat-preview details')!.open = true)
    expect(container.querySelector('.combat-preview dl')?.textContent).toContain('Base50 %')
    act(() => container.querySelector<HTMLButtonElement>('.combat-slot-actions button')!.click())
    expect(container.querySelector('.box-combat-state')?.textContent).toContain('Combat : 💀 KO — Disponible demain')
    expect(container.querySelector('.box-combat-state')?.textContent).toContain('Combats2')
  })

  it('discloses the authoritative victory and reward after one fight intent', async () => {
    const value = combat({
      loadout: { nextAttemptMode: 'MANUAL', slots: characters.slice(0, 4).map((character, index) => ({ position: (index + 1) as 1 | 2 | 3 | 4, character, ko: false })) },
      preview: { baseHalfPoints: 100, rarityBonusHalfPoints: 48, constellationBonusHalfPoints: 12, favorableMatchups: 0, favorableBonusHalfPoints: 0, unfavorableMatchups: 0, unfavorableMalusHalfPoints: 0, rawHalfPoints: 160, clamp: null, finalHalfPoints: 160, memberContributions: [] }, canFight: true,
    })
    const { container, props } = mount(value)
    await act(async () => { container.querySelector<HTMLButtonElement>('.combat-resolution button')!.click(); await Promise.resolve() })
    expect(props.onFight).toHaveBeenCalledOnce()
    expect(container.querySelector('.combat-resolution')?.textContent).toContain('Victoire !')
    expect(container.querySelector('.combat-resolution')?.textContent).toContain('Obtenu : +800 Primogemmes · +20 000 Moras')
  })

  it('surfaces a controlled Combat message when a fight rejects a KO character', async () => {
    const value = combat({
      loadout: { nextAttemptMode: 'MANUAL', slots: characters.slice(0, 4).map((character, index) => ({ position: (index + 1) as 1 | 2 | 3 | 4, character, ko: false })) },
      preview: { baseHalfPoints: 100, rarityBonusHalfPoints: 48, constellationBonusHalfPoints: 12, favorableMatchups: 0, favorableBonusHalfPoints: 0, unfavorableMatchups: 0, unfavorableMalusHalfPoints: 0, rawHalfPoints: 160, clamp: null, finalHalfPoints: 160, memberContributions: [] }, canFight: true,
    })
    const { container } = mount(value, { onFight: vi.fn().mockRejectedValue({ code: 'DAILY_COMBAT_CHARACTER_KO' }) })
    await act(async () => { container.querySelector<HTMLButtonElement>('.combat-resolution button')!.click(); await Promise.resolve() })
    const alert = container.querySelector('[role="alert"]')
    expect(alert?.textContent).toBe('Un personnage sélectionné est KO jusqu’à demain.')
    expect(alert?.textContent).not.toBe('La demande n’a pas pu être traitée.')
  })

  it('surfaces a controlled Combat message when Auto has too few available characters', async () => {
    const { container } = mount(combat(), { onAuto: vi.fn().mockRejectedValue({ code: 'DAILY_COMBAT_NOT_ENOUGH_AVAILABLE' }) })
    const auto = Array.from(container.querySelectorAll<HTMLButtonElement>('.combat-loadout-actions button')).find((button) => button.textContent === 'Équipe automatique')!
    await act(async () => { auto.click(); await Promise.resolve() })
    const alert = container.querySelector('[role="alert"]')
    expect(alert?.textContent).toBe('Vous n’avez plus assez de personnages disponibles aujourd’hui.')
    expect(alert?.textContent).not.toBe('La demande n’a pas pu être traitée.')
  })

  it('keeps Boss as an honest unavailable shell with no invented gameplay', () => {
    const { container } = mount(combat())
    act(() => Array.from(container.querySelectorAll<HTMLButtonElement>('.combat-tabs button')).find((button) => button.textContent === 'Boss')!.click())
    expect(container.textContent).toContain('Bientôt disponible')
    expect(container.textContent).toContain('Le Boss n’est pas encore implémenté.')
    expect(container.textContent).not.toMatch(/PV|résistance|classement/i)
  })
})
