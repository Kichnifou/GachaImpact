import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/game-api'
import { StellaIntentCoordinator } from './stella-intent-coordinator'

function deferred<Value>() {
  let resolve!: (value: Value) => void
  const promise = new Promise<Value>((nextResolve) => { resolve = nextResolve })
  return { promise, resolve }
}

describe('StellaIntentCoordinator', () => {
  it('creates one key for a normal success and releases the intention', async () => {
    const createKey = vi.fn(() => 'key-1')
    const coordinator = new StellaIntentCoordinator(createKey)
    const request = vi.fn(async (key: string) => ({ key, operation: { alreadyProcessed: false } }))

    await expect(coordinator.execute('player-a', 'furina', request)).resolves.toMatchObject({ key: 'key-1' })
    expect(createKey).toHaveBeenCalledOnce()
    expect(request).toHaveBeenCalledWith('key-1')
    expect(coordinator.getIntent('player-a')).toBeNull()
  })

  it.each([
    new ApiError('NETWORK_ERROR', 'offline', null),
    new ApiError('INTERNAL_ERROR', 'unknown', 500),
    new ApiError('HTTP_503', 'unavailable', 503),
  ])('retries an ambiguous outcome with the exact same key: $code', async (error) => {
    const createKey = vi.fn(() => 'stable-key')
    const coordinator = new StellaIntentCoordinator(createKey)
    const keys: string[] = []

    await expect(coordinator.execute('player-a', 'furina', async (key) => { keys.push(key); throw error })).rejects.toBe(error)
    await expect(coordinator.execute('player-a', 'furina', async (key) => { keys.push(key); return { operation: { alreadyProcessed: true } } })).resolves.toMatchObject({ operation: { alreadyProcessed: true } })

    expect(keys).toEqual(['stable-key', 'stable-key'])
    expect(createKey).toHaveBeenCalledOnce()
    expect(coordinator.getIntent('player-a')).toBeNull()
  })

  it('releases a definitive business error so a later attempt gets a new key', async () => {
    const createKey = vi.fn().mockReturnValueOnce('first-key').mockReturnValueOnce('second-key')
    const coordinator = new StellaIntentCoordinator(createKey)
    const definitive = new ApiError('STELLA_UNAVAILABLE', 'none left', 409)

    await expect(coordinator.execute('player-a', 'furina', async () => { throw definitive })).rejects.toBe(definitive)
    expect(coordinator.getIntent('player-a')).toBeNull()
    await expect(coordinator.execute('player-a', 'furina', async (key) => key)).resolves.toBe('second-key')
    expect(createKey).toHaveBeenCalledTimes(2)
  })

  it('keeps an ambiguous intention available after the original Box caller disappears', async () => {
    const coordinator = new StellaIntentCoordinator(() => 'navigation-key')
    await expect(coordinator.execute('player-a', 'furina', async () => { throw new ApiError('NETWORK_ERROR', 'offline', null) })).rejects.toMatchObject({ code: 'NETWORK_ERROR' })

    const intentSeenAfterRemount = coordinator.getIntent('player-a')
    expect(intentSeenAfterRemount).toEqual({ characterId: 'furina', key: 'navigation-key' })
    await expect(coordinator.execute('player-a', 'furina', async (key) => key)).resolves.toBe('navigation-key')
  })

  it('strictly isolates intentions and active requests by Player', async () => {
    const createKey = vi.fn().mockReturnValueOnce('player-a-key').mockReturnValueOnce('player-b-key')
    const coordinator = new StellaIntentCoordinator(createKey)
    await expect(coordinator.execute('player-a', 'furina', async () => { throw new ApiError('NETWORK_ERROR', 'offline', null) })).rejects.toMatchObject({ code: 'NETWORK_ERROR' })

    await expect(coordinator.execute('player-b', 'furina', async (key) => key)).resolves.toBe('player-b-key')
    expect(coordinator.getIntent('player-a')?.key).toBe('player-a-key')
    expect(coordinator.getIntent('player-b')).toBeNull()
  })

  it('blocks a different character while an ambiguous intention must be resolved', async () => {
    const coordinator = new StellaIntentCoordinator(() => 'locked-key')
    await expect(coordinator.execute('player-a', 'furina', async () => { throw new ApiError('NETWORK_ERROR', 'offline', null) })).rejects.toMatchObject({ code: 'NETWORK_ERROR' })
    await expect(coordinator.execute('player-a', 'keqing', async () => 'unused')).rejects.toMatchObject({ code: 'STELLA_INTENT_CONFLICT' })
    expect(coordinator.getIntent('player-a')).toEqual({ characterId: 'furina', key: 'locked-key' })
  })

  it('allows only one active submit for a Player', async () => {
    const coordinator = new StellaIntentCoordinator(() => 'single-key')
    const pending = deferred<string>()
    const request = vi.fn(() => pending.promise)
    const first = coordinator.execute('player-a', 'furina', request)

    await expect(coordinator.execute('player-a', 'furina', request)).rejects.toMatchObject({ code: 'STELLA_IN_PROGRESS' })
    expect(request).toHaveBeenCalledOnce()
    pending.resolve('done')
    await expect(first).resolves.toBe('done')
  })
})
