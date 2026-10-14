// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import ContestUnavailable from './ContestUnavailable'
import { ApiError } from '../api/game-api'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

it('automatically recovers the first 503 without a click and cleans its timer', async () => {
  vi.useFakeTimers()
  const container = document.createElement('div'), root = createRoot(container)
  const load = vi.fn().mockRejectedValueOnce(new ApiError('CONTEST_TEMPORARILY_UNAVAILABLE', 'Unavailable', 503)).mockResolvedValue({ id: 'authoritative' })
  function Surface() {
    const [result, setResult] = useState<{ id: string } | null>(null)
    const [retry] = useState(() => async () => { const value = await load(); setResult(value); return value })
    return result ? <output>{result.id}</output> : <ContestUnavailable availability={{ phase: 'unavailable', pending: false }} onRetry={retry} />
  }
  try {
    await act(async () => root.render(<Surface />))
    expect(load).toHaveBeenCalledOnce()
    await act(async () => { await vi.advanceTimersByTimeAsync(5_999) })
    expect(load).toHaveBeenCalledOnce()
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(container.textContent).toBe('authoritative')
    expect(load).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
  } finally { act(() => root.unmount()); vi.useRealTimers() }
})

it.each([401, 403])('stops automatic retry on authentication/access failure %s', async status => {
  vi.useFakeTimers()
  const container = document.createElement('div'), root = createRoot(container)
  const retry = vi.fn(async () => { throw new ApiError('ACCESS_DENIED', 'Access denied', status) })
  try {
    await act(async () => root.render(<ContestUnavailable availability={{ phase: 'unavailable', pending: false }} onRetry={retry} />))
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000); window.dispatchEvent(new Event('focus')) })
    expect(retry).toHaveBeenCalledOnce()
    expect(container.textContent).toContain('Reconnectez-vous')
    expect(vi.getTimerCount()).toBe(0)
  } finally { act(() => root.unmount()); vi.useRealTimers() }
})

it('bounds prolonged failure retries and pauses hidden tabs', async () => {
  vi.useFakeTimers()
  const container = document.createElement('div'), root = createRoot(container)
  const retry = vi.fn(async () => { throw new Error('network') })
  try {
    await act(async () => root.render(<ContestUnavailable availability={{ phase: 'unavailable', pending: false }} onRetry={retry} />))
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
    expect(retry).toHaveBeenCalledTimes(5) // t=0,6,18,33,48
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); await vi.advanceTimersByTimeAsync(120_000) })
    expect(retry).toHaveBeenCalledTimes(5)
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus')) })
    expect(retry).toHaveBeenCalledTimes(6)
  } finally { act(() => root.unmount()); Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); vi.useRealTimers() }
})

it('shows a retry after failure, suppresses duplicate pending requests and displays no invented result', async () => {
  const container = document.createElement('div'), root = createRoot(container)
  const retry = vi.fn(async () => { throw new Error('still unavailable') })
  try {
    await act(async () => root.render(<ContestUnavailable availability={{ phase: 'unavailable', pending: false }} onRetry={retry} />))
    expect(container.textContent).toContain('Concours indisponible')
    const button = container.querySelector('button')!
    expect(button.className).toContain('app-button')
    await act(async () => button.click())
    expect(retry).toHaveBeenCalledTimes(2)
    await act(async () => root.render(<ContestUnavailable availability={{ phase: 'unavailable', pending: true }} onRetry={retry} />))
    expect(container.querySelector('button')?.disabled).toBe(true)
    expect(container.textContent).toContain('continuer à jouer')
    expect(container.textContent).not.toContain('Titan')
    expect(container.textContent).not.toContain('Force')
  } finally { act(() => root.unmount()) }
})
