// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import AppearancePanel from './AppearancePanel'
import type { AppearanceDto } from '../api/types'
import type { SocialActions } from '../social/types'
import { TutorialPresentationContext } from '../tutorial/tutorial-presentation'
import { tutorialSteps } from '../tutorial/tutorial-catalog'
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root | undefined
afterEach(() => { act(() => root?.unmount()); root = undefined; document.body.replaceChildren() })
const value: AppearanceDto = { avatar: { kind: 'ELEMENT', assetPath: null }, title: null, equippedAvatarCosmeticId: null, equippedTitleCosmeticId: null, catalog: [{ id: 'a', displayName: 'Avatar possédé', type: 'AVATAR', owned: true, isActive: true, visibility: 'VISIBLE', assetPath: null, condition: null, isNew: true }] }
async function setup(equip = vi.fn(async () => value), tutorial = false) {
  const consult = vi.fn(async () => ({ consulted: ['a'] })), changed = vi.fn(async () => undefined)
  const actions = { appearance: async () => value, equipAppearance: equip, consultAppearance: consult } as unknown as SocialActions
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  await act(async () => root!.render(<TutorialPresentationContext value={{ active: tutorial, step: tutorialSteps.find(step => step.id === 'profile-avatars') ?? null }}><AppearancePanel actions={actions} displayName="Fixture" elementKey="pyro" onChanged={changed} /></TutorialPresentationContext>))
  return { host, consult, changed, equip }
}
it('only consults the opened catalogue and restores focus when Escape closes it', async () => {
  const { consult, equip } = await setup()
  expect(consult).not.toHaveBeenCalled(); expect(document.body.querySelector('.appearance-catalog')).toBeNull()
  const trigger = document.body.querySelector<HTMLButtonElement>('.appearance-choose')!; trigger.focus()
  await act(async () => trigger.click())
  expect(document.body.querySelector('[role="dialog"]')?.getAttribute('aria-labelledby')).toBeTruthy()
  expect(consult).toHaveBeenCalledOnce(); expect(equip).not.toHaveBeenCalled()
  await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  expect(document.body.querySelector('[role="dialog"]')).toBeNull(); expect(document.activeElement).toBe(trigger)
  expect(document.body.style.overflow).toBe('')
  await act(async () => trigger.click()); expect(consult).toHaveBeenCalledOnce()
})
it('keeps an equipment failure in the open dialogue without confirming a preview', async () => {
  const equip = vi.fn(async (): Promise<AppearanceDto> => { throw new Error('Connexion interrompue') })
  const { changed } = await setup(equip)
  await act(async () => document.body.querySelector<HTMLButtonElement>('.appearance-choose')!.click())
  await act(async () => document.body.querySelector<HTMLButtonElement>('.appearance-catalog button')!.click())
  expect(document.body.querySelector('[role="dialog"] [role="alert"]')).toBeTruthy(); expect(changed).not.toHaveBeenCalled()
  expect(document.body.querySelector('.appearance-preview')?.textContent).toContain('Avatar élémentaire')
})
it('does not refresh a departed account after delayed equipment and prevents double submission', async () => {
  let resolve!: (next: AppearanceDto) => void
  const equip = vi.fn(() => new Promise<AppearanceDto>(done => { resolve = done }))
  const { changed } = await setup(equip)
  await act(async () => document.body.querySelector<HTMLButtonElement>('.appearance-choose')!.click())
  act(() => { const button = document.body.querySelector<HTMLButtonElement>('.appearance-catalog button')!; button.click(); button.click() })
  expect(equip).toHaveBeenCalledOnce()
  act(() => root!.unmount()); root = undefined
  await act(async () => resolve(value)); expect(changed).not.toHaveBeenCalled()
})
it('presents the tutorial catalogue without consulting or equipping it', async () => {
  const { consult, equip } = await setup(undefined, true)
  expect(document.body.querySelector('[data-tutorial-anchor="appearance-chooser"]')).toBeTruthy()
  await act(async () => document.body.querySelector<HTMLButtonElement>('.appearance-catalog button')!.click())
  expect(consult).not.toHaveBeenCalled(); expect(equip).not.toHaveBeenCalled()
})
