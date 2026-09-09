import { describe, expect, it, vi } from 'vitest'

import type { BankTransferDto, PlayerBankDto } from '../api/types'
import { BankMemoryCache } from './bank-memory-cache'

const bank = (walletMoras = '1000'): PlayerBankDto => ({
  walletMoras, bankMoras: '500', totalWealth: '1500', estimatedInterest: '15', interestRatePercent: 3,
  nextInterestAt: '2026-09-10T22:00:00.000Z', recentOperations: [],
})

const transfer = (walletMoras: string): BankTransferDto => ({ ...bank(walletMoras), operation: { id: `operation-${walletMoras}`, alreadyProcessed: false } })

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((next) => { resolve = next })
  return { promise, resolve }
}

describe('BankMemoryCache', () => {
  it('starts empty and stores an authoritative background refresh per player', async () => {
    const cache = new BankMemoryCache()
    const load = vi.fn(async () => bank())
    expect(cache.read('player-a')).toBeNull()
    await expect(cache.revalidate('player-a', load)).resolves.toEqual(bank())
    expect(cache.read('player-a')).toEqual(bank())
    expect(cache.read('player-b')).toBeNull()
  })

  it('never lets a stale refresh overwrite a confirmed transfer', async () => {
    const cache = new BankMemoryCache()
    const refresh = deferred<PlayerBankDto>()
    await cache.revalidate('player-a', async () => bank('1000'))
    const pending = cache.revalidate('player-a', () => refresh.promise)
    cache.writeConfirmed('player-a', transfer('750'))
    refresh.resolve(bank('1000'))
    await expect(pending).resolves.toMatchObject({ walletMoras: '750' })
    expect(cache.read('player-a')).toMatchObject({ walletMoras: '750' })
  })

  it('clears all personal snapshots on sign-out', async () => {
    const cache = new BankMemoryCache()
    await cache.revalidate('player-a', async () => bank())
    cache.clear()
    expect(cache.read('player-a')).toBeNull()
  })
})
