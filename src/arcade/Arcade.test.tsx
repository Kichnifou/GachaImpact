// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ArcadeOverview, ArcadeSession, ArcadeMutation, ArcadeRanking } from '../api/arcade-types'
import { activityTabs, parseNavigationHash, hashForScreen } from '../navigation/navigation'
import { publishProgressionUpdate } from '../progression/publish-progression-update'
import type { PlayerProgressionDto } from '../api/types'
const api = vi.hoisted(() => ({ getArcade: vi.fn(), startArcade: vi.fn(), actArcade: vi.fn(), getArcadeRecords: vi.fn() }))
vi.mock('../api/game-api', async importOriginal => ({ ...await importOriginal<object>(), getGameApiClient: () => api }))
import ArcadeScreen from '../screens/ArcadeScreen'
import ArcadeRecords from './ArcadeRecords'
import ArcadeBoards from './ArcadeBoards'
import { mergeArcadeSession } from './use-arcade'
import { ApiError } from '../api/game-api'
import LevelUpFeedback from '../components/LevelUpFeedback'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const roots: { root: Root; container: HTMLDivElement }[] = []
async function mount(element: React.ReactNode) {
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container); roots.push({ root, container })
  await act(async () => { root.render(element); await Promise.resolve(); await Promise.resolve() })
  return { root, container }
}
async function click(node: HTMLElement) { await act(async () => { node.click(); await Promise.resolve(); await Promise.resolve() }) }
const button = (scope: ParentNode, text: string) => {
  const node = Array.from(scope.querySelectorAll<HTMLButtonElement>('button')).find(item => item.textContent?.trim() === text)
  if (!node) throw Error('Missing button ' + text); return node
}
function session(game: ArcadeSession['game'], status: ArcadeSession['status'] = 'ACTIVE'): ArcadeSession {
  return { id: game + '-session', game, difficulty: 'MEDIUM', status, version: 0, rulesVersion: 1, scoringVersion: 1, firstSide: 'PLAYER', createdAt: '2026-10-01T10:00:00Z', nextActionAt: '2026-10-01T10:00:00Z', banter: { id: 'START:0', text: 'Prêt.' }, result: null,
    board: game === 'MEMORY' ? { kind: 'MEMORY', turn: 'PLAYER', phase: 'PICK', playerPairs: 0, aiPairs: 0, remainingPairs: 18, columns: 6, totalPairs: 18, outcome: null, cards: Array.from({ length: 36 }, (_, position) => ({ position, status: 'HIDDEN' })) }
      : { kind: game, turn: 'PLAYER', cells: Array(game === 'TIC_TAC_TOE' ? 9 : 42).fill(null), winningCells: [], lastMove: null, outcome: null } }
}
function overview(sessions: ArcadeSession[] = []): ArcadeOverview {
  return { sessions, serverNow: '2026-10-01T10:00:00Z', businessDate: '2026-10-01', records: [], scores: { MEMORY: '0', CONNECT_FOUR: '0', TIC_TAC_TOE: '0' }, totalScore: '0',
    daily: (['MEMORY', 'CONNECT_FOUR', 'TIC_TAC_TOE'] as const).map(game => ({ game, used: false, xpAwarded: 0 })) }
}
function mutation(row: ArcadeSession): ArcadeMutation { return { ...overview(), session: row, operationId: 'operation', alreadyProcessed: false, award: null } }
beforeEach(() => { vi.resetAllMocks(); api.getArcade.mockResolvedValue(overview()) })
afterEach(async () => { for (const { root, container } of roots.splice(0)) { await act(async () => root.unmount()); container.remove() } vi.useRealTimers() })

describe('Arcade interface and session lifecycle', () => {
  it('places Arcade between Event and Contest without changing other activity destinations', () => {
    expect(activityTabs.map(tab => tab.screen)).toEqual(['activities-dailies', 'activities-missions', 'activities-combat', 'activities-event', 'activities-arcade', 'activities-contest'])
    expect(parseNavigationHash('#activities/arcade')).toBe('activities-arcade'); expect(hashForScreen('activities-arcade')).toBe('activities/arcade')
  })
  it('starts only on explicit action, defaults to Medium and uses one shared shell', async () => {
    const { container } = await mount(<ArcadeScreen playerId="player-a" />)
    expect(api.startArcade).not.toHaveBeenCalled()
    api.startArcade.mockResolvedValue(mutation(session('MEMORY')))
    await click(button(container, 'Commencer'))
    expect(api.startArcade).toHaveBeenCalledWith({ game: 'MEMORY', difficulty: 'MEDIUM', expectedVersion: 0, previousSessionId: null, idempotencyKey: expect.any(String) })
    expect(container.querySelectorAll('.arcade-memory-card')).toHaveLength(36)
    expect(container.querySelectorAll('.arcade-header')).toHaveLength(1)
    expect(container.querySelector('select')?.disabled).toBe(true)
  })
  it('automatically resumes the active board, locks games and supports arrow navigation without hidden faces', async () => {
    api.getArcade.mockResolvedValue(overview([session('MEMORY')]))
    const { container } = await mount(<ArcadeScreen playerId="player-a" />)
    expect(container.textContent).toContain('À vous')
    expect(container.textContent).not.toMatch(/Reprendre|Pause/)
    expect(container.querySelectorAll('.arcade-memory img')).toHaveLength(0)
    expect(container.innerHTML).not.toMatch(/assetPaths|faceId|portrait-|seed|privateState/)
    const cards = container.querySelectorAll<HTMLButtonElement>('.arcade-memory-card'); cards[0]!.focus()
    act(() => cards[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })))
    expect(document.activeElement).toBe(cards[1])
    for (const label of ['Memory', 'Puissance 4', 'Morpion']) expect(button(container, label).disabled).toBe(true)
    await click(button(container, 'Puissance 4')); expect(container.querySelectorAll('.arcade-memory-card')).toHaveLength(36)
    expect(api.startArcade).not.toHaveBeenCalled(); expect(api.actArcade).not.toHaveBeenCalled()
  })
  it('confirms abandonment, retries its exact intent and unlocks games without a result', async () => {
    const row = session('CONNECT_FOUR'); api.getArcade.mockResolvedValue(overview([row]))
    const { container } = await mount(<ArcadeScreen playerId="player-a" />)
    expect(container.querySelectorAll('.arcade-disc')).toHaveLength(42)
    await click(button(container, 'Quitter'))
    expect(document.body.textContent).toContain('Cette partie ne donnera ni score ni XP.')
    await click(button(document.body.querySelector('[role="dialog"]')!, 'Annuler'))
    expect(api.actArcade).not.toHaveBeenCalled()
    await click(button(container, 'Quitter'))
    api.actArcade.mockRejectedValueOnce(new ApiError('NETWORK_ERROR', 'Réseau interrompu', null))
    await click(button(document.body.querySelector('[role="dialog"]')!, 'Confirmer'))
    const sent = api.actArcade.mock.calls[0]!
    expect(sent).toEqual([row.id, { kind: 'QUIT', expectedVersion: 0, idempotencyKey: expect.any(String) }])
    api.actArcade.mockResolvedValue(mutation({ ...row, version: 1, status: 'ABANDONED' }))
    await click(button(container, 'Réessayer la même action'))
    expect(api.actArcade.mock.calls[1]).toEqual(sent)
    for (const label of ['Memory', 'Puissance 4', 'Morpion']) expect(button(container, label).disabled).toBe(false)
    expect(container.querySelector('.arcade-connect')).toBeNull()
    api.startArcade.mockResolvedValue(mutation({ ...row, id: 'next' }))
    await click(button(container, 'Rejouer'))
    expect(api.startArcade).toHaveBeenCalledWith(expect.objectContaining({ previousSessionId: row.id }))
  })
  it('keeps a Quitter confirmation bound to the original session after a server refresh', async () => {
    const original = session('MEMORY'); api.getArcade.mockResolvedValue(overview([original]))
    const { container } = await mount(<ArcadeScreen playerId="player-a" />)
    await click(button(container, 'Quitter'))
    api.getArcade.mockResolvedValue(overview([session('CONNECT_FOUR')]))
    await act(async () => { window.dispatchEvent(new Event('focus')); await Promise.resolve() })
    api.actArcade.mockRejectedValueOnce(new ApiError('ARCADE_STALE_VERSION', 'Partie modifiée', 409))
    await click(button(document.body.querySelector('[role="dialog"]')!, 'Confirmer'))
    expect(api.actArcade).toHaveBeenCalledWith(original.id, expect.objectContaining({ kind: 'QUIT', expectedVersion: 0 }))
  })
  it.each(['MEMORY', 'CONNECT_FOUR'] as const)('automatically resumes %s across turns, Records, visibility, feedback and navigation', async game => {
    vi.useFakeTimers()
    let row = session(game); row.board.turn = 'AI'
    api.getArcade.mockImplementation(async () => overview([row]))
    let resolve!: (value: ArcadeMutation) => void
    api.actArcade.mockImplementation(() => new Promise(done => { resolve = done }))
    const { container, root } = await mount(<ArcadeScreen playerId="player-a" />)
    const locked = () => { for (const label of ['Memory', 'Puissance 4', 'Morpion']) expect(button(container, label).disabled).toBe(true) }
    for (let i = 0; i < 3; i++) {
      locked(); await act(async () => { await vi.advanceTimersByTimeAsync(800) }); locked()
      row = { ...row, version: row.version + 1 }
      await act(async () => resolve(mutation(row))); locked()
    }
    expect(api.actArcade).toHaveBeenCalledTimes(3)
    await click(button(container, 'Records →'))
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) }); expect(api.actArcade).toHaveBeenCalledTimes(3)
    act(() => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    await act(async () => { await vi.advanceTimersByTimeAsync(800) }); expect(api.actArcade).toHaveBeenCalledTimes(4)
    await act(async () => resolve(mutation({ ...row, version: 4 })))
    await act(async () => root.render(<ArcadeScreen playerId="player-a" feedbackPending />))
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) }); expect(api.actArcade).toHaveBeenCalledTimes(4)
    await act(async () => root.render(<ArcadeScreen playerId="player-a" />))
    await act(async () => { await vi.advanceTimersByTimeAsync(800) }); expect(api.actArcade).toHaveBeenCalledTimes(5)
    row = { ...row, version: 5 }; await act(async () => resolve(mutation(row)))
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) }); expect(api.actArcade).toHaveBeenCalledTimes(5)
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); await Promise.resolve() })
    await act(async () => { await vi.advanceTimersByTimeAsync(800) }); expect(api.actArcade).toHaveBeenCalledTimes(6)
    row = { ...row, version: 6 }; await act(async () => resolve(mutation(row)))
    await act(async () => root.render(<div>Autre écran</div>))
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) }); expect(api.actArcade).toHaveBeenCalledTimes(6)
    await act(async () => { root.render(<ArcadeScreen playerId="player-a" />); await Promise.resolve() })
    await act(async () => { await vi.advanceTimersByTimeAsync(800) }); expect(api.actArcade).toHaveBeenCalledTimes(7)
    expect(api.actArcade.mock.calls.at(-1)![0]).toBe(row.id); expect(api.startArcade).not.toHaveBeenCalled()
    await act(async () => resolve(mutation({ ...row, status: 'FINISHED', version: 7 })))
    for (const label of ['Memory', 'Puissance 4', 'Morpion']) expect(button(container, label).disabled).toBe(false)
  })
  it('blocks double clicks, retries the exact ambiguous move, and publishes confirmed snapshots once per response', async () => {
    const row = session('MEMORY'); api.getArcade.mockResolvedValue(overview([row]))
    let reject!: (reason: unknown) => void
    api.actArcade.mockImplementationOnce(() => new Promise((_resolve, rejectPromise) => { reject = rejectPromise }))
    const publish = vi.fn(), { container } = await mount(<ArcadeScreen playerId="player-a" onMutation={publish} />)
    const card = container.querySelector<HTMLButtonElement>('.arcade-memory-card')!
    act(() => { card.click(); card.click() })
    expect(api.actArcade).toHaveBeenCalledTimes(1); expect(card.disabled).toBe(true)
    await act(async () => reject(new ApiError('NETWORK_ERROR', 'Réseau interrompu', null)))
    const sent = api.actArcade.mock.calls[0]!
    api.actArcade.mockResolvedValue({ ...mutation({ ...row, version: 1 }), alreadyProcessed: true })
    await click(button(container, 'Réessayer la même action'))
    expect(api.actArcade.mock.calls[1]).toEqual(sent); expect(publish).toHaveBeenCalledTimes(1)
  })
  it('publishes a pending result after navigation and ignores an obsolete overview response', async () => {
    api.getArcade.mockResolvedValueOnce(overview([session('MEMORY')]))
    const publish = vi.fn(), { root, container } = await mount(<ArcadeScreen playerId="player-a" onMutation={publish} />)
    api.getArcade.mockResolvedValue(overview([session('MEMORY')]))
    let resolve!: (value: ArcadeMutation) => void
    api.actArcade.mockImplementationOnce(() => new Promise(resolvePromise => { resolve = resolvePromise }))
    await click(container.querySelector<HTMLButtonElement>('.arcade-memory-card')!)
    await act(async () => root.render(<div>Autre écran</div>))
    await act(async () => resolve(mutation({ ...session('MEMORY'), version: 1 })))
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({ session: expect.objectContaining({ version: 1 }) }), 'player-a')
    const newer = { ...session('MEMORY'), version: 4 }
    expect(mergeArcadeSession([newer], session('MEMORY'))).toEqual([newer])
    expect(mergeArcadeSession([{ ...newer, id: 'new', createdAt: '2026-10-02T00:00:00Z' }], session('MEMORY'))[0]!.id).toBe('new')
  })
  it('shows score-only replay status and does not publish a result merely read on arrival', async () => {
    const row = session('MEMORY', 'FINISHED'); row.result = { outcome: 'WIN', performancePoints: 10, scoreAwarded: 10, xpAwarded: 0, operationId: 'finished', businessDate: '2026-10-01', finishedAt: '2026-10-01T11:00:00Z' }
    const state = overview([row]); state.daily[0]!.used = true; state.daily[0]!.xpAwarded = 3; state.scores.MEMORY = '9007199254740993'; state.totalScore = state.scores.MEMORY
    api.getArcade.mockResolvedValue(state)
    const publish = vi.fn(), { container } = await mount(<ArcadeScreen playerId="player-a" onMutation={publish} />)
    expect(container.textContent).toContain('+10 score · +0 XP'); expect(container.textContent).toContain('Résultat enregistré')
    expect(container.textContent).toContain(BigInt(state.totalScore).toLocaleString('fr-FR')); expect(publish).not.toHaveBeenCalled()
    expect(button(container, 'Rejouer')).toBeTruthy()
  })
})

describe('Arcade Records', () => {
  it('shows historical denominators in personal and global records', async () => {
    const { container } = await mount(<ArcadeRecords records={[{ game: 'MEMORY', difficulty: 'MEDIUM', score: '1', played: '1', wins: '0', draws: '0', losses: '1', best: { points: 1, pairs: 2, totalPairs: 18, outcome: 'LOSS' } }]} initialGame="MEMORY" onClose={() => {}} />)
    expect(container.textContent).toBe('')
    const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]')!
    expect(dialog.textContent).toContain('2 / 18 paires')
    api.getArcadeRecords.mockResolvedValue({ ...ranking(), entries: [{ ...ranking().entries[0]!, pairs: 8, totalPairs: 12 }] })
    await click(button(dialog, 'Global'))
    expect(dialog.textContent).toContain('8 / 12 paires')
    expect(dialog.textContent).not.toContain('Une meilleure partie par joueur')
  })
  const ranking = (page = 2): ArcadeRanking => ({ kind: 'SCORE', game: 'MEMORY', difficulty: 'MEDIUM', page, pageSize: 10, total: 13, totalPages: 2, selfPage: 2, selfStatus: 'RANKED',
    entries: [{ playerId: 'player-a', displayName: 'Joueur', elementKey: 'hydro', avatarAssetPath: null, value: '50', rank: 1, position: 13, pairs: null, totalPairs: null, isSelf: true }] })
  it('opens the personal page, preserves manual pagination on refresh and resets it on category change', async () => {
    api.getArcadeRecords.mockImplementation(async (query: { page?: number }) => ranking(query.page ?? 2))
    const { container } = await mount(<ArcadeRecords records={[]} initialGame="MEMORY" onClose={vi.fn()} />)
    expect(container.textContent).toBe('')
    const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]')!
    expect(dialog.textContent).toContain('Aucun record')
    await click(button(dialog, 'Score'))
    expect(api.getArcadeRecords).toHaveBeenLastCalledWith({ kind: 'SCORE', game: 'MEMORY', difficulty: 'MEDIUM', page: undefined })
    expect(dialog.textContent).toContain('Votre page : 2'); expect(dialog.querySelector('.self')?.textContent).toContain('Vous')
    await click(button(dialog, 'Score')); await click(button(dialog, 'Memory'))
    expect(dialog.querySelector('.self')?.textContent).toContain('Vous')
    await click(button(dialog, 'Précédent')); expect(api.getArcadeRecords.mock.calls.at(-1)![0].page).toBe(1)
    await click(button(dialog, 'Actualiser')); expect(api.getArcadeRecords.mock.calls.at(-1)![0].page).toBe(1)
    await click(button(dialog, 'Total')); expect(api.getArcadeRecords.mock.calls.at(-1)![0]).toMatchObject({ game: 'TOTAL', page: undefined })
    await click(button(dialog, 'Global')); expect(api.getArcadeRecords.mock.calls.at(-1)![0]).toMatchObject({ kind: 'GLOBAL', game: 'MEMORY' })
    expect(dialog.querySelectorAll('tbody tr')).toHaveLength(10)
  })
  it('traps focus and restores it after Escape/backdrop; a level-up takes priority', async () => {
    api.getArcade.mockResolvedValue(overview())
    const { container, root } = await mount(<ArcadeScreen playerId="player-a" />)
    const trigger = button(container, 'Records →'); trigger.focus(); await click(trigger)
    const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]')!
    const first = dialog.querySelector<HTMLButtonElement>('button')!, select = dialog.querySelectorAll<HTMLSelectElement>('select')[1]!
    first.focus(); act(() => first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true })))
    expect(document.activeElement).toBe(select)
    act(() => select.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(document.body.querySelector('[role="dialog"]')).toBeNull(); expect(document.activeElement).toBe(trigger)
    await click(trigger)
    act(() => document.body.querySelector('.arcade-records-overlay')!.dispatchEvent(new Event('pointerdown', { bubbles: true })))
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    await click(trigger); await act(async () => root.render(<ArcadeScreen playerId="player-a" feedbackPending />))
    expect(document.body.querySelector('[aria-label="Records Arcade"]')).toBeNull()
  })
})

describe('Arcade rules and board presentation', () => {
  it('opens rules in a portal, traps/restores focus and closes through Escape or backdrop', async () => {
    api.getArcade.mockResolvedValue(overview([session('MEMORY')]))
    const { container } = await mount(<ArcadeScreen playerId="player-a" />)
    const board = container.querySelector('.arcade-memory'), trigger = button(container, 'Règles & gains')
    trigger.focus(); await click(trigger)
    const dialog = document.body.querySelector<HTMLElement>('[aria-label="Règles & gains"]')!
    expect(container.contains(dialog)).toBe(false); expect(container.querySelector('.arcade-memory')).toBe(board)
    expect(dialog.textContent).toContain('30 XP par jour')
    const first = dialog.querySelector<HTMLButtonElement>('button')!, last = button(dialog, 'Morpion')
    first.focus(); act(() => first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true })))
    expect(document.activeElement).toBe(last)
    await click(button(dialog, 'Memory')); expect(dialog.textContent).toContain('12 paires, centre décoratif')
    act(() => first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(document.body.querySelector('[role="dialog"]')).toBeNull(); expect(document.activeElement).toBe(trigger)
    await click(trigger); act(() => document.querySelector('.arcade-records-overlay')!.dispatchEvent(new Event('pointerdown', { bubbles: true })))
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
  })
  it.each([[4, 8], [5, 12], [6, 18]])('renders Memory %i with %i pairs and an inaccessible decorative center', async (columns, totalPairs) => {
    const base = session('MEMORY').board; if (base.kind !== 'MEMORY') throw Error('Memory')
    const onMove = vi.fn()
    const { container } = await mount(<ArcadeBoards disabled={false} onMove={onMove} board={{ ...base, columns, totalPairs, cards: Array.from({ length: columns ** 2 }, (_, position) => ({ position, status: columns === 5 && position === 12 ? 'BLOCKED' : 'HIDDEN' })) }} />)
    expect(container.querySelectorAll('button')).toHaveLength(totalPairs * 2)
    if (columns === 5) {
      const center = container.querySelector<HTMLElement>('[aria-label="Case centrale décorative"]')!
      expect(center.tagName).toBe('SPAN'); await click(center); expect(onMove).not.toHaveBeenCalled()
      const cards = container.querySelectorAll<HTMLButtonElement>('button')
      cards[7]!.focus(); act(() => cards[7]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })))
      expect(document.activeElement?.getAttribute('aria-label')).toBe('Carte cachée 18')
    }
  })
})

describe('shared Level-up overflow', () => {
  it('publishes level 100 overflow using actual server rewards without a second feedback system', async () => {
    const previous: PlayerProgressionDto = { totalXp: '3029', level: 100, xpIntoCurrentStep: '29', xpPerStep: '30', isMaxLevel: true, level100OverflowRewardsClaimed: 0, totalMessages: '0', countedMessages: '0' }
    const next = { ...previous, totalXp: '3039', xpIntoCurrentStep: '9', level100OverflowRewardsClaimed: 1 }
    const result = publishProgressionUpdate(previous, next, { id: 'arcade:finish', rewards: [{ resourceKey: 'primogems', amount: '800' }] })
    expect(result.feedback).toMatchObject({ levelsGained: 0, overflowRewardsGranted: 1, rewards: [{ resourceKey: 'primogems', amount: '800' }] })
    const { container } = await mount(<LevelUpFeedback event={result.feedback!} onFinished={vi.fn()} />)
    expect(container.textContent).toContain('1 palier au niveau 100'); expect(container.textContent).toContain('800')
    expect(publishProgressionUpdate(next, next, { id: 'arcade:finish' }).feedback).toBeNull()
  })
})
