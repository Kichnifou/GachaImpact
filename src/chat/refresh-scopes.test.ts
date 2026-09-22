import { describe, expect, it, vi } from 'vitest'
import { runChatRefreshScopes, type ChatRefreshHandlers } from './refresh-scopes'
import type { ChatRefreshScope } from '../api/types'

function harness() {
  const keys: ChatRefreshScope[] = ['resources', 'progression', 'gacha', 'box', 'inventory', 'dailyChallenge', 'bank', 'wheel', 'social', 'trades', 'dailyCombat', 'monthlyBoss', 'contest', 'teams', 'expedition', 'event', 'notifications']
  const handlers = Object.fromEntries(keys.map(key => [key, vi.fn(async () => undefined)])) as ChatRefreshHandlers
  return { handlers, called: () => keys.filter(key => vi.mocked(handlers[key]!).mock.calls.length > 0) }
}

describe('confirmed Chat refresh dispatch', () => {
  it('revalidates every Pull projection once and no unrelated owner', async () => {
    const { handlers, called } = harness()
    await runChatRefreshScopes(['resources', 'gacha', 'box', 'inventory', 'dailyChallenge', 'progression', 'teams', 'dailyCombat', 'monthlyBoss', 'contest', 'resources'], handlers)
    expect(called()).toEqual(['resources', 'progression', 'gacha', 'box', 'inventory', 'dailyChallenge', 'dailyCombat', 'monthlyBoss', 'contest', 'teams'])
    expect(handlers.resources).toHaveBeenCalledOnce()
    for (const scope of called()) expect(handlers[scope]).toHaveBeenCalledOnce()
  })
  it('revalidates every Stella projection once and no unrelated owner', async () => {
    const { handlers, called } = harness()
    await runChatRefreshScopes(['box', 'inventory', 'resources', 'teams', 'dailyCombat', 'monthlyBoss', 'contest'], handlers)
    expect(called()).toEqual(['resources', 'box', 'inventory', 'dailyCombat', 'monthlyBoss', 'contest', 'teams'])
    for (const scope of called()) expect(handlers[scope]).toHaveBeenCalledOnce()
  })
  it('revalidates Banque, Roue, Social and Event only for their scopes', async () => {
    for (const [scopes, expected] of [
      [['bank', 'resources'], ['resources', 'bank']],
      [['wheel', 'resources'], ['resources', 'wheel']],
      [['social', 'resources'], ['resources', 'social']],
      [['event', 'resources'], ['resources', 'event']],
    ] as const) {
      const { handlers, called } = harness()
      await runChatRefreshScopes(scopes, handlers)
      expect(called()).toEqual(expected)
    }
  })
  it('dispatches the owner matrix for XP, Pull, Trades, Combat, Expedition and Event', async () => {
    for (const scopes of [
      ['progression', 'dailyChallenge', 'resources'],
      ['resources', 'gacha', 'box', 'inventory', 'dailyChallenge', 'progression', 'teams', 'dailyCombat', 'monthlyBoss', 'contest'],
      ['trades', 'resources', 'inventory', 'notifications'],
      ['dailyCombat', 'resources', 'notifications', 'teams'],
      ['monthlyBoss', 'resources', 'notifications', 'teams'],
      ['expedition', 'resources', 'notifications'],
      ['event', 'resources', 'inventory', 'notifications'],
    ] satisfies ChatRefreshScope[][]) {
      const { handlers, called } = harness()
      await runChatRefreshScopes(scopes, handlers)
      expect(called()).toEqual(keysInOrder(scopes))
      for (const scope of scopes) expect(handlers[scope]).toHaveBeenCalledOnce()
    }
  })
  it('finishes all owner reads even when one fails, without replaying the confirmed send', async () => {
    const box = vi.fn(async () => { throw new Error('read failed') }), resources = vi.fn(async () => undefined)
    await expect(runChatRefreshScopes(['box', 'resources'], { box, resources })).rejects.toThrow('projection')
    expect(resources).toHaveBeenCalledOnce()
    expect(box).toHaveBeenCalledOnce()
  })
})

function keysInOrder(scopes: ChatRefreshScope[]) {
  return ['resources', 'progression', 'gacha', 'box', 'inventory', 'dailyChallenge', 'bank', 'wheel', 'social', 'trades', 'dailyCombat', 'monthlyBoss', 'contest', 'teams', 'expedition', 'event', 'notifications'].filter(scope => scopes.includes(scope as ChatRefreshScope))
}
