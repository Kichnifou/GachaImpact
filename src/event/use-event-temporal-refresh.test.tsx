// @vitest-environment happy-dom
import { act, useCallback, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { EventDto } from '../api/types'
import { EVENT_REFRESH_MARGIN_MS, useEventTemporalRefresh } from './use-event-temporal-refresh'

const roots: Root[] = []
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const snapshot = (refreshAfterMs: number, completedToday = false, businessDate = '2026-09-15'): EventDto => ({
  businessDate,
  refreshAfterMs,
  festival: { key: 'harvest', month: 9, title: 'Festival des Récoltes', emoji: '🌾', currency: { key: 'harvest-tokens', label: 'Jetons de Récolte', emoji: '🌾' }, collection: { key: 'harvest-sheaf', label: 'Gerbe de Récolte' } },
  edition: { id: 'edition-2026', year: 2026, startsAt: '2026-08-31T22:00:00.000Z', endsAt: '2026-09-30T22:00:00.000Z' },
  participation: { joined: true, joinedAt: '2026-09-15T12:00:00.000Z', points: completedToday ? 1 : 0 },
  currency: { amount: completedToday ? '2' : '1' },
  canJoin: false,
  dailyBonus: { claimedToday: true, canClaim: false }, milestones: { currentPoints: 0, thresholds: [] },
  gameA: { available: true, theme: { key: 'recolte', label: 'Récolte' }, completedToday, attemptsToday: completedToday ? 1 : 0, windows: [], activeWindowIndex: null, canAttempt: false, cooldownRemainingMs: 0 },
  gameB: { available: true, theme: { key: 'harvest', label: 'Festival des Récoltes' }, solvedToday: false, resolvedCode: null, discoveredBy: null, attemptsUsed: 0, attemptsRemaining: 3, testedCodes: [], remainingCodes: [], canAttempt: false },
  gameC: { available: true, theme: { key: 'harvest', label: 'Panier' }, sentToday: false, canSend: false, receivedMessages: [], unviewedCount: 0 },
})

function Harness({ initial, sessionUserId, refresh }: Readonly<{ initial: EventDto; sessionUserId?: string; refresh: () => Promise<EventDto> }>) {
  const [event, setEvent] = useState(initial)
  const load = useCallback(async () => { const next = await refresh(); setEvent(next); return next }, [refresh])
  useEventTemporalRefresh(event, sessionUserId, load)
  return <span data-testid="event-state">{event.businessDate}:{String(event.gameA.completedToday)}</span>
}

function TimerHarness({ event, sessionUserId, refresh }: Readonly<{ event: EventDto; sessionUserId?: string; refresh: () => Promise<EventDto> }>) {
  useEventTemporalRefresh(event, sessionUserId, refresh)
  return null
}

function mount(initial: EventDto, refresh: () => Promise<EventDto>, sessionUserId: string | undefined = 'player-1') {
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container); roots.push(root)
  act(() => root.render(<Harness initial={initial} sessionUserId={sessionUserId} refresh={refresh} />))
  return { container, root }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => { act(() => roots.splice(0).forEach((root) => root.unmount())); document.body.replaceChildren(); vi.useRealTimers() })

describe('Event temporal refresh boundary', () => {
  it.each([['future window', 1_000], ['active window', 45_000], ['cooldown', 3_000]])('refreshes the authoritative projection at the %s boundary', async (_label, delay) => {
    const refresh = vi.fn(async () => snapshot(60_000))
    mount(snapshot(delay), refresh)
    await act(async () => { await vi.advanceTimersByTimeAsync(delay + EVENT_REFRESH_MARGIN_MS - 1) })
    expect(refresh).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(refresh).toHaveBeenCalledOnce()
  })

  it('publishes the new day so a completed daily state becomes actionable again', async () => {
    const refresh = vi.fn(async () => snapshot(60_000, false, '2026-09-16'))
    const { container } = mount(snapshot(5_000, true), refresh)
    expect(container.textContent).toBe('2026-09-15:true')
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000 + EVENT_REFRESH_MARGIN_MS) })
    expect(container.textContent).toBe('2026-09-16:false')
  })

  it('cleans the old timer when a snapshot is replaced or the session logs out', async () => {
    const refresh = vi.fn(async () => snapshot(60_000))
    const container = document.createElement('div'); document.body.append(container)
    const root = createRoot(container); roots.push(root)
    act(() => root.render(<TimerHarness event={snapshot(1_000)} sessionUserId="player-1" refresh={refresh} />))
    act(() => root.render(<TimerHarness event={snapshot(5_000)} sessionUserId="player-1" refresh={refresh} />))
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000 + EVENT_REFRESH_MARGIN_MS) })
    expect(refresh).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(4_000) })
    expect(refresh).toHaveBeenCalledOnce()
    refresh.mockClear()
    act(() => root.render(<TimerHarness event={snapshot(5_000)} sessionUserId="player-1" refresh={refresh} />))
    act(() => root.render(<TimerHarness event={snapshot(5_000)} refresh={refresh} />))
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000 + EVENT_REFRESH_MARGIN_MS) })
    expect(refresh).not.toHaveBeenCalled()
  })
})
