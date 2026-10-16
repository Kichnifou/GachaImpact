// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AccountDeletionPanel from './AccountDeletionPanel'
import { TutorialPresentationContext } from '../tutorial/tutorial-presentation'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const roots: ReturnType<typeof createRoot>[] = []
afterEach(() => { act(() => roots.splice(0).forEach(root => root.unmount())); document.body.replaceChildren(); vi.restoreAllMocks() })
function mount(tutorial = false) {
  const host = document.createElement('div'); document.body.append(host)
  const root = createRoot(host); roots.push(root)
  act(() => root.render(<TutorialPresentationContext.Provider value={{ active: tutorial, step: null }}><AccountDeletionPanel /></TutorialPresentationContext.Provider>))
  return host
}
describe('account deletion fallback', () => {
  it('shows the danger action and keeps deletion unavailable even after confirmation, without network calls', () => {
    const network = vi.spyOn(globalThis, 'fetch')
    const host = mount(), opener = host.querySelector('button')!
    expect(opener.classList.contains('app-button-danger')).toBe(true)
    act(() => { opener.focus(); opener.click() })
    const dialog = host.querySelector<HTMLElement>('[role="dialog"]')!
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.textContent).toContain('Aucune donnée ne sera supprimée')
    const input = dialog.querySelector('input')!
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'SUPPRIMER')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const confirm = Array.from(dialog.querySelectorAll('button')).at(-1)!
    expect(confirm.disabled).toBe(true)
    act(() => confirm.click())
    expect(network).not.toHaveBeenCalled()
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })))
    expect(host.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(opener)
  })
  it('disables the action during the interactive tutorial', () => {
    const host = mount(true), opener = host.querySelector('button')!
    expect(opener.disabled).toBe(true)
    act(() => opener.click())
    expect(host.querySelector('[role="dialog"]')).toBeNull()
  })
  it('traps focus and allows cancellation without changing the account', () => {
    const host = mount()
    act(() => host.querySelector('button')!.click())
    const input = host.querySelector('input')!, cancel = host.querySelector<HTMLButtonElement>('[role="dialog"] button')!
    expect(document.activeElement).toBe(input)
    act(() => { cancel.focus(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })) })
    expect(document.activeElement).toBe(input)
    act(() => cancel.click())
    expect(host.querySelector('[role="dialog"]')).toBeNull()
  })
})
