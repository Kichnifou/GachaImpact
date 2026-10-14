// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import AppearancePanel from './AppearancePanel'
import type { AppearanceDto } from '../api/types'
import type { SocialActions } from '../social/types'
import { badgeSymbols } from '../../server/src/application/appearance/badges'
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
it('shows all ten free badges despite an avatar filter and equips only the badge family', async () => {
  let value: AppearanceDto = { avatar: { kind: 'ELEMENT', assetPath: null }, title: 'Titre conservé', equippedAvatarCosmeticId: 'avatar', equippedTitleCosmeticId: 'title', equippedBadgeCosmeticId: null, badgeSymbol: null, catalog: Object.values(badgeSymbols).map((displayName, i) => ({ id: 'badge-' + i, type: 'BADGE', displayName, owned: true, isActive: true, isNew: false, visibility: 'VISIBLE', assetPath: null, condition: null })) }
  const equipAppearance = vi.fn(async (_type: string, id: string | null) => { value = { ...value, equippedBadgeCosmeticId: id, badgeSymbol: value.catalog.find(c => c.id === id)?.displayName ?? null }; return value })
  const consultAppearance = vi.fn(), host = document.createElement('div'), root = createRoot(host)
  document.body.append(host)
  const actions = { appearance: async () => value, equipAppearance, consultAppearance } as unknown as SocialActions
  try {
    await act(async () => root.render(<AppearancePanel actions={actions} displayName="Owner" elementKey="hydro" onChanged={async () => {}} />))
    await act(async () => document.body.querySelector<HTMLButtonElement>('.appearance-choose')!.click())
    await act(async () => { const input = document.body.querySelector<HTMLInputElement>('input')!; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Ayaka'); input.dispatchEvent(new Event('input', { bubbles: true })) })
    await act(async () => [...document.body.querySelectorAll<HTMLButtonElement>('nav button')].find(b => b.textContent === 'Badges')!.click())
    expect(document.body.querySelectorAll('.appearance-badge-symbol')).toHaveLength(10)
    expect(document.body.querySelector('.appearance-controls')?.hasAttribute('hidden')).toBe(true)
    expect(host.textContent).toContain('Aucun badge')
    expect(consultAppearance).not.toHaveBeenCalled()
    await act(async () => document.body.querySelector<HTMLButtonElement>('.appearance-catalog button')!.click())
    expect(equipAppearance.mock.calls[0]?.[0]).toBe('BADGE')
    expect(value.equippedAvatarCosmeticId).toBe('avatar'); expect(value.equippedTitleCosmeticId).toBe('title')
    await act(async () => [...document.body.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === 'Déséquiper')!.click())
    expect(equipAppearance).toHaveBeenLastCalledWith('BADGE', null)
    await act(async () => [...document.body.querySelectorAll<HTMLButtonElement>('nav button')].find(b => b.textContent === 'Avatars')!.click())
    await act(async () => document.body.querySelector<HTMLButtonElement>('.appearance-choose')!.click())
    expect(document.body.querySelector<HTMLInputElement>('input')?.value).toBe('Ayaka')
  } finally { act(() => root.unmount()); host.remove() }
})
