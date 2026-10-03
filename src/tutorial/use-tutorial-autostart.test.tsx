// @vitest-environment happy-dom
import { act, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { TutorialAutostartDto } from '../api/types'
import { TutorialController, type TutorialApi } from './tutorial-controller'
import { useTutorialAutostart } from './use-tutorial-autostart'
let root: Root, node: HTMLDivElement
beforeEach(() => { vi.useFakeTimers(); node = document.createElement('div'); document.body.append(node); root = createRoot(node) })
afterEach(() => { act(() => root.unmount()); document.body.replaceChildren(); vi.useRealTimers(); vi.restoreAllMocks() })
const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(150) })
function Surface({ id = 'A', busy = false, eligible = true, api, controller }: { id?: string; busy?: boolean; eligible?: boolean; api: TutorialApi; controller: TutorialController }) {
  useTutorialAutostart(id, eligible, api, controller, busy, () => undefined)
  return null
}
it('waits for the shared business and DOM gate, claims once under StrictMode, and never repeats after Pause/Finish', async () => {
  let claimed = false
  const preference = { version: 1, status: 'IN_PROGRESS', stepId: 'profile' } as const
  const api: TutorialApi = { get: vi.fn(async () => preference), put: vi.fn(async value => value), claimAutostart: vi.fn(async () => { if (claimed) return { shouldLaunch: false as const }; claimed = true; return { shouldLaunch: true as const, preference } }) }
  const controller = new TutorialController(api)
  const render = (busy: boolean) => act(async () => root.render(<StrictMode><Surface busy={busy} api={api} controller={controller} /></StrictMode>))
  await render(true); await flush(); expect(api.claimAutostart).not.toHaveBeenCalled()
  const blocker = document.createElement('div'); blocker.dataset.businessPending = 'true'; document.body.append(blocker)
  await render(false); await flush(); expect(api.claimAutostart).not.toHaveBeenCalled()
  blocker.remove(); await flush()
  expect(api.claimAutostart).toHaveBeenCalledOnce(); expect(controller.getSnapshot().active).toBe(true)
  expect(api.get).not.toHaveBeenCalled(); expect(api.put).not.toHaveBeenCalled()
  controller.pause(); await flush(); expect(api.claimAutostart).toHaveBeenCalledOnce()
  await controller.launch(); await controller.finish(); await flush(); expect(api.claimAutostart).toHaveBeenCalledOnce()
  await act(async () => root.render(null)); await act(async () => root.render(<Surface api={api} controller={new TutorialController(api)} />)); await flush()
  expect(api.claimAutostart).toHaveBeenCalledTimes(2); expect(claimed).toBe(true)
})
it('does not claim before element selection and ignores a late confirmed claim after switching Player', async () => {
  let resolve!: (value: TutorialAutostartDto) => void
  const api: TutorialApi = { get: vi.fn(), put: vi.fn(), claimAutostart: vi.fn(() => new Promise<TutorialAutostartDto>(done => { resolve = done })) }
  const first = new TutorialController(api), secondApi: TutorialApi = { get: vi.fn(), put: vi.fn(), claimAutostart: vi.fn(async () => ({ shouldLaunch: false as const })) }, second = new TutorialController(secondApi)
  await act(async () => root.render(<Surface eligible={false} api={api} controller={first} />)); await flush(); expect(api.claimAutostart).not.toHaveBeenCalled()
  await act(async () => root.render(<Surface api={api} controller={first} />)); await flush()
  await act(async () => root.render(<Surface id="B" api={secondApi} controller={second} />)); await flush()
  await act(async () => resolve({ shouldLaunch: true, preference: { version: 1, status: 'IN_PROGRESS', stepId: 'profile' } })); await flush()
  expect(first.getSnapshot().active).toBe(false); expect(second.getSnapshot().active).toBe(false)
})
