// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { BoxCharacterDto, PlayerBoxDto } from '../api/types'
import BoxScreen from './BoxScreen'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const character = (id: string, name: string): BoxCharacterDto => ({ id, externalKey: id, name, rarity: 5, elementKey: 'hydro', weaponType: 'Épée', region: 'Fontaine', iconPath: null, splashPath: null, wishPath: null, fullbodyPath: null, constellation: 0, copies: 1, firstObtainedAt: '2026-09-12T12:00:00Z', favorite: false, c6CompetitionStats: null })
const alpha = character('alpha', 'Alpha')
const beta = character('beta', 'Beta')
const box: PlayerBoxDto = { characters: [alpha, beta], summary: { totalOwned: 2, fiveStars: 2, fourStars: 0, c6: 0 }, preference: { sortKey: 'alphabetical', direction: 'asc' }, stella: { quantity: '0' } }
const containers: HTMLElement[] = []

afterEach(() => {
  document.body.replaceChildren()
  containers.splice(0)
})

describe('Box one-shot character intent', () => {
  it('consumes A, stays closed after normal navigation, then opens a later B intent', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    containers.push(container)
    const root = createRoot(container)
    const consumed = vi.fn()
    const shared = { initialBox: box, onLoadBox: vi.fn(async () => box), onSetFavorite: vi.fn(async () => alpha), onSetSortPreference: vi.fn(async (value) => value), onUseStella: vi.fn(), stellaRetryCharacterId: null }
    const renderBox = async (intent: { characterId: string; token: string } | null) => {
      await act(async () => { root.render(<BoxScreen {...shared} openCharacterIntent={intent} onOpenCharacterIntentConsumed={consumed} />); await Promise.resolve() })
    }

    await renderBox({ characterId: alpha.id, token: 'intent-a' })
    expect(container.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toContain('Alpha')
    expect(consumed).toHaveBeenCalledWith('intent-a')

    await renderBox(null)
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Fermer la fiche"]')!.click())
    expect(container.querySelector('[role="dialog"]')).toBeNull()

    act(() => root.render(<div>Accueil</div>))
    await renderBox(null)
    expect(container.querySelector('[role="dialog"]')).toBeNull()

    await renderBox({ characterId: beta.id, token: 'intent-b' })
    expect(container.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toContain('Beta')
    expect(consumed).toHaveBeenLastCalledWith('intent-b')
    act(() => root.unmount())
  })
})
