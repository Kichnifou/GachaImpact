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
})
