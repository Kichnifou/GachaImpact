// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/game-api'
import type { EventDto, EventGameAAttemptDto, EventGameBAttemptDto, EventJoinDto } from '../api/types'
import EventScreen from './EventScreen'

const roots: Root[] = []
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterEach(() => { act(() => roots.splice(0).forEach((root) => root.unmount())); document.body.replaceChildren(); vi.useRealTimers() })

const beforeJoin: EventDto = {
  businessDate: '2026-09-15', refreshAfterMs: 3600000,
  festival: { key: 'harvest', month: 9, title: 'Festival des Récoltes', emoji: '\u{1F33E}', currency: { key: 'harvest-tokens', label: 'Jetons de Récolte', emoji: '\u{1F33E}' }, collection: { key: 'harvest-sheaf', label: 'Gerbe de Récolte' } },
  edition: { id: 'edition-2026', year: 2026, startsAt: '2026-08-31T22:00:00.000Z', endsAt: '2026-09-30T22:00:00.000Z' },
  participation: { joined: false, joinedAt: null, points: 0 }, currency: { amount: '0' }, canJoin: true,
  gameA: { available: false, theme: { key: 'recolte', label: 'Récolte' }, completedToday: false, attemptsToday: 0, windows: [], activeWindowIndex: null, canAttempt: false, cooldownRemainingMs: 0 },
  gameB: { available: false, theme: { key: 'harvest', label: 'Festival des Récoltes' }, solvedToday: false, discoveredBy: null, attemptsUsed: 0, attemptsRemaining: 0, testedCodes: [], remainingCodes: Array.from({ length: 32 }, (_, index) => index.toString(2).padStart(5, '0')), canAttempt: false },
}
const joinedGameA = { available: true, theme: { key: 'recolte', label: 'Récolte' }, completedToday: false, attemptsToday: 0, windows: [
  { startAt: '2026-09-15T07:00:00.000Z', endAt: '2026-09-15T08:00:00.000Z', state: 'PAST' as const },
  { startAt: '2026-09-15T12:00:00.000Z', endAt: '2026-09-15T13:00:00.000Z', state: 'ACTIVE' as const },
  { startAt: '2026-09-15T18:00:00.000Z', endAt: '2026-09-15T19:00:00.000Z', state: 'FUTURE' as const },
], activeWindowIndex: 1, canAttempt: true, cooldownRemainingMs: 0 }
const afterJoin: EventJoinDto = { ...beforeJoin, participation: { joined: true, joinedAt: '2026-09-15T12:00:00.000Z', points: 0 }, currency: { amount: '1' }, canJoin: false, gameA: joinedGameA, gameB: { ...beforeJoin.gameB, available: true, attemptsRemaining: 3, canAttempt: true }, operation: { id: 'operation-1', alreadyProcessed: false } }

function mount(options: { value?: EventDto; onLoad?: () => Promise<EventDto>; onJoin?: (key: string) => Promise<EventJoinDto>; onAttempt?: (key: string) => Promise<EventGameAAttemptDto>; onAttemptB?: (code: string, key: string) => Promise<EventGameBAttemptDto> } = {}) {
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container); roots.push(root)
  const props = { value: options.value ?? beforeJoin, onLoad: options.onLoad ?? vi.fn(async () => beforeJoin), onJoin: options.onJoin ?? vi.fn(async () => afterJoin), onAttempt: options.onAttempt ?? vi.fn(async () => ({ ...afterJoin, attempt: { succeeded: false } })), onAttemptB: options.onAttemptB ?? vi.fn(async () => ({ ...afterJoin, attempt: { kind: 'INCORRECT' as const } })) }
  act(() => root.render(<EventScreen {...props} />))
  return { container, root, props }
}

function selectGames(container: HTMLElement) {
  act(() => Array.from(container.querySelectorAll<HTMLButtonElement>('.event-tabs button')).find(({ textContent }) => textContent === 'Jeux')!.click())
}

describe('EventScreen presentation', () => {
  it('refreshes on entry and opens the registration summary first', async () => {
    const mounted = mount()
    await act(async () => { await Promise.resolve() })
    expect(mounted.props.onLoad).toHaveBeenCalledOnce()
    expect(mounted.container.textContent).toContain('Festival des Récoltes')
    expect(mounted.container.textContent).toContain('Jetons de Récolte')
    expect(mounted.container.textContent).toContain('Gerbe de Récolte')
    expect(mounted.container.textContent).toContain('Recevez 1 Jeton de Récolte')
    expect(mounted.container.textContent).toContain('du 1 septembre 2026 au 30 septembre 2026')
    expect(mounted.container.textContent).toContain('Non inscrit')
    expect(mounted.container.querySelector<HTMLButtonElement>('.event-foundation-card button')?.disabled).toBe(false)
    const tabs = Array.from(mounted.container.querySelectorAll<HTMLButtonElement>('.event-tabs button'))
    expect(tabs.map(({ textContent }) => textContent)).toEqual(['Inscription', 'Jeux', 'Shop', 'Classement'])
    expect(tabs.map(({ disabled }) => disabled)).toEqual([false, true, true, true])
    act(() => tabs[1].click())
    expect(mounted.container.querySelector('.event-tabs .active')?.textContent).toBe('Inscription')
    expect(mounted.container.querySelector('.event-stat-grid')).not.toBeNull()
    expect(mounted.container.textContent).not.toMatch(/À venir|Bientôt disponible|prochains lots/)
  })

  it('enables Games after the server join snapshot without leaving registration', () => {
    const mounted = mount()
    act(() => mounted.root.render(<EventScreen {...mounted.props} value={afterJoin} />))
    const tabs = Array.from(mounted.container.querySelectorAll<HTMLButtonElement>('.event-tabs button'))
    expect(tabs.map(({ disabled }) => disabled)).toEqual([false, false, true, true])
    expect(mounted.container.querySelector('.event-tabs .active')?.textContent).toBe('Inscription')
    expect(mounted.container.textContent).toContain('Événement rejoint')
    expect(mounted.container.querySelector('.event-game-a')).toBeNull()
  })

  it('returns to registration when a new snapshot removes event participation', () => {
    const mounted = mount({ value: afterJoin })
    selectGames(mounted.container)
    expect(mounted.container.querySelector('.event-tabs .active')?.textContent).toBe('Jeux')

    act(() => mounted.root.render(<EventScreen {...mounted.props} value={{ ...beforeJoin, edition: { ...beforeJoin.edition, id: 'edition-2027', year: 2027 } }} />))

    const tabs = Array.from(mounted.container.querySelectorAll<HTMLButtonElement>('.event-tabs button'))
    expect(tabs.map(({ disabled }) => disabled)).toEqual([false, true, true, true])
    expect(mounted.container.querySelector('.event-tabs .active')?.textContent).toBe('Inscription')
    expect(mounted.container.textContent).toContain('Recevez 1 Jeton de Récolte')
    expect(mounted.container.querySelector('.event-stat-grid')).not.toBeNull()
  })

  it('presents the exclusive December boundary as the last included calendar day', () => {
    const december = { ...beforeJoin, businessDate: '2026-12-15', festival: { ...beforeJoin.festival, key: 'christmas', month: 12, title: 'Festival de Noël' }, edition: { ...beforeJoin.edition, startsAt: '2026-11-30T23:00:00.000Z', endsAt: '2026-12-31T23:00:00.000Z' } }
    const { container } = mount({ value: december })
    expect(container.textContent).toContain('du 1 décembre 2026 au 31 décembre 2026')
    expect(container.textContent).not.toContain('au 1 janvier 2027')
  })

  it('separates the registration summary from the themed game tabs', () => {
    const { container } = mount({ value: afterJoin })
    expect(container.textContent).toContain('Événement rejoint')
    expect(container.querySelector('.event-game-a')).toBeNull()
    selectGames(container)
    expect(container.querySelector('.event-stat-grid')).toBeNull()
    expect(Array.from(container.querySelectorAll<HTMLButtonElement>('.event-game-tabs button'), ({ textContent }) => textContent)).toEqual(['Récolte', 'Grenier', 'Panier'])
    expect(Array.from(container.querySelectorAll<HTMLButtonElement>('.event-game-tabs button'), ({ disabled }) => disabled)).toEqual([false, false, true])
    expect(container.querySelectorAll('.event-game-a-window')).toHaveLength(3)
    expect(container.querySelector('[data-window-state="ACTIVE"]')?.textContent).toContain('Active')
    expect(container.querySelector<HTMLButtonElement>('.event-game-a-action button')?.textContent).toBe('Tenter ma chance')
    expect(container.textContent).not.toMatch(/À venir|Bientôt disponible/)
  })

  it('uses themed failure and singular success feedback with explicit visual states', async () => {
    const failed: EventGameAAttemptDto = { ...afterJoin, gameA: { ...joinedGameA, attemptsToday: 1, canAttempt: false, cooldownRemainingMs: 3000 }, operation: { id: 'attempt-1', alreadyProcessed: false }, attempt: { succeeded: false } }
    const failedMount = mount({ value: afterJoin, onAttempt: vi.fn(async () => failed) }); selectGames(failedMount.container)
    await act(async () => { failedMount.container.querySelector<HTMLButtonElement>('.event-game-a-action button')!.click(); await Promise.resolve() })
    expect(failedMount.container.querySelector('.event-game-a-feedback.failure')?.textContent).toBe('Pas cette fois ! Rien n’est encore prêt à être récolté... réessaie bientôt !')

    const success: EventGameAAttemptDto = { ...failed, participation: { ...failed.participation, points: 1 }, currency: { amount: '2' }, gameA: { ...failed.gameA, completedToday: true, cooldownRemainingMs: 0 }, operation: { id: 'attempt-2', alreadyProcessed: false }, attempt: { succeeded: true } }
    const successMount = mount({ value: afterJoin, onAttempt: vi.fn(async () => success) }); selectGames(successMount.container)
    await act(async () => { successMount.container.querySelector<HTMLButtonElement>('.event-game-a-action button')!.click(); await Promise.resolve() })
    expect(successMount.container.querySelector('.event-game-a-feedback.success')?.textContent).toBe('Réussite ! +1 point et +1 Jeton de Récolte.')
    expect(successMount.container.textContent).not.toContain('+1 Jetons de Récolte')
  })

  it('counts down 3/2/1 while the server-owned action stays disabled', async () => {
    vi.useFakeTimers()
    const onAttempt = vi.fn(async () => ({ ...afterJoin, attempt: { succeeded: false } }))
    const failed: EventDto = { ...afterJoin, gameA: { ...joinedGameA, attemptsToday: 1, canAttempt: false, cooldownRemainingMs: 3000 } }
    const { container } = mount({ value: failed, onAttempt }); selectGames(container)
    const button = () => container.querySelector<HTMLButtonElement>('.event-cooldown-button')!
    expect(button().textContent).toBe('Patientez 3 secondes...')
    act(() => button().click())
    expect(onAttempt).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(button().textContent).toBe('Patientez 2 secondes...')
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(button().textContent).toBe('Patientez 1 seconde...')
    expect(button().disabled).toBe(true)
    expect(onAttempt).not.toHaveBeenCalled()
  })

  it('shows a neutral expired state without an attempt button', () => {
    const expired: EventDto = { ...afterJoin, gameA: { ...joinedGameA, activeWindowIndex: null, canAttempt: false, windows: joinedGameA.windows.map((window) => ({ ...window, state: 'PAST' as const })) } }
    const { container } = mount({ value: expired }); selectGames(container)
    expect(container.querySelector('.event-game-a-day-state.expired')?.textContent).toBe('Délai dépassé...')
    expect(container.querySelector('.event-game-a-action button')).toBeNull()
    expect(container.textContent).not.toContain('À réussir aujourd’hui')
  })

  it('shows 32 distinct Game B codes, marks tested codes, and consumes a wrong guess', async () => {
    const value: EventDto = { ...afterJoin, gameB: { ...afterJoin.gameB, testedCodes: ['00000'], remainingCodes: afterJoin.gameB.remainingCodes.filter((code) => code !== '00000') } }
    const onAttemptB = vi.fn(async (code: string): Promise<EventGameBAttemptDto> => ({ ...value, gameB: { ...value.gameB, attemptsUsed: 1, attemptsRemaining: 2, testedCodes: ['00000', code], remainingCodes: value.gameB.remainingCodes.filter((entry) => entry !== code) }, operation: { id: 'attempt-b', alreadyProcessed: false }, attempt: { kind: 'INCORRECT' } }))
    const { container } = mount({ value, onAttemptB }); selectGames(container)
    act(() => Array.from(container.querySelectorAll<HTMLButtonElement>('.event-game-tabs button')).find(({ textContent }) => textContent === 'Grenier')!.click())
    const codes = Array.from(container.querySelectorAll<HTMLButtonElement>('.event-game-b-code'))
    expect(codes).toHaveLength(32)
    expect(new Set(codes.map(({ textContent }) => textContent)).size).toBe(32)
    expect(codes[0].classList.contains('tested')).toBe(true)
    expect(codes[0].disabled).toBe(true)
    expect(codes[1].disabled).toBe(false)
    expect(container.textContent).toContain('3 essais personnels restants')
    act(() => codes[1].click())
    await act(async () => { container.querySelector<HTMLButtonElement>('.event-game-b-action button')!.click(); await Promise.resolve() })
    expect(onAttemptB).toHaveBeenCalledWith('00001', expect.any(String))
    expect(container.querySelector('.event-game-b-feedback')?.textContent).toBe('Code incorrect : un essai consommé.')
  })

  it('shows the discoverer and removes the action after collective resolution', () => {
    const value: EventDto = { ...afterJoin, gameB: { ...afterJoin.gameB, solvedToday: true, discoveredBy: { id: 'discoverer', displayName: 'Kyo' }, testedCodes: ['11111'], remainingCodes: afterJoin.gameB.remainingCodes.filter((code) => code !== '11111'), canAttempt: false } }
    const { container } = mount({ value }); selectGames(container)
    act(() => container.querySelectorAll<HTMLButtonElement>('.event-game-tabs button')[1].click())
    expect(container.querySelector('.event-game-b')?.textContent).toContain('Découvert par Kyo')
    expect(container.querySelector('.event-game-b-action button')).toBeNull()
    expect(Array.from(container.querySelectorAll<HTMLButtonElement>('.event-game-b-code')).every(({ disabled }) => disabled)).toBe(true)
  })

  it('replays an ambiguous Game B response with the same key after the snapshot exhausts attempts', async () => {
    const onAttemptB = vi.fn()
      .mockRejectedValueOnce(new ApiError('NETWORK_ERROR', 'Réseau indisponible.', null))
      .mockResolvedValueOnce({ ...afterJoin, operation: { id: 'attempt-b', alreadyProcessed: true }, attempt: { kind: 'INCORRECT' } })
    const mounted = mount({ value: afterJoin, onAttemptB }); selectGames(mounted.container)
    act(() => mounted.container.querySelectorAll<HTMLButtonElement>('.event-game-tabs button')[1].click())
    act(() => mounted.container.querySelector<HTMLButtonElement>('.event-game-b-code')!.click())
    await act(async () => { mounted.container.querySelector<HTMLButtonElement>('.event-game-b-action button')!.click(); await Promise.resolve() })
    const firstKey = onAttemptB.mock.calls[0][1]
    const exhausted: EventDto = { ...afterJoin, gameB: { ...afterJoin.gameB, attemptsUsed: 3, attemptsRemaining: 0, canAttempt: false } }
    act(() => mounted.root.render(<EventScreen {...mounted.props} value={exhausted} />))
    expect(mounted.container.querySelector<HTMLButtonElement>('.event-game-b-action button')?.textContent).toBe('Réessayer 00000')
    await act(async () => { mounted.container.querySelector<HTMLButtonElement>('.event-game-b-action button')!.click(); await Promise.resolve() })
    expect(onAttemptB.mock.calls.map((call) => call[1])).toEqual([firstKey, firstKey])
  })

  it('discards an ambiguous Game B intent at the next business date and creates a new UUID', async () => {
    const onAttemptB = vi.fn()
      .mockRejectedValueOnce(new ApiError('NETWORK_ERROR', 'Réseau indisponible.', null))
      .mockResolvedValueOnce({ ...afterJoin, operation: { id: 'new-day-attempt', alreadyProcessed: false }, attempt: { kind: 'INCORRECT' } })
    const mounted = mount({ value: afterJoin, onAttemptB }); selectGames(mounted.container)
    act(() => mounted.container.querySelectorAll<HTMLButtonElement>('.event-game-tabs button')[1].click())
    act(() => mounted.container.querySelectorAll<HTMLButtonElement>('.event-game-b-code')[0].click())
    await act(async () => { mounted.container.querySelector<HTMLButtonElement>('.event-game-b-action button')!.click(); await Promise.resolve() })
    const oldKey = onAttemptB.mock.calls[0][1]
    expect(mounted.container.querySelector('.event-game-b-action')?.textContent).toContain('Réessayer 00000')

    const nextDay: EventDto = { ...afterJoin, businessDate: '2026-09-16' }
    act(() => mounted.root.render(<EventScreen {...mounted.props} value={nextDay} />))
    expect(mounted.container.querySelector('.event-game-tabs .active')?.textContent).toBe('Grenier')
    expect(mounted.container.querySelector('.event-game-b-action')?.textContent).toContain('Choisissez une combinaison')
    expect(mounted.container.querySelectorAll('.event-game-b-code.selected')).toHaveLength(0)
    expect(mounted.container.querySelector('.event-game-b-feedback')?.textContent).toBe('')
    expect(mounted.container.querySelector('.event-feedback')?.textContent).toBe('')
    act(() => mounted.container.querySelectorAll<HTMLButtonElement>('.event-game-b-code')[1].click())
    await act(async () => { mounted.container.querySelector<HTMLButtonElement>('.event-game-b-action button')!.click(); await Promise.resolve() })
    expect(onAttemptB.mock.calls[1][0]).toBe('00001')
    expect(onAttemptB.mock.calls[1][1]).not.toBe(oldKey)
    expect(onAttemptB.mock.calls[1][1]).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('returns to registration and discards Game B state when the edition changes', async () => {
    const onAttemptB = vi.fn()
      .mockRejectedValueOnce(new ApiError('NETWORK_ERROR', 'Réseau indisponible.', null))
      .mockResolvedValueOnce({ ...afterJoin, operation: { id: 'new-edition-attempt', alreadyProcessed: false }, attempt: { kind: 'INCORRECT' } })
    const mounted = mount({ value: afterJoin, onAttemptB }); selectGames(mounted.container)
    act(() => mounted.container.querySelectorAll<HTMLButtonElement>('.event-game-tabs button')[1].click())
    act(() => mounted.container.querySelectorAll<HTMLButtonElement>('.event-game-b-code')[0].click())
    await act(async () => { mounted.container.querySelector<HTMLButtonElement>('.event-game-b-action button')!.click(); await Promise.resolve() })
    const oldKey = onAttemptB.mock.calls[0][1]
    const nextEdition: EventDto = { ...afterJoin, edition: { ...afterJoin.edition, id: 'edition-2027', year: 2027 }, businessDate: '2027-09-15' }
    act(() => mounted.root.render(<EventScreen {...mounted.props} value={nextEdition} />))
    expect(mounted.container.querySelector('.event-tabs .active')?.textContent).toBe('Inscription')
    expect(mounted.container.querySelector('.event-game-b')).toBeNull()
    act(() => mounted.container.querySelectorAll<HTMLButtonElement>('.event-tabs button')[1].click())
    act(() => mounted.container.querySelectorAll<HTMLButtonElement>('.event-game-tabs button')[1].click())
    expect(mounted.container.querySelector('.event-game-b-action')?.textContent).toContain('Choisissez une combinaison')
    expect(mounted.container.querySelectorAll('.event-game-b-code.selected')).toHaveLength(0)
    expect(mounted.container.querySelector('.event-game-b-feedback')?.textContent).toBe('')
    act(() => mounted.container.querySelectorAll<HTMLButtonElement>('.event-game-b-code')[1].click())
    await act(async () => { mounted.container.querySelector<HTMLButtonElement>('.event-game-b-action button')!.click(); await Promise.resolve() })
    expect(onAttemptB.mock.calls[1][1]).not.toBe(oldKey)
  })

  it('visually completes every window after a success during an active window', () => {
    const complete: EventDto = { ...afterJoin, gameA: { ...joinedGameA, completedToday: true, canAttempt: false } }
    const { container } = mount({ value: complete }); selectGames(container)
    expect(container.querySelectorAll('.event-game-a-window.completed')).toHaveLength(3)
    expect(container.querySelectorAll('.event-game-a-window.active')).toHaveLength(0)
    expect(Array.from(container.querySelectorAll('.event-game-a-window'), (window) => window.getAttribute('data-window-state'))).toEqual(['COMPLETED', 'COMPLETED', 'COMPLETED'])
    expect(Array.from(container.querySelectorAll('.event-game-a-window small'), (label) => label.textContent)).toEqual(['Terminée', 'Terminée', 'Terminée'])
    expect(container.querySelector('.event-game-a-windows')?.textContent).not.toContain('Active')
    expect(container.querySelector('.event-game-a-windows')?.textContent).toContain('14:00')
  })

  it('keeps one pending join stable under a double click', async () => {
    let resolve!: (value: EventJoinDto) => void
    const onJoin = vi.fn(() => new Promise<EventJoinDto>((done) => { resolve = done }))
    const { container } = mount({ onJoin }); const button = container.querySelector<HTMLButtonElement>('.event-foundation-card button')!
    act(() => { button.click(); button.click() })
    expect(onJoin).toHaveBeenCalledOnce(); expect(button.disabled).toBe(true); expect(button.textContent).toBe('Inscription…')
    await act(async () => { resolve(afterJoin); await Promise.resolve() })
  })

  it('reports API errors and leaves only implemented tabs interactive', async () => {
    const onJoin = vi.fn(async () => { throw new ApiError('NETWORK_ERROR', 'Impossible de joindre le serveur GachaImpact.', null) })
    const { container } = mount({ onJoin })
    await act(async () => { container.querySelector<HTMLButtonElement>('.event-foundation-card button')!.click(); await Promise.resolve() })
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('momentanément inaccessible')
    const tabs = Array.from(container.querySelectorAll<HTMLButtonElement>('.event-tabs button'))
    expect(tabs.map(({ disabled }) => disabled)).toEqual([false, true, true, true])
    expect(tabs.every((tab) => !tab.hasAttribute('title') && tab.querySelector('small') === null)).toBe(true)
  })

  it.each([[1920, 1080], [1774, 864], [1366, 768], [390, 844]])('keeps one bounded scroll owner at %d×%d', (width, height) => {
    Object.defineProperties(window, { innerWidth: { value: width, configurable: true }, innerHeight: { value: height, configurable: true } })
    const { container } = mount()
    expect(container.querySelectorAll('.scrollable-screen-panel-body')).toHaveLength(1)
    expect(container.querySelector('.event-stat-grid')).not.toBeNull()
  })
})
