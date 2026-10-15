// @vitest-environment happy-dom
import { act, type ComponentProps } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type GameShell from './components/GameShell'
import type { PlayerDto } from './api/types'
import AppBootstrap from './AppBootstrap'
import { usePresence } from './social/use-presence'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const mocks = vi.hoisted(() => ({
  userId: 'web-owner', status: 'signedIn', shell: null as ComponentProps<typeof GameShell> | null,
  api: Object.fromEntries(['getTwitchAccount', 'getTwitchLinkResolution', 'startTwitchLink', 'resolveTwitchLink', 'getCurrentPlayer', 'getResources', 'getProgression', 'getWheelToday', 'getDailyRewardToday', 'getDailyChallenge', 'getDailyCombat', 'getMonthlyBoss', 'getContest', 'getEvent', 'getExpedition', 'getNotifications', 'archiveNotification', 'getCurrentGacha', 'getCharacters', 'getTeams', 'replaceTeamComposition', 'getPermissions', 'getFavor', 'pullGacha', 'chooseElement', 'useStella', 'claimGiftCode'].map(key => [key, vi.fn()])) as Record<string, ReturnType<typeof vi.fn>>,
  signOut: vi.fn(),
  presence: { connected: vi.fn(), session: vi.fn(), heartbeat: vi.fn(), end: vi.fn() },
}))
vi.mock('./auth/auth-context', async original => ({ ...await original<typeof import('./auth/auth-context')>(), useAuth: () => ({ status: mocks.status, session: mocks.status === 'signedIn' ? { user: { id: mocks.userId } } : null, signOut: mocks.signOut }) }))
vi.mock('./api/game-api', async original => {
  const client = { ...mocks.api, social: mocks.presence, trades: {} }
  return { ...await original<typeof import('./api/game-api')>(), getGameApiClient: () => client }
})
vi.mock('./components/GameShell', () => ({ default: function GameSessionShell(props: ComponentProps<typeof GameShell>) {
  mocks.shell = props
  usePresence(props.player.id, props.socialActions)
  return <output>{JSON.stringify({ player: props.player, resources: props.resources, progression: props.progression, teams: props.teams, gacha: props.gacha, challenge: props.dailyChallenge, combat: props.dailyCombat, revision: props.playerStateReadRevision, feedbacks: props.levelUpFeedbacks })}</output>
} }))
let root: ReturnType<typeof createRoot>, container: HTMLDivElement
const player: PlayerDto = { id: 'player', displayName: 'Fixture', status: 'ACTIVE', elementKey: 'hydro' }
const resources = { primogems: '1000', moras: '50', particles: {} }
const event = { businessDate: '2026-10-05', edition: { id: 'edition', startsAt: '2026-10-01' }, gameB: { solvedToday: false }, gameA: { completedToday: false }, participation: { joined: false } }
beforeEach(() => {
  mocks.status = 'signedIn'; mocks.userId = 'web-owner'; mocks.shell = null; mocks.signOut.mockReset().mockResolvedValue(undefined)
  Object.values(mocks.api).forEach(fn => fn.mockReset().mockResolvedValue({}))
  Object.values(mocks.presence).forEach(fn => fn.mockReset().mockResolvedValue({}))
  mocks.api.getCurrentPlayer.mockResolvedValue(player)
  mocks.api.getResources.mockResolvedValue(resources)
  mocks.api.getProgression.mockResolvedValue({ totalXp: '0', level: 1 })
  mocks.api.getCharacters.mockResolvedValue({ characters: [] })
  mocks.api.getCurrentGacha.mockResolvedValue({ playerState: { pity5: 10 } })
  mocks.api.getDailyChallenge.mockResolvedValue({ status: 'ACTIVE' })
  mocks.api.getTeams.mockResolvedValue({ teams: [{ id: 'old-team' }] })
  mocks.api.getExpedition.mockResolvedValue({ operationalStatus: 'IDLE' })
  mocks.api.getEvent.mockResolvedValue(event)
  history.replaceState(null, '', '/'); sessionStorage.clear();
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(() => { act(() => root.unmount()); mocks.shell = null; vi.useRealTimers(); vi.restoreAllMocks(); container.remove(); history.replaceState(null, '', '/'); sessionStorage.clear() })
const mount = () => act(async () => root.render(<AppBootstrap />))

const web = { ...player, id: 'web-player', elementKey: null }
const recovered = { ...player, id: 'twitch-player', displayName: 'Twitch conservé', elementKey: 'cryo' as const }
const account = { linked: null, identityLinkAvailable: true, pilotAvailable: true, eligible: false, snapshotAvailable: false }
const summary = { displayName: 'Progression', level: 74, elementKey: 'cryo', resources: { primogems: '300', moras: '500' }, characters: 10, totalMessages: '20', recentActivityAt: null }
const resolution = { id: 'resolution', revision: 'revision', expiresAt: '2099-01-01T00:00:00Z', web: { ...summary, elementKey: null, level: 1 }, twitch: summary, safety: { WEB: { status: 'SAFE' }, TWITCH: { status: 'SAFE' } } }
const button = (label: string) => [...container.querySelectorAll<HTMLButtonElement>('button')].find(node => node.textContent === label)!
async function beginLink() {
  mocks.api.getCurrentPlayer.mockResolvedValue(web)
  mocks.api.getTwitchAccount.mockResolvedValue(account)
  mocks.api.getTwitchLinkResolution.mockResolvedValue(null)
  mocks.api.startTwitchLink.mockResolvedValue({ url: 'https://id.twitch.tv/oauth2/authorize?state=private-fixture' })
  const assign = vi.spyOn(location, 'assign').mockImplementation(() => undefined)
  await mount()
  await act(async () => button('Lier mon compte Twitch').click())
  const link = container.querySelector<HTMLButtonElement>('[role="dialog"] .account-twitch-identity button') ?? [...container.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(node => node.textContent === 'Lier mon compte Twitch')!
  await act(async () => { link.click(); link.click() })
  expect(mocks.api.startTwitchLink).toHaveBeenCalledOnce()
  expect(assign).toHaveBeenCalledOnce()
}
async function browserReturn(outcome: string) {
  await act(async () => root.unmount())
  container.remove(); container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  history.replaceState(null, '', `/?keep=1&twitch=${outcome}#configuration`)
  mocks.shell = null
  await mount()
}
it('restores the real comparison after a full OAuth navigation/remount and confirms the retained Player', async () => {
  await beginLink()
  mocks.api.getTwitchLinkResolution.mockResolvedValue(resolution)
  await browserReturn('progression-choice')
  expect(container.querySelector('[role="dialog"]')?.textContent).toContain('Choisis la progression à conserver')
  expect(location.search).toBe('?keep=1')
  expect(mocks.api.resolveTwitchLink).not.toHaveBeenCalled()
  mocks.api.resolveTwitchLink.mockResolvedValue({ resolutionRequired: false })
  mocks.api.getTwitchAccount.mockResolvedValue({ ...account, linked: { login: 'fixture', displayName: 'Twitch', linkedAt: '2026-10-15' } })
  mocks.api.getCurrentPlayer.mockResolvedValue(recovered)
  await act(async () => container.querySelector<HTMLInputElement>('.twitch-progression-ack input')!.click())
  await act(async () => button('Utiliser ma progression Twitch').click())
  expect(mocks.api.resolveTwitchLink).toHaveBeenCalledExactlyOnceWith('resolution', 'TWITCH', 'revision')
  expect(mocks.shell?.player).toEqual(recovered)
  expect(container.querySelector('[role="dialog"]')).toBeNull()
  expect(location.hash).toBe('#home')
})
it.each(['connected', 'profile-recovered'])('enters the recovered authoritative Player directly after %s', async outcome => {
  await beginLink()
  mocks.api.getCurrentPlayer.mockResolvedValue(recovered)
  mocks.api.getTwitchLinkResolution.mockClear()
  await browserReturn(outcome)
  expect(mocks.shell?.player).toEqual(recovered)
  expect(container.querySelector('[role="dialog"]')).toBeNull()
  expect(mocks.api.getTwitchLinkResolution).not.toHaveBeenCalled()
  expect(location.hash).toBe('#home')
  expect(location.search).toBe('?keep=1')
})
it.each(['error', 'TWITCH_OAUTH_EXPIRED'])('restores errors after %s without another OAuth and closes normally', async outcome => {
  await beginLink()
  await browserReturn(outcome)
  expect(container.querySelector('[role="dialog"] [role="alert"]')?.textContent).toContain('échoué ou a été annulée')
  expect(mocks.api.startTwitchLink).toHaveBeenCalledOnce()
  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Fermer"]')!.click())
  expect(container.querySelector('[role="dialog"]')).toBeNull()
  await mount()
  expect(container.querySelector('[role="dialog"]')).toBeNull()
})
it('does not treat a forged connected query as a recovered Player', async () => {
  mocks.api.getCurrentPlayer.mockResolvedValue(web); mocks.api.getTwitchAccount.mockResolvedValue(account); mocks.api.getTwitchLinkResolution.mockResolvedValue(null)
  await browserReturn('connected')
  expect(mocks.shell).toBeNull(); expect(container.textContent).toContain('Choisis ton élément')
  expect(mocks.api.chooseElement).not.toHaveBeenCalled(); expect(mocks.api.resolveTwitchLink).not.toHaveBeenCalled()
  expect(container.textContent).not.toContain('Compte Twitch lié.')
})
it('ignores a prior session return and does not reopen after logout', async () => {
  await beginLink()
  mocks.userId = 'different-subject'; mocks.api.getCurrentPlayer.mockResolvedValue(web)
  await browserReturn('progression-choice')
  expect(container.querySelector('[role="dialog"]')).toBeNull(); expect(location.search).toBe('?keep=1')
  mocks.status = 'signedOut'; await mount()
  mocks.status = 'signedIn'; await mount()
  expect(container.querySelector('[role="dialog"]')).toBeNull()
})
it('does not navigate a late OAuth start after its account dialog was closed', async () => {
  mocks.api.getCurrentPlayer.mockResolvedValue(web); mocks.api.getTwitchAccount.mockResolvedValue(account); mocks.api.getTwitchLinkResolution.mockResolvedValue(null)
  let finish!: (value: { url: string }) => void
  mocks.api.startTwitchLink.mockImplementation(() => new Promise(done => { finish = done }))
  const assign = vi.spyOn(location, 'assign').mockImplementation(() => undefined)
  await mount(); await act(async () => button('Lier mon compte Twitch').click())
  const link = [...container.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(node => node.textContent === 'Lier mon compte Twitch')!
  await act(async () => link.click())
  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Fermer"]')!.click())
  await act(async () => finish({ url: 'https://id.twitch.tv/oauth2/authorize?state=late' }))
  expect(assign).not.toHaveBeenCalled(); expect(sessionStorage.length).toBe(0)
})
it('also enters Home after a chosen-element low-progress Player was actually replaced', async () => {
  mocks.api.getCurrentPlayer.mockResolvedValue(player)
  await mount()
  mocks.shell!.onBeforeTwitchRedirect!()
  mocks.api.getCurrentPlayer.mockResolvedValue(recovered)
  await browserReturn('connected')
  expect(mocks.shell?.player).toEqual(recovered); expect(location.hash).toBe('#home'); expect(location.search).toBe('?keep=1')
})
it('preserves the normal post-element account destination when linking the same Player', async () => {
  await mount(); mocks.shell!.onBeforeTwitchRedirect!()
  await browserReturn('connected')
  expect(mocks.shell?.player).toEqual(player); expect(location.hash).toBe('#configuration'); expect(location.search).toContain('twitch=connected')
})
