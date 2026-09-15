// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/game-api'
import type { ContestDto, ContestHistoryDto, ContestSnapshotDto } from '../api/types'
import ContestScreen from './ContestScreen'

const appCss = readFileSync(`${process.cwd()}/src/App.css`, 'utf8')

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const roots: Root[] = []
beforeEach(() => vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ matched: [], unmatched: [] }) }))))
afterEach(() => {
  act(() => roots.splice(0).forEach((root) => root.unmount()))
  document.body.replaceChildren()
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}

const theme = { key: 'STRENGTH', label: 'Force', title: 'Titan', statKey: 'strength' } as const
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
  viewer: { participantSlot: 1, selectedCharacterId: 'character-1', spectator: false, organizer: true, selectedForSupport: false },
  participants: [{ slot: 1, kind: 'HUMAN', playerId: 'player-1', displayName: 'Kichnifou', characterName: 'Furina', avatar: null, basePoints: null, titleRank: 0, title: null, score: 0, turnOrder: null, ready: false, activeTurn: false, replaced: false, liveRank: null, finalRank: null, rewardPrimogems: null }],
  spectators: [], recentScoreChanges: [], promotions: [], historyEvents: [],
}

function mount(value: ContestDto, overrides: Partial<React.ComponentProps<typeof ContestScreen>> = {}) {
  const unchanged = vi.fn(async () => value)
  const props = {
    value, onRefresh: unchanged, onOpen: unchanged, onJoin: unchanged, onSelectLegend: unchanged, onReady: unchanged,
    onStart: unchanged, onSpectate: unchanged, onLeave: unchanged, onCancel: unchanged, onPlay: unchanged, onSupport: unchanged,
    onRemoveParticipant: unchanged, onRemoveSpectator: unchanged,
    onLoadHistory: vi.fn(async (): Promise<ContestHistoryDto> => ({ page: 1, pageSize: 10, total: 0, pageCount: 1, contests: [] })),
    onLoadHistoryDetail: vi.fn(async () => lobby),
    ...overrides,
  }
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container); roots.push(root)
  act(() => root.render(<ContestScreen {...props} />))
  return { container, props, root }
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
    expect(Array.from(select.options).map((option) => option.textContent)).toEqual(['Choisir une Légende', 'Furina — 12/20', 'Nahida — 12/20'])
    act(() => { select.value = 'character-2'; select.dispatchEvent(new Event('change', { bubbles: true })) })
    await act(async () => { container.querySelector<HTMLButtonElement>('.contest-empty .app-button-primary')!.click(); await Promise.resolve() })
    expect(onOpen).toHaveBeenCalledWith('character-2', expect.any(String))
  })

  it('disables joining affordances after daily use while preserving spectating', () => {
    const otherLobby = { ...lobby, viewer: { ...lobby.viewer, participantSlot: null, selectedCharacterId: null, organizer: false }, participants: [{ ...lobby.participants[0]!, playerId: 'other-player', displayName: 'Autre joueur' }] }
    const value = { ...base, dailyUsed: true, active: otherLobby, permissions: { ...permissions, canOpen: false, canJoin: false, canSpectate: true } }
    const { container } = mount(value)
    expect(container.querySelector<HTMLSelectElement>('.contest-join-panel select')?.disabled).toBe(true)
    expect(Array.from(container.querySelectorAll<HTMLButtonElement>('.contest-inline-actions button')).find((button) => button.textContent === 'Participer')?.disabled).toBe(true)
    expect(Array.from(container.querySelectorAll<HTMLButtonElement>('.contest-inline-actions button')).find((button) => button.textContent === 'Regarder activement')?.disabled).toBe(false)
    expect(container.querySelector('.contest-join-unavailable')?.textContent).toBe('Participation quotidienne déjà utilisée.')
  })

  it('opens an eligible C6 lobby and keeps detailed /20 stats inside Mes Légendes', async () => {
    const onOpen = vi.fn(async () => base)
    const { container } = mount(base, { onOpen })
    expect(container.textContent).toContain('Aucun Concours actif')
    expect(container.querySelector('.contest-participant-grid')?.textContent ?? '').not.toContain('/20')
    const picker = container.querySelector<HTMLSelectElement>('.contest-legend-select select')!
    act(() => { picker.value = 'character-1'; picker.dispatchEvent(new Event('change', { bubbles: true })) })
    await act(async () => { container.querySelector<HTMLButtonElement>('.contest-empty .app-button-primary')!.click(); await Promise.resolve() })
    expect(onOpen).toHaveBeenCalledWith('character-1', expect.any(String))
    act(() => Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Mes Légendes')!.click())
    expect(container.querySelector('[aria-label="Mes Légendes"]')?.textContent).toContain('Force 12/20')
    expect(container.querySelectorAll('.contest-legends-list > *')).toHaveLength(3)
  })

  it('filters, sorts, and paginates personal Legends after three complete entries', () => {
    const legends = [
      { ...legend, character: { ...legend.character, id: 'z', name: 'Zhongli', elementKey: 'geo' as const }, stats: { ...legend.stats, strength: 20 } },
      { ...legend, character: { ...legend.character, id: 'e', name: 'Éclair', elementKey: 'electro' as const }, stats: { ...legend.stats, strength: 2 } },
      { ...legend, character: { ...legend.character, id: 'a', name: 'Amber', elementKey: 'pyro' as const }, stats: { ...legend.stats, strength: 4 } },
      { ...legend, character: { ...legend.character, id: 'n', name: 'Nahida', elementKey: 'dendro' as const }, stats: { ...legend.stats, strength: 15 } },
    ]
    const { container } = mount({ ...base, legends })
    act(() => Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Mes Légendes')!.click())
    const modal = container.querySelector<HTMLElement>('[aria-label="Mes Légendes"]')!
    expect(modal.querySelectorAll('.contest-legends-list article')).toHaveLength(3)
    expect(modal.querySelector('.history-modal-pagination')?.textContent).toContain('Page 1 / 2')
    act(() => Array.from(modal.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Suivant')!.click())
    expect(modal.querySelector('.contest-legends-list')?.textContent).toContain('Zhongli')

    const search = modal.querySelector<HTMLInputElement>('.contest-legends-controls input')!
    act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, 'eclair'); search.dispatchEvent(new Event('input', { bubbles: true })) })
    expect(modal.querySelectorAll('.contest-legends-list article')).toHaveLength(1)
    expect(modal.querySelector('.contest-legends-list')?.textContent).toContain('Éclair')
    expect(Array.from(modal.querySelectorAll<HTMLSelectElement>('.contest-legends-controls select'))[1]?.textContent).toContain('Puissance totale')
  })

  it('shows lobby readiness and strict organizer controls without exposing raw stat maxima', async () => {
    const value = { ...base, active: lobby, permissions: { ...permissions, canOpen: false, canLeave: true, canReady: true, canStart: true, canCancel: true } }
    const onReady = vi.fn(async () => value)
    const onStart = vi.fn(async () => value)
    const { container } = mount(value, { onReady, onStart })
    expect(container.textContent).toContain('Lobby public')
    expect(container.textContent).toContain('Pas prêt')
    expect(container.querySelector('.contest-participant-grid')?.textContent ?? '').not.toContain('/20')
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Je suis prêt')!.click(); await Promise.resolve() })
    expect(onReady).toHaveBeenCalledWith(true, expect.any(String))
    expect(container.textContent).not.toContain('Lancer avec des bots')
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Lancer')!.click(); await Promise.resolve() })
    expect(document.body.textContent).toContain('participation quotidienne de tous les joueurs participants')
    expect(onStart).not.toHaveBeenCalled()
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(document.querySelector('[role="alertdialog"]')).toBeNull()
    act(() => Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Lancer')!.click())
    act(() => Array.from(document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')).find((button) => button.textContent === 'Non')!.click())
    expect(onStart).not.toHaveBeenCalled()
    act(() => Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Lancer')!.click())
    await act(async () => { document.querySelector<HTMLButtonElement>('[role="alertdialog"] [aria-label="Lancer le Concours"]')!.click(); await Promise.resolve() })
    expect(onStart).toHaveBeenCalledWith(expect.any(String))
    expect(onStart).toHaveBeenCalledTimes(1)
  })

  it('closes confirmations when their authoritative Contest context becomes stale and never executes stale Yes', async () => {
    const lobbyValue = { ...base, active: lobby, permissions: { ...permissions, canStart: true, canCancel: true } }
    const onStart = vi.fn(async () => lobbyValue)
    const mounted = mount(lobbyValue, { onStart })
    act(() => Array.from(mounted.container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Lancer')!.click())
    expect(document.querySelector('[role="alertdialog"]')).not.toBeNull()
    const running = { ...lobby, status: 'RUNNING' as const, phase: 'TURNS' as const, currentRound: 1, currentTurnOrder: 1, startedAt: '2026-09-14T12:00:00Z', turnDeadlineAt: '2099-09-14T12:00:00Z' }
    const runningValue = { ...base, active: running, permissions: { ...permissions, canLeave: true, canCancel: true } }
    await act(async () => { mounted.root.render(<ContestScreen {...mounted.props} value={runningValue} />); await Promise.resolve() })
    expect(document.querySelector('[role="alertdialog"]')).toBeNull()
    expect(onStart).not.toHaveBeenCalled()

    const leave = vi.fn(async () => runningValue)
    await act(async () => { mounted.root.render(<ContestScreen {...mounted.props} value={runningValue} onLeave={leave} />); await Promise.resolve() })
    act(() => Array.from(mounted.container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Quitter le Concours')!.click())
    expect(document.querySelector('[role="alertdialog"]')).not.toBeNull()
    const nextTurn = { ...runningValue, active: { ...running, currentTurnOrder: 2 } }
    await act(async () => { mounted.root.render(<ContestScreen {...mounted.props} value={nextTurn} onLeave={leave} />); await Promise.resolve() })
    expect(document.querySelector('[role="alertdialog"]')).toBeNull()
    expect(leave).not.toHaveBeenCalled()

    act(() => Array.from(mounted.container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Quitter le Concours')!.click())
    const noPermission = { ...nextTurn, permissions: { ...nextTurn.permissions, canLeave: false } }
    await act(async () => { mounted.root.render(<ContestScreen {...mounted.props} value={noPermission} onLeave={leave} />); await Promise.resolve() })
    expect(document.querySelector('[role="alertdialog"]')).toBeNull()
    expect(leave).not.toHaveBeenCalled()
  })

  it('treats an expired confirmation as No without sending a mutation', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-14T12:00:00.000Z'))
    const running = {
      ...lobby,
      status: 'RUNNING' as const,
      phase: 'TURNS' as const,
      currentRound: 1,
      currentTurnOrder: 1,
      startedAt: '2026-09-14T11:59:00.000Z',
      turnDeadlineAt: '2026-09-14T12:00:01.000Z',
    }
    const value = { ...base, active: running, permissions: { ...permissions, canLeave: true } }
    const onLeave = vi.fn(async () => value)
    const { container } = mount(value, { onLeave })

    act(() => Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Quitter le Concours')!.click())
    expect(document.querySelector('[role="alertdialog"]')).not.toBeNull()
    await act(async () => { await vi.advanceTimersByTimeAsync(1_100) })
    expect(document.querySelector('[role="alertdialog"]')).toBeNull()
    expect(onLeave).not.toHaveBeenCalled()
  })

  it('confirms irreversible running participation consequences but not lobby or spectator exits', async () => {
    const running: ContestSnapshotDto = { ...lobby, status: 'RUNNING', phase: 'TURNS', startedAt: '2026-09-13T10:00:00Z', turnDeadlineAt: '2099-09-13T12:00:00Z', currentRound: 2, currentTurnOrder: 1 }
    const runningValue = { ...base, active: running, permissions: { ...permissions, canLeave: true, canCancel: true } }
    const onLeave = vi.fn(async () => runningValue)
    const onCancel = vi.fn(async () => runningValue)
    const { container } = mount(runningValue, { onLeave, onCancel })

    act(() => Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Quitter le Concours')!.click())
    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain('déjà été consommée au lancement')
    expect(onLeave).not.toHaveBeenCalled()
    act(() => document.querySelector<HTMLButtonElement>('[role="alertdialog"] [aria-label="Fermer"]')!.click())
    expect(onLeave).not.toHaveBeenCalled()
    act(() => Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Quitter le Concours')!.click())
    await act(async () => { document.querySelector<HTMLButtonElement>('[role="alertdialog"] [aria-label="Quitter le Concours"]')!.click(); await Promise.resolve() })
    expect(onLeave).toHaveBeenCalledTimes(1)

    act(() => Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Annuler le Concours')!.click())
    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain('autres participants humains récupéreront la leur')
    expect(onCancel).not.toHaveBeenCalled()
    await act(async () => { document.querySelector<HTMLButtonElement>('[role="alertdialog"] [aria-label="Annuler le Concours"]')!.click(); await Promise.resolve() })
    expect(onCancel).toHaveBeenCalledTimes(1)

    const spectatorContest = { ...running, viewer: { ...running.viewer, participantSlot: null, spectator: true, organizer: false } }
    const spectatorValue = { ...base, active: spectatorContest, permissions: { ...permissions, canLeave: true } }
    const spectatorLeave = vi.fn(async () => spectatorValue)
    const spectator = mount(spectatorValue, { onLeave: spectatorLeave }).container
    await act(async () => { Array.from(spectator.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Quitter le Concours')!.click(); await Promise.resolve() })
    expect(spectator.querySelector('[role="alertdialog"]')).toBeNull()
    expect(spectatorLeave).toHaveBeenCalledTimes(1)

    const lobbyValue = { ...base, active: lobby, permissions: { ...permissions, canCancel: true } }
    const lobbyCancel = vi.fn(async () => lobbyValue)
    const lobbyView = mount(lobbyValue, { onCancel: lobbyCancel }).container
    await act(async () => { Array.from(lobbyView.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Annuler le lobby')!.click(); await Promise.resolve() })
    expect(lobbyView.querySelector('[role="alertdialog"]')).toBeNull()
    expect(lobbyCancel).toHaveBeenCalledTimes(1)
  })

  it('lets a lobby spectator leave and lets the organizer remove active spectators', async () => {
    const spectatorLobby: ContestSnapshotDto = {
      ...lobby,
      viewer: { participantSlot: null, selectedCharacterId: null, spectator: true, organizer: false, selectedForSupport: false },
      spectators: [{ playerId: 'spectator-self', displayName: 'Mika', selected: false }],
    }
    const spectatorValue = { ...base, active: spectatorLobby, permissions: { ...permissions, canJoin: true, canLeave: true } }
    const onLeave = vi.fn(async () => spectatorValue)
    const spectatorView = mount(spectatorValue, { onLeave }).container
    await act(async () => { Array.from(spectatorView.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Quitter le rôle de spectateur')!.click(); await Promise.resolve() })
    expect(onLeave).toHaveBeenCalledWith(expect.any(String))

    const organizerLobby = { ...lobby, spectators: [{ playerId: 'spectator-target', displayName: 'Jean Julien', selected: false }] }
    const organizerValue = { ...base, active: organizerLobby, permissions: { ...permissions, canLeave: true } }
    const onRemoveSpectator = vi.fn(async () => organizerValue)
    const organizerView = mount(organizerValue, { onRemoveSpectator }).container
    const removeButton = organizerView.querySelector<HTMLButtonElement>('.contest-spectator-remove')!
    expect(removeButton.textContent).toBe('×')
    expect(removeButton.getAttribute('aria-label')).toBe('Retirer Jean Julien des spectateurs')
    await act(async () => { removeButton.click(); await Promise.resolve() })
    expect(onRemoveSpectator).toHaveBeenCalledWith('spectator-target', expect.any(String))
  })

  it('keeps turn-order cards stable while showing live ranks and four distinctive title styles', () => {
    const participants: ContestSnapshotDto['participants'] = [
      { ...lobby.participants[0]!, slot: 3, playerId: 'player-3', displayName: 'Troisième', titleRank: 1, title: 'Titan de Bronze', score: 30, turnOrder: 1, liveRank: 1 },
      { ...lobby.participants[0]!, slot: 4, playerId: 'player-4', displayName: 'Quatrième', titleRank: 2, title: 'Titan d’Argent', score: 5, turnOrder: 2, liveRank: 4 },
      { ...lobby.participants[0]!, slot: 2, playerId: 'player-2', displayName: 'Deuxième', titleRank: 3, title: 'Titan d’Or', score: 30, turnOrder: 3, liveRank: 2 },
      { ...lobby.participants[0]!, slot: 1, displayName: 'Premier', titleRank: 4, title: 'Titan de Platine', score: 12, turnOrder: 4, liveRank: 3 },
    ]
    const activeTheme = { key: 'POPULARITY', label: 'Popularité', title: 'Idôle', statKey: 'popularity' } as const
    const running: ContestSnapshotDto = { ...lobby, theme: activeTheme, status: 'RUNNING', phase: 'TURNS', startedAt: '2026-09-13T10:00:00Z', turnDeadlineAt: '2099-09-13T12:00:00Z', currentTurnOrder: 1, participants }
    const container = mount({ ...base, active: running, permissions: { ...permissions, canLeave: true } }).container
    expect(container.querySelector('.contest-toolbar')?.textContent).toContain('Thème du ConcoursPopularité')
    expect(Array.from(container.querySelectorAll('.contest-participant h3')).map((node) => node.textContent)).toEqual(['Troisième', 'Quatrième', 'Deuxième', 'Premier'])
    expect(Array.from(container.querySelectorAll('.contest-live-rank')).map((node) => node.textContent)).toEqual(['1er', '4e', '2e', '3e'])
    for (const rank of [1, 2, 3, 4]) expect(container.querySelector(`.contest-title-rank-${rank}`)).not.toBeNull()
    expect(container.textContent).toContain('Titan de Platine')
  })

  it('renders running actions and loads only the paginated finished history', async () => {
    const running: ContestSnapshotDto = { ...lobby, status: 'RUNNING', phase: 'TURNS', startedAt: '2026-09-13T10:00:00Z', turnDeadlineAt: '2099-09-13T12:00:00Z', currentRound: 2, currentTurnOrder: 1, participants: lobby.participants.map((participant) => ({ ...participant, basePoints: 3, turnOrder: 1, ready: true, activeTurn: true })) }
    const value = { ...base, active: running, permissions: { ...permissions, canOpen: false, canLeave: true, canPlay: true } }
    const onPlay = vi.fn(async () => value)
    const history = { ...running, status: 'FINISHED' as const, phase: 'FINISHED' as const, turnDeadlineAt: null, finishedAt: '2026-09-13T10:10:00Z', winnerSlot: 1, participants: running.participants.map((participant) => ({ ...participant, activeTurn: false, finalRank: 1, rewardPrimogems: '800' })) }
    const onLoadHistory = vi.fn(async (): Promise<ContestHistoryDto> => ({ page: 1, pageSize: 10, total: 1, pageCount: 1, contests: [{ id: history.id, businessDate: history.businessDate, theme: history.theme, currentRound: history.currentRound, winner: { slot: 1, displayName: 'Kichnifou', kind: 'HUMAN' }, startedAt: history.startedAt, finishedAt: history.finishedAt }] }))
    const onLoadHistoryDetail = vi.fn(async () => history)
    const { container } = mount(value, { onPlay, onLoadHistory, onLoadHistoryDetail })
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Action de base')!.click(); await Promise.resolve() })
    expect(onPlay).toHaveBeenCalledWith('BASIC', expect.any(String))
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Historique')!.click(); await Promise.resolve() })
    expect(onLoadHistory).toHaveBeenCalledWith(1)
    expect(container.querySelector('[aria-label="Historique des Concours"]')?.textContent).toContain('vainqueur Kichnifou')
    expect(container.querySelectorAll('.contest-history-list > *')).toHaveLength(10)
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Détails →')!.click(); await Promise.resolve() })
    expect(onLoadHistoryDetail).toHaveBeenCalledWith('contest-1')
    expect(container.querySelector('[aria-label="Historique des Concours"]')?.textContent).toContain('#1 Kichnifou')
  })

  it('renders the interpreted public detail for humans, bots, replacement, support, rewards and promotion', async () => {
    const detail: ContestSnapshotDto = {
      ...lobby, status: 'FINISHED', phase: 'FINISHED', currentRound: 5, winnerSlot: 1, startedAt: '2026-09-13T10:00:00Z', finishedAt: '2026-09-13T10:07:30Z',
      participants: [
        { ...lobby.participants[0]!, ready: true, basePoints: 5, turnOrder: 2, score: 52, finalRank: 1, rewardPrimogems: '800' },
        { ...lobby.participants[0]!, slot: 2, kind: 'BOT', playerId: null, displayName: 'Astra · Bot', characterName: 'Légende relayée', ready: true, basePoints: 3, turnOrder: 1, score: 41, finalRank: 2, rewardPrimogems: '0', replaced: true, replacementReason: 'LEFT' },
        { ...lobby.participants[0]!, slot: 3, kind: 'BOT', playerId: null, displayName: 'Braise · Bot', characterName: 'Légende invitée', ready: true, basePoints: 3, turnOrder: 4, score: 35, finalRank: 3, rewardPrimogems: '0' },
        { ...lobby.participants[0]!, slot: 4, kind: 'BOT', playerId: null, displayName: 'Céleste · Bot', characterName: 'Légende invitée', ready: true, basePoints: 2, turnOrder: 3, score: 29, finalRank: 4, rewardPrimogems: '0' },
      ],
      promotions: [{ playerId: 'player-1', slot: 1, characterName: 'Furina', fromRank: 2, toRank: 3, title: 'Titan d’Or' }],
      historyEvents: [
        { kind: 'PARTICIPANT_LEFT', occurredAt: '2026-09-13T10:04:00Z', slot: 2, playerName: 'Mynonyme' },
        { kind: 'PARTICIPANT_REPLACED', occurredAt: '2026-09-13T10:04:00Z', slot: 2, playerName: 'Mynonyme', characterName: 'Furina', botName: 'Braise · Bot', score: 41, reason: 'LEFT' },
        { kind: 'SUPPORT_SELECTED', occurredAt: '2026-09-13T10:05:00Z', round: 4, playerName: 'Mika' },
        { kind: 'SUPPORT_PLAYED', occurredAt: '2026-09-13T10:05:10Z', slot: 1, playerName: 'Mika', targetName: 'Kichnifou', points: 3 },
        { kind: 'TITLE_PROMOTED', occurredAt: '2026-09-13T10:07:30Z', slot: 1, playerName: 'Kichnifou', characterName: 'Furina', fromRank: 2, toRank: 3, title: 'Titan d’Or' },
      ],
    }
    const onLoadHistory = vi.fn(async (): Promise<ContestHistoryDto> => ({ page: 1, pageSize: 10, total: 1, pageCount: 1, contests: [{ id: detail.id, businessDate: detail.businessDate, theme: detail.theme, currentRound: 5, winner: { slot: 1, displayName: 'Kichnifou', kind: 'HUMAN' }, startedAt: detail.startedAt, finishedAt: detail.finishedAt }] }))
    const { container } = mount(base, { onLoadHistory, onLoadHistoryDetail: vi.fn(async () => detail) })
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Historique')!.click(); await Promise.resolve() })
    expect(container.querySelectorAll('.contest-history-list article')).toHaveLength(1)
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Détails →')!.click(); await Promise.resolve() })
    const modalText = container.querySelector('[aria-label="Historique des Concours"]')?.textContent ?? ''
    expect(modalText).toContain('Date métier')
    expect(modalText).toContain('7 min 30 s')
    expect(modalText).toContain('Ordre de tour')
    expect(modalText).toContain('#1 Kichnifou · vainqueur')
    expect(modalText).toContain('Humain · Furina')
    expect(modalText).toContain('Astra · BotBot')
    expect(modalText).toContain('800 Primos')
    expect(modalText).toContain('Mynonyme a quitté le Concours')
    expect(modalText).toContain('Mika a soutenu Kichnifou de 3 points')
    expect(modalText).toContain('Mynonyme · Furina a été remplacé par Braise · Bot')
    expect(modalText).toContain('score conservé : 41')
    expect(modalText).toContain('✨ Furina devient Titan d’Or !')
    expect(modalText).not.toContain('/20')
  })

  it('renders passive spectators, a selected support window, and a replaced participant', async () => {
    const supportTargets: ContestSnapshotDto['participants'] = [
      { ...lobby.participants[0]!, kind: 'BOT', playerId: null, displayName: 'Astra · Bot 1', ready: true, basePoints: 3, turnOrder: 1, replaced: true },
      { ...lobby.participants[0]!, slot: 2, playerId: 'player-2', displayName: 'Mynonyme', ready: true, basePoints: 2, turnOrder: 2 },
      { ...lobby.participants[0]!, slot: 3, playerId: 'player-3', displayName: 'Mika', ready: true, basePoints: 2, turnOrder: 3 },
      { ...lobby.participants[0]!, slot: 4, playerId: 'player-4', displayName: 'Céo', ready: true, basePoints: 4, turnOrder: 4 },
    ]
    const running: ContestSnapshotDto = {
      ...lobby, status: 'RUNNING', phase: 'SUPPORT', startedAt: '2026-09-13T10:00:00Z', supportDeadlineAt: '2099-09-13T12:00:00Z',
      currentRound: 2, viewer: { participantSlot: null, selectedCharacterId: null, spectator: true, organizer: false, selectedForSupport: true },
      participants: supportTargets,
      spectators: [{ playerId: 'spectator-1', displayName: 'Jean Julien', selected: true }],
    }
    const value = { ...base, active: running, permissions: { ...permissions, canOpen: false, canLeave: true, canSupport: true } }
    const onSupport = vi.fn(async () => value)
    const { container } = mount(value, { onSupport })
    expect(container.querySelector('[aria-label="Spectateurs"]')?.textContent).toContain('Jean Julien · soutien sélectionné')
    expect(container.textContent).toContain('Remplacement IA')
    expect(container.textContent).toContain('À vous de soutenir un participant.')
    expect(container.querySelector('.contest-action-region')).toBeNull()
    expect(container.querySelectorAll<HTMLButtonElement>('.contest-card-actions button')).toHaveLength(4)
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('.contest-card-actions button'))[1]!.click(); await Promise.resolve() })
    expect(onSupport).toHaveBeenCalledWith(2, expect.any(String))
  })

  it('shows another player turn without controls and renders a bot winner with title-bearing human result', () => {
    const otherTurn: ContestSnapshotDto = {
      ...lobby, status: 'RUNNING', phase: 'TURNS', startedAt: '2026-09-13T10:00:00Z', turnDeadlineAt: '2099-09-13T12:00:00Z',
      currentRound: 3, currentTurnOrder: 2, viewer: { participantSlot: null, selectedCharacterId: null, spectator: true, organizer: false, selectedForSupport: false },
      participants: [{ ...lobby.participants[0]!, ready: true, basePoints: 3, turnOrder: 1, activeTurn: false }],
      spectators: [{ playerId: 'spectator-1', displayName: 'Mika', selected: false }],
    }
    const passive = mount({ ...base, active: otherTurn, permissions: { ...permissions, canOpen: false, canLeave: true } }).container
    expect(passive.textContent).toContain('En attente des joueurs...')
    expect(passive.textContent).not.toContain('vous pouvez être choisi pour soutenir')
    expect(passive.querySelector('.contest-action-region')).toBeNull()
    expect(passive.textContent).not.toContain('Action de base')

    const finished: ContestSnapshotDto = {
      ...otherTurn, status: 'FINISHED', phase: 'FINISHED', turnDeadlineAt: null, finishedAt: '2026-09-13T10:10:00Z', winnerSlot: 2,
      participants: [
        { ...otherTurn.participants[0]!, score: 48, finalRank: 2, rewardPrimogems: '400', title: 'Titan d’Argent' },
        { ...otherTurn.participants[0]!, slot: 2, kind: 'BOT', playerId: null, displayName: 'Astra · Bot 2', characterName: 'Légende invitée', score: 52, turnOrder: 2, finalRank: 1, rewardPrimogems: '0' },
      ],
      promotions: [{ playerId: 'player-1', slot: 1, characterName: 'Furina', fromRank: 1, toRank: 2, title: 'Titan d’Argent' }],
    }
    const result = mount({ ...base, active: null, lastResult: finished, dailyUsed: true, permissions: { ...permissions, canOpen: false } }).container
    expect(result.textContent).toContain('Astra · Bot 2 remporte le Concours')
    expect(result.textContent).toContain('Titan d’Argent')
    expect(result.textContent).toContain('✨ Furina devient Titan d’Argent !')
    expect(result.textContent).toContain('2e · 400 Primos')
  })

  it('puts play controls only on the current viewer card without changing card geometry', () => {
    const participants: ContestSnapshotDto['participants'] = [1, 2, 3, 4].map((slot) => ({
      ...lobby.participants[0]!, slot, playerId: `player-${slot}`, displayName: `Joueur ${slot}`, basePoints: 2, turnOrder: slot, ready: true, activeTurn: slot === 2,
    }))
    const running: ContestSnapshotDto = { ...lobby, status: 'RUNNING', phase: 'TURNS', startedAt: '2026-09-13T10:00:00Z', turnDeadlineAt: '2099-09-13T12:00:00Z', currentTurnOrder: 2, viewer: { ...lobby.viewer, participantSlot: 2 }, participants }
    const container = mount({ ...base, active: running, permissions: { ...permissions, canPlay: true } }).container
    const cards = container.querySelectorAll('.contest-participant')
    expect(cards[0]?.querySelector('.contest-card-actions')).toBeNull()
    expect(cards[1]?.querySelector('.contest-card-actions')?.textContent).toContain('Action de base')
    expect(cards[1]?.querySelector('.contest-card-actions')?.textContent).toContain('Prendre un risque')
    expect(Array.from(cards[1]!.querySelectorAll<HTMLButtonElement>('.contest-card-actions button')).map((button) => button.className)).toEqual([
      expect.stringContaining('app-button-primary'),
      expect.stringContaining('app-button-danger'),
    ])
    expect(cards[2]?.querySelector('.contest-card-actions')).toBeNull()
    expect(cards[3]?.querySelector('.contest-card-actions')).toBeNull()
    expect(container.textContent).toContain('À votre tour !')
    expect(appCss).toMatch(/\.contest-card-actions \{[\s\S]*?position: absolute/)
  })

  it('reloads the persisted lobby Legend and restores it after a failed change', async () => {
    const secondLegend = { ...legend, character: { ...legend.character, id: 'character-2', externalKey: 'nahida', name: 'Nahida' } }
    const persistedLobby = { ...lobby, viewer: { ...lobby.viewer, selectedCharacterId: 'character-2' }, participants: [{ ...lobby.participants[0]!, characterName: 'Nahida' }] }
    const value = { ...base, legends: [legend, secondLegend], active: persistedLobby, permissions: { ...permissions, canOpen: false, canReady: true } }
    const onSelectLegend = vi.fn(async () => { throw new Error('Refus serveur') })
    const onRefresh = vi.fn(async () => value)
    const { container } = mount(value, { onSelectLegend, onRefresh })
    const select = container.querySelector<HTMLSelectElement>('.contest-legend-select select')!
    expect(select.value).toBe('character-2')
    await act(async () => { select.value = 'character-1'; select.dispatchEvent(new Event('change', { bubbles: true })); await Promise.resolve(); await Promise.resolve() })
    expect(onSelectLegend).toHaveBeenCalledWith('character-1', expect.any(String))
    expect(onRefresh).toHaveBeenCalled()
    expect(select.value).toBe('character-2')
  })

  it('requires a personal Legend choice before opening from the last result', async () => {
    const secondLegend = { ...legend, character: { ...legend.character, id: 'character-2', externalKey: 'nahida', name: 'Nahida' }, stats: { ...legend.stats, strength: 18 } }
    const finished = { ...lobby, status: 'FINISHED' as const, phase: 'FINISHED' as const, winnerSlot: 1, startedAt: '2026-09-13T10:00:00Z', finishedAt: '2026-09-13T10:05:00Z', participants: [{ ...lobby.participants[0]!, ready: true, basePoints: 3, turnOrder: 1, score: 50, finalRank: 1, rewardPrimogems: '800' }] }
    const value = { ...base, legends: [legend, secondLegend], lastResult: finished, permissions: { ...permissions, canOpen: true } }
    const onOpen = vi.fn(async () => value)
    const { container } = mount(value, { onOpen })
    const select = container.querySelector<HTMLSelectElement>('.contest-result-hero select')!
    const button = container.querySelector<HTMLButtonElement>('.contest-result-hero .app-button-primary')!
    expect(select.value).toBe('')
    expect(button.disabled).toBe(true)
    expect(select.textContent).toContain('Nahida — 18/20')
    act(() => { select.value = 'character-2'; select.dispatchEvent(new Event('change', { bubbles: true })) })
    await act(async () => { button.click(); await Promise.resolve() })
    expect(onOpen).toHaveBeenCalledWith('character-2', expect.any(String))
  })

  it('revalidates an active Contest on focus and visible visibility changes, then removes all listeners and polling', async () => {
    vi.useFakeTimers()
    const value = { ...base, active: lobby, permissions: { ...permissions, canOpen: false } }
    const onRefresh = vi.fn(async () => value)
    mount(value, { onRefresh })
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(onRefresh).toHaveBeenCalledTimes(1)
    await act(async () => { window.dispatchEvent(new Event('focus')); await Promise.resolve() })
    expect(onRefresh).toHaveBeenCalledTimes(2)
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); await Promise.resolve() })
    expect(onRefresh).toHaveBeenCalledTimes(2)
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); await Promise.resolve() })
    expect(onRefresh).toHaveBeenCalledTimes(3)
    await act(async () => { vi.advanceTimersByTime(2_000); await Promise.resolve() })
    expect(onRefresh).toHaveBeenCalledTimes(4)
    const root = roots.pop()!; act(() => root.unmount())
    await act(async () => { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); vi.advanceTimersByTime(4_000); await Promise.resolve() })
    expect(onRefresh).toHaveBeenCalledTimes(4)
  })

  it('keeps polling a temporary result so server expiration returns the open screen to neutral', async () => {
    vi.useFakeTimers()
    const finished = { ...lobby, status: 'FINISHED' as const, phase: 'FINISHED' as const, finishedAt: '2026-09-13T10:00:00Z' }
    const projected = { ...base, lastResult: finished, permissions: { ...permissions, canOpen: true } }
    const onRefresh = vi.fn(async () => base)
    mount(projected, { onRefresh })
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(onRefresh).toHaveBeenCalledTimes(1)
    await act(async () => { vi.advanceTimersByTime(3_000); await Promise.resolve(); await Promise.resolve() })
    expect(onRefresh).toHaveBeenCalledTimes(2)
  })

  it('revalidates immediately on entry and discovers a distant lobby within the three-second idle poll', async () => {
    vi.useFakeTimers()
    const onRefresh = vi.fn(async () => base)
    mount(base, { onRefresh })
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(onRefresh).toHaveBeenCalledOnce()
    await act(async () => { vi.advanceTimersByTime(2_999); await Promise.resolve() })
    expect(onRefresh).toHaveBeenCalledOnce()
    await act(async () => { vi.advanceTimersByTime(1); await Promise.resolve() })
    expect(onRefresh).toHaveBeenCalledTimes(2)
  })

  it('does not accumulate polling, focus, or visibility reads behind a slow response', async () => {
    vi.useFakeTimers()
    const value = { ...base, active: lobby, permissions: { ...permissions, canOpen: false } }
    const slow = deferred<ContestDto>()
    const onRefresh = vi.fn().mockImplementationOnce(() => slow.promise).mockResolvedValue(value)
    mount(value, { onRefresh })

    await act(async () => { vi.advanceTimersByTime(2_000); await Promise.resolve() })
    expect(onRefresh).toHaveBeenCalledTimes(1)
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
      document.dispatchEvent(new Event('visibilitychange'))
      vi.advanceTimersByTime(10_000)
      await Promise.resolve()
    })
    expect(onRefresh).toHaveBeenCalledTimes(1)

    await act(async () => { slow.resolve(value); await slow.promise; await Promise.resolve() })
    await act(async () => { vi.advanceTimersByTime(2_000); await Promise.resolve() })
    expect(onRefresh).toHaveBeenCalledTimes(2)
  })

  it('keeps Quitter and Annuler usable while a polling read is in flight', async () => {
    const value = { ...base, active: lobby, permissions: { ...permissions, canOpen: false, canLeave: true, canCancel: true } }
    const slowRefresh = deferred<ContestDto>()
    const onLeave = vi.fn(async () => value)
    const onCancel = vi.fn(async () => value)
    const { container } = mount(value, { onRefresh: vi.fn(() => slowRefresh.promise), onLeave, onCancel })

    await act(async () => { window.dispatchEvent(new Event('focus')); await Promise.resolve() })
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Quitter')!.click(); await Promise.resolve() })
    expect(onLeave).toHaveBeenCalledOnce()
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Annuler le lobby')!.click(); await Promise.resolve() })
    expect(onCancel).toHaveBeenCalledOnce()
    await act(async () => { slowRefresh.resolve(value); await slowRefresh.promise })
  })

  it('shows immediate pending feedback, blocks a double click, and retries an ambiguous action with the same key', async () => {
    const running: ContestSnapshotDto = { ...lobby, status: 'RUNNING', phase: 'TURNS', startedAt: '2026-09-13T10:00:00Z', turnDeadlineAt: '2099-09-13T12:00:00Z', currentRound: 2, currentTurnOrder: 1, participants: lobby.participants.map((participant) => ({ ...participant, basePoints: 3, turnOrder: 1, ready: true, activeTurn: true })) }
    const value = { ...base, active: running, permissions: { ...permissions, canOpen: false, canLeave: true, canPlay: true } }
    const first = deferred<ContestDto>()
    const onPlay = vi.fn().mockImplementationOnce(() => first.promise).mockResolvedValue(value)
    const { container } = mount(value, { onPlay })
    const actionButton = () => Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Action de base' || button.textContent === 'Action en cours…')!

    act(() => { actionButton().click(); actionButton().click() })
    expect(onPlay).toHaveBeenCalledTimes(1)
    expect(actionButton().textContent).toBe('Action en cours…')
    expect(actionButton().getAttribute('aria-busy')).toBe('true')
    const firstKey = onPlay.mock.calls[0]![1]

    await act(async () => { first.reject(new ApiError('NETWORK_ERROR', 'Réponse perdue', null)); await first.promise.catch(() => undefined); await Promise.resolve() })
    await act(async () => { actionButton().click(); await Promise.resolve() })
    expect(onPlay).toHaveBeenCalledTimes(2)
    expect(onPlay.mock.calls[1]![1]).toBe(firstKey)
  })

  it('separates a polling outage from mutation feedback and clears it after recovery', async () => {
    const value = { ...base, active: lobby, permissions: { ...permissions, canOpen: false } }
    const onRefresh = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(value)
    const { container } = mount(value, { onRefresh })
    await act(async () => { window.dispatchEvent(new Event('focus')); await Promise.resolve(); await Promise.resolve() })
    expect(container.querySelector('.contest-sync-feedback')?.textContent).toContain('Synchronisation temporairement indisponible')
    await act(async () => { window.dispatchEvent(new Event('focus')); await Promise.resolve(); await Promise.resolve() })
    expect(container.querySelector('.contest-sync-feedback')).toBeNull()
  })

  it('shows a new +0 event exactly once without changing the score', async () => {
    vi.useFakeTimers()
    const running: ContestSnapshotDto = {
      ...lobby,
      status: 'RUNNING', phase: 'TURNS', startedAt: '2026-09-13T10:00:00Z', turnDeadlineAt: '2099-09-13T12:00:00Z',
      currentTurnOrder: 1,
      participants: [{ ...lobby.participants[0]!, score: 4, basePoints: 2, turnOrder: 1, activeTurn: true }],
      recentScoreChanges: [{ eventId: 'already-seen', slot: 1, points: 2, kind: 'TURN_PLAYED', createdAt: '2026-09-13T10:00:00Z' }],
    }
    const value = { ...base, active: running, permissions: { ...permissions, canOpen: false } }
    const mounted = mount(value)
    expect(mounted.container.querySelector('.contest-score-change')).toBeNull()

    const zeroEvent = { ...running, recentScoreChanges: [...running.recentScoreChanges, { eventId: 'risk-zero', slot: 1, points: 0, kind: 'TURN_PLAYED' as const, createdAt: '2026-09-13T10:00:01Z' }] }
    act(() => mounted.root.render(<ContestScreen {...mounted.props} value={{ ...value, active: zeroEvent }} />))
    expect(mounted.container.querySelector('.contest-score strong')?.textContent).toBe('4')
    expect(mounted.container.querySelectorAll('.contest-score-change')).toHaveLength(1)
    expect(mounted.container.querySelector('.contest-score-change')?.textContent).toBe('+0')

    await act(async () => { vi.advanceTimersByTime(1_200); await Promise.resolve() })
    expect(mounted.container.querySelector('.contest-score-change')).toBeNull()
    act(() => mounted.root.render(<ContestScreen {...mounted.props} value={{ ...value, active: { ...zeroEvent } }} />))
    expect(mounted.container.querySelector('.contest-score-change')).toBeNull()
  })

  it('targets score feedback to support recipients and bot turns', () => {
    const participants: ContestSnapshotDto['participants'] = [
      { ...lobby.participants[0]!, score: 5, basePoints: 1, turnOrder: 1, activeTurn: false },
      { ...lobby.participants[0]!, slot: 2, kind: 'BOT', playerId: null, displayName: 'Astra · Bot', characterName: 'Légende invitée', score: 8, basePoints: 1, turnOrder: 2, activeTurn: true },
    ]
    const initial: ContestSnapshotDto = { ...lobby, status: 'RUNNING', phase: 'SUPPORT', startedAt: '2026-09-13T10:00:00Z', participants, recentScoreChanges: [] }
    const value = { ...base, active: initial, permissions: { ...permissions, canOpen: false } }
    const mounted = mount(value)

    const support = { ...initial, participants: participants.map((item) => item.slot === 2 ? { ...item, score: 11 } : item), recentScoreChanges: [{ eventId: 'support-3', slot: 2, points: 3, kind: 'SUPPORT_PLAYED' as const, createdAt: '2026-09-13T10:00:01Z' }] }
    act(() => mounted.root.render(<ContestScreen {...mounted.props} value={{ ...value, active: support }} />))
    expect(mounted.container.querySelectorAll('.contest-participant')[1]?.querySelector('.contest-score-change')?.textContent).toBe('+3')
    expect(mounted.container.querySelectorAll('.contest-participant')[0]?.querySelector('.contest-score-change')).toBeNull()

    const bot = { ...support, recentScoreChanges: [...support.recentScoreChanges, { eventId: 'bot-1', slot: 2, points: 1, kind: 'BOT_TURN_PLAYED' as const, createdAt: '2026-09-13T10:00:02Z' }] }
    act(() => mounted.root.render(<ContestScreen {...mounted.props} value={{ ...value, active: bot }} />))
    expect(mounted.container.querySelectorAll('.contest-participant')[1]?.querySelector('.contest-score-change')?.textContent).toBe('+3')
  })

  it('queues every unseen event chronologically, including remote +0 feedback', async () => {
    vi.useFakeTimers()
    const eventA = { eventId: 'A', slot: 1, points: 1, kind: 'TURN_PLAYED' as const, createdAt: '2026-09-13T10:00:00Z' }
    const eventB = { eventId: 'B', slot: 1, points: 0, kind: 'TURN_PLAYED' as const, createdAt: '2026-09-13T10:00:01Z' }
    const eventC = { eventId: 'C', slot: 1, points: 2, kind: 'TURN_AUTO_BASIC' as const, createdAt: '2026-09-13T10:00:02Z' }
    const running: ContestSnapshotDto = { ...lobby, status: 'RUNNING', phase: 'TURNS', startedAt: '2026-09-13T10:00:00Z', participants: [{ ...lobby.participants[0]!, basePoints: 2, turnOrder: 1 }], recentScoreChanges: [eventA] }
    const value = { ...base, active: running, permissions: { ...permissions } }
    const mounted = mount(value)
    act(() => mounted.root.render(<ContestScreen {...mounted.props} value={{ ...value, active: { ...running, recentScoreChanges: [eventA, eventB, eventC] } }} />))
    expect(mounted.container.querySelector('.contest-score-change')?.textContent).toBe('+0')
    expect(mounted.container.querySelector('.contest-score-change')?.getAttribute('data-event-id')).toBe('B')
    await act(async () => { vi.advanceTimersByTime(1_200); await Promise.resolve() })
    expect(mounted.container.querySelector('.contest-score-change')?.textContent).toBe('+2')
    expect(mounted.container.querySelector('.contest-score-change')?.getAttribute('data-event-id')).toBe('C')
  })

  it('shows the same remote turn and support events to independent player and spectator views', () => {
    const participants: ContestSnapshotDto['participants'] = [1, 2, 3, 4].map((slot) => ({ ...lobby.participants[0]!, slot, playerId: `player-${slot}`, displayName: `Joueur ${slot}`, basePoints: 2, turnOrder: slot }))
    const eventA = { eventId: 'A', slot: 1, points: 1, kind: 'TURN_PLAYED' as const, createdAt: '2026-09-13T10:00:00Z' }
    const initial: ContestSnapshotDto = { ...lobby, status: 'RUNNING', phase: 'TURNS', startedAt: '2026-09-13T10:00:00Z', participants, recentScoreChanges: [eventA] }
    const player = mount({ ...base, active: initial, permissions: { ...permissions } })
    const spectatorInitial = { ...initial, viewer: { participantSlot: null, selectedCharacterId: null, spectator: true, organizer: false, selectedForSupport: false } }
    const spectator = mount({ ...base, active: spectatorInitial, permissions: { ...permissions } })
    const remoteZero = { eventId: 'B', slot: 2, points: 0, kind: 'TURN_PLAYED' as const, createdAt: '2026-09-13T10:00:01Z' }
    act(() => {
      player.root.render(<ContestScreen {...player.props} value={{ ...base, active: { ...initial, recentScoreChanges: [eventA, remoteZero] }, permissions }} />)
      spectator.root.render(<ContestScreen {...spectator.props} value={{ ...base, active: { ...spectatorInitial, recentScoreChanges: [eventA, remoteZero] }, permissions }} />)
    })
    expect(player.container.querySelector('.contest-score-change')?.textContent).toBe('+0')
    expect(spectator.container.querySelector('.contest-score-change')?.textContent).toBe('+0')

    const support = { eventId: 'support-shared', slot: 3, points: 2, kind: 'SUPPORT_PLAYED' as const, createdAt: '2026-09-13T10:00:02Z' }
    const playerSupport = mount({ ...base, active: { ...initial, phase: 'SUPPORT', recentScoreChanges: [eventA] }, permissions })
    const spectatorSupport = mount({ ...base, active: { ...spectatorInitial, phase: 'SUPPORT', recentScoreChanges: [eventA] }, permissions })
    act(() => {
      playerSupport.root.render(<ContestScreen {...playerSupport.props} value={{ ...base, active: { ...initial, phase: 'SUPPORT', recentScoreChanges: [eventA, support] }, permissions }} />)
      spectatorSupport.root.render(<ContestScreen {...spectatorSupport.props} value={{ ...base, active: { ...spectatorInitial, phase: 'SUPPORT', recentScoreChanges: [eventA, support] }, permissions }} />)
    })
    for (const view of [playerSupport, spectatorSupport]) {
      const feedback = view.container.querySelectorAll('.contest-participant')[2]?.querySelector('.contest-score-change')
      expect(feedback?.textContent).toBe('+2')
      expect(feedback?.getAttribute('data-event-id')).toBe('support-shared')
    }
  })

  it('re-baselines the first fresh projection after a hidden-tab resume', () => {
    const eventA = { eventId: 'A', slot: 1, points: 1, kind: 'TURN_PLAYED' as const, createdAt: '2026-09-13T10:00:00Z' }
    const eventB = { eventId: 'B', slot: 1, points: 2, kind: 'TURN_PLAYED' as const, createdAt: '2026-09-13T10:00:01Z' }
    const eventC = { eventId: 'C', slot: 1, points: 3, kind: 'TURN_PLAYED' as const, createdAt: '2026-09-13T10:00:02Z' }
    const running: ContestSnapshotDto = { ...lobby, status: 'RUNNING', phase: 'TURNS', startedAt: '2026-09-13T10:00:00Z', participants: [{ ...lobby.participants[0]!, basePoints: 2, turnOrder: 1 }], recentScoreChanges: [eventA] }
    const value = { ...base, active: running, permissions }
    const mounted = mount(value)
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    act(() => mounted.root.render(<ContestScreen {...mounted.props} value={{ ...value, active: { ...running, recentScoreChanges: [eventA, eventB] } }} />))
    expect(mounted.container.querySelector('.contest-score-change')).toBeNull()
    act(() => mounted.root.render(<ContestScreen {...mounted.props} value={{ ...value, active: { ...running, recentScoreChanges: [eventA, eventB, eventC] } }} />))
    expect(mounted.container.querySelector('.contest-score-change')?.getAttribute('data-event-id')).toBe('C')
  })

  it('keeps participant, spectator, and action geometry stable at desktop breakpoints', () => {
    expect(appCss).toContain('.contest-scroll-body { min-height: 0; overflow-x: hidden; overflow-y: auto; }')
    expect(appCss).toContain('.contest-active-layout.running { grid-template-rows: auto auto auto auto; }')
    expect(appCss).not.toContain('grid-template-rows: 74px 230px 66px auto')
    expect(appCss).not.toContain('grid-template-rows: 58px 190px 66px 26px')
    expect(appCss).toContain('.contest-participant-grid { min-height: 210px; align-items: stretch; grid-auto-rows: minmax(210px, auto); }')
    expect(appCss).not.toContain('.contest-participant .contest-avatar { display: none; }')
    expect(appCss).toContain('.contest-spectators > div > span.removable { grid-template-columns: minmax(0, 1fr) 18px; }')
    expect(appCss).toMatch(/\.contest-card-actions \{[\s\S]*?position: absolute/)
    expect(appCss).toMatch(/\.contest-score-change \{[\s\S]*?position: absolute/)
    expect(appCss).not.toContain('.contest-feedback-region { min-height: 32px')
    expect(appCss).toContain('font-size: 15px; font-weight: 800;')
  })
})
