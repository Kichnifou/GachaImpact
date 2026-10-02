import type { TutorialStepDefinition } from './tutorial-catalog'
import type { PreparedTutorialTarget } from './tutorial-controller'

export function visibleTutorialAnchors(anchor: string) {
  return Array.from(document.querySelectorAll<HTMLElement>(`[data-tutorial-anchor="${anchor}"]`)).filter(el => {
    const rect = el.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0 && !el.closest('[hidden]') && getComputedStyle(el).visibility !== 'hidden'
  })
}
function hasVisibleLoading(root: HTMLElement) {
  const nodes = [...(root.matches('[data-tutorial-state="loading"]') ? [root] : []), ...Array.from(root.querySelectorAll<HTMLElement>('[data-tutorial-state="loading"]'))]
  return nodes.some(el => !el.closest('[hidden]') && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0)
}
// One bounded, cancellable observation per transition; never fetches or invokes business code.
export function waitForTutorialTarget(step: TutorialStepDefinition, signal: AbortSignal, timeoutMs = 10_000): Promise<PreparedTutorialTarget> {
  return new Promise((resolve, reject) => {
    let observer: MutationObserver | undefined, deadline: ReturnType<typeof setTimeout> | undefined, frame = 0
    const cleanup = () => { observer?.disconnect(); clearTimeout(deadline); cancelAnimationFrame(frame); signal.removeEventListener('abort', cancel) }
    const cancel = () => { cleanup(); reject(new DOMException('Présentation annulée', 'AbortError')) }
    const inspect = () => {
      frame = 0
      const stage = document.querySelector<HTMLElement>(`[data-tutorial-screen="${step.screen}"][data-tutorial-step="${step.id}"]`)
      if (!stage || hasVisibleLoading(stage)) return
      const primary = visibleTutorialAnchors(step.anchor)
      if (primary.some(hasVisibleLoading)) return
      const screenEntry = visibleTutorialAnchors('screen-entry').filter(el => stage.contains(el))
      const fallback = screenEntry.length ? screenEntry : visibleTutorialAnchors(step.fallbackAnchor).filter(el => stage.contains(el))
      const anchor = primary.length ? step.anchor : fallback.length ? screenEntry.length ? 'screen-entry' : step.fallbackAnchor : null
      if (!anchor) return
      cleanup(); resolve({ anchor, fallback: !primary.length || primary.some(el => el.dataset.tutorialFallback === "true") })
    }
    if (signal.aborted) { cancel(); return }
    signal.addEventListener('abort', cancel, { once: true })
    observer = new MutationObserver(() => { if (!frame) frame = requestAnimationFrame(inspect) })
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-tutorial-screen', 'data-tutorial-step', 'data-tutorial-anchor', 'data-tutorial-state', 'data-tutorial-fallback', 'hidden', 'class', 'style'] })
    deadline = setTimeout(() => { cleanup(); reject(new Error('La vue guidée ne peut pas être préparée.')) }, timeoutMs)
    frame = requestAnimationFrame(inspect)
  })
}
