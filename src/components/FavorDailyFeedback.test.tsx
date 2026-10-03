// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import FavorDailyFeedback from './FavorDailyFeedback'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
let root: Root
afterEach(() => { act(() => root.unmount()); document.body.replaceChildren(); vi.useRealTimers() })
function mount() {
  vi.useFakeTimers(); const container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  const finish = vi.fn(); act(() => root.render(<FavorDailyFeedback id="today" onFinished={finish} />)); return { container, finish }
}
it('shows the exact accessible gain, focuses the dialog and locks Escape/backdrop for one second', () => {
  const { container, finish } = mount(); const dialog = container.querySelector<HTMLElement>('[role="dialog"]')!
  expect(dialog.getAttribute('aria-modal')).toBe('true'); expect(document.activeElement).toBe(dialog)
  expect(dialog.querySelector('.level-up-feedback-kicker')?.textContent).toBe('Récompense quotidienne')
  expect(dialog.querySelector(':scope > strong')?.textContent).toBe('Faveur de l’Astre')
  expect(dialog.querySelector('small')?.textContent).toBe('+800 Primogemmes')
  expect(dialog.getAttribute('aria-label')).toBe('Faveur de l’Astre — récompense quotidienne')
  for (const label of ['Faveur de l’Astre', 'Récompense quotidienne', '+800 Primogemmes']) expect(dialog.textContent).toContain(label)
  act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); container.firstElementChild!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })) }); expect(finish).not.toHaveBeenCalled()
  act(() => vi.advanceTimersByTime(1000)); act(() => dialog.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))); expect(finish).not.toHaveBeenCalled()
  act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))); expect(finish).toHaveBeenCalledExactlyOnceWith('today')
  act(() => vi.advanceTimersByTime(5400)); expect(finish).toHaveBeenCalledOnce()
})
it('allows only the backdrop after the initial lock', () => {
  const { container, finish } = mount(); act(() => vi.advanceTimersByTime(1000)); act(() => container.firstElementChild!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))); expect(finish).toHaveBeenCalledOnce()
})
it('automatically releases its queue entry at 5.4 seconds', () => {
  const { finish } = mount(); act(() => vi.advanceTimersByTime(5399)); expect(finish).not.toHaveBeenCalled(); act(() => vi.advanceTimersByTime(1)); expect(finish).toHaveBeenCalledExactlyOnceWith('today')
})
