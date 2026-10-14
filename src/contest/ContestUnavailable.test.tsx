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
    expect(container.textContent).toContain(status === 401 ? 'Reconnectez-vous' : 'refusé')
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

it('keeps initial transient failure neutral and accessible without invented gameplay', async () => {
  const container = document.createElement('div'), root = createRoot(container)
  const retry = vi.fn(async () => { throw new ApiError('TEMPORARY', 'temporary', 503) })
  try {
    await act(async () => root.render(<ContestUnavailable availability={{ phase: 'unavailable', pending: false }} onRetry={retry} />))
    expect(container.querySelector('.unavailable-shell')).toBeNull()
    expect(container.textContent).not.toContain('Concours indisponible')
    expect(container.querySelector('button')).toBeNull()
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(container.querySelector('.contest-participant')).toBeNull()
  } finally { act(() => root.unmount()) }
})

it.each([500, 503, null])('silently retries repeated %s failures then publishes the real result', async status => {
  vi.useFakeTimers()
  const container = document.createElement('div'), root = createRoot(container)
  const load = vi.fn().mockRejectedValueOnce(new ApiError('READ_ERROR', 'read failed', status)).mockRejectedValueOnce(new ApiError('READ_ERROR', 'read failed', status)).mockResolvedValue('real-result')
  function Surface() {
    const [result, setResult] = useState<string | null>(null)
    const [refresh] = useState(() => async () => { const value = await load(); setResult(value); return value })
    return result ? <output>{result}</output> : <ContestUnavailable availability={{ phase: 'unavailable', pending: false }} onRetry={refresh} />
  }
  try {
    await act(async () => root.render(<Surface />))
    await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
    expect(container.querySelector('.contest-connection-status')).toBeNull()
    expect(container.querySelector('button')).toBeNull()
    await act(async () => { await vi.advanceTimersByTimeAsync(12000) })
    expect(container.textContent).toBe('real-result')
    expect(load).toHaveBeenCalledTimes(3)
  } finally { act(() => root.unmount()); vi.useRealTimers() }
})

it('keeps a slow read owned, exposes only a compact persistent notice and recovers', async () => {
  vi.useFakeTimers()
  const container = document.createElement('div'), root = createRoot(container)
  let resolve!: () => void
  const retry = vi.fn(() => new Promise<void>(done => { resolve = done }))
  try {
    await act(async () => root.render(<ContestUnavailable availability={{ phase: 'unavailable', pending: true }} onRetry={retry} />))
    await act(async () => { await vi.advanceTimersByTimeAsync(59000); window.dispatchEvent(new Event('focus')) })
    expect(container.querySelector('.contest-connection-status')).toBeNull()
    expect(retry).toHaveBeenCalledOnce()
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(container.querySelector('.contest-connection-status')).not.toBeNull()
    expect(container.querySelector('button')?.disabled).toBe(true)
    await act(async () => resolve())
  } finally { act(() => root.unmount()); vi.useRealTimers() }
})

it('revalidates immediately on reconnect without waiting for the backoff', async () => {
  const container = document.createElement('div'), root = createRoot(container)
  const retry = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue(undefined)
  try {
    await act(async () => root.render(<ContestUnavailable availability={{ phase: 'unavailable', pending: false }} onRetry={retry} />))
    await act(async () => window.dispatchEvent(new Event('online')))
    expect(retry).toHaveBeenCalledTimes(2)
  } finally { act(() => root.unmount()) }
})
