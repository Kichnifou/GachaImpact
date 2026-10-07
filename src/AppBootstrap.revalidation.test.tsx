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
  api: Object.fromEntries(['getCurrentPlayer', 'getResources', 'getProgression', 'getWheelToday', 'getDailyRewardToday', 'getDailyChallenge', 'getDailyCombat', 'getMonthlyBoss', 'getContest', 'getEvent', 'getExpedition', 'getNotifications', 'getCurrentGacha', 'getCharacters', 'getTeams', 'getPermissions', 'getFavor', 'pullGacha', 'chooseElement'].map(key => [key, vi.fn()])) as Record<string, ReturnType<typeof vi.fn>>,
  signOut: vi.fn(),
  presence: { connected: vi.fn(), session: vi.fn(), heartbeat: vi.fn(), end: vi.fn() },
}))
vi.mock('./auth/auth-context', () => ({ useAuth: () => ({ status: mocks.status, session: mocks.status === 'signedIn' ? { user: { id: mocks.userId } } : null, signOut: mocks.signOut }) }))
vi.mock('./api/game-api', async original => ({ ...await original<typeof import('./api/game-api')>(), getGameApiClient: () => ({ ...mocks.api, social: mocks.presence, trades: {} }) }))
vi.mock('./components/GameShell', () => ({ default: function GameSessionShell(props: ComponentProps<typeof GameShell>) {
  mocks.shell = props
  usePresence(props.player.id, props.socialActions)
  return <output>{JSON.stringify({ player: props.player, resources: props.resources, progression: props.progression, teams: props.teams, gacha: props.gacha, challenge: props.dailyChallenge, combat: props.dailyCombat, revision: props.playerStateReadRevision, feedbacks: props.levelUpFeedbacks })}</output>
} }))
let root: ReturnType<typeof createRoot>, container: HTMLDivElement
vi.mock('./screens/AccountSettingsPanel', () => ({ default: ({ onRefreshPlayerState }: { onRefreshPlayerState: () => Promise<void> }) => <button onClick={() => void onRefreshPlayerState()}>Retour OAuth vérifié</button> }))
const player: PlayerDto = { id: 'player', displayName: 'Fixture', status: 'ACTIVE', elementKey: 'hydro' }
const resources = { primogems: '1000', moras: '50', particles: {} }
const event = { businessDate: '2026-10-05', edition: { id: 'edition', startsAt: '2026-10-01' }, gameB: { solvedToday: false }, gameA: { completedToday: false }, participation: { joined: false } }
beforeEach(() => {
  mocks.status = 'signedIn'; mocks.userId = 'web-owner'; mocks.shell = null; mocks.signOut.mockClear()
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
  container = document.createElement('div'); root = createRoot(container)
})
afterEach(() => { act(() => root.unmount()); mocks.shell = null })
const mount = () => act(async () => root.render(<AppBootstrap />))

it('recovers the actual Twitch Player from the pre-element account panel and reloads every bootstrap domain', async () => {
  mocks.api.getCurrentPlayer.mockResolvedValue({ ...player, id: 'temporary-web-player', elementKey: null });
  await mount();
  expect(mocks.shell).toBeNull();
  expect(mocks.api.getResources).not.toHaveBeenCalled();
  await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Configuration › Compte')!.click());
  mocks.api.getCurrentPlayer.mockResolvedValue({ ...player, id: 'recovered-twitch-player', elementKey: 'pyro' });
  mocks.api.getResources.mockResolvedValue({ ...resources, primogems: '8800' });
  mocks.api.getProgression.mockResolvedValue({ totalXp: '900', level: 30 });
  mocks.api.getTeams.mockResolvedValue({ teams: [{ id: 'twitch-team' }] });
  mocks.api.getCurrentGacha.mockResolvedValue({ playerState: { pity5: 73 } });
  await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Retour OAuth vérifié')!.click());
  const shell = mocks.shell as ComponentProps<typeof GameShell> | null;
  expect(shell?.player.id).toBe('recovered-twitch-player');
  expect(shell?.resources.primogems).toBe('8800');
  expect(shell?.progression.totalXp).toBe('900');
  expect(shell?.teams.teams[0]?.id).toBe('twitch-team');
  expect(shell?.gacha.playerState.pity5).toBe(73);
  for (const domain of ['getCharacters', 'getFavor', 'getPermissions', 'getExpedition', 'getContest', 'getEvent', 'getNotifications']) expect(mocks.api[domain]).toHaveBeenCalled();
  expect(mocks.signOut).not.toHaveBeenCalled();
  expect(container.querySelector('[role="dialog"]')).toBeNull();
  expect(container.textContent).not.toContain('Configuration › Compte');
  expect(mocks.presence.session).toHaveBeenCalledOnce();
});

it('replaces the game presence session on canonical Player change and reconnects to that Player with the same Auth subject', async () => {
  await mount();
  const oldKey = mocks.presence.session.mock.calls[0]![0];
  mocks.api.getCurrentPlayer.mockResolvedValue({ ...player, id: 'retained-twitch-player' });
  await act(async () => mocks.shell!.onRefreshPlayerState!());
  expect(mocks.shell!.player.id).toBe('retained-twitch-player');
  expect(mocks.presence.end).toHaveBeenCalledWith(oldKey);
  expect(mocks.presence.session).toHaveBeenCalledTimes(2);
  const newKey = mocks.presence.session.mock.calls[1]![0]; expect(newKey).not.toBe(oldKey);
  mocks.status = 'signedOut'; await mount(); mocks.status = 'signedIn'; await mount();
  expect(mocks.shell!.player.id).toBe('retained-twitch-player'); expect(mocks.userId).toBe('web-owner');
  expect(mocks.presence.session).toHaveBeenCalledTimes(3);
  expect(mocks.presence.session.mock.calls[2]![0]).not.toBe(newKey);
  expect(mocks.signOut).not.toHaveBeenCalled();
});
it('closes the old Account dialog and clears a temporary element selection when the retained Twitch Player has no element', async () => {
  mocks.api.getCurrentPlayer.mockResolvedValue({ ...player, id: 'temporary-web-player', elementKey: null });
  await mount();
  await act(async () => container.querySelector<HTMLButtonElement>('.element-choice.hydro')!.click());
  expect(container.querySelector('.element-choice.hydro')!.getAttribute('aria-pressed')).toBe('true');
  await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Configuration › Compte')!.click());
  mocks.api.getCurrentPlayer.mockResolvedValue({ ...player, id: 'retained-null-element-twitch-player', elementKey: null });
  await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Retour OAuth vérifié')!.click());
  expect(container.querySelector('[role="dialog"]')).toBeNull();
  expect(container.querySelector('[aria-pressed="true"]')).toBeNull();
  expect(mocks.api.chooseElement).not.toHaveBeenCalled();
  await act(async () => container.querySelector<HTMLButtonElement>('.element-choice.pyro')!.click());
  await act(async () => container.querySelector<HTMLButtonElement>('.element-confirm')!.click());
  expect(mocks.shell!.player.id).toBe('retained-null-element-twitch-player');
  expect(mocks.shell!.player.elementKey).toBe('pyro');
  expect(mocks.api.chooseElement).toHaveBeenCalledWith('pyro');
  expect(mocks.signOut).not.toHaveBeenCalled();
});

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


it('recovers a no-element Twitch Player with retained gameplay, then uses normal choice without resetting its state', async () => {
  mocks.api.getCurrentPlayer.mockResolvedValue({ ...player, id: 'temporary-web', elementKey: null });
  await mount();
  await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Configuration › Compte')!.click());
  mocks.api.getCurrentPlayer.mockResolvedValue({ ...player, id: 'twitch-without-element', elementKey: null });
  mocks.api.getResources.mockResolvedValue({ ...resources, primogems: '777' });
  mocks.api.getProgression.mockResolvedValue({ totalXp: '60', level: 2 });
  await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Retour OAuth vérifié')!.click());
  expect(mocks.shell).toBeNull(); expect(container.textContent).toContain('Choisis ton élément');
  // Close the account dialog before the existing permanent element choice.
  await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  mocks.api.getCurrentPlayer.mockResolvedValue({ ...player, id: 'twitch-without-element', elementKey: 'hydro' });
  await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent?.includes('Hydro'))!.click());
  await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Choisir Hydro')!.click());
  const shell = mocks.shell as ComponentProps<typeof GameShell> | null;
  expect(shell?.player.id).toBe('twitch-without-element'); expect(shell?.player.elementKey).toBe('hydro');
  expect(shell?.resources.primogems).toBe('777'); expect(shell?.progression.totalXp).toBe('60');
  expect(mocks.api.chooseElement).toHaveBeenCalledWith('hydro'); expect(mocks.signOut).not.toHaveBeenCalled();
});

it('does not ask a recovered level-1 Player with an element to choose it again', async () => {
  mocks.api.getCurrentPlayer.mockResolvedValue({ ...player, id: 'recovered-level-one', elementKey: 'pyro' });
  mocks.api.getProgression.mockResolvedValue({ totalXp: '30', level: 1 });
  await mount();
  expect(mocks.shell?.player.id).toBe('recovered-level-one');
  expect(container.textContent).not.toContain('Choisis ton élément');
  expect(mocks.api.chooseElement).not.toHaveBeenCalled();
});
