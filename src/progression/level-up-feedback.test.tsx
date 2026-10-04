// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { GachaPullDto, PlayerProgressionDto } from '../api/types'
import LevelUpFeedback, { LEVEL_UP_FEEDBACK_DISMISS_LOCK_MS, LEVEL_UP_FEEDBACK_DURATION_MS } from '../components/LevelUpFeedback'
import { buildLevelUpFeedback, gachaLevelRewards } from './level-up-feedback'
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

  it('renders a multi-level title and all explicitly labelled rewards', () => {
    const event = buildLevelUpFeedback(progression(9), progression(12), [
      { resourceKey: 'primogems', amount: '800' }, { resourceKey: 'moras', amount: '10000' }, { resourceKey: 'particles_cryo', amount: '80' }, { resourceKey: 'particles_hydro', amount: '40' },
    ], 'multi')!
    const html = renderToStaticMarkup(<LevelUpFeedback event={event} onFinished={vi.fn()} />)
    expect(html).toContain('Récompenses :')
    expect(html).toContain('3 niveaux gagnés !')
    expect(html).toContain('+800 Primos · +10 000 Moras · +80 Cryo · +40 Hydro')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect((html.match(/<small\b/g) ?? [])).toHaveLength(1)
  })

  it('renders a normal 11 to 12 level-up with explicit authoritative rewards', () => {
    const event = buildLevelUpFeedback(progression(11), progression(12), [{ resourceKey: 'primogems', amount: '800' }], 'normal')!
    const html = renderToStaticMarkup(<LevelUpFeedback event={event} onFinished={vi.fn()} />)
    expect(html).toContain('Niveau supérieur !')
    expect(html).toContain('Récompenses : +800 Primos')
  })

  it('renders two overflow steps in one modal using server totals, without inventing particles', () => {
    const previous = { ...progression(100), isMaxLevel: true, level100OverflowRewardsClaimed: 7 }
    const rewards = [{ resourceKey: 'primogems', amount: '1600' }, { resourceKey: 'moras', amount: '20000' }, { resourceKey: 'particles_cryo', amount: '160' }, { resourceKey: 'particles_geo', amount: '40' }, { resourceKey: 'particles_hydro', amount: '40' }]
    const event = buildLevelUpFeedback(previous, { ...previous, level100OverflowRewardsClaimed: 9 }, rewards, 'overflow')!
    expect(event.rewards).toEqual(rewards)
    const html = renderToStaticMarkup(<LevelUpFeedback event={event} onFinished={vi.fn()} />).replace(/\u202f|\u00a0/g, ' ')
    expect(html).toContain('2 paliers au niveau 100')
    expect(html).toContain('Récompenses : +1 600 Primos · +20 000 Moras · +160 Cryo · +40 Géo · +40 Hydro')
    expect((html.match(/role="dialog"/g) ?? [])).toHaveLength(1)
    expect(buildLevelUpFeedback(previous, { ...previous, level100OverflowRewardsClaimed: 9 }, [], 'no-fallback')?.rewards).toEqual([])
  })

  it('preserves all authoritative overflow rewards from a Cryo Gacha passive and excludes other bonuses', () => {
    const rewards = [{ resourceKey: 'primogems', amount: '800' }, { resourceKey: 'moras', amount: '10000' }, { resourceKey: 'particles_cryo', amount: '80' }, { resourceKey: 'particles_geo', amount: '40' }]
    const pull: GachaPullDto = {
      operation: { id: 'cryo-overflow', pullCount: 1, primogemCost: '160', createdAt: '2026-10-04T10:00:00Z', alreadyProcessed: false },
      playerState: { pity5: 1, pity4: 1, guaranteedFeatured5: false, captureProgress: 0, fiftyFiftyLostStreak: 0, selectedBannerCharacterId: null, totalPulls: '1', totalFiveStars: '0', totalFourStars: '0', fiftyFiftyWon: '0', fiftyFiftyLost: '0', capturesTriggered: '0' },
      results: [{ index: 1, resultType: 'resource', character: null, rarity: null, resourceKey: 'moras', resourceAmount: '100', wasNewCharacter: null, constellationAfter: null, copiesAfter: null, wasFiftyFifty: false, wonFiftyFifty: null, guaranteeConsumed: false, captureTriggered: false, c6Progression: null,
        passiveEffects: [{ elementKey: 'cryo', type: 'xp', amount: '1', xpAfter: '3030', levelsReached: [], overflowRewardsGranted: 1 }],
        bonusRewards: [...rewards.map(reward => ({ ...reward, causeKey: 'player.xp.level-reward' })), { resourceKey: 'primogems', amount: '80', causeKey: 'gacha.c6-duplicate-refund' }] }],
    }
    const previous = { ...progression(100), isMaxLevel: true, level100OverflowRewardsClaimed: 3 }
    const event = buildLevelUpFeedback(previous, { ...previous, level100OverflowRewardsClaimed: 4 }, gachaLevelRewards(pull), pull.operation.id)!
    expect(event.rewards).toEqual(rewards)
    expect(event.overflowRewardsGranted).toBe(1)
  })

  it('captures clicks immediately but only dismisses by click or Escape after one second', () => {
    vi.useFakeTimers()
    const event = buildLevelUpFeedback(progression(11), progression(12), [], 'dismiss')!
    const onFinished = vi.fn()
    const behind = document.createElement('button')
    behind.addEventListener('click', vi.fn())
    document.body.append(behind)
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    roots.push(root)
    act(() => root.render(<LevelUpFeedback event={event} onFinished={onFinished} />))
    const overlay = container.querySelector<HTMLElement>('.level-up-feedback-overlay')!
    act(() => overlay.click())
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
    expect(onFinished).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(LEVEL_UP_FEEDBACK_DISMISS_LOCK_MS))
    expect(overlay.classList.contains('dismissible')).toBe(true)
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
    expect(onFinished).toHaveBeenCalledTimes(1)
    expect(onFinished).toHaveBeenCalledWith('dismiss')
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

  it('reports the end of the sidebar phase so the next queued modal can start afterward', () => {
    vi.useFakeTimers()
    const event = buildLevelUpFeedback(progression(11), progression(12), [], 'profile-sequence')!
    const onFinished = vi.fn()
    function Probe() {
      const feedback = useProfileLevelUpFeedback(event, onFinished)
      return <output>{feedback.visible ? 'visible' : 'hidden'}</output>
    }
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    roots.push(root)
    act(() => root.render(<Probe />))
    act(() => vi.advanceTimersByTime(PROFILE_LEVEL_UP_DURATION_MS))
    expect(onFinished).toHaveBeenCalledWith('profile-sequence')
  })
})
