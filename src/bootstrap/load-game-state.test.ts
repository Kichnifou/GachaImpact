import { describe, expect, it, vi } from 'vitest'

import { ApiError } from '../api/game-api'
import { loadBootstrapGameState, retryBootstrapRead, type BootstrapReaders } from './load-game-state'

const independentKeys = ['resources', 'progression', 'wheel', 'dailyReward', 'gacha', 'catalog', 'permissions'] as const
const playerLockKeys = ['notifications', 'expedition', 'teams', 'event'] as const
const independentReconciliationKeys = ['dailyChallenge', 'dailyCombat', 'monthlyBoss', 'contest'] as const

function readersWithConcurrencyTrace() {
  const started: string[] = []
  const finished: string[] = []
  let independentActive = 0
  let independentMaximum = 0
  let reconcilingActive = 0
  let reconcilingMaximum = 0
  let playerLockActive = 0
  let playerLockMaximum = 0
  let independentReconciliationActive = 0
  let independentReconciliationMaximum = 0

  const independent = (key: string) => vi.fn(async () => {
    started.push(key)
    independentActive += 1
    independentMaximum = Math.max(independentMaximum, independentActive)
    await Promise.resolve()
    independentActive -= 1
    finished.push(key)
    return key as never
  })
  const reconciling = (key: string) => vi.fn(async () => {
    started.push(key)
    reconcilingActive += 1
    reconcilingMaximum = Math.max(reconcilingMaximum, reconcilingActive)
    if (playerLockKeys.includes(key as typeof playerLockKeys[number])) {
      playerLockActive += 1
      playerLockMaximum = Math.max(playerLockMaximum, playerLockActive)
    } else {
      independentReconciliationActive += 1
      independentReconciliationMaximum = Math.max(independentReconciliationMaximum, independentReconciliationActive)
    }
    await Promise.resolve()
    if (playerLockKeys.includes(key as typeof playerLockKeys[number])) playerLockActive -= 1
    else independentReconciliationActive -= 1
    reconcilingActive -= 1
    finished.push(key)
    return key as never
  })

  const readers = {
    resources: independent('resources'),
    progression: independent('progression'),
    wheel: independent('wheel'),
    dailyReward: independent('dailyReward'),
    gacha: independent('gacha'),
    catalog: independent('catalog'),
    permissions: independent('permissions'),
    notifications: reconciling('notifications'),
    expedition: reconciling('expedition'),
    teams: reconciling('teams'),
    dailyChallenge: reconciling('dailyChallenge'),
    dailyCombat: reconciling('dailyCombat'),
    monthlyBoss: reconciling('monthlyBoss'),
    contest: reconciling('contest'),
    event: reconciling('event'),
  } satisfies BootstrapReaders

  return {
    readers,
    started,
    finished,
    independentMaximum: () => independentMaximum,
    reconcilingMaximum: () => reconcilingMaximum,
    playerLockMaximum: () => playerLockMaximum,
    independentReconciliationMaximum: () => independentReconciliationMaximum,
  }
}

describe('bootstrap game state loading', () => {
  it('keeps safe reads parallel, serializes the Player-lock lane and returns every required state', async () => {
    const trace = readersWithConcurrencyTrace()
    const state = await loadBootstrapGameState(trace.readers)

    expect(trace.independentMaximum()).toBe(independentKeys.length)
    expect(trace.reconcilingMaximum()).toBe(5)
    expect(trace.playerLockMaximum()).toBe(1)
    expect(trace.independentReconciliationMaximum()).toBe(independentReconciliationKeys.length)
    expect(trace.started.filter((key) => independentKeys.includes(key as typeof independentKeys[number]))).toHaveLength(independentKeys.length)
    expect(trace.started.filter((key) => playerLockKeys.includes(key as typeof playerLockKeys[number]))).toEqual(playerLockKeys)
    expect(trace.started.filter((key) => independentReconciliationKeys.includes(key as typeof independentReconciliationKeys[number]))).toEqual(independentReconciliationKeys)
    expect(trace.finished.indexOf('notifications')).toBeLessThan(trace.started.indexOf('expedition'))
    expect(Object.fromEntries(Object.entries(state).map(([key, value]) => [key, value]))).toEqual({
      resources: 'resources', progression: 'progression', wheel: 'wheel', dailyReward: 'dailyReward',
      gacha: 'gacha', catalog: 'catalog', permissions: 'permissions', notifications: 'notifications',
      expedition: 'expedition', teams: 'teams', dailyChallenge: 'dailyChallenge', dailyCombat: 'dailyCombat',
      monthlyBoss: 'monthlyBoss', contest: 'contest', event: 'event',
    })
    for (const reader of Object.values(trace.readers)) expect(reader).toHaveBeenCalledTimes(1)
  })

  it('reuses the Expedition projection returned by Notifications without a second GET', async () => {
    const trace = readersWithConcurrencyTrace()
    const expedition = { operationalStatus: 'RUNNING' } as never
    trace.readers.notifications.mockResolvedValue({ unreadCount: 0, notifications: [], expedition } as never)

    const state = await loadBootstrapGameState(trace.readers)

    expect(state.expedition).toBe(expedition)
    expect(trace.readers.expedition).not.toHaveBeenCalled()
    expect(trace.playerLockMaximum()).toBe(1)
  })

  it('retries one transient 5xx or network failure exactly once', async () => {
    const serverFailure = vi.fn<() => Promise<string>>()
      .mockRejectedValueOnce(new ApiError('HTTP_503', 'temporary', 503))
      .mockResolvedValueOnce('server-ok')
    const networkFailure = vi.fn<() => Promise<string>>()
      .mockRejectedValueOnce(new ApiError('NETWORK_ERROR', 'temporary', null))
      .mockResolvedValueOnce('network-ok')

    await expect(retryBootstrapRead(serverFailure)).resolves.toBe('server-ok')
    await expect(retryBootstrapRead(networkFailure)).resolves.toBe('network-ok')
    expect(serverFailure).toHaveBeenCalledTimes(2)
    expect(networkFailure).toHaveBeenCalledTimes(2)
  })

  it('does not retry 4xx and never loops after the one permitted retry', async () => {
    const businessFailure = vi.fn<() => Promise<string>>()
      .mockRejectedValue(new ApiError('BUSINESS_ERROR', 'refused', 409))
    const persistentFailure = vi.fn<() => Promise<string>>()
      .mockRejectedValue(new ApiError('HTTP_500', 'still unavailable', 500))

    await expect(retryBootstrapRead(businessFailure)).rejects.toMatchObject({ status: 409 })
    await expect(retryBootstrapRead(persistentFailure)).rejects.toMatchObject({ status: 500 })
    expect(businessFailure).toHaveBeenCalledTimes(1)
    expect(persistentFailure).toHaveBeenCalledTimes(2)
  })
})
