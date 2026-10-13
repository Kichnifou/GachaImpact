// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { useDirectMessageDocumentTitle } from './use-direct-message-document-title'
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
function Title({ count, playerId = 'alice' }: { count: number; playerId?: string }) { useDirectMessageDocumentTitle(count, playerId); return null }
const roots: ReturnType<typeof createRoot>[] = []
afterEach(() => { act(() => roots.splice(0).forEach(root => root.unmount())); vi.restoreAllMocks(); vi.useRealTimers(); document.title = 'GachaImpact'; document.body.replaceChildren() })
it('blinks only while hidden, restarts for unread messages and cleans every lifecycle boundary', async () => {
  vi.useFakeTimers()
  let visibility: DocumentVisibilityState = 'visible'
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
  const host = document.createElement('div'); document.body.append(host)
  const root = createRoot(host); roots.push(root)
  const render = async (count: number, playerId = 'alice') => act(async () => root.render(<Title count={count} playerId={playerId} />))
  const change = async (value: DocumentVisibilityState) => act(async () => { visibility = value; document.dispatchEvent(new Event('visibilitychange')) })
  await render(1)
  expect(document.title).toBe('GachaImpact'); expect(vi.getTimerCount()).toBe(0)
  await change('hidden')
  expect(document.title).toBe('Vous avez 1 nouveau message !'); expect(vi.getTimerCount()).toBe(1)
  await act(async () => vi.advanceTimersByTime(1_350)); expect(document.title).toBe('GachaImpact')
  await act(async () => vi.advanceTimersByTime(1_350)); expect(document.title).toBe('Vous avez 1 nouveau message !')
  await change('visible')
  expect(document.title).toBe('GachaImpact'); expect(vi.getTimerCount()).toBe(0)
  await change('hidden'); await change('hidden')
  expect(document.title).toBe('Vous avez 1 nouveau message !'); expect(vi.getTimerCount()).toBe(1)
  await render(3)
  expect(document.title).toBe('Vous avez de nouveaux messages !'); expect(vi.getTimerCount()).toBe(1)
  await render(0)
  expect(document.title).toBe('GachaImpact'); expect(vi.getTimerCount()).toBe(0)
  await render(2, 'bob'); expect(vi.getTimerCount()).toBe(1)
  await render(0, 'carol')
  expect(document.title).toBe('GachaImpact'); expect(vi.getTimerCount()).toBe(0)
  await change('visible'); await render(1)
  expect(document.title).toBe('GachaImpact'); expect(vi.getTimerCount()).toBe(0)
  await change('hidden'); await act(async () => root.unmount()); roots.splice(0)
  expect(document.title).toBe('GachaImpact'); expect(vi.getTimerCount()).toBe(0)
  await change('hidden'); expect(vi.getTimerCount()).toBe(0)
  // A fresh mount (including F5) observes current visibility, with no stale interval.
  const fresh = createRoot(host); roots.push(fresh)
  await act(async () => fresh.render(<Title count={2} />))
  expect(document.title).toBe('Vous avez de nouveaux messages !'); expect(vi.getTimerCount()).toBe(1)
  await change('visible')
  expect(document.title).toBe('GachaImpact'); expect(vi.getTimerCount()).toBe(0)
})
it('keeps a conservative normal title without a visibility signal', async () => {
  vi.useFakeTimers()
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(undefined as never)
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
  const host = document.createElement('div'); document.body.append(host)
  const root = createRoot(host); roots.push(root)
  await act(async () => root.render(<Title count={5} />))
  expect(document.title).toBe('GachaImpact'); expect(vi.getTimerCount()).toBe(0)
})
