// @vitest-environment happy-dom
import { act, type ComponentProps } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type GameShell from './components/GameShell'
import type { PlayerDto } from './api/types'
import AppBootstrap from './AppBootstrap'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const mocks = vi.hoisted(() => ({
  userId: 'web-owner', status: 'signedIn', shell: null as ComponentProps<typeof GameShell> | null,
  api: Object.fromEntries(['getCurrentPlayer', 'getResources', 'getProgression', 'getWheelToday', 'getDailyRewardToday', 'getDailyChallenge', 'getDailyCombat', 'getMonthlyBoss', 'getContest', 'getEvent', 'getExpedition', 'getNotifications', 'getCurrentGacha', 'getCharacters', 'getTeams', 'getPermissions', 'getFavor', 'pullGacha'].map(key => [key, vi.fn()])) as Record<string, ReturnType<typeof vi.fn>>,
  signOut: vi.fn(),
}))
vi.mock('./auth/auth-context', () => ({ useAuth: () => ({ status: mocks.status, session: mocks.status === 'signedIn' ? { user: { id: mocks.userId } } : null, signOut: mocks.signOut }) }))
vi.mock('./api/game-api', async original => ({ ...await original<typeof import('./api/game-api')>(), getGameApiClient: () => ({ ...mocks.api, social: {}, trades: {} }) }))
vi.mock('./components/GameShell', () => ({ default: (props: ComponentProps<typeof GameShell>) => {
  mocks.shell = props
  return <output>{JSON.stringify({ player: props.player, resources: props.resources, progression: props.progression, teams: props.teams, gacha: props.gacha, challenge: props.dailyChallenge, combat: props.dailyCombat, revision: props.playerStateReadRevision, feedbacks: props.levelUpFeedbacks })}</output>
} }))
let root: ReturnType<typeof createRoot>, container: HTMLDivElement
const player: PlayerDto = { id: 'player', displayName: 'Fixture', status: 'ACTIVE', elementKey: 'hydro' }
const resources = { primogems: '1000', moras: '50', particles: {} }
const event = { businessDate: '2026-10-05', edition: { id: 'edition', startsAt: '2026-10-01' }, gameB: { solvedToday: false }, gameA: { completedToday: false }, participation: { joined: false } }
beforeEach(() => {
  mocks.status = 'signedIn'; mocks.userId = 'web-owner'; mocks.shell = null; mocks.signOut.mockClear()
  Object.values(mocks.api).forEach(fn => fn.mockReset().mockResolvedValue({}))
  mocks.api.getCurrentPlayer.mockResolvedValue(player)
  mocks.api.getResources.mockResolvedValue(resources)
  mocks.api.getProgression.mockResolvedValue({ totalXp: '0', level: 1 })
  mocks.api.getCharacters.mockResolvedValue({ characters: [] })
  mocks.api.getCurrentGacha.mockResolvedValue({ playerState: { pity5: 10 } })
  mocks.api.getDailyChallenge.mockResolvedValue({ status: 'ACTIVE' })
  mocks.api.getTeams.mockResolvedValue({ teams: [{ id: 'old-team' }] })
  mocks.api.getExpedition.mockResolvedValue({ operationalStatus: 'IDLE' })
  mocks.api.getEvent.mockResolvedValue(event)
  container = document.createElement('div'); root = createRoot(container)
})
afterEach(() => { act(() => root.unmount()); mocks.shell = null })
const mount = () => act(async () => root.render(<AppBootstrap />))

it('refreshes balances and the daily reward card together through the existing Chat resources scope', async () => {
  await mount()
  mocks.api.getResources.mockResolvedValue({ ...resources, primogems: '1160' })
  mocks.api.getDailyRewardToday.mockResolvedValue({ claimed: true, businessDate: '2026-10-06' })
  await act(async () => mocks.shell!.onRefreshChatScopes!(['resources']))
  expect(mocks.shell!.resources.primogems).toBe('1160')
  expect(mocks.shell!.dailyRewardToday).toMatchObject({ claimed: true })
  expect(mocks.api.getResources).toHaveBeenCalledTimes(2)
  expect(mocks.api.getDailyRewardToday).toHaveBeenCalledTimes(2)
})

it('rereads the actual bootstrap pipeline, coalesces callers and publishes all shared changes without gain feedback', async () => {
  await mount()
  const initial = container.textContent!
  expect(initial).toContain('old-team')
  let release!: (value: PlayerDto) => void
  mocks.api.getCurrentPlayer.mockImplementationOnce(() => new Promise<PlayerDto>(done => { release = done }))
  mocks.api.getResources.mockResolvedValue({ ...resources, primogems: '840' })
  mocks.api.getProgression.mockResolvedValue({ totalXp: '30', level: 2 })
  mocks.api.getTeams.mockResolvedValue({ teams: [{ id: 'new-team' }] })
  mocks.api.getCurrentGacha.mockResolvedValue({ playerState: { pity5: 11 } })
  mocks.api.getDailyChallenge.mockResolvedValue({ status: 'COMPLETED' })
  mocks.api.getDailyCombat.mockResolvedValue({ status: 'WON' })
  const refresh = mocks.shell!.onRefreshPlayerState!
  let first!: Promise<void>, second!: Promise<void>
  await act(async () => { first = refresh(); second = refresh() })
  expect(first).toBe(second)
  expect(mocks.api.getCurrentPlayer).toHaveBeenCalledTimes(2)
  await act(async () => { release(player); await first })
  const next = mocks.shell!
  expect(next.resources.primogems).toBe('840'); expect(next.progression.level).toBe(2)
  expect(next.teams.teams[0].id).toBe('new-team'); expect(next.gacha.playerState.pity5).toBe(11)
  expect(next.dailyChallenge.status).toBe('COMPLETED'); expect(next.dailyCombat.status).toBe('WON')
  expect(next.playerStateReadRevision).toBe(2); expect(next.levelUpFeedbacks).toEqual([])
  expect(mocks.api.getResources).toHaveBeenCalledTimes(2)
  expect(mocks.api.pullGacha).not.toHaveBeenCalled(); expect(mocks.signOut).not.toHaveBeenCalled()
})
it('keeps the last state after a read failure and succeeds on a subsequent reread', async () => {
  await mount()
  const before = container.textContent
  mocks.api.getResources.mockRejectedValueOnce(new Error('Read failed'))
  await act(async () => { await expect(mocks.shell!.onRefreshPlayerState!()).rejects.toThrow('Read failed') })
  expect(container.textContent).toBe(before); expect(mocks.signOut).not.toHaveBeenCalled()
  await act(async () => mocks.shell!.onRefreshPlayerState!())
  expect(mocks.shell!.playerStateReadRevision).toBe(2)
})
it('ignores reads from an old auth owner after sign-out and sign-in', async () => {
  await mount()
  let release!: (value: typeof resources) => void
  mocks.api.getResources.mockImplementationOnce(() => new Promise<typeof resources>(done => { release = done }))
  let request!: Promise<void>
  await act(async () => { request = mocks.shell!.onRefreshPlayerState!() })
  mocks.status = 'signedOut'; await mount()
  mocks.status = 'signedIn'; mocks.userId = 'different-owner'
  mocks.api.getCurrentPlayer.mockResolvedValue({ ...player, id: 'different-player' })
  mocks.api.getResources.mockResolvedValue({ ...resources, primogems: '999' })
  await mount()
  await act(async () => { release({ ...resources, primogems: '1' }); await request })
  expect(mocks.shell!.player.id).toBe('different-player'); expect(mocks.shell!.resources.primogems).toBe('999')
})
it.each(['signedOut', 'loading'])('does not mount the ready shell or read gameplay for auth %s', async status => {
  mocks.status = status; await mount()
  await act(async () => { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')) })
  expect(mocks.shell).toBeNull(); expect(mocks.api.getResources).not.toHaveBeenCalled()
})
it('does not expose the return refresh before the Player is resolved', async () => {
  mocks.api.getCurrentPlayer.mockReturnValue(new Promise(() => undefined))
  await mount()
  await act(async () => { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')) })
  expect(mocks.shell).toBeNull(); expect(mocks.api.getResources).not.toHaveBeenCalled()
})
