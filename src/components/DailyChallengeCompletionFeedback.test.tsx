// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DailyChallengeDto } from '../api/types'
import { isDailyChallengeCompletionTransition } from '../daily-challenge/presentation'
import DailyChallengeCompletionFeedback from './DailyChallengeCompletionFeedback'
import { LEVEL_UP_FEEDBACK_DISMISS_LOCK_MS, LEVEL_UP_FEEDBACK_DURATION_MS } from './LevelUpFeedback'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterEach(() => { document.body.replaceChildren(); vi.useRealTimers() })

const challenge = { externalKey: 'daily_pulls_5', type: 'pulls', displayName: 'Vœux du jour', description: 'Effectuez 5 Invocations.', progressLabel: 'Invocations effectuées', progress: '5', target: '5', rewardPrimogems: '800' } as const
const completed = { status: 'COMPLETED', challenge } as DailyChallengeDto

describe('daily challenge completion feedback', () => {
  it('only recognizes an in-session ACTIVE to COMPLETED transition', () => {
    expect(isDailyChallengeCompletionTransition('ACTIVE', completed)).toBe(true)
    expect(isDailyChallengeCompletionTransition('COMPLETED', completed)).toBe(false)
    expect(isDailyChallengeCompletionTransition('AVAILABLE', completed)).toBe(false)
  })

  it('uses the shared timed overlay family with a one-second dismissal lock', () => {
    vi.useFakeTimers()
    const container = document.createElement('div'); document.body.append(container)
    const root = createRoot(container)
    const onFinished = vi.fn()
    act(() => root.render(<DailyChallengeCompletionFeedback challenge={challenge} onFinished={onFinished} />))
    expect(container.textContent).toContain('Défi terminé !')
    expect(container.textContent).toContain('5 / 5 Invocations effectuées.')
    act(() => container.querySelector<HTMLElement>('.challenge-completion-overlay')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })))
    expect(onFinished).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(LEVEL_UP_FEEDBACK_DISMISS_LOCK_MS))
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
    expect(onFinished).toHaveBeenCalledOnce()
    act(() => root.unmount())

    const second = document.createElement('div'); document.body.append(second)
    const secondRoot = createRoot(second); const autoFinished = vi.fn()
    act(() => secondRoot.render(<DailyChallengeCompletionFeedback challenge={challenge} onFinished={autoFinished} />))
    act(() => vi.advanceTimersByTime(LEVEL_UP_FEEDBACK_DURATION_MS))
    expect(autoFinished).toHaveBeenCalledOnce()
    act(() => secondRoot.unmount())
  })
})
