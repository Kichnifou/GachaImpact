// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import type { SharedInvocationApi } from '../api/shared-invocations-types'
import { useSharedInvocationCount } from './use-shared-invocation-count'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
let root: ReturnType<typeof createRoot> | undefined, current: number | null
function View({ api, visible = true, owner = 'first' }: { api: SharedInvocationApi; visible?: boolean; owner?: string }) { current = useSharedInvocationCount(api, visible, owner); return <span>{current}</span> }
afterEach(() => { act(() => root?.unmount()); vi.useRealTimers(); vi.restoreAllMocks(); Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }) })
it('reads only the lightweight counter while visible, with no rapid focus/visibility polling, and hides errors', async () => {
  vi.useFakeTimers(); vi.spyOn(Math, 'random').mockReturnValue(0)
  const api = { availableCount: vi.fn().mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 3 }).mockRejectedValueOnce(Error('offline')), list: vi.fn() } as unknown as SharedInvocationApi
  root = createRoot(document.createElement('div'))
  await act(async () => { root!.render(<View api={api} />); await Promise.resolve() })
  expect(current).toBe(0)
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
  expect(current).toBe(3)
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
  act(() => document.dispatchEvent(new Event('visibilitychange')))
  await act(async () => { await vi.advanceTimersByTimeAsync(120_000) })
  expect(api.availableCount).toHaveBeenCalledTimes(2)
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')); await Promise.resolve() })
  expect(current).toBeNull()
  expect(api.availableCount).toHaveBeenCalledTimes(3)
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')); await Promise.resolve() })
  expect(api.availableCount).toHaveBeenCalledTimes(3)
  act(() => root!.render(<View api={api} visible={false} />))
  await act(async () => { await vi.advanceTimersByTimeAsync(120_000) })
  expect(api.availableCount).toHaveBeenCalledTimes(3)
  expect(api.list).not.toHaveBeenCalled()
})
it('never applies a late count from a prior account or invents an initial/loading value', async () => {
  let resolve!: (value: { count: number }) => void
  const api = { availableCount: vi.fn().mockReturnValueOnce(new Promise(done => { resolve = done })).mockResolvedValue({ count: 1 }) } as unknown as SharedInvocationApi
  root = createRoot(document.createElement('div'))
  await act(async () => { root!.render(<View api={api} />); await Promise.resolve() })
  expect(current).toBeNull()
  await act(async () => { root!.render(<View api={api} owner="second" />); await Promise.resolve() })
  expect(current).toBe(1)
  await act(async () => { resolve({ count: 99 }); await Promise.resolve() })
  expect(current).toBe(1)
})
