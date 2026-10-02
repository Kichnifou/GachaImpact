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
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
let root: Root, container: HTMLDivElement
beforeEach(() => {
  window.location.hash = '#inventory'; container = document.createElement('div'); container.id = 'root'; document.body.append(container); root = createRoot(container)
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 10, 200, 100))
})
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
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
    await act(async () => tile.click())
  }
  await launch(); expect(window.location.hash).toBe('#home'); expect(container.querySelector('.home-screen')).not.toBeNull()
  expect(container.querySelector('.global-menu')).toBeNull()
  tutorialSteps.forEach(step => expect(container.querySelector(`[data-tutorial-anchor="${step.id}"]`)).not.toBeNull())
  expect(container.querySelectorAll('[data-tutorial-anchor="resources"]')).toHaveLength(2)
  await act(async () => { window.location.hash = '#shop'; window.dispatchEvent(new Event('hashchange')) })
  expect(window.location.hash).toBe('#home'); expect(container.querySelector('.home-screen')).not.toBeNull()
  await act(async () => Array.from(document.querySelectorAll<HTMLButtonElement>('.tutorial-bubble button')).find(el => el.textContent === 'Terminer')!.click())
  expect(saved).toEqual({ version: 1, status: 'COMPLETED', stepId: null }); expect(container.hasAttribute('inert')).toBe(false)
  await launch(); expect(saved).toEqual({ version: 1, status: 'IN_PROGRESS', stepId: 'profile' })
  expect(props.onClaimDailyReward).not.toHaveBeenCalled(); expect(props.onPullGacha).not.toHaveBeenCalled()
})
