import { describe, expect, it } from 'vitest'
import { BannerVoteCache } from './banner-vote-cache'
import type { BannerVoteDto } from '../api/types'

const snapshot: BannerVoteDto = { bannerRotationId: 'rotation', startsAt: '', endsAt: '', canVote: true, ownVote: null, catalogVersion: '1', candidates: [] }
describe('Player session vote cache', () => {
  it('retains a confirmed snapshot on navigation and failed revalidation, isolates Players', async () => {
    const cache = new BannerVoteCache()
    await cache.revalidate(async () => snapshot)
    expect(cache.value).toBe(snapshot)
    await expect(cache.revalidate(async () => { throw Error('offline') })).rejects.toThrow()
    expect(cache.value).toBe(snapshot)
    expect(new BannerVoteCache().value).toBeNull()
  })
  it('does not overwrite a vote with an older read or repopulate after logout', async () => {
    const cache = new BannerVoteCache()
    let resolve!: (value: BannerVoteDto) => void
    const read = cache.revalidate(() => new Promise(r => { resolve = r }))
    const voted = { ...snapshot, canVote: false }
    await cache.vote(async () => voted)
    resolve(snapshot); await read
    expect(cache.value).toBe(voted)
    const pending = cache.vote(() => new Promise(r => { resolve = r }))
    cache.clear(); resolve(voted); await pending
    expect(cache.value).toBeNull()
  })
})
