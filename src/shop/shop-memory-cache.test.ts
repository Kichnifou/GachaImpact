import { describe, expect, it } from 'vitest'
import type { PlayerShopDto, ShopPurchaseDto } from '../api/types'
import { ShopMemoryCache } from './shop-memory-cache'

const state = (moras: string): PlayerShopDto => ({ resources: { primogems: '0', moras, particles: { pyro: '0', hydro: '0', cryo: '0', electro: '0', anemo: '0', geo: '0', dendro: '0' } }, gachaState: { pity5: 0, pity4: 0, guaranteedFeatured5: false, captureProgress: 0, fiftyFiftyLostStreak: 0, selectedBannerCharacterId: null, totalPulls: '0', totalFiveStars: '0', totalFourStars: '0', fiftyFiftyWon: '0', fiftyFiftyLost: '0', capturesTriggered: '0' }, items: [], recentPurchases: [] })

describe('ShopMemoryCache', () => {
  it('isolates players and rejects stale revalidation after a confirmed purchase', async () => { const cache = new ShopMemoryCache(); let release!: (value: PlayerShopDto) => void; const pending = cache.revalidate('a', () => new Promise((resolve) => { release = resolve })); const confirmed = { ...state('10'), purchase: {} } as unknown as ShopPurchaseDto; cache.writeConfirmed('a', confirmed); cache.writeConfirmed('b', { ...confirmed, ...state('20') }); release(state('99')); await pending; expect(cache.read('a')?.resources.moras).toBe('10'); expect(cache.read('b')?.resources.moras).toBe('20') });
  it('clears every player on logout', () => { const cache = new ShopMemoryCache(); cache.writeConfirmed('a', { ...state('1'), purchase: {} } as ShopPurchaseDto); cache.clear(); expect(cache.read('a')).toBeNull() });
})
