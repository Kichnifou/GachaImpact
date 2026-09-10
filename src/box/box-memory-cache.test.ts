import { describe, expect, it, vi } from 'vitest'
import type { BoxCharacterDto, PlayerBoxDto, StellaUseDto } from '../api/types'
import { BoxMemoryCache } from './box-memory-cache'

const character = (favorite = false): BoxCharacterDto => ({
  id: 'furina', externalKey: 'legacy:20', name: 'Furina', rarity: 5, elementKey: 'hydro', weaponType: 'sword', region: 'fontaine',
  iconPath: '/furina.png', splashPath: null, wishPath: null, fullbodyPath: null,
  constellation: 2, copies: 3, firstObtainedAt: '2026-08-15T10:30:00.000Z', favorite,
})
const box = (favorite = false): PlayerBoxDto => ({
  characters: [character(favorite)],
  summary: { totalOwned: 1, fiveStars: 1, fourStars: 0, c6: 0 },
  preference: { sortKey: 'alphabetical', direction: 'asc' },
  stella: { quantity: '0' },
})

function deferred<Value>() {
  let resolve!: (value: Value) => void
  const promise = new Promise<Value>((nextResolve) => { resolve = nextResolve })
  return { promise, resolve }
}

describe('BoxMemoryCache', () => {
  it('updates a cached Stella quantity for moderation without reloading the Box', () => {
    const cache = new BoxMemoryCache()
    cache.write('player', box())
    cache.setStellaQuantity('player', '42')
    expect(cache.read('player')?.stella.quantity).toBe('42')
  })
  it('starts empty, revalidates through the server loader and caches its response', async () => {
    const cache = new BoxMemoryCache()
    const response = box()
    const load = vi.fn(async () => response)
    expect(cache.read('player-a')).toBeNull()
    await expect(cache.revalidate('player-a', load)).resolves.toBe(response)
    expect(load).toHaveBeenCalledOnce()
    expect(cache.read('player-a')).toBe(response)
  })

  it('never exposes one player cache to another player', () => {
    const cache = new BoxMemoryCache()
    cache.write('player-a', box())
    expect(cache.read('player-b')).toBeNull()
  })

  it('keeps the previous cached Box when a background revalidation fails', async () => {
    const cache = new BoxMemoryCache()
    const previous = box()
    cache.write('player-a', previous)
    await expect(cache.revalidate('player-a', async () => { throw new Error('offline') })).rejects.toThrow('offline')
    expect(cache.read('player-a')).toBe(previous)
  })

  it('updates a confirmed favorite without changing the collection summary', () => {
    const cache = new BoxMemoryCache()
    const previous = box()
    cache.write('player-a', previous)
    cache.replaceCharacter('player-a', character(true))
    expect(cache.read('player-a')?.characters[0]?.favorite).toBe(true)
    expect(cache.read('player-a')?.summary).toBe(previous.summary)
  })

  it('keeps a confirmed favorite in both cache and UI result when an older refresh resolves later', async () => {
    const cache = new BoxMemoryCache()
    const refresh = deferred<PlayerBoxDto>()
    cache.write('player-a', box(false))
    const result = cache.revalidate('player-a', () => refresh.promise)
    cache.replaceCharacter('player-a', character(true))
    refresh.resolve(box(false))
    await expect(result).resolves.toEqual(box(true))
    expect(cache.read('player-a')).toEqual(box(true))
  })

  it('accepts a normal refresh when no confirmed mutation happened concurrently', async () => {
    const cache = new BoxMemoryCache()
    cache.write('player-a', box(false))
    await expect(cache.revalidate('player-a', async () => box(true))).resolves.toEqual(box(true))
    expect(cache.read('player-a')).toEqual(box(true))
  })

  it('accepts a new refresh started after a confirmed mutation', async () => {
    const cache = new BoxMemoryCache()
    cache.write('player-a', box(false))
    cache.replaceCharacter('player-a', character(true))
    await expect(cache.revalidate('player-a', async () => box(false))).resolves.toEqual(box(false))
    expect(cache.read('player-a')).toEqual(box(false))
  })

  it('keeps confirmed sort preferences and Stella results safe from an older refresh', async () => {
    const cache = new BoxMemoryCache()
    const refresh = deferred<PlayerBoxDto>()
    cache.write('player-a', { ...box(), stella: { quantity: '2' } })
    const result = cache.revalidate('player-a', () => refresh.promise)
    cache.replacePreference('player-a', { sortKey: 'element', direction: 'desc' })
    const stella: StellaUseDto = {
      operation: { id: 'operation', alreadyProcessed: false },
      character: { ...character(), copies: 4, constellation: 3 },
      stella: { quantity: '1' },
      c6Progression: null,
    }
    cache.applyStella('player-a', stella)
    refresh.resolve({ ...box(), stella: { quantity: '2' } })
    await expect(result).resolves.toMatchObject({ preference: { sortKey: 'element', direction: 'desc' }, stella: { quantity: '1' } })
    expect(cache.read('player-a')).toMatchObject({ preference: { sortKey: 'element', direction: 'desc' }, stella: { quantity: '1' }, characters: [{ copies: 4, constellation: 3 }] })
  })

  it('applies an authoritative already-processed Stella retry result without duplicating progression', () => {
    const cache = new BoxMemoryCache()
    cache.write('player-a', { ...box(), stella: { quantity: '1' } })
    const retry: StellaUseDto = {
      operation: { id: 'persisted-operation', alreadyProcessed: true },
      character: { ...character(), copies: 7, constellation: 6 },
      stella: { quantity: '0' },
      c6Progression: { type: 'unlocked', stats: { strength: 1, intelligence: 1, beauty: 1, charisma: 1, popularity: 1 } },
    }

    cache.applyStella('player-a', retry)
    cache.applyStella('player-a', retry)
    expect(cache.read('player-a')).toMatchObject({ stella: { quantity: '0' }, summary: { c6: 1 }, characters: [{ copies: 7, constellation: 6 }] })
  })

  it('keeps revisions isolated between players', async () => {
    const cache = new BoxMemoryCache()
    const playerARefresh = deferred<PlayerBoxDto>()
    cache.write('player-a', box(false))
    cache.write('player-b', box(false))
    const playerAResult = cache.revalidate('player-a', () => playerARefresh.promise)
    cache.replaceCharacter('player-b', character(true))
    playerARefresh.resolve(box(true))
    await expect(playerAResult).resolves.toEqual(box(true))
    expect(cache.read('player-a')).toEqual(box(true))
    expect(cache.read('player-b')).toEqual(box(true))
  })

  it('clears all cached possession data on sign-out', () => {
    const cache = new BoxMemoryCache()
    cache.write('player-a', box())
    cache.clear()
    expect(cache.read('player-a')).toBeNull()
  })
})
