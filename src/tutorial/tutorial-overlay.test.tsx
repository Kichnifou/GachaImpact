// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import TutorialOverlay from './TutorialOverlay'
import type { TutorialStepId } from '../api/types'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
let root: Root, container: HTMLDivElement, observe: ReturnType<typeof vi.fn>, disconnect: ReturnType<typeof vi.fn>, resized: () => void
const previous = vi.fn(), next = vi.fn(), pause = vi.fn(), finish = vi.fn(), business = vi.fn()
beforeEach(() => {
  previous.mockClear(); next.mockClear(); pause.mockClear(); finish.mockClear(); business.mockClear()
  container = document.createElement('div'); container.id = 'root'; document.body.append(container)
  root = createRoot(container)
  observe = vi.fn(); disconnect = vi.fn()
  vi.stubGlobal('ResizeObserver', class { constructor(fn: () => void) { resized = fn } observe = observe; unobserve = vi.fn(); disconnect = disconnect })
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function(this: HTMLElement) {
    return new DOMRect(this.hasAttribute('data-tutorial-anchor') ? 10 : 0, 10, this.hasAttribute('data-tutorial-anchor') ? 100 : 350, this.hasAttribute('data-tutorial-anchor') ? 80 : 220)
  })
})
afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
const render = (stepId: TutorialStepId = 'profile') => act(async () => root.render(<><button data-business onClick={business} onKeyDown={business}>Business</button><div data-tutorial-anchor={stepId} /><TutorialOverlay stepId={stepId} pending={false} error="" onPrevious={previous} onNext={next} onPause={pause} onFinish={finish} /></>))
it('orders controls and disables Previous on profile', async () => {
  await render()
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.tutorial-bubble button'))
  expect(buttons.map(button => button.textContent)).toEqual(['Précédent', 'Suivant', 'Pause', 'Terminer'])
  expect(buttons[0].disabled).toBe(true)
})
it('keeps Suivant text stable and protects all mutations while pending', async () => {
  await act(async () => root.render(<><div data-tutorial-anchor="resources" /><TutorialOverlay stepId="resources" pending error="" onPrevious={previous} onNext={next} onPause={pause} onFinish={finish} /></>))
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.tutorial-bubble button'))
  expect(buttons.map(button => button.textContent)).toEqual(['Précédent', 'Suivant', 'Pause', 'Terminer'])
  expect(buttons.map(button => button.disabled)).toEqual([true, true, false, true])
})
it.each(['previous', 'finish'] as const)('enables only the failed %s action and Pause for retry', async retryAction => {
  await act(async () => root.render(<><div data-tutorial-anchor="resources" /><TutorialOverlay stepId="resources" pending={false} error="Indisponible" retryAction={retryAction} onPrevious={previous} onNext={next} onPause={pause} onFinish={finish} /></>))
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.tutorial-bubble button'))
  expect(buttons.map(button => button.disabled)).toEqual(retryAction === 'previous' ? [false, true, false, true] : [true, true, false, false])
})
it('portals outside inert UI, focuses Pause and traps keyboard', async () => {
  await render()
  expect(container.hasAttribute('inert')).toBe(true)
  expect(document.querySelector('.tutorial-layer')?.closest('[inert]')).toBeNull()
  expect(document.activeElement?.textContent).toBe('Pause')
  await act(async () => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })))
  expect(document.activeElement?.textContent).toBe('Terminer')
  container.querySelector('button')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  container.querySelector<HTMLButtonElement>('button')!.click(); expect(business).not.toHaveBeenCalled()
})
it.each(['Précédent', 'Suivant', 'Pause', 'Terminer'])('handles %s once without invoking the overlay Next as well', async label => {
  await render('resources'); await act(async () => Array.from(document.querySelectorAll<HTMLButtonElement>('.tutorial-bubble button')).find(el => el.textContent === label)!.click())
  expect(previous).toHaveBeenCalledTimes(label === 'Précédent' ? 1 : 0); expect(next).toHaveBeenCalledTimes(label === 'Suivant' ? 1 : 0); expect(pause).toHaveBeenCalledTimes(label === 'Pause' ? 1 : 0); expect(finish).toHaveBeenCalledTimes(label === 'Terminer' ? 1 : 0)
})
it('outside click advances, bubble text does not, Escape pauses', async () => {
  await render(); await act(async () => document.querySelector<HTMLElement>('.tutorial-layer')!.click()); expect(next).toHaveBeenCalledOnce()
  document.querySelector<HTMLElement>('#tutorial-text')!.click(); expect(next).toHaveBeenCalledOnce()
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); expect(pause).toHaveBeenCalledOnce()
})
it('keeps dialogue keyboard events away from underlying document shortcuts', async () => {
  await render(); document.addEventListener('keydown', business)
  try {
    await act(async () => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    expect(business).not.toHaveBeenCalled()
  } finally { document.removeEventListener('keydown', business) }
})
it('observes real layout, recalculates after resize and restores inert, aria and focus exactly', async () => {
  container.setAttribute('inert', 'existing'); container.setAttribute('aria-hidden', 'false')
  const origin = document.createElement('button'); document.body.append(origin); origin.focus()
  await render('resources'); expect(observe).toHaveBeenCalled()
  const before = document.querySelector<HTMLElement>('.tutorial-spotlight')!.style.width
  vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockImplementation(function(this: HTMLElement) { return new DOMRect(10, 10, this.hasAttribute('data-tutorial-anchor') ? 200 : 350, 80) })
  await act(async () => { resized(); window.dispatchEvent(new Event('resize')); await new Promise(resolve => requestAnimationFrame(resolve)) })
  expect(document.querySelector<HTMLElement>('.tutorial-spotlight')!.style.width).not.toBe(before)
  await act(async () => root.render(null))
  expect(container.getAttribute('inert')).toBe('existing'); expect(container.getAttribute('aria-hidden')).toBe('false')
  expect(document.activeElement).toBe(origin); expect(disconnect).toHaveBeenCalled()
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); expect(pause).not.toHaveBeenCalled()
  origin.remove()
})
it('neutralizes a newly mounted ordinary portal and cleans it up', async () => {
  await render(); const modal = document.createElement('section'); document.body.append(modal)
  await act(async () => { await Promise.resolve() }); expect(modal.hasAttribute('inert')).toBe(true)
  await act(async () => root.render(null)); expect(modal.hasAttribute('inert')).toBe(false); modal.remove()
})
it('drops removed real anchors from a composed spotlight after a layout change', async () => {
  vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockImplementation(function(this: HTMLElement) {
    return this.dataset.extra ? new DOMRect(200, 10, 100, 80) : new DOMRect(10, 10, this.hasAttribute('data-tutorial-anchor') ? 100 : 350, 80)
  })
  const layout = (extra: boolean) => <><div data-tutorial-anchor="resources" />{extra && <div data-tutorial-anchor="resources" data-extra="true" />}<TutorialOverlay stepId="resources" pending={false} error="" onPrevious={previous} onNext={next} onPause={pause} onFinish={finish} /></>
  await act(async () => root.render(layout(true)))
  expect(document.querySelector<HTMLElement>('.tutorial-spotlight')!.style.width).toBe('306px')
  await act(async () => root.render(layout(false)))
  await act(async () => { await new Promise(resolve => requestAnimationFrame(resolve)) })
  expect(document.querySelector<HTMLElement>('.tutorial-spotlight')!.style.width).toBe('116px')
})
