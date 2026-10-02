import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import AppButton from '../components/AppButton'
import type { TutorialStepId } from '../api/types'
import { tutorialSteps } from './tutorial-controller'
import { spotlightRect, tutorialBubblePosition, unionTutorialRects, type TutorialRect } from './tutorial-geometry'
import './tutorial.css'

type Props = { stepId: TutorialStepId | null; pending: boolean; error: string; onNext: () => void; onPause: () => void; onFinish: () => void }
export default function TutorialOverlay({ stepId, pending, error, onNext, onPause, onFinish }: Props) {
  const layer = useRef<HTMLDivElement>(null), bubble = useRef<HTMLElement>(null), pause = useRef<HTMLButtonElement>(null)
  const actions = useRef({ onNext, onPause }); actions.current = { onNext, onPause }
  const [geometry, setGeometry] = useState<{ target: TutorialRect | null; left: number; top: number }>({ target: null, left: 12, top: 12 })
  const index = tutorialSteps.findIndex(step => step.id === stepId), step = tutorialSteps[index]

  useLayoutEffect(() => {
    const portal = layer.current!, previousFocus = document.activeElement
    const saved = new Map<HTMLElement, { inert: string | null; hidden: string | null }>()
    const neutralize = () => {
      for (const child of Array.from(document.body.children)) {
        if (!(child instanceof HTMLElement) || child === portal || saved.has(child)) continue
        saved.set(child, { inert: child.getAttribute('inert'), hidden: child.getAttribute('aria-hidden') })
        child.setAttribute('inert', ''); child.setAttribute('aria-hidden', 'true')
      }
    }
    neutralize()
    const observer = new MutationObserver(neutralize); observer.observe(document.body, { childList: true })
    pause.current?.focus({ preventScroll: true })
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); actions.current.onPause(); return }
      if (!portal.contains(event.target as Node)) { event.preventDefault(); event.stopImmediatePropagation(); pause.current?.focus({ preventScroll: true }); return }
      if (event.key === 'Tab') {
        const controls = Array.from(portal.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
        const current = controls.indexOf(document.activeElement as HTMLButtonElement)
        event.preventDefault(); event.stopImmediatePropagation()
        controls[(current + (event.shiftKey ? -1 : 1) + controls.length) % controls.length]?.focus()
      }
    }
    const intercept = (event: Event) => { if (!portal.contains(event.target as Node)) { event.preventDefault(); event.stopImmediatePropagation() } }
    const events = ['click', 'dblclick', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'submit']
    document.addEventListener('keydown', keyboard, true)
    document.addEventListener('keyup', intercept, true)
    events.forEach(name => document.addEventListener(name, intercept, { capture: true, passive: false }))
    return () => {
      observer.disconnect()
      document.removeEventListener('keydown', keyboard, true); document.removeEventListener('keyup', intercept, true)
      events.forEach(name => document.removeEventListener(name, intercept, true))
      saved.forEach((value, element) => {
        if (value.inert === null) element.removeAttribute('inert'); else element.setAttribute('inert', value.inert)
        if (value.hidden === null) element.removeAttribute('aria-hidden'); else element.setAttribute('aria-hidden', value.hidden)
      })
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected && !previousFocus.closest('[inert]')) previousFocus.focus({ preventScroll: true })
      else document.querySelector<HTMLButtonElement>('[data-menu-trigger]')?.focus({ preventScroll: true })
    }
  }, [])

  useLayoutEffect(() => {
    if (!bubble.current?.contains(document.activeElement)) pause.current?.focus({ preventScroll: true })
  }, [pending, stepId])

  useLayoutEffect(() => {
    let frame = 0, targets: HTMLElement[] = [], scrolled = false
    const measure = () => {
      frame = 0
      const found = stepId ? Array.from(document.querySelectorAll<HTMLElement>(`[data-tutorial-anchor="${stepId}"]`)).filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 }) : []
      if (found.length !== targets.length || found.some(el => !targets.includes(el))) { targets.forEach(el => resize.unobserve(el)); targets = found; targets.forEach(el => resize.observe(el)); scrolled = false }
      let rect = unionTutorialRects(targets.map(el => el.getBoundingClientRect()))
      if (rect && !scrolled) {
        scrolled = true
        const delta = rect.height > window.innerHeight - 24 ? rect.top - 12 : rect.top < 12 ? rect.top - 12 : rect.bottom > window.innerHeight - 12 ? rect.bottom - window.innerHeight + 12 : 0
        if (delta) window.scrollBy({ top: delta, behavior: 'instant' })
        // Local scroll owners, when present, scroll only enough to expose the target.
        targets.forEach(el => { if (el.getBoundingClientRect().bottom < 0 || el.getBoundingClientRect().top > window.innerHeight) el.scrollIntoView({ block: 'nearest', behavior: 'instant' }) })
        rect = unionTutorialRects(targets.map(el => el.getBoundingClientRect()))
      }
      const target = rect ? spotlightRect(rect, window.innerWidth, window.innerHeight) : null
      const box = bubble.current!.getBoundingClientRect()
      const position = tutorialBubblePosition(target, box, { width: window.innerWidth, height: window.innerHeight })
      setGeometry(previous => {
        const next = { target, ...position }; return JSON.stringify(previous) === JSON.stringify(next) ? previous : next
      })
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure) }
    const resize = new ResizeObserver(schedule)
    resize.observe(document.documentElement); resize.observe(bubble.current!)
    const mutations = new MutationObserver(schedule)
    mutations.observe(document.getElementById('root') ?? document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] })
    const resized = () => { scrolled = false; schedule() }
    window.addEventListener('resize', resized); window.addEventListener('scroll', schedule, true)
    measure()
    return () => { cancelAnimationFrame(frame); resize.disconnect(); mutations.disconnect(); window.removeEventListener('resize', resized); window.removeEventListener('scroll', schedule, true) }
  }, [stepId])

  const target = geometry.target
  return createPortal(<div ref={layer} className="tutorial-layer modal-layer" onPointerDown={event => { if (!(event.target instanceof Element) || !event.target.closest('button:not(:disabled)')) event.preventDefault() }} onKeyDown={event => event.stopPropagation()} onKeyUp={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); if (event.detail <= 1 && target) onNext() }}>
    {target ? <div className="tutorial-spotlight" aria-hidden="true" style={{ left: target.left, top: target.top, width: target.width, height: target.height }} /> : <div className="tutorial-shade" />}
    <section ref={bubble} className="tutorial-bubble" role="dialog" aria-modal="true" aria-labelledby="tutorial-title" aria-describedby="tutorial-text" aria-busy={pending} style={{ left: geometry.left, top: geometry.top }} onClick={event => event.stopPropagation()}>
      <span className="eyebrow">Tutoriel{step ? ` · ${index + 1}/${tutorialSteps.length}` : ''}</span>
      <h2 id="tutorial-title">{step?.title ?? 'Tutoriel'}</h2>
      <p id="tutorial-text" aria-live="polite">{step?.text ?? (pending ? 'Chargement…' : 'Reprenez avec Suivant.')}</p>
      <p className="tutorial-error" role={error ? 'alert' : undefined}>{error}</p>
      <footer><AppButton ref={pause} onClick={event => { event.stopPropagation(); onPause() }}>Pause</AppButton>
        <AppButton disabled={pending || Boolean(error) || !target} onClick={event => { event.stopPropagation(); if (event.detail <= 1) onFinish() }}>Terminer</AppButton>
        <AppButton variant="primary" disabled={pending || (!target && !error)} onClick={event => { event.stopPropagation(); if (event.detail <= 1) onNext() }}>{pending ? 'Enregistrement…' : 'Suivant'}</AppButton></footer>
    </section>
  </div>, document.body)
}
