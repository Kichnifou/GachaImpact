import { describe, expect, it, vi } from 'vitest'

import { ApiError } from '../api/game-api'
import { ModerationIntentCoordinator, type ModerationAction } from './moderation-intent-coordinator'

const playerId = 'player-a'
const addPrimos = (amount = '1000'): ModerationAction => ({
  type: 'resource',
  payload: { resourceKey: 'primogems', direction: 'add', amount },
})

function deferred<Value>() {
  let resolve!: (value: Value) => void
  const promise = new Promise<Value>((nextResolve) => { resolve = nextResolve })
  return { promise, resolve }
}

describe('ModerationIntentCoordinator', () => {
  it('reuses the exact key after an ambiguous resource delta and clears it after success', async () => {
    const createKey = vi.fn(() => 'stable-key')
    const coordinator = new ModerationIntentCoordinator(createKey)
    const request = vi.fn()
      .mockRejectedValueOnce(new ApiError('NETWORK_ERROR', 'Réponse perdue', null))
      .mockResolvedValueOnce({ resources: { primogems: '2000' } })

    await expect(coordinator.execute(playerId, addPrimos(), request)).rejects.toMatchObject({ code: 'NETWORK_ERROR' })
    await expect(coordinator.execute(playerId, addPrimos(), request)).resolves.toEqual({ resources: { primogems: '2000' } })

    expect(request.mock.calls).toEqual([['stable-key'], ['stable-key']])
    expect(createKey).toHaveBeenCalledOnce()
    expect(coordinator.getIntent(playerId)).toBeNull()
  })

  it.each([
    { type: 'xp', payload: { totalXp: '88' } } as const,
    { type: 'xp', payload: { prepareNextLevel: true } } as const,
    { type: 'gacha', payload: { pity5: 89, pity4: 9, guaranteedFeatured5: true, captureProgress: 3 } } as const,
    { type: 'stella', payload: { quantity: '10000000000000000' } } as const,
  ])('keeps absolute $type actions stable across an ambiguous retry', async (action) => {
    const coordinator = new ModerationIntentCoordinator(() => 'absolute-key')
    const keys: string[] = []

    await expect(coordinator.execute(playerId, action, async (key) => {
      keys.push(key)
      throw new ApiError('HTTP_503', 'Indisponible', 503)
    })).rejects.toMatchObject({ status: 503 })
    await expect(coordinator.execute(playerId, action, async (key) => { keys.push(key); return 'ok' })).resolves.toBe('ok')

    expect(keys).toEqual(['absolute-key', 'absolute-key'])
  })

  it('blocks a different payload and a different action while the result is uncertain', async () => {
    const createKey = vi.fn(() => 'locked-key')
    const coordinator = new ModerationIntentCoordinator(createKey)
    const request = vi.fn(async () => { throw new ApiError('INTERNAL_ERROR', 'État incertain', 500) })
    await expect(coordinator.execute(playerId, addPrimos(), request)).rejects.toMatchObject({ code: 'INTERNAL_ERROR' })

    await expect(coordinator.execute(playerId, addPrimos('2000'), request)).rejects.toMatchObject({
      code: 'MODERATION_INTENT_CONFLICT',
      message: 'Une opération de test précédente a un résultat incertain. Réessayez la même action pour vérifier son résultat avant d’en lancer une autre.',
    })
    await expect(coordinator.execute(playerId, { type: 'xp', payload: { totalXp: '88' } }, request)).rejects.toMatchObject({ code: 'MODERATION_INTENT_CONFLICT' })

    expect(request).toHaveBeenCalledOnce()
    expect(createKey).toHaveBeenCalledOnce()
  })

  it('clears a deterministic error so the next attempt receives a new key', async () => {
    const keys = ['first-key', 'second-key']
    const coordinator = new ModerationIntentCoordinator(() => keys.shift()!)

    await expect(coordinator.execute(playerId, addPrimos(), async () => {
      throw new ApiError('MODERATION_INSUFFICIENT_RESOURCE', 'Solde insuffisant', 409)
    })).rejects.toMatchObject({ code: 'MODERATION_INSUFFICIENT_RESOURCE' })
    expect(coordinator.getIntent(playerId)).toBeNull()

    const request = vi.fn(async (key: string) => key)
    await expect(coordinator.execute(playerId, addPrimos(), request)).resolves.toBe('second-key')
    expect(request).toHaveBeenCalledWith('second-key')
  })

  it('survives a consumer remount and canonicalizes Gacha fields independently of object order', async () => {
    const coordinator = new ModerationIntentCoordinator(() => 'remount-key')
    const first: ModerationAction = { type: 'gacha', payload: { pity5: 89, pity4: 9, guaranteedFeatured5: false, captureProgress: 2 } }
    const reordered: ModerationAction = { type: 'gacha', payload: { captureProgress: 2, guaranteedFeatured5: false, pity4: 9, pity5: 89 } }

    await expect(coordinator.execute(playerId, first, async () => {
      throw new ApiError('NETWORK_ERROR', 'Hors ligne', null)
    })).rejects.toMatchObject({ code: 'NETWORK_ERROR' })
    expect(coordinator.getIntent(playerId)?.idempotencyKey).toBe('remount-key')

    const remountedConsumer = vi.fn(async (key: string) => key)
    await expect(coordinator.execute(playerId, reordered, remountedConsumer)).resolves.toBe('remount-key')
  })

  it('blocks a second target while an ambiguous target intent remains unresolved and clears on sign-out', async () => {
    const keys = ['player-a-key', 'player-b-key']
    const coordinator = new ModerationIntentCoordinator(() => keys.shift()!)
    await expect(coordinator.execute('player-a', addPrimos(), async () => {
      throw new ApiError('NETWORK_ERROR', 'Hors ligne', null)
    })).rejects.toMatchObject({ code: 'NETWORK_ERROR' })

    await expect(coordinator.execute('player-b', addPrimos(), async (key) => key)).rejects.toMatchObject({ code: 'MODERATION_INTENT_CONFLICT' })
    expect(coordinator.getIntent('player-a')?.idempotencyKey).toBe('player-a-key')
    expect(coordinator.getIntent('player-b')).toBeNull()

    coordinator.clear()
    expect(coordinator.getIntent('player-a')).toBeNull()
  })

  it('keeps a tester-role key for the same retry and blocks a revoke or another target while it is ambiguous', async () => {
    const createKey = vi.fn(() => 'tester-role-key')
    const coordinator = new ModerationIntentCoordinator(createKey)
    const grant: ModerationAction = { type: 'tester-role', payload: { enabled: true } }
    const revoke: ModerationAction = { type: 'tester-role', payload: { enabled: false } }

    await expect(coordinator.execute('alice', grant, async () => {
      throw new ApiError('NETWORK_ERROR', 'Réponse perdue', null)
    })).rejects.toMatchObject({ code: 'NETWORK_ERROR' })

    const retry = vi.fn(async (key: string) => key)
    await expect(coordinator.execute('alice', revoke, retry)).rejects.toMatchObject({ code: 'MODERATION_INTENT_CONFLICT' })
    await expect(coordinator.execute('bob', grant, retry)).rejects.toMatchObject({ code: 'MODERATION_INTENT_CONFLICT' })

    await expect(coordinator.execute('alice', grant, retry)).resolves.toBe('tester-role-key')
    expect(coordinator.getIntent('alice')).toBeNull()
    expect(createKey).toHaveBeenCalledOnce()
  })

  it('releases a tester-role intent after a deterministic error', async () => {
    const keys = ['first-tester-key', 'second-tester-key']
    const coordinator = new ModerationIntentCoordinator(() => keys.shift()!)
    const grant: ModerationAction = { type: 'tester-role', payload: { enabled: true } }

    await expect(coordinator.execute('alice', grant, async () => {
      throw new ApiError('MODERATION_TARGET_NOT_FOUND', 'Introuvable', 404)
    })).rejects.toMatchObject({ code: 'MODERATION_TARGET_NOT_FOUND' })
    await expect(coordinator.execute('alice', grant, async (key) => key)).resolves.toBe('second-tester-key')
  })

  it('allows only one active request per Player', async () => {
    const coordinator = new ModerationIntentCoordinator(() => 'active-key')
    const pending = deferred<string>()
    const request = vi.fn(() => pending.promise)
    const first = coordinator.execute(playerId, addPrimos(), request)

    await expect(coordinator.execute(playerId, addPrimos(), request)).rejects.toMatchObject({ code: 'MODERATION_IN_PROGRESS' })
    expect(request).toHaveBeenCalledOnce()
    pending.resolve('done')
    await expect(first).resolves.toBe('done')
  })
})
