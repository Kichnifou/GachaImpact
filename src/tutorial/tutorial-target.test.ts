// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { getTutorialStep } from './tutorial-catalog'
import { waitForTutorialTarget } from './tutorial-target'

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 10, 100, 50))
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => callback(0), 1))
  vi.stubGlobal('cancelAnimationFrame', clearTimeout)
})
afterEach(() => { document.body.replaceChildren(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
function mount(id: 'bank-history' | 'contest-history') {
  const step = getTutorialStep(id)
  document.body.innerHTML = `<div id="root"><div data-tutorial-screen="${step.screen}" data-tutorial-step="${id}"><h2 data-tutorial-anchor="screen-entry">Entrée réelle</h2></div></div>`
  return { step, stage: document.querySelector('[data-tutorial-screen]')!, abort: new AbortController() }
}
it('waits for the requested mount and loading state before falling back to its genuine entry', async () => {
  const { step, stage, abort } = mount('bank-history'); stage.setAttribute('data-tutorial-step', 'bank-balances')
  const result = waitForTutorialTarget(step, abort.signal); let settled = false; void result.then(() => { settled = true })
  await vi.advanceTimersByTimeAsync(10); expect(settled).toBe(false)
  stage.setAttribute('data-tutorial-step', step.id); const loading = document.createElement('p'); loading.dataset.tutorialState = 'loading'; stage.append(loading)
  await vi.advanceTimersByTimeAsync(10); expect(settled).toBe(false)
  loading.remove(); await vi.advanceTimersByTimeAsync(10)
  await expect(result).resolves.toEqual({ anchor: 'screen-entry', fallback: true })
})
it('waits for a portal loading state rather than presenting its fallback heading', async () => {
  const { step, abort } = mount('contest-history')
  const portal = document.createElement('section'); portal.dataset.tutorialAnchor = step.anchor; portal.dataset.tutorialState = 'loading'; document.body.append(portal)
  const result = waitForTutorialTarget(step, abort.signal); let settled = false; void result.then(() => { settled = true })
  await vi.advanceTimersByTimeAsync(10); expect(settled).toBe(false)
  portal.removeAttribute('data-tutorial-state')
  await vi.advanceTimersByTimeAsync(10); await expect(result).resolves.toEqual({ anchor: step.anchor, fallback: false })
})
it('ignores a hidden inactive panel loading inside the mounted screen', async () => {
  const { step, stage, abort } = mount('bank-history')
  const panel = document.createElement('section'); panel.hidden = true
  panel.innerHTML = '<p data-tutorial-state="loading">Lecture inactive</p>'; stage.append(panel)
  const result = waitForTutorialTarget(step, abort.signal); await vi.advanceTimersByTimeAsync(10)
  await expect(result).resolves.toEqual({ anchor: 'screen-entry', fallback: true })
})
it('reports an explicit locked/empty fallback on a real primary entry', async () => {
  const { step, stage, abort } = mount('bank-history'); const entry = document.createElement('div'); entry.dataset.tutorialAnchor = step.anchor; entry.dataset.tutorialFallback = 'true'; stage.append(entry)
  const result = waitForTutorialTarget(step, abort.signal); await vi.advanceTimersByTimeAsync(10)
  await expect(result).resolves.toEqual({ anchor: step.anchor, fallback: true })
})
it('aborts immediately and cancels every deadline/frame even if an anchor mounts later', async () => {
  const { step, stage, abort } = mount('bank-history'); stage.setAttribute('data-tutorial-step', 'old')
  const result = waitForTutorialTarget(step, abort.signal); const rejected = expect(result).rejects.toMatchObject({ name: 'AbortError' }); abort.abort(); await rejected
  stage.setAttribute('data-tutorial-step', step.id); await vi.advanceTimersByTimeAsync(20_000)
  expect(vi.getTimerCount()).toBe(0)
})
it('fails a missing anchor with one bounded deadline and leaves no timer', async () => {
  const { step, stage, abort } = mount('bank-history'); stage.replaceChildren()
  const result = waitForTutorialTarget(step, abort.signal, 50); const rejected = expect(result).rejects.toThrow('ne peut pas être préparée')
  await vi.advanceTimersByTimeAsync(51); await rejected; expect(vi.getTimerCount()).toBe(0)
})
