// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import GameShell from '../components/GameShell'
import { gameShellProps } from './game-shell-test-fixtures'
import { event } from './daily-test-fixtures'
import { dailyMaskKey, dailyTrackerEnvironment } from './use-daily-tracker'
import type { SocialActions } from '../social/types'
vi.mock('../components/ChatPanel', () => ({ default: () => <aside className="chat-panel" /> }))
vi.mock('../favor/use-favor-presence', () => ({ useFavorPresence: () => ({ favor: null, error: false, feedbacks: [], finish: vi.fn() }) }))
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
let root: Root, container: HTMLDivElement
beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); window.location.hash = ''; container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
afterEach(() => { act(() => root.unmount()); container.remove(); vi.useRealTimers() })
it.each(['wheel', 'challenge'] as const)('opens Quotidiennes > %s exactly without consuming its action, and Tout voir returns to Overview', async id => {
  const props = gameShellProps(), masks = id === 'wheel' ? ['reward', 'expedition'] : ['reward', 'expedition', 'wheel']
  localStorage.setItem(dailyMaskKey(dailyTrackerEnvironment(), props.player.id, '2026-09-12'), JSON.stringify(masks))
  await act(async () => root.render(<GameShell {...props} />))
  expect(container.querySelector('.daily-tracker h3')?.textContent).toBe(id === 'wheel' ? 'Roue' : 'Défi')
  await act(async () => container.querySelector<HTMLButtonElement>('.daily-tracker-primary button')!.click())
  expect(container.querySelector(id === 'wheel' ? '.wheel-card' : '.daily-challenge-card')).not.toBeNull()
  expect(props.onSpinWheel).not.toHaveBeenCalled(); expect(props.onPurchaseDailyChallenge).not.toHaveBeenCalled()
  await act(async () => container.querySelector<HTMLButtonElement>('.daily-tracker-all')!.click())
  expect(container.querySelector('.dailies-overview')).not.toBeNull()
  expect(container.querySelectorAll('[data-daily-activity]')).toHaveLength(9)
})
it('opens Boss rather than Daily Combat and does not attack', async () => {
  const props = gameShellProps()
  props.monthlyBoss = { ...props.monthlyBoss, availableCharacters: Array.from({ length: 4 }, () => ({ ...props.expedition.value.activeCharacter!, constellation: 0, copies: 1, firstObtainedAt: '', favorite: false, displayOrder: null })) }
  localStorage.setItem(dailyMaskKey(dailyTrackerEnvironment(), props.player.id, '2026-09-12'), JSON.stringify(['reward', 'expedition', 'wheel', 'challenge', 'combat']))
  await act(async () => root.render(<GameShell {...props} />))
  expect(container.querySelector('.daily-tracker h3')?.textContent).toBe('Boss')
  await act(async () => container.querySelector<HTMLButtonElement>('.daily-tracker-primary button')!.click())
  expect(container.querySelector('.combat-tabs button.active')?.textContent).toBe('Boss')
  expect(props.onAttackMonthlyBoss).not.toHaveBeenCalled()
})
it('opens the next native Event section without joining or attempting', async () => {
  const props = gameShellProps()
  const value = { ...event, businessDate: '2026-09-12' }
  props.event = value; props.onLoadEvent = vi.fn(async () => value); props.onJoinEvent = vi.fn(); props.onAttemptEventGameA = vi.fn()
  localStorage.setItem(dailyMaskKey(dailyTrackerEnvironment(), props.player.id, '2026-09-12'), JSON.stringify(['reward', 'expedition', 'wheel', 'challenge', 'combat', 'boss', 'friendship']))
  await act(async () => root.render(<GameShell {...props} />))
  await act(async () => container.querySelector<HTMLButtonElement>('.daily-tracker-primary button')!.click())
  expect(container.querySelector('.event-screen')).not.toBeNull()
  expect(container.querySelector('.event-tabs button.active')?.textContent).toBe('Général')
  expect(props.onJoinEvent).not.toHaveBeenCalled(); expect(props.onAttemptEventGameA).not.toHaveBeenCalled()
})
it('opens Social Friends from the real heart summary without sending a heart or fetching a directory', async () => {
  const props = gameShellProps()
  const actions = { friends: vi.fn(async () => ({ businessDate: '2026-09-12', sort: 'presence', totalFriendHeartsSent: '0', players: [], friends: [], requests: [], summary: { activeFriends: 2, available: 2, alreadySent: 0 } })), sendHearts: vi.fn(), directory: vi.fn(), connected: vi.fn(async () => ({ players: [], total: 0 })), session: vi.fn(async () => undefined), heartbeat: vi.fn(async () => undefined), end: vi.fn(async () => undefined) } as unknown as SocialActions
  props.socialActions = actions
  localStorage.setItem(dailyMaskKey(dailyTrackerEnvironment(), props.player.id, '2026-09-12'), JSON.stringify(['favor', 'reward', 'expedition', 'wheel', 'challenge', 'combat', 'boss', 'event']))
  await act(async () => root.render(<GameShell {...props} />))
  expect(container.querySelector('.daily-tracker h3')?.textContent).toBe('Amitié')
  await act(async () => container.querySelector<HTMLButtonElement>('.daily-tracker-primary button')!.click())
  expect(container.querySelector('.social-tabs button.active')?.textContent).toBe('Amis')
  expect(actions.sendHearts).not.toHaveBeenCalled(); expect(actions.directory).not.toHaveBeenCalled()
})
