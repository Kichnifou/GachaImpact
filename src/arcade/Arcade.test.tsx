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
    board: game === 'MEMORY' ? { kind: 'MEMORY', turn: 'PLAYER', phase: 'PICK', playerPairs: 0, aiPairs: 0, remainingPairs: 18, outcome: null, cards: Array.from({ length: 36 }, (_, position) => ({ position, status: 'HIDDEN' })) }
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
  it('resumes each server board, keeps hidden cards out of DOM and supports arrow navigation', async () => {
    api.getArcade.mockResolvedValue(overview([session('MEMORY'), session('CONNECT_FOUR'), session('TIC_TAC_TOE')]))
    const { container } = await mount(<ArcadeScreen playerId="player-a" />)
    expect(container.textContent).toContain('Partie en pause')
    expect(container.querySelectorAll('.arcade-memory img')).toHaveLength(0)
    expect(container.innerHTML).not.toMatch(/assetPaths|faceId|portrait-|seed|privateState/)
    await click(button(container, 'Reprendre'))
    const cards = container.querySelectorAll<HTMLButtonElement>('.arcade-memory-card'); cards[0]!.focus()
    act(() => cards[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })))
    expect(document.activeElement).toBe(cards[1])
    await click(button(container, 'Puissance 4')); expect(container.querySelectorAll('.arcade-disc')).toHaveLength(42)
    await click(button(container, 'Morpion')); expect(container.querySelectorAll('.arcade-cell')).toHaveLength(9)
    await click(button(container, 'Memory')); expect(container.querySelectorAll('.arcade-memory-card')).toHaveLength(36)
    expect(api.startArcade).not.toHaveBeenCalled(); expect(api.actArcade).not.toHaveBeenCalled()
  })
  it('blocks double clicks, retries the exact ambiguous move, and publishes confirmed snapshots once per response', async () => {
    const row = session('MEMORY'); api.getArcade.mockResolvedValue(overview([row]))
    let reject!: (reason: unknown) => void
    api.actArcade.mockImplementationOnce(() => new Promise((_resolve, rejectPromise) => { reject = rejectPromise }))
    const publish = vi.fn(), { container } = await mount(<ArcadeScreen playerId="player-a" onMutation={publish} />)
    await click(button(container, 'Reprendre'))
    const card = container.querySelector<HTMLButtonElement>('.arcade-memory-card')!
    act(() => { card.click(); card.click() })
    expect(api.actArcade).toHaveBeenCalledTimes(1); expect(card.disabled).toBe(true)
    await act(async () => reject(new ApiError('NETWORK_ERROR', 'Réseau interrompu', null)))
    const sent = api.actArcade.mock.calls[0]!
    api.actArcade.mockResolvedValue({ ...mutation({ ...row, version: 1 }), alreadyProcessed: true })
    await click(button(container, 'Réessayer le même coup'))
    expect(api.actArcade.mock.calls[1]).toEqual(sent); expect(publish).toHaveBeenCalledTimes(1)
  })
  it('publishes a pending result after navigation and ignores an obsolete overview response', async () => {
    api.getArcade.mockResolvedValueOnce(overview([session('MEMORY')]))
    const publish = vi.fn(), { root, container } = await mount(<ArcadeScreen playerId="player-a" onMutation={publish} />)
    api.getArcade.mockResolvedValue(overview([session('MEMORY')]))
    await click(button(container, 'Reprendre'))
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
  const ranking = (page = 2): ArcadeRanking => ({ kind: 'SCORE', game: 'MEMORY', difficulty: 'MEDIUM', page, pageSize: 10, total: 13, totalPages: 2, selfPage: 2, selfStatus: 'RANKED',
    entries: [{ playerId: 'player-a', displayName: 'Joueur', elementKey: 'hydro', avatarAssetPath: null, value: '50', rank: 1, position: 13, pairs: null, isSelf: true }] })
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
