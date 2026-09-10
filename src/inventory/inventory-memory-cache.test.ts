import { describe, expect, it } from 'vitest'
import type { PlayerInventoryDto, StellaUseDto } from '../api/types'
import { InventoryMemoryCache } from './inventory-memory-cache'

const inventory = (quantity = '2'): PlayerInventoryDto => ({
  resources: [],
  items: [{ id: 'stella', externalKey: 'masterless-stella-fortuna', displayName: 'Masterless Stella Fortuna', category: 'SPECIAL', section: 'objects', description: null, quantity, firstObtainedAt: null, acquisitionHint: null }],
})
const stellaResult: StellaUseDto = {
  operation: { id: 'operation', alreadyProcessed: false },
  character: { id: 'furina', externalKey: 'furina', name: 'Furina', rarity: 5, elementKey: 'hydro', weaponType: null, region: null, iconPath: null, splashPath: null, wishPath: null, fullbodyPath: null, constellation: 2, copies: 3, firstObtainedAt: '2026-09-09T00:00:00Z', favorite: false },
  stella: { quantity: '1' },
  c6Progression: null,
}

function deferred<Value>() {
  let resolve!: (value: Value) => void
  const promise = new Promise<Value>((next) => { resolve = next })
  return { promise, resolve }
}

describe('InventoryMemoryCache', () => {
  it('updates cached Stella quantity immediately for moderation', async () => {
    const cache = new InventoryMemoryCache()
    await cache.revalidate('player', async () => inventory())
    cache.setStellaQuantity('player', '42')
    expect(cache.read('player')?.items.find(({ externalKey }) => externalKey === 'masterless-stella-fortuna')?.quantity).toBe('42')
  })
  it('caches per player and clears every personal snapshot on sign-out', async () => {
    const cache = new InventoryMemoryCache()
    await cache.revalidate('player-a', async () => inventory())
    expect(cache.read('player-a')).toEqual(inventory())
    expect(cache.read('player-b')).toBeNull()
    cache.clear()
    expect(cache.read('player-a')).toBeNull()
  })

  it('keeps a confirmed Stella balance safe from an older revalidation', async () => {
    const cache = new InventoryMemoryCache()
    await cache.revalidate('player-a', async () => inventory('2'))
    const stale = deferred<PlayerInventoryDto>()
    const refresh = cache.revalidate('player-a', () => stale.promise)
    cache.applyStella('player-a', stellaResult)
    stale.resolve(inventory('2'))
    await expect(refresh).resolves.toEqual(inventory('1'))
    expect(cache.read('player-a')).toEqual(inventory('1'))
  })

  it('ignores a refresh that resolves after the cache lifecycle was cleared', async () => {
    const cache = new InventoryMemoryCache()
    const stale = deferred<PlayerInventoryDto>()
    const refresh = cache.revalidate('player-a', () => stale.promise)
    cache.clear()
    stale.resolve(inventory())
    await refresh
    expect(cache.read('player-a')).toBeNull()
  })
})
