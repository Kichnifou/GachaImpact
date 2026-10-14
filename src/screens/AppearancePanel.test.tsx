// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import type { AppearanceDto } from '../api/types'
import type { SocialActions } from '../social/types'
import AppearancePanel from './AppearancePanel'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const initial: AppearanceDto = { avatar: { kind: 'ELEMENT', assetPath: null }, title: null, equippedAvatarCosmeticId: null, equippedTitleCosmeticId: null, catalog: [
  { id: 'visible', type: 'AVATAR', displayName: 'Fixture visible', assetPath: '/assets/fixture.png', condition: 'Condition vérifiée', visibility: 'VISIBLE', owned: false, isActive: true },
  { id: 'mystery', type: 'AVATAR', displayName: 'Cosmétique mystérieux', assetPath: null, condition: null, visibility: 'MYSTERY', owned: false, isActive: true },
  { id: 'owned', type: 'AVATAR', displayName: 'Fixture possédé', assetPath: '/assets/owned.png', condition: null, visibility: 'VISIBLE', owned: true, isActive: true },
] }

describe('AppearancePanel', () => {
  it('groups level titles by derived thresholds descending, keeps future families separate and preserves equipment', async () => {
    const container = document.createElement('div'), root = createRoot(container); document.body.append(container)
    const catalog: AppearanceDto['catalog'] = [10, 50, 25, 100, 75].map(level => ({ id: 'level-' + level, type: 'TITLE', displayName: 'Titre ' + level, levelRequirement: level, assetPath: null, condition: 'Atteindre le niveau ' + level, visibility: 'VISIBLE', owned: level <= 50, isActive: true }))
    const appearance = { ...initial, equippedTitleCosmeticId: 'level-50', catalog: [...catalog, { id: 'future', type: 'TITLE' as const, displayName: 'Une autre famille', levelRequirement: null, assetPath: null, condition: null, visibility: 'VISIBLE' as const, owned: false, isActive: true }] }
    const equipAppearance = vi.fn(async () => appearance)
    try {
      await act(async () => { root.render(<AppearancePanel actions={{ appearance: async () => appearance, equipAppearance } as unknown as SocialActions} displayName="Axel" elementKey="hydro" onChanged={async () => {}} />); await Promise.resolve() })
      await act(async () => document.body.querySelector<HTMLButtonElement>('.appearance-choose')!.click())
      await act(async () => [...document.body.querySelectorAll('nav button')].find(button => button.textContent === 'Titres')!.dispatchEvent(new Event('click', { bubbles: true })))
      await act(async () => document.body.querySelector<HTMLButtonElement>('.appearance-choose')!.click())
      const section = document.body.querySelector('.appearance-level-section')!
      expect(section.querySelector('h3')?.textContent).toBe('Titres de niveaux')
      expect([...section.querySelectorAll('.appearance-card strong')].map(node => node.textContent)).toEqual(['Titre 100', 'Titre 75', 'Titre 50', 'Titre 25', 'Titre 10'])
      for (const level of [10,25,50,75,100]) expect(section.querySelector('.title-tier-' + level)).toBeTruthy()
      expect(section.textContent).not.toContain('Une autre famille')
      expect(section.querySelectorAll('.is-locked')).toHaveLength(2)
      expect(section.querySelector('.is-equipped')?.textContent).toContain('Équipé')
      expect(document.body.querySelector('.appearance-tabs')).toBeTruthy()
      expect(equipAppearance).not.toHaveBeenCalled()
    } finally { act(() => root.unmount()); container.remove() }
  })
  it('shows owned character portraits alphabetically and falls back to the simple element icon', async () => {
    const container = document.createElement('div'); const root = createRoot(container); document.body.append(container)
    const catalog: AppearanceDto['catalog'] = [
      { id: 'z', sourceCharacterId: 'character-z', type: 'AVATAR', displayName: 'Zeta', assetPath: null, condition: null, visibility: 'SECRET', owned: true, isActive: true },
      { id: 'a', sourceCharacterId: 'character-a', type: 'AVATAR', displayName: 'Alpha', assetPath: '/assets/genshin/characters/alpha.png', condition: null, visibility: 'SECRET', owned: true, isActive: true },
      { id: 'hidden', sourceCharacterId: 'character-hidden', type: 'AVATAR', displayName: 'Unowned', assetPath: null, condition: null, visibility: 'SECRET', owned: false, isActive: true },
    ]
    const equipAppearance = vi.fn(async (_type: 'AVATAR' | 'TITLE', _id: string | null) => ({ ...initial, catalog }))
    try {
      await act(async () => { root.render(<AppearancePanel actions={{ appearance: async () => ({ ...initial, catalog }), equipAppearance } as unknown as SocialActions} displayName="Élodie" elementKey="pyro" onChanged={async () => undefined} />); await Promise.resolve() })
      await act(async () => document.body.querySelector<HTMLButtonElement>('.appearance-choose')!.click())
      const cards = [...document.body.querySelectorAll('.appearance-character-card')]
      expect(cards).toHaveLength(2)
      expect(cards.map(card => card.querySelector('strong')?.textContent)).toEqual(['Alpha', 'Zeta'])
      expect(cards[0]?.querySelector('img')?.getAttribute('src')).toBe('/assets/genshin/characters/alpha.png')
      expect(cards[1]?.querySelector('img')?.getAttribute('src')).toBe('/assets/genshin/elements/pyro.png')
      expect(document.body.textContent).not.toContain('Unowned')
      await act(async () => { cards[0]?.querySelector<HTMLButtonElement>('button')?.click(); await Promise.resolve() })
      expect(equipAppearance).toHaveBeenCalledWith('AVATAR', 'a')
    } finally { act(() => root.unmount()); container.remove() }
  })
  it('shows the elemental fallback, visibility levels, equips owned items and supports no title', async () => {
    const container = document.createElement('div'); const root = createRoot(container); document.body.append(container)
    const appearance = vi.fn(async () => initial)
    const equipAppearance = vi.fn(async (type: 'AVATAR' | 'TITLE', id: string | null): Promise<AppearanceDto> => ({ ...initial, equippedAvatarCosmeticId: type === 'AVATAR' ? id : null }))
    const onChanged = vi.fn(async () => undefined)
    try {
      await act(async () => { root.render(<AppearancePanel actions={{ appearance, equipAppearance } as unknown as SocialActions} displayName="Élodie" elementKey="pyro" onChanged={onChanged} />); await Promise.resolve() })
      await act(async () => document.body.querySelector<HTMLButtonElement>('.appearance-choose')!.click())
      expect(document.body.querySelector('nav.activity-inner-tabs[role="tablist"]')).not.toBeNull()
      expect(document.body.textContent).toContain('Avatar élémentaire permanent')
      expect(document.body.textContent).toContain('Condition vérifiée')
      expect(document.body.textContent).toContain('Cosmétique mystérieux')
      expect(document.body.textContent).not.toContain('Fixture secret')
      expect(document.body.querySelectorAll('.appearance-catalog .app-button')).toHaveLength(1)
      await act(async () => { document.body.querySelector<HTMLButtonElement>('.appearance-catalog .app-button')!.click(); await Promise.resolve() })
      expect(equipAppearance).toHaveBeenCalledWith('AVATAR', 'owned')
      expect(onChanged).toHaveBeenCalledTimes(1)
      await act(async () => { [...document.body.querySelectorAll('nav.activity-inner-tabs button')].find(button => button.textContent === 'Titres')!.dispatchEvent(new Event('click', { bubbles: true })); await Promise.resolve() })
      await act(async () => document.body.querySelector<HTMLButtonElement>('.appearance-choose')!.click())
      expect(document.body.textContent).toContain('Aucun titre débloqué.')
      expect(document.body.textContent).toContain('Aucun titre')
    } finally { act(() => root.unmount()); container.remove() }
  })
})
