import { describe, expect, it, vi } from 'vitest'
import type { BoxCharacterDto, PlayerBoxDto } from '../api/types'
import { BoxMemoryCache } from './box-memory-cache'

const character = (favorite = false): BoxCharacterDto => ({
  id: 'furina', externalKey: 'legacy:20', name: 'Furina', rarity: 5, elementKey: 'hydro', weaponType: 'sword', region: 'fontaine',
  iconPath: '/furina.png', splashPath: null, wishPath: null, fullbodyPath: null,
  constellation: 2, copies: 3, firstObtainedAt: '2026-08-15T10:30:00.000Z', favorite,
})
const box = (favorite = false): PlayerBoxDto => ({
  characters: [character(favorite)],
  summary: { totalOwned: 1, fiveStars: 1, fourStars: 0, c6: 0 },
})

describe('BoxMemoryCache', () => {
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

  it('clears all cached possession data on sign-out', () => {
    const cache = new BoxMemoryCache()
    cache.write('player-a', box())
    cache.clear()
    expect(cache.read('player-a')).toBeNull()
  })
})
