// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../api/game-api'
import type { EventDto, EventGameAAttemptDto, EventJoinDto } from '../api/types'
import EventScreen from './EventScreen'

const roots: Root[] = []
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterEach(() => { act(() => roots.splice(0).forEach((root) => root.unmount())); document.body.replaceChildren() })

const beforeJoin: EventDto = {
  businessDate: '2026-09-15',
  festival: { key: 'harvest', month: 9, title: 'Festival des Récoltes', emoji: '🌾', currency: { key: 'harvest-tokens', label: 'Jetons de Récolte', emoji: '🌾' }, collection: { key: 'harvest-sheaf', label: 'Gerbe de Récolte' } },
  edition: { id: 'edition-2026', year: 2026, startsAt: '2026-08-31T22:00:00.000Z', endsAt: '2026-09-30T22:00:00.000Z' },
  participation: { joined: false, joinedAt: null, points: 0 }, currency: { amount: '0' }, canJoin: true,
  gameA: { available: false, theme: { key: 'recolte', label: 'Récolte' }, completedToday: false, attemptsToday: 0, windows: [], activeWindowIndex: null, canAttempt: false, cooldownRemainingMs: 0 },
}
const joinedGameA = { available: true, theme: { key: 'recolte', label: 'Récolte' }, completedToday: false, attemptsToday: 0, windows: [
  { startAt: '2026-09-15T07:00:00.000Z', endAt: '2026-09-15T08:00:00.000Z', state: 'PAST' as const },
  { startAt: '2026-09-15T12:00:00.000Z', endAt: '2026-09-15T13:00:00.000Z', state: 'ACTIVE' as const },
  { startAt: '2026-09-15T18:00:00.000Z', endAt: '2026-09-15T19:00:00.000Z', state: 'FUTURE' as const },
], activeWindowIndex: 1, canAttempt: true, cooldownRemainingMs: 0 }
const afterJoin: EventJoinDto = { ...beforeJoin, participation: { joined: true, joinedAt: '2026-09-15T12:00:00.000Z', points: 0 }, currency: { amount: '1' }, canJoin: false, gameA: joinedGameA, operation: { id: 'operation-1', alreadyProcessed: false } }

function mount(options: { value?: EventDto; onLoad?: () => Promise<EventDto>; onJoin?: (key: string) => Promise<EventJoinDto>; onAttempt?: (key: string) => Promise<EventGameAAttemptDto> } = {}) {
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container); roots.push(root)
  const props = { value: options.value ?? beforeJoin, onLoad: options.onLoad ?? vi.fn(async () => beforeJoin), onJoin: options.onJoin ?? vi.fn(async () => afterJoin), onAttempt: options.onAttempt ?? vi.fn(async () => ({ ...afterJoin, attempt: { succeeded: false } })) }
  act(() => root.render(<EventScreen {...props} />))
  return { container, root, props }
}

describe('EventScreen foundations', () => {
  it('refreshes on entry and renders the real September Festival before joining', async () => {
    const mounted = mount()
    await act(async () => { await Promise.resolve() })
    expect(mounted.props.onLoad).toHaveBeenCalledOnce()
    expect(mounted.container.textContent).toContain('Festival des Récoltes')
    expect(mounted.container.textContent).toContain('Jetons de Récolte')
    expect(mounted.container.textContent).toContain('Gerbe de Récolte')
    expect(mounted.container.textContent).toContain('du 1 septembre 2026 au 30 septembre 2026')
    expect(mounted.container.textContent).not.toContain('au 1 octobre 2026')
    expect(mounted.container.textContent).toContain('Non inscrit')
    expect(mounted.container.textContent).toContain('Points de l’édition0')
    expect(mounted.container.textContent).toContain('Votre solde restera associé à ce Festival entre les années.')
    expect(mounted.container.textContent).not.toMatch(/Compteur autoritatif|Solde durable|Objet descriptif|La suite du Festival|À venir|prochains lots|Bientôt disponible/)
    expect(mounted.container.querySelector<HTMLButtonElement>('.event-foundation-card button')?.disabled).toBe(false)
  })

  it('presents the exclusive December boundary as the last included calendar day', () => {
    const december = {
      ...beforeJoin,
      businessDate: '2026-12-15',
      festival: { ...beforeJoin.festival, key: 'christmas', month: 12, title: 'Festival de Noël' },
      edition: { ...beforeJoin.edition, startsAt: '2026-11-30T23:00:00.000Z', endsAt: '2026-12-31T23:00:00.000Z' },
    }
    const { container } = mount({ value: december })
    expect(container.textContent).toContain('du 1 décembre 2026 au 31 décembre 2026')
    expect(container.textContent).not.toContain('au 1 janvier 2027')
  })

  it('shows the authoritative joined snapshot without a second client-side credit', () => {
    const { container } = mount({ value: afterJoin })
    expect(container.textContent).toContain('Inscrit')
    expect(container.textContent).toContain('🌾 1')
    expect(container.querySelector('.event-joined-status')?.textContent).toBe('Événement rejoint')
    expect(container.querySelector('.event-foundation-card button')).toBeNull()
    expect(container.querySelector('.event-foundation-card .small-primary-button')).toBeNull()
    expect(container.textContent).toContain('Votre solde restera associé à ce Festival entre les années.')
    expect(container.textContent).not.toMatch(/prochains lots|arriveront|À venir|Bientôt disponible/)
    expect(container.querySelector<HTMLButtonElement>('.event-tabs button')?.disabled).toBe(false)
    expect(container.textContent).toContain('Récolte')
    expect(container.querySelectorAll('.event-game-a-window')).toHaveLength(3)
    expect(container.querySelector('[data-window-state="ACTIVE"]')?.textContent).toContain('Active')
    expect(container.querySelector<HTMLButtonElement>('.event-game-a-action button')?.textContent).toBe('Tenter ma chance')
  })

  it('projects failure, cooldown and success without leaving an obsolete action', async () => {
    const failed: EventGameAAttemptDto = { ...afterJoin, gameA: { ...joinedGameA, attemptsToday: 1, canAttempt: false, cooldownRemainingMs: 3000 }, operation: { id: 'attempt-1', alreadyProcessed: false }, attempt: { succeeded: false } }
    const onAttempt = vi.fn(async () => failed)
    const mounted = mount({ value: afterJoin, onAttempt })
    await act(async () => { mounted.container.querySelector<HTMLButtonElement>('.event-game-a-action button')!.click(); await Promise.resolve() })
    expect(onAttempt).toHaveBeenCalledOnce()
    expect(mounted.container.textContent).toContain('Pas cette fois')
    act(() => mounted.root.render(<EventScreen {...mounted.props} value={failed} />))
    expect(mounted.container.querySelector<HTMLButtonElement>('.event-game-a-action button')?.disabled).toBe(true)
    expect(mounted.container.textContent).toContain('Patientez 3 s')
    const success: EventGameAAttemptDto = { ...failed, participation: { ...failed.participation, points: 1 }, currency: { amount: '2' }, gameA: { ...failed.gameA, completedToday: true, canAttempt: false, cooldownRemainingMs: 0 }, operation: { id: 'attempt-2', alreadyProcessed: false }, attempt: { succeeded: true } }
    act(() => mounted.root.render(<EventScreen {...mounted.props} value={success} />))
    expect(mounted.container.textContent).toContain('Réussi aujourd’hui')
    const stats = Array.from(mounted.container.querySelectorAll('.event-stat'), (entry) => entry.textContent)
    expect(stats[0]).toContain('1')
    expect(stats[1]).toContain('2')
    expect(mounted.container.querySelector('.event-game-a-action button')).toBeNull()
  })

  it('keeps one pending join stable under a double click', async () => {
    let resolve!: (value: EventJoinDto) => void
    const onJoin = vi.fn(() => new Promise<EventJoinDto>((done) => { resolve = done }))
    const { container } = mount({ onJoin })
    const button = container.querySelector<HTMLButtonElement>('.event-foundation-card button')!
    act(() => { button.click(); button.click() })
    expect(onJoin).toHaveBeenCalledOnce()
    expect(button.disabled).toBe(true)
    expect(button.textContent).toBe('Inscription…')
    await act(async () => { resolve(afterJoin); await Promise.resolve() })
  })

  it('reports API errors and keeps future tabs disabled without roadmap labels', async () => {
    const onJoin = vi.fn(async () => { throw new ApiError('NETWORK_ERROR', 'Impossible de joindre le serveur GachaImpact.', null) })
    const { container } = mount({ onJoin })
    await act(async () => { container.querySelector<HTMLButtonElement>('.event-foundation-card button')!.click(); await Promise.resolve() })
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('momentanément inaccessible')
    const tabs = Array.from(container.querySelectorAll<HTMLButtonElement>('.event-tabs button'))
    expect(tabs.map(({ textContent }) => textContent)).toEqual(['Jeux', 'Shop', 'Classement'])
    expect(tabs.map(({ disabled }) => disabled)).toEqual([false, true, true])
    expect(tabs.every((tab) => !tab.hasAttribute('title') && tab.querySelector('small') === null)).toBe(true)
    expect(container.textContent).not.toMatch(/Top 3|mini-jeu|acheté/)
  })

  it.each([[1920, 1080], [1774, 864], [1366, 768], [390, 844]])('keeps one bounded scroll owner at %d×%d', (width, height) => {
    Object.defineProperties(window, { innerWidth: { value: width, configurable: true }, innerHeight: { value: height, configurable: true } })
    const { container } = mount()
    expect(container.querySelectorAll('.scrollable-screen-panel-body')).toHaveLength(1)
    expect(container.querySelector('.event-stat-grid')).not.toBeNull()
  })
})
