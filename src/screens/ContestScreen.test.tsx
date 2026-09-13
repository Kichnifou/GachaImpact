// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ContestDto, ContestHistoryDto, ContestSnapshotDto } from '../api/types'
import ContestScreen from './ContestScreen'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const roots: Root[] = []
afterEach(() => { act(() => roots.splice(0).forEach((root) => root.unmount())); document.body.replaceChildren() })

const theme = { key: 'STRENGTH', label: 'Force', title: 'Titan' } as const
const legend = {
  character: { id: 'character-1', externalKey: 'furina', name: 'Furina', iconPath: null, elementKey: 'hydro' as const },
  stats: { strength: 12, intelligence: 8, beauty: 15, charisma: 11, popularity: 13 },
  totals: { contests: '2', wins: '1' },
  themes: Object.fromEntries(['STRENGTH', 'INTELLIGENCE', 'BEAUTY', 'CHARISMA', 'POPULARITY'].map((key) => [key, { participations: '1', wins: '0', titleRank: 0, title: null }])) as typeof legendThemes,
}
const legendThemes = {} as Record<typeof theme.key | 'INTELLIGENCE' | 'BEAUTY' | 'CHARISMA' | 'POPULARITY', { participations: string; wins: string; titleRank: number; title: string | null }>
const permissions = { canOpen: true, canJoin: false, canSpectate: false, canLeave: false, canReady: false, canStart: false, canCancel: false, canPlay: false, canSupport: false }
const base: ContestDto = { businessDate: '2026-09-13', theme, dailyUsed: false, permissions, active: null, lastResult: null, legends: [legend] }
const lobby: ContestSnapshotDto = {
  id: 'contest-1', businessDate: '2026-09-13', theme, status: 'LOBBY', phase: 'LOBBY', organizerPlayerId: 'player-1',
  lobbyDeadlineAt: '2099-09-13T12:00:00Z', turnDeadlineAt: null, supportDeadlineAt: null, currentTurnOrder: null, currentRound: 0,
  winnerSlot: null, startedAt: null, finishedAt: null,
  viewer: { participantSlot: 1, spectator: false, organizer: true, selectedForSupport: false },
  participants: [{ slot: 1, kind: 'HUMAN', playerId: 'player-1', displayName: 'Kichnifou', characterName: 'Furina', avatar: null, basePoints: null, titleRank: 0, title: null, score: 0, turnOrder: null, ready: false, activeTurn: false, replaced: false, finalRank: null, rewardPrimogems: null }],
  spectators: [], events: [],
}

function mount(value: ContestDto, overrides: Partial<React.ComponentProps<typeof ContestScreen>> = {}) {
  const unchanged = vi.fn(async () => value)
  const props = {
    value, onRefresh: unchanged, onOpen: unchanged, onJoin: unchanged, onSelectLegend: unchanged, onReady: unchanged,
    onStart: unchanged, onSpectate: unchanged, onLeave: unchanged, onCancel: unchanged, onPlay: unchanged, onSupport: unchanged,
    onRemoveParticipant: unchanged,
    onLoadHistory: vi.fn(async (): Promise<ContestHistoryDto> => ({ page: 1, pageSize: 10, total: 0, pageCount: 1, contests: [] })),
    ...overrides,
  }
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container); roots.push(root)
  act(() => root.render(<ContestScreen {...props} />))
  return { container, props }
}

describe('ContestScreen', () => {
  it('keeps no-C6 players in view-only mode and lets several eligible Legends be selected', async () => {
    const noLegend = { ...base, legends: [], permissions: { ...permissions, canOpen: false, canSpectate: true } }
    const empty = mount(noLegend).container
    expect(empty.textContent).toContain('Une Légende 5★ C6 active est nécessaire pour participer.')
    expect(empty.querySelector<HTMLButtonElement>('.contest-empty button')?.disabled).toBe(true)

    const secondLegend = { ...legend, character: { ...legend.character, id: 'character-2', externalKey: 'nahida', name: 'Nahida' } }
    const selectable = { ...base, legends: [legend, secondLegend] }
    const onOpen = vi.fn(async () => selectable)
    const { container } = mount(selectable, { onOpen })
    const select = container.querySelector<HTMLSelectElement>('.contest-legend-select select')!
    act(() => { select.value = 'character-2'; select.dispatchEvent(new Event('change', { bubbles: true })) })
    await act(async () => { container.querySelector<HTMLButtonElement>('.contest-empty .primary-button')!.click(); await Promise.resolve() })
    expect(onOpen).toHaveBeenCalledWith('character-2', expect.any(String))
  })

  it('opens an eligible C6 lobby and keeps detailed /20 stats inside Mes Légendes', async () => {
    const onOpen = vi.fn(async () => base)
    const { container } = mount(base, { onOpen })
    expect(container.textContent).toContain('Aucun Concours actif')
    expect(container.textContent).not.toContain('/20')
    await act(async () => { container.querySelector<HTMLButtonElement>('.contest-empty .primary-button')!.click(); await Promise.resolve() })
    expect(onOpen).toHaveBeenCalledWith('character-1', expect.any(String))
    act(() => Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Mes Légendes')!.click())
    expect(container.querySelector('[aria-label="Mes Légendes"]')?.textContent).toContain('Force 12/20')
  })

  it('shows lobby readiness and strict organizer controls without exposing raw stat maxima', async () => {
    const value = { ...base, active: lobby, permissions: { ...permissions, canOpen: false, canLeave: true, canReady: true, canStart: true, canCancel: true } }
    const onReady = vi.fn(async () => value)
    const onStart = vi.fn(async () => value)
    const { container } = mount(value, { onReady, onStart })
    expect(container.textContent).toContain('Lobby public')
    expect(container.textContent).toContain('Pas prêt')
    expect(container.textContent).not.toContain('/20')
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Je suis prêt')!.click(); await Promise.resolve() })
    expect(onReady).toHaveBeenCalledWith(true, expect.any(String))
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Lancer avec des bots')!.click(); await Promise.resolve() })
    expect(onStart).toHaveBeenCalledWith(expect.any(String))
  })

  it('renders running actions and loads only the paginated finished history', async () => {
    const running: ContestSnapshotDto = { ...lobby, status: 'RUNNING', phase: 'TURNS', startedAt: '2026-09-13T10:00:00Z', turnDeadlineAt: '2099-09-13T12:00:00Z', currentRound: 2, currentTurnOrder: 1, participants: lobby.participants.map((participant) => ({ ...participant, basePoints: 3, turnOrder: 1, ready: true, activeTurn: true })) }
    const value = { ...base, active: running, permissions: { ...permissions, canOpen: false, canLeave: true, canPlay: true } }
    const onPlay = vi.fn(async () => value)
    const history = { ...running, status: 'FINISHED' as const, phase: 'FINISHED' as const, turnDeadlineAt: null, finishedAt: '2026-09-13T10:10:00Z', winnerSlot: 1, participants: running.participants.map((participant) => ({ ...participant, activeTurn: false, finalRank: 1, rewardPrimogems: '800' })) }
    const onLoadHistory = vi.fn(async (): Promise<ContestHistoryDto> => ({ page: 1, pageSize: 10, total: 1, pageCount: 1, contests: [history] }))
    const { container } = mount(value, { onPlay, onLoadHistory })
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Action de base')!.click(); await Promise.resolve() })
    expect(onPlay).toHaveBeenCalledWith('BASIC', expect.any(String))
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Historique')!.click(); await Promise.resolve() })
    expect(onLoadHistory).toHaveBeenCalledWith(1)
    expect(container.querySelector('[aria-label="Historique des Concours"]')?.textContent).toContain('#1 Kichnifou · 0 pts · 800 Primos')
  })

  it('renders passive spectators, a selected support window, and a replaced participant', async () => {
    const running: ContestSnapshotDto = {
      ...lobby, status: 'RUNNING', phase: 'SUPPORT', startedAt: '2026-09-13T10:00:00Z', supportDeadlineAt: '2099-09-13T12:00:00Z',
      currentRound: 2, viewer: { participantSlot: null, spectator: true, organizer: false, selectedForSupport: true },
      participants: [{ ...lobby.participants[0]!, kind: 'BOT', playerId: null, displayName: 'Astra · Bot 1', ready: true, basePoints: 3, turnOrder: 1, replaced: true }],
      spectators: [{ playerId: 'spectator-1', displayName: 'Jean Julien', selected: true }],
    }
    const value = { ...base, active: running, permissions: { ...permissions, canOpen: false, canLeave: true, canSupport: true } }
    const onSupport = vi.fn(async () => value)
    const { container } = mount(value, { onSupport })
    expect(container.querySelector('[aria-label="Spectateurs actifs"]')?.textContent).toContain('Jean Julien · soutien sélectionné')
    expect(container.textContent).toContain('Remplacement IA')
    expect(container.textContent).toContain('Vous avez été choisi pour soutenir')
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('.contest-support-actions button'))[0]!.click(); await Promise.resolve() })
    expect(onSupport).toHaveBeenCalledWith(1, expect.any(String))
  })

  it('shows another player turn without controls and renders a bot winner with title-bearing human result', () => {
    const otherTurn: ContestSnapshotDto = {
      ...lobby, status: 'RUNNING', phase: 'TURNS', startedAt: '2026-09-13T10:00:00Z', turnDeadlineAt: '2099-09-13T12:00:00Z',
      currentRound: 3, currentTurnOrder: 2, viewer: { participantSlot: null, spectator: true, organizer: false, selectedForSupport: false },
      participants: [{ ...lobby.participants[0]!, ready: true, basePoints: 3, turnOrder: 1, activeTurn: false }],
      spectators: [{ playerId: 'spectator-1', displayName: 'Mika', selected: false }],
    }
    const passive = mount({ ...base, active: otherTurn, permissions: { ...permissions, canOpen: false, canLeave: true } }).container
    expect(passive.textContent).toContain('Le serveur poursuit la partie.')
    expect(passive.textContent).not.toContain('Action de base')

    const finished: ContestSnapshotDto = {
      ...otherTurn, status: 'FINISHED', phase: 'FINISHED', turnDeadlineAt: null, finishedAt: '2026-09-13T10:10:00Z', winnerSlot: 2,
      participants: [
        { ...otherTurn.participants[0]!, score: 48, finalRank: 2, rewardPrimogems: '400', title: 'Titan Argent' },
        { ...otherTurn.participants[0]!, slot: 2, kind: 'BOT', playerId: null, displayName: 'Astra · Bot 2', characterName: 'Légende invitée', score: 52, turnOrder: 2, finalRank: 1, rewardPrimogems: '0' },
      ],
    }
    const result = mount({ ...base, active: null, lastResult: finished, dailyUsed: true, permissions: { ...permissions, canOpen: false } }).container
    expect(result.textContent).toContain('Astra · Bot 2 remporte le Concours')
    expect(result.textContent).toContain('Titan Argent')
    expect(result.textContent).toContain('2e · 400 Primos')
  })
})
