// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { PlayerProgressionDto } from '../api/types'
import LevelUpFeedback, { LEVEL_UP_FEEDBACK_DURATION_MS } from '../components/LevelUpFeedback'
import { buildLevelUpFeedback } from './level-up-feedback'
import { PROFILE_LEVEL_UP_DURATION_MS, useProfileLevelUpFeedback } from './use-profile-level-up-feedback'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const progression = (level: number): PlayerProgressionDto => ({ totalXp: String(level * 30), level, xpIntoCurrentStep: '0', xpPerStep: '30', isMaxLevel: false, level100OverflowRewardsClaimed: 0, totalMessages: '0', countedMessages: '0' })
const roots: Root[] = []

afterEach(() => {
  act(() => roots.splice(0).forEach((root) => root.unmount()))
  document.body.replaceChildren()
  vi.useRealTimers()
})

describe('level-up feedback', () => {
  it('never creates feedback for the initial load or unchanged progression', () => {
    expect(buildLevelUpFeedback(null, progression(12), [], 'initial')).toBeNull()
    expect(buildLevelUpFeedback(progression(12), progression(12), [], 'same')).toBeNull()
  })

  it('creates one +1 feedback from authoritative rewards and aggregates duplicate resource rows', () => {
    expect(buildLevelUpFeedback(progression(11), progression(12), [
      { resourceKey: 'primogems', amount: '400' }, { resourceKey: 'primogems', amount: '400' }, { resourceKey: 'moras', amount: '10000' },
    ], 'one')).toEqual({ id: 'one', levelsGained: 1, rewards: [{ resourceKey: 'primogems', amount: '800' }, { resourceKey: 'moras', amount: '10000' }] })
  })

  it('renders a multi-level title and all rewards on one line', () => {
    const event = buildLevelUpFeedback(progression(9), progression(12), [
      { resourceKey: 'primogems', amount: '800' }, { resourceKey: 'moras', amount: '10000' }, { resourceKey: 'particles_cryo', amount: '80' }, { resourceKey: 'particles_hydro', amount: '40' },
    ], 'multi')!
    const html = renderToStaticMarkup(<LevelUpFeedback event={event} onFinished={vi.fn()} />)
    expect(html).toContain('3 niveaux gagnés !')
    expect(html).toContain('+800 Primos · +10 000 Moras · +80 Cryo · +40 Hydro')
    expect(html).toContain('aria-live="polite"')
    expect((html.match(/<small>/g) ?? [])).toHaveLength(1)
  })

  it('expires once after the complete presentation duration', () => {
    vi.useFakeTimers()
    const event = buildLevelUpFeedback(progression(11), progression(12), [], 'timer')!
    const onFinished = vi.fn()
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    roots.push(root)
    act(() => root.render(<LevelUpFeedback event={event} onFinished={onFinished} />))
    act(() => vi.advanceTimersByTime(LEVEL_UP_FEEDBACK_DURATION_MS - 1))
    expect(onFinished).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(onFinished).toHaveBeenCalledWith('timer')
  })

  it('keeps the sidebar delta and profile glow for two seconds', () => {
    vi.useFakeTimers()
    const event = buildLevelUpFeedback(progression(9), progression(12), [], 'profile-timer')!
    function Probe() {
      const feedback = useProfileLevelUpFeedback(event)
      return <output data-visible={feedback.visible}>{feedback.levelsGained === null ? 'hidden' : `+${feedback.levelsGained}`}</output>
    }
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    roots.push(root)
    act(() => root.render(<Probe />))
    expect(container.querySelector('output')?.dataset.visible).toBe('true')
    expect(container.textContent).toBe('+3')
    act(() => vi.advanceTimersByTime(PROFILE_LEVEL_UP_DURATION_MS - 1))
    expect(container.textContent).toBe('+3')
    act(() => vi.advanceTimersByTime(1))
    expect(container.querySelector('output')?.dataset.visible).toBe('false')
    expect(container.textContent).toBe('hidden')
  })
})
