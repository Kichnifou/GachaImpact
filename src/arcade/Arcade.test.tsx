import { useArcade } from './use-arcade'
import { TutorialPresentationContext } from '../tutorial/tutorial-presentation'
import { getTutorialStep } from '../tutorial/tutorial-catalog'
// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ArcadeOverview, ArcadeSession, ArcadeMutation, ArcadeRanking, ArcadeInvitation } from '../api/arcade-types'
import { activityTabs, parseNavigationHash, hashForScreen } from '../navigation/navigation'
import { publishProgressionUpdate } from '../progression/publish-progression-update'
import type { PlayerProgressionDto } from '../api/types'
const api = vi.hoisted(() => ({ getArcade: vi.fn(), getArcadeOpponents: vi.fn().mockResolvedValue({ opponents: [] }), inviteArcade: vi.fn(), actArcadeInvitation: vi.fn(), startArcade: vi.fn(), actArcade: vi.fn(), getArcadeRecords: vi.fn() }))
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
  return { mode: 'SOLO', viewerSide: 'PLAYER', participants: null, opponent: null, id: game + '-session', game, difficulty: 'MEDIUM', status, version: 0, rulesVersion: 1, scoringVersion: 1, firstSide: 'PLAYER', createdAt: '2026-10-01T10:00:00Z', nextActionAt: '2026-10-01T10:00:00Z', banter: { id: 'START:0', text: 'Prêt.' }, result: null,
    board: game === 'MEMORY' ? { kind: 'MEMORY', turn: 'PLAYER', phase: 'PICK', playerPairs: 0, aiPairs: 0, remainingPairs: 18, columns: 6, totalPairs: 18, outcome: null, cards: Array.from({ length: 36 }, (_, position) => ({ position, status: 'HIDDEN' })) }
      : { kind: game, turn: 'PLAYER', cells: Array(game === 'TIC_TAC_TOE' ? 9 : 42).fill(null), winningCells: [], lastMove: null, outcome: null } }
}
function overview(sessions: ArcadeSession[] = []): ArcadeOverview {
  return { sessions, invitation: null, serverNow: '2026-10-01T10:00:00Z', businessDate: '2026-10-01', records: [], scores: { MEMORY: '0', CONNECT_FOUR: '0', TIC_TAC_TOE: '0' }, totalScore: '0',
    daily: (['MEMORY', 'CONNECT_FOUR', 'TIC_TAC_TOE'] as const).map(game => ({ game, used: false, xpAwarded: 0 })) }
}
function mutation(row: ArcadeSession): ArcadeMutation { return { ...overview(), session: row, operationId: 'operation', alreadyProcessed: false, award: null } }
beforeEach(() => { vi.resetAllMocks(); api.getArcade.mockResolvedValue(overview()); api.getArcadeOpponents.mockResolvedValue({ opponents: [] }) })
afterEach(async () => { for (const { root, container } of roots.splice(0)) { await act(async () => root.unmount()); container.remove() } vi.useRealTimers(); vi.restoreAllMocks() })

describe('Arcade interface and session lifecycle', () => {
  it.each(['ACTIVE', 'FINISHED'] as const)('queues Quitter behind an ADVANCE and respects its %s outcome', async status => {
    vi.useFakeTimers()
    let row = session('CONNECT_FOUR'); row.board.turn = 'AI'
    api.getArcade.mockImplementation(async () => overview([row]))
    let resolve!: (value: ArcadeMutation) => void
    api.actArcade.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const { container } = await mount(<ArcadeScreen playerId="player-a" />)
    await act(async () => { await vi.advanceTimersByTimeAsync(800) })
    const quit = button(container, 'Quitter')
    expect(quit.closest('.arcade-top-actions')).not.toBeNull()
    expect(quit.disabled).toBe(false)
    await click(quit)
    await click(button(document.body.querySelector('[role="dialog"]')!, 'Confirmer'))
    expect(api.actArcade).toHaveBeenCalledTimes(1)
    row = { ...row, status, version: 1 }
    if (status === 'FINISHED') row.result = { outcome: 'LOSS', performancePoints: 3, scoreAwarded: 3, xpAwarded: 0, operationId: 'finish', businessDate: '2026-10-01', finishedAt: '2026-10-01T11:00:00Z' }
    api.actArcade.mockResolvedValue(mutation({ ...row, version: 2, status: 'ABANDONED' }))
    await act(async () => { resolve(mutation(row)); await Promise.resolve(); await Promise.resolve() })
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    expect(api.actArcade).toHaveBeenCalledTimes(status === 'ACTIVE' ? 2 : 1)
    if (status === 'ACTIVE') expect(api.actArcade.mock.calls[1]).toEqual([row.id, expect.objectContaining({ kind: 'QUIT', expectedVersion: 1 })])
    else expect(container.textContent).toContain('+3 score · +0 XP')
    expect(container.textContent).not.toContain('Réessayer la même action')
  })
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
    expect(container.querySelector('.arcade-header')).toBeNull()
    expect(container.querySelector('h1')?.className).toBe('sr-only')
    expect(button(container, 'Règles & gains').closest('.arcade-arena')).not.toBeNull()
    expect(button(container, 'Records →').closest('.arcade-arena')).not.toBeNull()
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
      .mockResolvedValueOnce(mutation({ ...row, version: 1, status: 'ABANDONED' }))
    await click(button(document.body.querySelector('[role="dialog"]')!, 'Confirmer'))
    const sent = api.actArcade.mock.calls[0]!
    expect(sent).toEqual([row.id, { kind: 'QUIT', expectedVersion: 0, idempotencyKey: expect.any(String) }])
    expect(api.actArcade.mock.calls[1]).toEqual(sent)
    expect(container.textContent).not.toContain('Réessayer la même action')
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
    await click(button(document.body.querySelector('[role="dialog"]')!, 'Confirmer'))
    expect(api.actArcade).not.toHaveBeenCalled()
    expect(container.querySelector('.arcade-connect')).not.toBeNull()
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
    api.actArcade.mockResolvedValue({ ...mutation({ ...row, version: 1 }), alreadyProcessed: true })
    await act(async () => reject(new ApiError('NETWORK_ERROR', 'Réseau interrompu', null)))
    const sent = api.actArcade.mock.calls[0]!
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
  it.each([true, false])('reconciles after two ambiguous attempts, advanced=%s, without inventing rewards', async advanced => {
    vi.useFakeTimers()
    const row = session('MEMORY')
    api.getArcade.mockResolvedValueOnce(overview([row])).mockResolvedValue(overview([{ ...row, version: advanced ? 1 : 0 }]))
    api.actArcade.mockRejectedValue(new ApiError('NETWORK_ERROR', 'Réseau interrompu', null))
    const publish = vi.fn(), { container } = await mount(<ArcadeScreen playerId="player-a" onMutation={publish} />)
    await click(container.querySelector<HTMLButtonElement>('.arcade-memory-card')!)
    expect(api.actArcade).toHaveBeenCalledTimes(2)
    expect(api.actArcade.mock.calls[1]).toEqual(api.actArcade.mock.calls[0])
    expect(api.actArcade.mock.calls[0]).toEqual([row.id, { kind: 'MOVE', position: 0, expectedVersion: 0, idempotencyKey: expect.any(String) }])
    expect(api.getArcade).toHaveBeenCalledTimes(2); expect(publish).not.toHaveBeenCalled()
    expect(container.querySelector('[role="alert"]') !== null).toBe(!advanced)
    expect(button(container, 'Quitter').disabled).toBe(false)
    expect(container.textContent).not.toContain('Réessayer la même action')
    await act(async () => { await vi.advanceTimersByTimeAsync(10000) })
    expect(api.actArcade).toHaveBeenCalledTimes(2)
  })
  it('suspends ADVANCE while Quitter is open and resumes when cancelled', async () => {
    vi.useFakeTimers()
    const row = session('MEMORY'); row.board.turn = 'AI'
    api.getArcade.mockResolvedValue(overview([row]))
    api.actArcade.mockResolvedValue(mutation({ ...row, version: 1, board: { ...row.board, turn: 'PLAYER' } }))
    const { container } = await mount(<ArcadeScreen playerId="player-a" />)
    await click(button(container, 'Quitter'))
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(api.actArcade).not.toHaveBeenCalled()
    await click(button(document.body.querySelector('[role="dialog"]')!, 'Annuler'))
    await act(async () => { await vi.advanceTimersByTimeAsync(800) })
    expect(api.actArcade).toHaveBeenCalledTimes(1)
  })
  it('shows score-only replay status and does not publish a result merely read on arrival', async () => {
    const row = session('MEMORY', 'FINISHED'); row.result = { outcome: 'WIN', performancePoints: 10, scoreAwarded: 10, xpAwarded: 0, operationId: 'finished', businessDate: '2026-10-01', finishedAt: '2026-10-01T11:00:00Z' }
    const state = overview([row]); state.daily[0]!.used = true; state.daily[0]!.xpAwarded = 3; state.scores.MEMORY = '9007199254740993'; state.totalScore = state.scores.MEMORY
    api.getArcade.mockResolvedValue(state)
    const publish = vi.fn(), { container } = await mount(<ArcadeScreen playerId="player-a" onMutation={publish} />)
    expect(container.textContent).toContain('+10 score · +0 XP'); expect(container.textContent).toContain('Résultat enregistré')
    expect(container.textContent).toContain(BigInt(state.totalScore).toLocaleString('fr-FR')); expect(publish).not.toHaveBeenCalled()
    expect(button(container, 'Rejouer')).toBeTruthy()
    expect(button(container, 'Rejouer').closest('.arcade-actions')).not.toBeNull()
    expect(container.textContent).toContain('XP du jour : obtenue')
    expect(container.textContent).not.toMatch(/Partie libre|\/ 10|Cercle cyan|Symbole violet/)
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
  it.each(['PLAYER', 'AI'] as const)('labels matched Memory pairs relative to %s while keeping canonical colors', async viewerSide => {
    const board = session('MEMORY').board
    if (board.kind !== 'MEMORY') throw Error('Memory')
    const face = { id: 'face', name: 'Furina', elementKey: 'hydro', assetPaths: [] }
    const { container } = await mount(<ArcadeBoards viewerSide={viewerSide} disabled={false} onMove={vi.fn()} board={{ ...board, cards: [
      { position: 0, status: 'MATCHED', owner: 'PLAYER', face },
      { position: 1, status: 'MATCHED', owner: 'AI', face },
    ] }} />)
    const cards = container.querySelectorAll('button')
    expect(cards[0]!.getAttribute('aria-label')).toBe(`Furina, paire ${viewerSide === 'PLAYER' ? 'à vous' : 'adverse'}`)
    expect(cards[1]!.getAttribute('aria-label')).toBe(`Furina, paire ${viewerSide === 'AI' ? 'à vous' : 'adverse'}`)
    expect(cards[0]!.classList.contains('player')).toBe(true)
    expect(cards[1]!.classList.contains('ai')).toBe(true)
  })
  it('keeps only arrows in column buttons and numbers in accessible labels', async () => {
    const { container } = await mount(<ArcadeBoards board={session('CONNECT_FOUR').board} disabled={false} onMove={vi.fn()} />)
    const columns = container.querySelectorAll<HTMLButtonElement>('.arcade-columns button')
    expect(columns).toHaveLength(7)
    columns.forEach((column, index) => { expect(column.textContent).toBe('↓'); expect(column.getAttribute('aria-label')).toBe(`Jouer colonne ${index + 1}`) })
  })
  it('opens rules in a portal, traps/restores focus and closes through Escape or backdrop', async () => {
    api.getArcade.mockResolvedValue(overview([session('MEMORY')]))
    const { container } = await mount(<ArcadeScreen playerId="player-a" />)
    const board = container.querySelector('.arcade-memory'), trigger = button(container, 'Règles & gains')
    trigger.focus(); await click(trigger)
    const dialog = document.body.querySelector<HTMLElement>('[aria-label="Règles & gains"]')!
    expect(container.contains(dialog)).toBe(false); expect(container.querySelector('.arcade-memory')).toBe(board)
    for (const text of ['XP par jour', 'Jusqu’à 10 XP par jeu', '30 XP maximum', 'Score uniquement. Obtenable à l’infini.', 'Deviens le plus fort de tes amis !', 'La partie se conserve tant qu’elle n’est pas terminée.', 'Impossible de jouer à un autre jeu tant qu’une partie n’est pas finie.']) expect(dialog.textContent).toContain(text)
    expect(dialog.textContent).not.toMatch(/Première fin du jour|XP \+ score pour chaque jeu|Jouez à la souris|Une seule partie active à la fois/)
    const first = dialog.querySelector<HTMLButtonElement>('button')!, last = button(dialog, 'Morpion')
    first.focus(); act(() => first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true })))
    expect(document.activeElement).toBe(last)
    await click(button(dialog, 'Memory')); expect(dialog.textContent).toContain('12 paires, centre décoratif')
    expect(dialog.querySelector('caption')?.textContent).toBe('Plateau et mémoire de l’IA en solo')
    expect(dialog.querySelector('thead')?.textContent).toContain('Mémoire de l’IA (solo)')
    expect(dialog.textContent).toContain('4 cartes')
    expect(dialog.textContent).toContain('12 cartes')
    expect(dialog.textContent).not.toMatch(/50 %|85 %|100 %/)
    expect(dialog.textContent).toContain('Toutes les cartes révélées')
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

it.each(['AI', 'REVEAL'] as const)('suspends %s advancement in the tour and resumes the actual session afterwards', async mode => {
  vi.useFakeTimers()
  const row = session(mode === 'AI' ? 'CONNECT_FOUR' : 'MEMORY')
  row.board.turn = mode === 'AI' ? 'AI' : 'PLAYER'
  if (row.board.kind === 'MEMORY') row.board.phase = 'REVEAL'
  api.getArcade.mockResolvedValue(overview([row])); api.actArcade.mockResolvedValue(mutation(row))
  const render = (active: boolean) => <TutorialPresentationContext.Provider value={{ active, step: getTutorialStep('arcade-tic-tac-toe') }}><ArcadeScreen playerId="player-a" /></TutorialPresentationContext.Provider>
  const { root, container } = await mount(render(true))
  await act(async () => { await vi.advanceTimersByTimeAsync(6_000) })
  expect(api.actArcade).not.toHaveBeenCalled(); expect(api.startArcade).not.toHaveBeenCalled()
  expect(container.querySelector('[aria-pressed="true"]')?.textContent).toBe(mode === 'AI' ? 'Puissance 4' : 'Memory')
  await act(async () => root.render(render(false)))
  await act(async () => { await vi.advanceTimersByTimeAsync(900) })
  expect(api.actArcade).toHaveBeenCalledOnce()
})

const participantA = { id: 'player-a', displayName: 'Axel' }, participantB = { id: 'player-b', displayName: 'Élio' }
const challenge: ArcadeInvitation = { id: 'invite', direction: 'INCOMING', host: participantB, guest: participantA, game: 'CONNECT_FOUR', difficulty: 'HARD', status: 'PENDING', hostReady: true, guestReady: false, expiresAt: '2026-10-01T12:02:00Z', sessionId: null }
const multiplayer = (game: ArcadeSession['game'] = 'TIC_TAC_TOE', viewerSide: ArcadeSession['viewerSide'] = 'PLAYER'): ArcadeSession => ({ ...session(game), mode: 'MULTIPLAYER', viewerSide, participants: { PLAYER: participantA, AI: participantB }, opponent: viewerSide === 'PLAYER' ? participantB : participantA, banter: { id:'START:0',text:'' } })
describe('Multiplayer Arcade interface and polling', () => {
  it('keeps solo available when opponent discovery fails, and filters friends without a mutation', async () => {
    api.getArcadeOpponents.mockRejectedValueOnce(new Error('Discovery unavailable'))
    const { container } = await mount(<ArcadeScreen playerId="player-a" />)
    expect(button(container, 'Commencer').disabled).toBe(false)
    api.getArcadeOpponents.mockResolvedValue({ opponents: [participantB] })
    await click(container.querySelector<HTMLInputElement>('.arcade-friends-only input')!)
    expect(api.getArcadeOpponents).toHaveBeenLastCalledWith(true)
    expect(container.querySelector<HTMLSelectElement>('[aria-label="Jouer contre"]')!.options[1]!.textContent).toBe('Élio')
    expect(api.inviteArcade).not.toHaveBeenCalled()
    expect(api.startArcade).not.toHaveBeenCalled()
  })
  it('selection is local; Ready sends the chosen context and friends filter once, with pseudo-only choices', async () => {
    api.getArcadeOpponents.mockResolvedValue({opponents:[participantB]})
    const {container}=await mount(<ArcadeScreen playerId="player-a" />)
    const select=container.querySelector<HTMLSelectElement>('[aria-label="Jouer contre"]')!
    expect([...select.options].map(option=>option.textContent)).toEqual(['Choisir un joueur','Élio'])
    expect(button(container,'Prêt').disabled).toBe(true);expect(button(container,'Refuser').disabled).toBe(true)
    await act(async()=>{select.value=participantB.id;select.dispatchEvent(new Event('change',{bubbles:true}))})
    expect(api.inviteArcade).not.toHaveBeenCalled();expect(button(container,'Prêt').disabled).toBe(false)
    api.inviteArcade.mockResolvedValue({invitation:{...challenge,direction:'OUTGOING'},operationId:'op',alreadyProcessed:false})
    api.getArcade.mockResolvedValue({...overview(),invitation:{...challenge,direction:'OUTGOING'}})
    await click(button(container,'Prêt'))
    expect(api.inviteArcade).toHaveBeenCalledTimes(1)
    expect(api.inviteArcade.mock.calls[0]![0]).toMatchObject({opponentPlayerId:participantB.id,game:'MEMORY',difficulty:'MEDIUM',friendsOnly:false})
    expect(button(container,'Annuler').disabled).toBe(false);expect(button(container,'Refuser').disabled).toBe(true)
    expect(select.disabled).toBe(true)
    expect(button(container,'Commencer').disabled).toBe(true)
    expect(button(container,'Règles & gains').disabled).toBe(false)
  })
  it('manual entry discovers incoming without a notification and forces game/difficulty; Ready starts shared session', async()=>{
    api.getArcade.mockResolvedValue({...overview(),invitation:challenge})
    const {container}=await mount(<ArcadeScreen playerId="player-a" />)
    expect(container.querySelector('.arcade-controls [aria-pressed=true]')?.textContent).toBe('Puissance 4')
    expect(container.querySelector<HTMLSelectElement>('.arcade-controls select')?.value).toBe('HARD')
    expect(button(container,'Prêt').disabled).toBe(false);expect(button(container,'Refuser').disabled).toBe(false)
    expect(button(container,'Commencer').disabled).toBe(true)
    const active=multiplayer('CONNECT_FOUR','AI')
    api.actArcadeInvitation.mockResolvedValue({invitation:{...challenge,status:'STARTED',guestReady:true,sessionId:active.id},operationId:'op',alreadyProcessed:false})
    api.getArcade.mockResolvedValue(overview([active]))
    await click(button(container,'Prêt'))
    expect(api.actArcadeInvitation).toHaveBeenCalledWith('invite',expect.objectContaining({kind:'READY'}))
    expect([...container.querySelectorAll('.arcade-versus strong')].map(node => node.textContent)).toEqual(['Axel','Élio'])
    expect(container.querySelector('.arcade-banter')?.textContent).toBe('')
  })
  it('guest side receives its human controls and relative accessible names, without AI timers', async()=>{
    vi.useFakeTimers()
    const active=multiplayer('TIC_TAC_TOE','AI');active.board.turn='AI'
    api.getArcade.mockResolvedValue(overview([active]))
    const {container}=await mount(<ArcadeScreen playerId="player-a" />)
    expect(container.querySelector<HTMLButtonElement>('.arcade-cell')?.disabled).toBe(false)
    await act(async()=>{await vi.advanceTimersByTimeAsync(1900)})
    expect(api.actArcade).not.toHaveBeenCalled()
    expect(container.querySelector('.arcade-banter')?.textContent).toBe('')
    expect(container.querySelector('.arcade-versus [aria-label="Élio, vous"]')).toBeTruthy()
    api.actArcade.mockResolvedValue(mutation({...active,version:1}))
    await click(container.querySelector<HTMLButtonElement>('.arcade-cell')!)
    expect(api.actArcade.mock.calls[0]![1]).toMatchObject({kind:'MOVE',position:0,expectedVersion:0})
    expect(api.actArcade.mock.calls[0]![1]).not.toHaveProperty('side')
  })
  it('coalesces polling/focus/visibility, stops hidden and unmounted reads, and resumes authoritative state', async()=>{
    vi.useFakeTimers()
    let visibility='visible'
    vi.spyOn(document,'visibilityState','get').mockImplementation(()=>visibility as DocumentVisibilityState)
    const active=multiplayer();api.getArcade.mockResolvedValue(overview([active]))
    const {root}=await mount(<ArcadeScreen playerId="player-a" />)
    let resolve!:(value:ArcadeOverview)=>void
    api.getArcade.mockImplementation(()=>new Promise<ArcadeOverview>(r=>{resolve=r}))
    await act(async()=>{await vi.advanceTimersByTimeAsync(2000);window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'))})
    expect(api.getArcade).toHaveBeenCalledTimes(2)
    await act(async()=>{resolve(overview([active]));await Promise.resolve()})
    visibility='hidden';document.dispatchEvent(new Event('visibilitychange'))
    await act(async()=>{await vi.advanceTimersByTimeAsync(6000)})
    expect(api.getArcade).toHaveBeenCalledTimes(2)
    visibility='visible';api.getArcade.mockResolvedValue(overview([{...active,status:'ABANDONED'}]))
    await act(async()=>{document.dispatchEvent(new Event('visibilitychange'));await Promise.resolve()})
    expect(api.getArcade).toHaveBeenCalledTimes(3)
    await act(async()=>root.unmount());const calls=api.getArcade.mock.calls.length
    await act(async()=>{await vi.advanceTimersByTimeAsync(5000);window.dispatchEvent(new Event('focus'))})
    expect(api.getArcade).toHaveBeenCalledTimes(calls)
  })
  it.each((['MEMORY','CONNECT_FOUR','TIC_TAC_TOE'] as const).flatMap(game => (['PLAYER','AI'] as const).map(side => ({game,side}))))('replays finished $game for $side as solo with the same difficulty, independently of the old opponent', async ({game,side}) => {
    vi.useFakeTimers()
    const finished={...multiplayer(game,side),difficulty:'HARD' as const,status:'FINISHED' as const,result:{outcome:'WIN' as const,performancePoints:8,scoreAwarded:8,xpAwarded:0,businessDate:'2026-10-01',finishedAt:'2026-10-01T11:00:00Z',operationId:'op'}}
    const solo={...session(game),id:'new-solo',difficulty:finished.difficulty}; solo.board.turn='AI'
    api.getArcade.mockResolvedValue(overview([finished])); api.getArcadeOpponents.mockResolvedValue({opponents:[]})
    api.startArcade.mockResolvedValue(mutation(solo)); api.actArcade.mockImplementation(() => new Promise(() => undefined))
    const {container}=await mount(<ArcadeScreen playerId="player-a" />)
    await click(button(container,game==='MEMORY'?'Memory':game==='CONNECT_FOUR'?'Puissance 4':'Morpion'))
    await click(button(container,'Rejouer'))
    expect(api.startArcade).toHaveBeenCalledOnce(); expect(api.inviteArcade).not.toHaveBeenCalled()
    expect(api.startArcade.mock.calls[0]![0]).toMatchObject({game,difficulty:'HARD',previousSessionId:finished.id,expectedVersion:0,idempotencyKey:expect.any(String)})
    expect(api.startArcade.mock.calls[0]![0]).not.toHaveProperty('opponentPlayerId')
    expect(container.querySelector('.arcade-versus')?.textContent).toContain('Adversaire')
    expect(container.querySelector('.arcade-banter')?.textContent).toContain('Prêt.')
    await act(async () => { await vi.advanceTimersByTimeAsync(750) })
    expect(api.actArcade).toHaveBeenCalledWith('new-solo',expect.objectContaining({kind:'ADVANCE'}))
  })
  it('keeps the result and manual opponent selection separate from solo replay after PvP', async () => {
    const finished={...multiplayer('MEMORY'),status:'FINISHED' as const,result:{outcome:'WIN' as const,performancePoints:8,scoreAwarded:8,xpAwarded:0,businessDate:'2026-10-01',finishedAt:'2026-10-01T11:00:00Z',operationId:'op'}}
    const another={id:'another-player',displayName:'Autre joueur'}
    api.getArcade.mockResolvedValue(overview([finished])); api.getArcadeOpponents.mockResolvedValue({opponents:[another]})
    const {container}=await mount(<ArcadeScreen playerId="player-a" />)
    expect(container.querySelector('.arcade-result')?.textContent).toContain('+8 score · +0 XP')
    const select=container.querySelector<HTMLSelectElement>('[aria-label="Jouer contre"]')!
    expect(select.disabled).toBe(false); expect(select.value).toBe(''); expect(button(container,'Rejouer')).toBeTruthy()
    await act(async () => { select.value=another.id; select.dispatchEvent(new Event('change',{bubbles:true})) })
    expect(api.inviteArcade).not.toHaveBeenCalled()
    api.inviteArcade.mockResolvedValue({invitation:{...challenge,game:'MEMORY',direction:'OUTGOING'},operationId:'new-invite',alreadyProcessed:false})
    await click(button(container,'Prêt'))
    expect(api.inviteArcade).toHaveBeenCalledOnce(); expect(api.startArcade).not.toHaveBeenCalled()
    expect(api.inviteArcade.mock.calls[0]![0]).toMatchObject({opponentPlayerId:another.id,game:'MEMORY'})
    expect(api.inviteArcade.mock.calls[0]![0]).not.toHaveProperty('replaySessionId')
  })
})

let arcadeControl: ReturnType<typeof useArcade>
function ArcadeControl() { arcadeControl = useArcade('player-a'); return <span>{arcadeControl.pending ? 'pending' : 'ready'}</span> }
describe('Arcade response latency and adaptive reads', () => {
  it('publishes overview while opponent discovery is still blocked', async () => {
    api.getArcadeOpponents.mockImplementation(() => new Promise(() => undefined))
    const { container } = await mount(<ArcadeScreen playerId="player-a" />)
    expect(button(container, 'Commencer').disabled).toBe(false)
    expect(api.getArcadeOpponents).toHaveBeenCalledOnce()
  })
  it.each(['INVITE', 'CANCEL', 'REFUSE', 'READY'] as const)('applies %s response before blocked overview/opponents and releases pending', async kind => {
    vi.useFakeTimers()
    api.getArcade.mockResolvedValue({ ...overview(), invitation: kind === 'INVITE' ? null : challenge })
    api.getArcadeOpponents.mockImplementation(() => new Promise(() => undefined))
    await mount(<ArcadeControl />)
    api.getArcade.mockImplementation(() => new Promise(() => undefined))
    const invited = { ...challenge, direction: 'OUTGOING' as const }
    const next = { invitation: { ...invited, status: kind === 'INVITE' ? 'PENDING' as const : kind === 'READY' ? 'STARTED' as const : kind === 'CANCEL' ? 'CANCELLED' as const : 'REFUSED' as const }, operationId: 'op', alreadyProcessed: false, session: kind === 'READY' ? multiplayer() : null }
    api.inviteArcade.mockResolvedValue(next); api.actArcadeInvitation.mockResolvedValue(next)
    await act(async () => { if (kind === 'INVITE') await arcadeControl.invite({ game: 'MEMORY', difficulty: 'MEDIUM', opponentPlayerId: participantB.id }); else await arcadeControl.actInvitation(challenge.id, kind) })
    expect(arcadeControl.pending).toBe(false)
    expect(arcadeControl.value?.invitation?.status ?? null).toBe(kind === 'INVITE' ? 'PENDING' : null)
    if (kind === 'READY') expect(arcadeControl.value?.sessions[0]).toEqual(next.session)
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    expect(arcadeControl.pending).toBe(false)
  })
  it.each(['PVP', 'INVITATION', 'IDLE', 'SOLO'] as const)('uses the %s cadence without overlapping reads and suspends hidden', async state => {
    vi.useFakeTimers()
    const nominal = state === 'PVP' ? 600 : state === 'INVITATION' ? 900 : 2500
    api.getArcade.mockResolvedValue({ ...overview(state === 'PVP' ? [multiplayer()] : state === 'SOLO' ? [session('MEMORY')] : []), invitation: state === 'INVITATION' ? challenge : null })
    await mount(<ArcadeControl />)
    expect(api.getArcade).toHaveBeenCalledOnce()
    await act(async () => { await vi.advanceTimersByTimeAsync(nominal - 1) }); expect(api.getArcade).toHaveBeenCalledOnce()
    await act(async () => { await vi.advanceTimersByTimeAsync(1) }); expect(api.getArcade).toHaveBeenCalledTimes(state === 'SOLO' ? 1 : 2)
    api.getArcade.mockImplementation(() => new Promise(() => undefined))
    await act(async () => window.dispatchEvent(new Event('focus')))
    const calls = api.getArcade.mock.calls.length
    await act(async () => { window.dispatchEvent(new Event('focus')); await vi.advanceTimersByTimeAsync(5000) })
    expect(api.getArcade).toHaveBeenCalledTimes(calls)
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); await vi.advanceTimersByTimeAsync(5000) })
    expect(api.getArcade).toHaveBeenCalledTimes(calls)
  })
  it('advances PvP Memory near the authoritative 500 ms deadline without a 750 ms floor', async () => {
    vi.useFakeTimers()
    const row = multiplayer('MEMORY'); if (row.board.kind !== 'MEMORY') throw Error('Memory')
    row.board.phase = 'REVEAL'; row.nextActionAt = new Date(Date.now() + 500).toISOString()
    api.getArcade.mockResolvedValue(overview([row])); api.actArcade.mockImplementation(() => new Promise(() => undefined))
    await mount(<ArcadeScreen playerId="player-a" />)
    await act(async () => { await vi.advanceTimersByTimeAsync(579) }); expect(api.actArcade).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(1) }); expect(api.actArcade).toHaveBeenCalledOnce()
  })
})

it('coalesces opponents focus reads and rejects a response for a previous friends filter', async () => {
  let resolve!: (value: { opponents: typeof participantB[] }) => void
  api.getArcadeOpponents.mockImplementationOnce(() => new Promise(done => { resolve = done }))
  await mount(<ArcadeControl />)
  await act(async () => { window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('focus')); arcadeControl.setFriendsOnly(true) })
  expect(api.getArcadeOpponents).toHaveBeenCalledOnce()
  api.getArcadeOpponents.mockResolvedValue({ opponents: [] })
  await act(async () => { resolve({ opponents: [participantB] }); await Promise.resolve(); await Promise.resolve() })
  expect(arcadeControl.opponents).toEqual([])
  expect(api.getArcadeOpponents).toHaveBeenLastCalledWith(true)
})
it('backs off failed overview reads, recovers the PvP cadence and refreshes immediately on visibility return', async () => {
  vi.useFakeTimers(); api.getArcade.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(overview([multiplayer()]))
  await mount(<ArcadeControl />)
  await act(async () => { await vi.advanceTimersByTimeAsync(4999) }); expect(api.getArcade).toHaveBeenCalledOnce()
  await act(async () => { await vi.advanceTimersByTimeAsync(1) }); expect(api.getArcade).toHaveBeenCalledTimes(2)
  await act(async () => { await vi.advanceTimersByTimeAsync(600) }); expect(api.getArcade).toHaveBeenCalledTimes(3)
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')); await vi.advanceTimersByTimeAsync(3000) }); expect(api.getArcade).toHaveBeenCalledTimes(3)
  visibility.mockReturnValue('visible')
  await act(async () => document.dispatchEvent(new Event('visibilitychange'))); expect(api.getArcade).toHaveBeenCalledTimes(4)
})
