import { describe, expect, it, vi } from 'vitest'
import { ChatReadCoordinator, chatPollDelay } from './chat-read-coordinator'

describe('chat read pressure', () => {
  it('coalesces concurrent reads, serializes different reads and releases after errors', async () => {
    const reads = new ChatReadCoordinator()
    let finish!: () => void
    const first = vi.fn(() => new Promise<void>(resolve => { finish = resolve }))
    const second = vi.fn(async () => { throw new Error('offline') })
    const a = reads.run('messages', first)
    expect(reads.run('messages', first)).toBe(a)
    const b = reads.run('updates', second)
    const rejected = expect(b).rejects.toThrow('offline')
    await Promise.resolve()
    expect(first).toHaveBeenCalledOnce()
    expect(second).not.toHaveBeenCalled()
    finish(); await a; await rejected
    expect(await reads.run('updates', async () => 42)).toBe(42)
  })

  it('bounds the active cadence, error backoff and slow-server delay with jitter', () => {
    expect(chatPollDelay(true, 0, 0, 0)).toBe(1500)
    expect(chatPollDelay(true, 0, 0, 1)).toBe(2000)
    expect(chatPollDelay(true, 0, 1, 0)).toBe(3000)
    expect(chatPollDelay(true, 0, 3, 0)).toBe(8000)
    expect(chatPollDelay(true, 99, 3, 1)).toBe(15500)
    expect(chatPollDelay(false, 0, 0, 0)).toBe(5000)
  })

  it.each([10, 25, 50])('bounds idle polling requests for %i active clients over one minute', clients => {
    const oldRequests = clients * Math.floor(60_000 / 350)
    const newRequests = Array.from({ length: clients }, (_, i) => Math.floor(60_000 / chatPollDelay(true, 0, 0, i / clients))).reduce((sum, value) => sum + value, 0)
    expect(newRequests).toBeLessThanOrEqual(clients * 40)
    expect(newRequests / oldRequests).toBeLessThan(0.24)
  })
})
