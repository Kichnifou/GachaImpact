// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import AppearancePanel from '../screens/AppearancePanel'
import HistoryScreen from '../screens/HistoryScreen'
import { TutorialPresentationContext } from './tutorial-presentation'
import { getTutorialStep } from './tutorial-catalog'
import type { SocialActions } from '../social/types'
import { useSharedInvocations } from '../gacha/use-shared-invocations'
import type { SharedInvocationApi } from '../api/shared-invocations-types'
import type { SharedInvocationController } from '../gacha/use-shared-invocations'
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

it('presents real badges without equipping/consulting and restores the normal appearance tab', async () => {
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container)
  const appearance = { avatar: { kind: 'ELEMENT', assetPath: null }, title: null, equippedAvatarCosmeticId: null, equippedTitleCosmeticId: null, equippedBadgeCosmeticId: null, catalog: [{ id: 'badge', type: 'BADGE', displayName: '★', visibility: 'VISIBLE', owned: true, isActive: true, isNew: true }] }
  const actions = { appearance: vi.fn(async () => appearance), equipAppearance: vi.fn(), consultAppearance: vi.fn() }
  const render = (active: boolean) => act(async () => root.render(<TutorialPresentationContext value={{ active, step: active ? getTutorialStep('profile-badges') : null }}><AppearancePanel actions={actions as unknown as SocialActions} displayName="Test" elementKey="hydro" onChanged={vi.fn()} /></TutorialPresentationContext>))
  try {
    await render(true)
    expect(container.querySelector('[data-appearance-tab]')?.getAttribute('data-appearance-tab')).toBe('BADGE')
    expect(container.textContent).toContain('★')
    await act(async () => Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Équiper')!.click())
    expect(actions.equipAppearance).not.toHaveBeenCalled(); expect(actions.consultAppearance).not.toHaveBeenCalled()
    await render(false); expect(container.querySelector('[data-appearance-tab]')?.getAttribute('data-appearance-tab')).toBe('AVATAR')
  } finally { act(() => root.unmount()); container.remove() }
})

it('presents the true activity category, preserves empty/error states and restores the selected category', async () => {
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container)
  const onActivity = vi.fn(async () => ({ category: 'activity' as const, today: '2026-10-14', coverageStartedAt: null, entries: [], page: 1, totalPages: 1, total: 0, pageSize: 10 }))
  const normal = vi.fn(async () => ({ results: [], page: 1, totalPages: 1, totalResults: 0, pageSize: 10 as const, hasPrevious: false, hasNext: false }))
  const render = (active: boolean) => act(async () => root.render(<TutorialPresentationContext value={{ active, step: active ? getTutorialStep('history-activity') : null }}><HistoryScreen onActivity={onActivity} onInvocations={normal} onBank={normal as never} onShop={normal as never} onBannersOrEvent={normal as never} /></TutorialPresentationContext>))
  try {
    await render(true); expect(onActivity).toHaveBeenCalledWith(1); expect(normal).not.toHaveBeenCalled()
    expect(container.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('Activité')
    normal.mockRejectedValueOnce(new Error('Previous category failed'))
    await render(false); expect(container.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('Invocations')
    expect(container.querySelector('[role="alert"]')).not.toBeNull()
    await render(true); expect(container.querySelector('[role="alert"]')).toBeNull()
    expect(container.textContent).toContain('Liste des joueurs actifs par jour.')
    await render(false)
    onActivity.mockRejectedValueOnce(new Error('Unavailable')); await render(true); expect(container.querySelector('[role="alert"]')).not.toBeNull()
  } finally { act(() => root.unmount()); container.remove() }
})

it('does not emit shared-session presence or reads while presentation is active', async () => {
  vi.useFakeTimers()
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container)
  const transport = { state: vi.fn(async () => ({ broadcasting: null, watching: null })), control: vi.fn() } as unknown as SharedInvocationApi
  function Harness() { useSharedInvocations(transport, true, undefined, 'test', true); return null }
  try {
    await act(async () => root.render(<Harness />)); await act(async () => vi.advanceTimersByTimeAsync(31_000))
    expect(transport.state).not.toHaveBeenCalled(); expect(transport.control).not.toHaveBeenCalled()
  } finally { act(() => root.unmount()); container.remove(); vi.useRealTimers() }
})

it('suspends existing shared owner/viewer presence and explicit mutations during the visit', async () => {
  vi.useFakeTimers()
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container)
  const own = { id: 'own', seq: 1, authoritative: true }, watching = { id: 'watched', seq: 1 }
  const state = { broadcasting: own, watching, watchingToken: 'private-fixture' }
  const transport = { state: vi.fn(async () => state), control: vi.fn(async () => state), viewerPresence: vi.fn(async () => ({})), start: vi.fn(), watch: vi.fn(), react: vi.fn() } as unknown as SharedInvocationApi
  let shared!: SharedInvocationController
  function Harness({ active }: { active: boolean }) { shared = useSharedInvocations(transport, !active, undefined, 'test', active); return null }
  try {
    await act(async () => root.render(<Harness active={false} />)); await act(async () => vi.advanceTimersByTimeAsync(100))
    expect(transport.state).toHaveBeenCalled()
    await act(async () => root.render(<Harness active />))
    vi.mocked(transport.control).mockClear(); vi.mocked(transport.viewerPresence!).mockClear(); vi.mocked(transport.state).mockClear()
    await act(async () => { await shared.start(); await shared.watch('another'); await shared.react('❤️'); await vi.advanceTimersByTimeAsync(31_000) })
    expect(transport.state).not.toHaveBeenCalled(); expect(transport.control).not.toHaveBeenCalled(); expect(transport.viewerPresence).not.toHaveBeenCalled()
    expect(transport.start).not.toHaveBeenCalled(); expect(transport.watch).not.toHaveBeenCalled(); expect(transport.react).not.toHaveBeenCalled()
  } finally { act(() => root.unmount()); container.remove(); vi.useRealTimers() }
})
