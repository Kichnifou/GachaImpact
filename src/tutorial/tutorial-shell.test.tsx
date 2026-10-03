// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import GameShell from '../components/GameShell'
import { gameShellProps } from '../dailies/game-shell-test-fixtures'
import type { TutorialPreferenceDto } from '../api/types'
import { tutorialSteps } from './tutorial-controller'

vi.mock('../components/ChatPanel', () => ({ default: ({ isCollapsed }: { isCollapsed: boolean }) => <aside data-tutorial-anchor="community" data-collapsed={isCollapsed} /> }))
vi.mock('../favor/use-favor-presence', () => ({ useFavorPresence: () => ({ favor: null, error: false, feedbacks: [], finish: vi.fn() }) }))
vi.mock('../screens/ProfileScreen', () => ({ default: ({ playerId }: { playerId: string }) => <div data-profile-player={playerId} /> }))
vi.mock('../screens/SocialScreen', () => ({ default: ({ onProfile }: { onProfile: (id: string) => void }) => <button data-other-profile onClick={() => onProfile('other-player')}>Profil tiers</button> }))
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
let root: Root, container: HTMLDivElement
beforeEach(() => {
  window.location.hash = '#inventory'; container = document.createElement('div'); container.id = 'root'; document.body.append(container); root = createRoot(container)
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 10, 200, 100))
})
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
it('opens the connected player from Menu after a third-party profile and keeps Arcade direct', async () => {
  const props = gameShellProps()
  props.socialActions = { friends: vi.fn().mockResolvedValue({ friends: [], requests: [], players: [], summary: {} }), connected: vi.fn().mockResolvedValue({ total: 0, players: [] }), session: vi.fn().mockResolvedValue({}), heartbeat: vi.fn().mockResolvedValue({}), end: vi.fn().mockResolvedValue({}) } as unknown as NonNullable<typeof props.socialActions>
  window.location.hash = '#social'
  await act(async () => root.render(<GameShell {...props} />))
  await act(async () => container.querySelector<HTMLButtonElement>('[data-other-profile]')!.click())
  expect(container.querySelector('[data-profile-player]')?.getAttribute('data-profile-player')).toBe('other-player')
  const openMenu = async () => { await act(async () => container.querySelector<HTMLButtonElement>('[data-menu-trigger]')!.click()) }
  await openMenu()
  expect(container.querySelector('[data-destination-id="activities"]')).toBeNull()
  await act(async () => container.querySelector<HTMLButtonElement>('[data-destination-id="profile"]')!.click())
  expect(container.querySelector('[data-profile-player]')?.getAttribute('data-profile-player')).toBe(props.player.id)
  expect(window.location.hash).toBe('#profile')
  await openMenu()
  await act(async () => container.querySelector<HTMLButtonElement>('.global-menu footer button:last-child')!.click())
  await act(async () => container.querySelector<HTMLButtonElement>('[data-destination-id="arcade"]')!.click())
  expect(window.location.hash).toBe('#activities/arcade')
})
it('launches only via Menu, returns Home, resolves eight anchors and allows replay after completion', async () => {
  const props = gameShellProps()
  let saved: TutorialPreferenceDto = { version: 1, status: 'NOT_STARTED', stepId: null }
  const api = { get: vi.fn(async () => saved), put: vi.fn(async (value: TutorialPreferenceDto) => { saved = value; return value }) }
  await act(async () => root.render(<GameShell {...props} tutorialApi={api} />))
  expect(api.get).not.toHaveBeenCalled()
  const launch = async () => {
    await act(async () => container.querySelector<HTMLButtonElement>('[data-menu-trigger]')!.click())
    await act(async () => Array.from(container.querySelectorAll<HTMLButtonElement>('.global-menu footer button')).at(-1)!.click())
    await act(async () => Array.from(container.querySelectorAll<HTMLButtonElement>('.global-menu footer button')).at(-1)!.click())
    const tile = container.querySelector<HTMLButtonElement>('[data-destination-id="tutorial"]')!; expect(tile.disabled).toBe(false)
    await act(async () => { tile.click(); await new Promise(resolve => setTimeout(resolve, 30)) })
  }
  await launch(); expect(window.location.hash).toBe('#home'); expect(container.querySelector('.home-screen')).not.toBeNull()
  expect(container.querySelector('.global-menu')).toBeNull()
  tutorialSteps.slice(0, 8).forEach(step => expect(container.querySelector(`[data-tutorial-anchor="${step.id}"]`)).not.toBeNull())
  expect(container.querySelectorAll('[data-tutorial-anchor="resources"]')).toHaveLength(2)
  await act(async () => { window.location.hash = '#shop'; window.dispatchEvent(new Event('hashchange')) })
  expect(window.location.hash).toBe('#home'); expect(container.querySelector('.home-screen')).not.toBeNull()
  await act(async () => Array.from(document.querySelectorAll<HTMLButtonElement>('.tutorial-bubble button')).find(el => el.textContent === 'Terminer')!.click())
  expect(saved).toEqual({ version: 1, status: 'COMPLETED', stepId: null }); expect(container.hasAttribute('inert')).toBe(false)
  await launch(); expect(saved).toEqual({ version: 1, status: 'IN_PROGRESS', stepId: 'profile' })
  expect(props.onClaimDailyReward).not.toHaveBeenCalled(); expect(props.onPullGacha).not.toHaveBeenCalled()
})
it('keeps the Menu available with a concrete notice when a business operation is pending', async () => {
  const props = gameShellProps()
  const api = { get: vi.fn(), put: vi.fn() }
  await act(async () => root.render(<GameShell {...props} externalFeedbackPending={true} tutorialApi={api} />))
  await act(async () => container.querySelector<HTMLButtonElement>('[data-menu-trigger]')!.click())
  for (let page = 0; page < 2; page++) await act(async () => Array.from(container.querySelectorAll<HTMLButtonElement>('.global-menu footer button')).at(-1)!.click())
  await act(async () => container.querySelector<HTMLButtonElement>('[data-destination-id="tutorial"]')!.click())
  expect(container.querySelector('.global-menu')).not.toBeNull()
  expect(container.textContent).toContain('Terminez')
  expect(document.querySelector('.tutorial-bubble')).toBeNull()
  expect(api.get).not.toHaveBeenCalled(); expect(api.put).not.toHaveBeenCalled()
})

it('autostarts the real GameShell overlay from a confirmed preference and preserves manual launch', async () => {
  const props = gameShellProps(), preference = { version: 1, status: 'IN_PROGRESS', stepId: 'profile' } as const
  const api = { get: vi.fn(async () => preference), put: vi.fn(async (value: TutorialPreferenceDto) => value), claimAutostart: vi.fn(async () => ({ shouldLaunch: true as const, preference })) }
  await act(async () => root.render(<GameShell {...props} externalFeedbackPending tutorialApi={api} />))
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 130)) })
  expect(api.claimAutostart).not.toHaveBeenCalled()
  await act(async () => root.render(<GameShell {...props} tutorialApi={api} />))
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 180)) })
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 40)) })
  expect(api.claimAutostart).toHaveBeenCalledOnce(); expect(document.querySelector('.tutorial-bubble')).not.toBeNull()
  expect(api.get).not.toHaveBeenCalled(); expect(api.put).not.toHaveBeenCalled()
  await act(async () => Array.from(document.querySelectorAll<HTMLButtonElement>('.tutorial-bubble button')).find(el => el.textContent === 'Pause')!.click())
  expect(document.querySelector('.tutorial-bubble')).toBeNull()
})
