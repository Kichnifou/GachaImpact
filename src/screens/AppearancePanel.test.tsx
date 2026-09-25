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
  it('shows the elemental fallback, visibility levels, equips owned items and supports no title', async () => {
    const container = document.createElement('div'); const root = createRoot(container)
    const appearance = vi.fn(async () => initial)
    const equipAppearance = vi.fn(async (type: 'AVATAR' | 'TITLE', id: string | null): Promise<AppearanceDto> => ({ ...initial, equippedAvatarCosmeticId: type === 'AVATAR' ? id : null }))
    const onChanged = vi.fn(async () => undefined)
    try {
      await act(async () => { root.render(<AppearancePanel actions={{ appearance, equipAppearance } as unknown as SocialActions} displayName="Élodie" elementKey="pyro" onChanged={onChanged} />); await Promise.resolve() })
      expect(container.querySelector('nav.activity-inner-tabs[role="tablist"]')).not.toBeNull()
      expect(container.textContent).toContain('Avatar élémentaire permanent')
      expect(container.textContent).toContain('Condition vérifiée')
      expect(container.textContent).toContain('Cosmétique mystérieux')
      expect(container.textContent).not.toContain('Fixture secret')
      expect(container.querySelectorAll('.appearance-catalog .app-button')).toHaveLength(1)
      await act(async () => { container.querySelector<HTMLButtonElement>('.appearance-catalog .app-button')!.click(); await Promise.resolve() })
      expect(equipAppearance).toHaveBeenCalledWith('AVATAR', 'owned')
      expect(onChanged).toHaveBeenCalledTimes(1)
      await act(async () => { [...container.querySelectorAll('nav.activity-inner-tabs button')].find(button => button.textContent === 'Titres')!.dispatchEvent(new Event('click', { bubbles: true })); await Promise.resolve() })
      expect(container.textContent).toContain('Aucun titre débloqué.')
      expect(container.textContent).toContain('Aucun titre')
    } finally { act(() => root.unmount()) }
  })
})
