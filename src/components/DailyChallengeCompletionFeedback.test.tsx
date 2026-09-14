// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DailyChallengeDto } from '../api/types'
import { isDailyChallengeCompletionTransition } from '../daily-challenge/presentation'
import DailyChallengeCompletionFeedback from './DailyChallengeCompletionFeedback'
import { LEVEL_UP_FEEDBACK_DURATION_MS } from './LevelUpFeedback'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const roots: Root[] = []
afterEach(() => { act(() => roots.splice(0).forEach((root) => root.unmount())); document.body.replaceChildren(); vi.useRealTimers() })

const challenge = { externalKey: 'daily_pulls_5', type: 'pulls', displayName: 'Vœux du jour', description: 'Effectuez 5 Invocations.', progressLabel: 'Invocations effectuées', progress: '5', target: '5', rewardPrimogems: '800' } as const
const completed = { status: 'COMPLETED', challenge } as DailyChallengeDto

function mountFeedback() {
  vi.useFakeTimers()
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container); roots.push(root)
  const onFinished = vi.fn()
  act(() => root.render(<DailyChallengeCompletionFeedback challenge={challenge} onFinished={onFinished} />))
  return { container, onFinished }
}

describe('daily challenge completion feedback', () => {
  it('only recognizes an in-session ACTIVE to COMPLETED transition', () => {
    expect(isDailyChallengeCompletionTransition('ACTIVE', completed)).toBe(true)
    expect(isDailyChallengeCompletionTransition('COMPLETED', completed)).toBe(false)
    expect(isDailyChallengeCompletionTransition('AVAILABLE', completed)).toBe(false)
  })

  it('renders and closes immediately when the backdrop is pressed', () => {
    const { container, onFinished } = mountFeedback()
    expect(container.textContent).toContain('Défi terminé !')
    expect(container.textContent).toContain('5 / 5 Invocations effectuées.')
    act(() => container.querySelector<HTMLElement>('.challenge-completion-overlay')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })))
    expect(onFinished).toHaveBeenCalledOnce()
  })

  it('does not close when the panel itself is pressed', () => {
    const { container, onFinished } = mountFeedback()
    act(() => container.querySelector<HTMLElement>('.challenge-completion-feedback')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })))
    expect(onFinished).not.toHaveBeenCalled()
  })

  it('closes immediately on Escape', () => {
    const { onFinished } = mountFeedback()
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
    expect(onFinished).toHaveBeenCalledOnce()
  })

  it('keeps the existing automatic timeout as a fallback', () => {
    const { onFinished } = mountFeedback()
    act(() => vi.advanceTimersByTime(LEVEL_UP_FEEDBACK_DURATION_MS))
    expect(onFinished).toHaveBeenCalledOnce()
  })

  it('finishes only once when backdrop and timeout both fire', () => {
    const { container, onFinished } = mountFeedback()
    act(() => container.querySelector<HTMLElement>('.challenge-completion-overlay')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })))
    act(() => vi.advanceTimersByTime(LEVEL_UP_FEEDBACK_DURATION_MS))
    expect(onFinished).toHaveBeenCalledOnce()
  })
})
