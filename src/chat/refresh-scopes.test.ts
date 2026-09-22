import { describe, expect, it, vi } from 'vitest'
import { runChatRefreshScopes, type ChatRefreshHandlers } from './refresh-scopes'
import type { ChatRefreshScope } from '../api/types'

function harness() {
  const keys: ChatRefreshScope[] = ['resources', 'progression', 'gacha', 'box', 'dailyChallenge', 'bank', 'wheel', 'social', 'event']
  const handlers = Object.fromEntries(keys.map(key => [key, vi.fn(async () => undefined)])) as ChatRefreshHandlers
  return { handlers, called: () => keys.filter(key => vi.mocked(handlers[key]!).mock.calls.length > 0) }
}

describe('confirmed Chat refresh dispatch', () => {
  it('revalidates Pull resources, pity/gacha, Box, Défi and progression once', async () => {
    const { handlers, called } = harness()
    await runChatRefreshScopes(['resources', 'gacha', 'box', 'dailyChallenge', 'progression', 'resources'], handlers)
    expect(called()).toEqual(['resources', 'progression', 'gacha', 'box', 'dailyChallenge'])
    expect(handlers.resources).toHaveBeenCalledOnce()
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
  it('finishes all owner reads even when one fails, without replaying the confirmed send', async () => {
    const box = vi.fn(async () => { throw new Error('read failed') }), resources = vi.fn(async () => undefined)
    await expect(runChatRefreshScopes(['box', 'resources'], { box, resources })).rejects.toThrow('projection')
    expect(resources).toHaveBeenCalledOnce()
    expect(box).toHaveBeenCalledOnce()
  })
})
