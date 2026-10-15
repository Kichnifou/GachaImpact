// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import AppearancePanel from './AppearancePanel'
import type { AppearanceDto } from '../api/types'
import type { SocialActions } from '../social/types'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
it('consumes an opening once, allows closing during load and only consults a presented catalogue', async () => {
  let resolve!: (value: AppearanceDto) => void
  const value: AppearanceDto = { avatar: { kind: 'ELEMENT', assetPath: null }, title: null, equippedAvatarCosmeticId: null, equippedTitleCosmeticId: null, catalog: [{ id: 'new', displayName: 'Wriothesley', sourceCharacterId: 'character', type: 'AVATAR', owned: true, isActive: true, visibility: 'VISIBLE', assetPath: null, condition: null, isNew: true }] }
  const consult = vi.fn(async () => ({ consulted: ['new'] })), consumed = vi.fn()
  const actions = { appearance: () => new Promise<AppearanceDto>(done => { resolve = done }), consultAppearance: consult } as unknown as SocialActions
  const host = document.createElement('div'); document.body.append(host)
  const root = createRoot(host)
  const render = async (token: string) => act(async () => root.render(<AppearancePanel actions={actions} displayName="Fixture" elementKey="cryo" onChanged={async () => {}} openIntent={{ token, category: 'AVATAR' }} onIntentConsumed={consumed} />))
  try {
    await render('first')
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Chargement')
    expect(consumed).toHaveBeenCalledExactlyOnceWith('first')
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    await act(async () => resolve(value))
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(consult).not.toHaveBeenCalled()
    await render('second')
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Wriothesley')
    expect(document.querySelectorAll('.appearance-new')).toHaveLength(1)
    expect(consult).toHaveBeenCalledExactlyOnceWith('AVATAR', ['new'])
    expect(document.querySelector('[role="dialog"]')?.textContent).not.toContain('Possédé')
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    await render('third')
    expect(document.querySelectorAll('.appearance-new')).toHaveLength(0)
    expect(consult).toHaveBeenCalledOnce()
  } finally { act(() => root.unmount()); document.body.replaceChildren() }
})
