// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EventDto, EventCalendarClaimDto } from '../api/types'
import EventCalendar from './EventCalendar'
import { useCalendarClaim } from '../event/use-calendar-claim'
import { ApiError } from '../api/game-api'
import { eventHasActionableContentToday } from '../event/event-presentation'

const base: EventDto = {
  businessDate: '2026-09-15', refreshAfterMs: 3600000,
  festival: { key: 'harvest', month: 9, title: 'Festival des Récoltes', emoji: '\u{1F33E}', currency: { key: 'harvest-tokens', label: 'Jetons de Récolte', unit: 'Jeton de Récolte', emoji: '\u{1F33E}' }, collection: { key: 'harvest-sheaf', label: 'Gerbe de Récolte' } },
  edition: { id: 'edition-2026', year: 2026, startsAt: '2026-08-31T22:00:00.000Z', endsAt: '2026-09-30T22:00:00.000Z' },
  participation: { joined: false, joinedAt: null, points: 0 }, currency: { amount: '0' }, shop: { available: false, balance: '0', rates: { primogems: '160', moras: '20000' }, collection: { itemExternalKey: 'gerbe_de_recolte', label: 'Gerbe de Récolte', cost: '80', obtainedThisEdition: false, available: true } }, canJoin: true,
  dailyBonus: { claimedToday: false, canClaim: false }, milestones: { currentPoints: 0, thresholds: [] },
  gameA: { available: false, theme: { key: 'recolte', label: 'Récolte' }, completedToday: false, attemptsToday: 0, windows: [], activeWindowIndex: null, canAttempt: false, cooldownRemainingMs: 0 },
  gameB: { available: false, theme: { key: 'harvest', label: 'Festival des Récoltes' }, solvedToday: false, resolvedCode: null, discoveredBy: null, attemptsUsed: 0, attemptsRemaining: 0, testedCodes: [], remainingCodes: Array.from({ length: 32 }, (_, index) => index.toString(2).padStart(5, '0')), canAttempt: false },
  gameC: { available: false, theme: { key: 'harvest', label: 'Panier' }, sentToday: false, canSend: false, receivedMessages: [], unviewedCount: 0 },
}

const value: EventDto = { ...base, businessDate: '2026-12-14', canJoin: false, participation: { joined: true, joinedAt: '', points: 9 }, festival: { ...base.festival, key: 'christmas', currency: { key: 'christmas-stars', unit: 'Étoile de Noël', label: 'Étoiles de Noël', emoji: '🎄' } }, calendar: { startsOn: '2026-12-01', endsOn: '2026-12-25', currentDay: 14, recap: false, canClaimToday: true, days: Array.from({ length: 25 }, (_, index) => ({ day: index + 1, state: index < 13 ? 'MISSED' : index === 13 ? 'AVAILABLE' : 'FUTURE', reward: index === 24 ? 50 : null })) } }
const roots: ReturnType<typeof createRoot>[] = []
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterEach(() => { act(() => roots.splice(0).forEach((root) => root.unmount())); document.body.replaceChildren() })

function Harness({ current, onClaim }: { current: EventDto; onClaim: (key: string) => Promise<EventCalendarClaimDto> }) {
  const action = useCalendarClaim(`${current.edition.id}:${current.businessDate}`, onClaim)
  return <EventCalendar value={current} action={action} enabled />
}
async function mount(current = value, onClaim: (key: string) => Promise<EventCalendarClaimDto> = vi.fn(async (): Promise<EventCalendarClaimDto> => ({ ...current, operation: { id: 'op', alreadyProcessed: false }, calendarClaim: { day: 14, reward: 3 } }))) {
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container); roots.push(root)
  const render = async (next: EventDto) => act(async () => root.render(<Harness current={next} onClaim={onClaim} />))
  await render(current)
  return { container, render, onClaim }
}

describe('Christmas calendar UI', () => {
  it('shows 25 readable cells, one action, a hidden future random amount and the Christmas reward', async () => {
    const { container } = await mount()
    expect(container.querySelectorAll('.event-calendar-cell')).toHaveLength(25)
    expect(container.querySelectorAll('button')).toHaveLength(1)
    expect(container.querySelector('button')?.getAttribute('aria-label')).toBe('Ouvrir la case du 14 décembre')
    expect(container.querySelectorAll('.future')[0]?.textContent).toContain('—')
    expect(container.textContent).toContain('50 Étoiles de Noël')
    expect(eventHasActionableContentToday(value)).toBe(true)
  })
  it('remains consultable before registration but cannot claim, and recap is never a daily action', async () => {
    const { container, render } = await mount({ ...value, participation: base.participation, calendar: { ...value.calendar!, canClaimToday: false } })
    expect(container.querySelector('button')).toBeNull()
    expect(container.textContent).toContain('Rejoignez le Festival')
    const recap = { ...value, calendar: { ...value.calendar!, recap: true, currentDay: null, canClaimToday: false, days: value.calendar!.days.map((cell) => ({ ...cell, state: 'MISSED' as const })) } }
    await render(recap)
    expect(container.querySelector('button')).toBeNull()
    expect(eventHasActionableContentToday(recap)).toBe(false)
    await render({ ...value, calendar: null })
    expect(container.textContent).toBe('')
  })
  it('guards synchronous clicks, retries the same ambiguous UUID, shows singular success and adopts the server snapshot', async () => {
    const result: EventCalendarClaimDto = { ...value, currency: { amount: '2' }, calendar: { ...value.calendar!, canClaimToday: false, days: value.calendar!.days.map((cell) => cell.day === 14 ? { ...cell, state: 'OPENED', reward: 1 } : cell) }, operation: { id: 'op', alreadyProcessed: false }, calendarClaim: { day: 14, reward: 1 } }
    const onClaim = vi.fn<(key: string) => Promise<EventCalendarClaimDto>>().mockRejectedValueOnce(new ApiError('NETWORK_ERROR', 'Réseau indisponible.', null)).mockResolvedValue(result)
    const { container, render } = await mount(value, onClaim)
    await act(async () => { const button = container.querySelector('button')!; button.click(); button.click() })
    expect(onClaim).toHaveBeenCalledTimes(1)
    expect(container.querySelector('[role="alert"]')).not.toBeNull()
    await act(async () => container.querySelector('button')!.click())
    expect(onClaim.mock.calls[0]![0]).toBe(onClaim.mock.calls[1]![0])
    await render(result)
    expect(container.querySelector('[role="status"]')?.textContent).toContain('1 Étoile de Noël.')
    expect(container.querySelectorAll('.opened')).toHaveLength(1)
    expect(eventHasActionableContentToday(result)).toBe(false)
    await render({ ...value, businessDate: '2026-12-15' })
    await act(async () => container.querySelector('button')!.click())
    expect(onClaim.mock.calls[2]![0]).not.toBe(onClaim.mock.calls[1]![0])
  })
})
