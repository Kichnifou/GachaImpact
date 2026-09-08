import { describe, expect, it, vi } from 'vitest'

import { createGameApiClient } from './game-api'

describe('game API client', () => {
  it('adds the current Bearer token without exposing it in the response', async () => {
    const fetchImplementation = vi.fn<typeof fetch>(async (_input, _init) =>
      new Response(JSON.stringify({ id: 'p1', displayName: 'Kichnifou', elementKey: null, status: 'ACTIVE' })),
    )
    const client = createGameApiClient({
      baseUrl: 'http://127.0.0.1:3001/',
      getAccessToken: async () => 'private-test-token',
      fetchImplementation,
    })

    await client.getCurrentPlayer()

    expect(fetchImplementation).toHaveBeenCalledOnce()
    const [, init] = fetchImplementation.mock.calls[0] ?? []
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer private-test-token')
  })

  it('parses structured backend business errors', async () => {
    const client = createGameApiClient({
      baseUrl: 'http://127.0.0.1:3001',
      getAccessToken: async () => 'token',
      fetchImplementation: async () =>
        new Response(
          JSON.stringify({
            error: {
              code: 'ELEMENT_ALREADY_CHOSEN',
              message: 'Backend detail',
              requestId: 'request-1',
            },
          }),
          { status: 409 },
        ),
    })

    await expect(client.chooseElement('pyro')).rejects.toEqual(
      expect.objectContaining({
        code: 'ELEMENT_ALREADY_CHOSEN',
        status: 409,
        requestId: 'request-1',
      }),
    )
  })

  it('keeps bigint resource amounts as lossless strings', async () => {
    const hugeAmount = '9007199254740993'
    const client = createGameApiClient({
      baseUrl: 'http://127.0.0.1:3001',
      getAccessToken: async () => 'token',
      fetchImplementation: async () =>
        new Response(
          JSON.stringify({
            primogems: hugeAmount,
            moras: hugeAmount,
            particles: {
              pyro: '0', hydro: '0', cryo: '0', electro: '0', anemo: '0', geo: '0', dendro: '0',
            },
          }),
        ),
    })

    const resources = await client.getResources()
    expect(resources.primogems).toBe(hugeAmount)
    expect(typeof resources.primogems).toBe('string')
  })

  it('loads the persisted Wheel state through the read-only endpoint', async () => {
    const fetchImplementation = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({
        spun: true,
        businessDate: '2026-09-05',
        result: { resultType: 'moras', resourceKey: 'moras', amount: '50000' },
      })),
    )
    const client = createGameApiClient({
      baseUrl: 'http://127.0.0.1:3001',
      getAccessToken: async () => 'token',
      fetchImplementation,
    })

    await expect(client.getWheelToday()).resolves.toMatchObject({
      spun: true,
      result: { amount: '50000' },
    })
    expect(fetchImplementation.mock.calls[0]?.[0]).toBe(
      'http://127.0.0.1:3001/api/v1/wheel/today',
    )
    expect(fetchImplementation.mock.calls[0]?.[1]?.method).toBeUndefined()
  })

  it('loads lossless Player progression through the read-only endpoint', async () => {
    const fetchImplementation = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({
        totalXp: '9007199254740993', level: 100, xpIntoCurrentStep: '3', xpPerStep: '30',
        isMaxLevel: true, level100OverflowRewardsClaimed: 2,
        totalMessages: '9007199254740993', countedMessages: '42',
      })),
    )
    const client = createGameApiClient({
      baseUrl: 'http://127.0.0.1:3001',
      getAccessToken: async () => 'token',
      fetchImplementation,
    })

    await expect(client.getProgression()).resolves.toMatchObject({
      totalXp: '9007199254740993', level: 100, xpIntoCurrentStep: '3',
    })
    expect(fetchImplementation.mock.calls[0]?.[0]).toBe(
      'http://127.0.0.1:3001/api/v1/me/progression',
    )
    expect(fetchImplementation.mock.calls[0]?.[1]?.method).toBeUndefined()
  })

  it('returns a stable network error without logging the token', async () => {
    const client = createGameApiClient({
      baseUrl: 'http://127.0.0.1:3001',
      getAccessToken: async () => 'token',
      fetchImplementation: async () => {
        throw new TypeError('offline')
      },
    })

    await expect(client.getCurrentPlayer()).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      status: null,
    })
  })

  it('uses read-only today and POST claim endpoints for the daily reward', async () => {
    const fetchImplementation = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ claimed: false, businessDate: '2026-09-05', rewards: { primogems: '160', mainElementParticles: '160', moras: '10000' } })))
    const client = createGameApiClient({ baseUrl: 'http://127.0.0.1:3001', getAccessToken: async () => 'token', fetchImplementation })
    await client.getDailyRewardToday()
    await client.claimDailyReward()
    expect(fetchImplementation.mock.calls[0]?.[0]).toContain('/api/v1/daily-reward/today')
    expect(fetchImplementation.mock.calls[0]?.[1]?.method).toBeUndefined()
    expect(fetchImplementation.mock.calls[1]?.[0]).toContain('/api/v1/daily-reward/claim')
    expect(fetchImplementation.mock.calls[1]?.[1]?.method).toBe('POST')
  })

  it('sends a pull intention key and preserves ordered lossless results', async () => {
    const fetchImplementation = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      operation: { id: 'op', pullCount: 10, primogemCost: '1600', createdAt: '2026-09-06T12:00:00Z', alreadyProcessed: false },
      results: Array.from({ length: 10 }, (_, index) => ({ index: index + 1, resultType: 'resource', character: null, rarity: null, resourceKey: 'moras', resourceAmount: '5000', wasNewCharacter: null, constellationAfter: null, copiesAfter: null, wasFiftyFifty: false, wonFiftyFifty: null, guaranteeConsumed: false, captureTriggered: false, bonusRewards: [], c6Progression: null })),
      playerState: { pity5: 10, pity4: 0, guaranteedFeatured5: false, captureProgress: 0, fiftyFiftyLostStreak: 0, selectedBannerCharacterId: 'target', totalPulls: '10', totalFiveStars: '0', totalFourStars: '1', fiftyFiftyWon: '0', fiftyFiftyLost: '0', capturesTriggered: '0' },
    })))
    const client = createGameApiClient({ baseUrl: 'http://127.0.0.1:3001', getAccessToken: async () => 'token', fetchImplementation })
    const key = crypto.randomUUID()
    const result = await client.pullGacha(10, key)
    expect(result.results.map(({ index }) => index)).toEqual([1,2,3,4,5,6,7,8,9,10])
    expect(result.operation.primogemCost).toBe('1600')
    expect(fetchImplementation.mock.calls[0]?.[0]).toContain('/api/v1/gacha/pull')
    expect(JSON.parse(String(fetchImplementation.mock.calls[0]?.[1]?.body))).toEqual({ count: 10, idempotencyKey: key })
  })

  it('loads the requested server-paginated Gacha history page', async () => {
    const fetchImplementation = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ page: 2, pageSize: 10, totalResults: 12, totalPages: 2, hasPrevious: true, hasNext: false, results: [] })))
    const client = createGameApiClient({ baseUrl: 'http://127.0.0.1:3001', getAccessToken: async () => 'token', fetchImplementation })
    await expect(client.getGachaHistory(2)).resolves.toMatchObject({ page: 2, pageSize: 10, totalResults: 12 })
    expect(fetchImplementation.mock.calls[0]?.[0]).toBe('http://127.0.0.1:3001/api/v1/gacha/history?page=2')
    expect(fetchImplementation.mock.calls[0]?.[1]?.method).toBeUndefined()
  })

  it('loads the personal Box and exposes its three narrowly-scoped mutations', async () => {
    const fetchImplementation = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ characters: [], summary: { totalOwned: 0, fiveStars: 0, fourStars: 0, c6: 0 }, preference: { sortKey: 'alphabetical', direction: 'asc' }, stella: { quantity: '0' } })))
    const client = createGameApiClient({ baseUrl: 'http://127.0.0.1:3001', getAccessToken: async () => 'token', fetchImplementation })
    await client.getBox()
    const id = crypto.randomUUID()
    await client.setBoxFavorite(id, true)
    await client.setBoxSortPreference({ sortKey: 'element', direction: 'desc' })
    const key = crypto.randomUUID()
    await client.useStella(id, key)
    expect(fetchImplementation.mock.calls[0]?.[0]).toBe('http://127.0.0.1:3001/api/v1/me/box')
    expect(fetchImplementation.mock.calls[1]?.[0]).toBe(`http://127.0.0.1:3001/api/v1/me/box/${id}/favorite`)
    expect(fetchImplementation.mock.calls[1]?.[1]?.method).toBe('PATCH')
    expect(JSON.parse(String(fetchImplementation.mock.calls[1]?.[1]?.body))).toEqual({ favorite: true })
    expect(fetchImplementation.mock.calls[2]?.[0]).toBe('http://127.0.0.1:3001/api/v1/me/box/preference')
    expect(fetchImplementation.mock.calls[2]?.[1]?.method).toBe('PATCH')
    expect(JSON.parse(String(fetchImplementation.mock.calls[2]?.[1]?.body))).toEqual({ sortKey: 'element', direction: 'desc' })
    expect(fetchImplementation.mock.calls[3]?.[0]).toBe(`http://127.0.0.1:3001/api/v1/me/box/${id}/stella`)
    expect(fetchImplementation.mock.calls[3]?.[1]?.method).toBe('POST')
    expect(JSON.parse(String(fetchImplementation.mock.calls[3]?.[1]?.body))).toEqual({ idempotencyKey: key })
  })

  it('uses the authoritative Team management and slot mutation endpoints', async () => {
    const fetchImplementation = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ teams: [], availableCharacters: [], passiveReference: [] })))
    const client = createGameApiClient({ baseUrl: 'http://127.0.0.1:3001', getAccessToken: async () => 'token', fetchImplementation })
    const teamId = crypto.randomUUID()
    const characterId = crypto.randomUUID()
    await client.getTeams()
    await client.activateTeam(teamId)
    await client.renameTeam(teamId, 'Exploration')
    await client.createNextTeam(11)
    await client.reorderTeams([teamId])
    await client.setTeamSlot(teamId, 3, characterId)
    await client.reorderTeamSlots(teamId, [characterId, null, null, null])
    await client.removeTeamSlot(teamId, 3)
    await client.clearTeam(teamId)
    await client.deleteTeam(teamId)
    expect(fetchImplementation.mock.calls.map(([url, init]) => [url, init?.method, init?.body ? JSON.parse(String(init.body)) : null])).toEqual([
      ['http://127.0.0.1:3001/api/v1/me/teams', undefined, null],
      [`http://127.0.0.1:3001/api/v1/me/teams/${teamId}/active`, 'PATCH', null],
      [`http://127.0.0.1:3001/api/v1/me/teams/${teamId}/name`, 'PATCH', { name: 'Exploration' }],
      ['http://127.0.0.1:3001/api/v1/me/teams', 'POST', { expectedPosition: 11 }],
      ['http://127.0.0.1:3001/api/v1/me/teams/order', 'PUT', { teamIds: [teamId] }],
      [`http://127.0.0.1:3001/api/v1/me/teams/${teamId}/slots/3`, 'PUT', { characterId }],
      [`http://127.0.0.1:3001/api/v1/me/teams/${teamId}/slots/order`, 'PUT', { characterIds: [characterId, null, null, null] }],
      [`http://127.0.0.1:3001/api/v1/me/teams/${teamId}/slots/3`, 'DELETE', null],
      [`http://127.0.0.1:3001/api/v1/me/teams/${teamId}/slots`, 'DELETE', null],
      [`http://127.0.0.1:3001/api/v1/me/teams/${teamId}`, 'DELETE', null],
    ])
  })
})
