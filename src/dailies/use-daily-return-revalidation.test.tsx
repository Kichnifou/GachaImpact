// @vitest-environment happy-dom
import { act, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useDailyRevalidation } from './use-daily-revalidation'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
let root: ReturnType<typeof createRoot>, container: HTMLDivElement
const daily = vi.fn(async () => undefined)
const refresh = vi.fn<() => Promise<unknown>>()
let allowed = true
function Shell({ playerId = 'player' }: { playerId?: string }) {
  useDailyRevalidation(playerId, daily, undefined, { refresh, canRefresh: () => allowed })
  return null
}
const wake = () => { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')) }
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-05T12:00:00Z'))
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  refresh.mockReset().mockResolvedValue(undefined); daily.mockClear(); allowed = true
  container = document.createElement('div'); root = createRoot(container)
})
afterEach(() => { act(() => root.unmount()); vi.restoreAllMocks(); vi.useRealTimers() })

it('coalesces a focus/visibility burst into one whole-Player read rather than an extra daily read', async () => {
  await act(async () => root.render(<Shell />))
  expect(refresh).not.toHaveBeenCalled()
  await act(async () => wake())
  expect(refresh).toHaveBeenCalledOnce(); expect(daily).not.toHaveBeenCalled()
  await act(async () => { await vi.advanceTimersByTimeAsync(800); document.dispatchEvent(new Event('visibilitychange')) })
  expect(refresh).toHaveBeenCalledTimes(2)
})
it('does not read a hidden document even if it receives focus', async () => {
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  await act(async () => root.render(<Shell />))
  await act(async () => wake()); expect(refresh).not.toHaveBeenCalled()
  visibility.mockReturnValue('visible')
  await act(async () => document.dispatchEvent(new Event('visibilitychange')))
  expect(refresh).toHaveBeenCalledOnce()
})
it('queues only one later reread behind an in-flight read without overlap', async () => {
  let finish!: () => void
  refresh.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve }))
  await act(async () => root.render(<Shell />))
  await act(async () => wake())
  await act(async () => { await vi.advanceTimersByTimeAsync(800); wake(); wake(); wake() })
  expect(refresh).toHaveBeenCalledOnce()
  await act(async () => { finish(); await Promise.resolve() })
  await act(async () => vi.advanceTimersByTimeAsync(750))
  expect(refresh).toHaveBeenCalledTimes(2)
  await act(async () => vi.advanceTimersByTimeAsync(3000))
  expect(refresh).toHaveBeenCalledTimes(2)
})
it('defers a returning read until the local Gacha presentation allows it', async () => {
  allowed = false
  await act(async () => root.render(<Shell />))
  await act(async () => wake())
  await act(async () => vi.advanceTimersByTimeAsync(1500))
  expect(refresh).not.toHaveBeenCalled()
  allowed = true
  await act(async () => vi.advanceTimersByTimeAsync(750))
  expect(refresh).toHaveBeenCalledOnce()
})
it('handles a reread failure and permits the next return without replaying anything', async () => {
  refresh.mockRejectedValueOnce(new Error('Read unavailable'))
  await act(async () => root.render(<Shell />))
  await act(async () => wake())
  await act(async () => { await vi.advanceTimersByTimeAsync(800); wake() })
  expect(refresh).toHaveBeenCalledTimes(2); expect(daily).not.toHaveBeenCalled()
})
it('cleans listeners and queued work through StrictMode, owner changes and remounts', async () => {
  await act(async () => root.render(<StrictMode><Shell /></StrictMode>))
  await act(async () => wake()); expect(refresh).toHaveBeenCalledOnce()
  allowed = false
  await act(async () => { await vi.advanceTimersByTimeAsync(800); wake() })
  await act(async () => root.render(null))
  allowed = true
  await act(async () => { wake(); await vi.advanceTimersByTimeAsync(1500) })
  expect(refresh).toHaveBeenCalledOnce()
  await act(async () => root.render(<Shell playerId="other-player" />))
  await act(async () => wake()); expect(refresh).toHaveBeenCalledTimes(2)
})
