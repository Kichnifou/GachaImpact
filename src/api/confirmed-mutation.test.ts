import { describe, expect, it, vi } from 'vitest'
import { confirmedMutation } from './confirmed-mutation'

describe('Confirmed social mutation', () => {
  it('returns a confirmed result without waiting for Resources and never replays on refresh failure', async () => {
    let reject!: (reason: Error) => void
    const result = { sent: 3, senderReward: '15' }
    const send = vi.fn(async () => result)
    const resources = vi.fn(() => new Promise((_resolve, fail) => { reject = fail }))
    await expect(confirmedMutation(send, resources)).resolves.toBe(result)
    reject(new Error('Resources unavailable'))
    await Promise.resolve(); await Promise.resolve()
    expect(send).toHaveBeenCalledOnce()
    expect(resources).toHaveBeenCalledOnce()
  })
  it('preserves an ambiguous mutation error without attempting secondary reads', async () => {
    const error = new Error('Network interrupted'), resources = vi.fn()
    await expect(confirmedMutation(async () => { throw error }, resources)).rejects.toBe(error)
    expect(resources).not.toHaveBeenCalled()
  })
})
