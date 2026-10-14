import { expect, it, vi } from 'vitest'
import { createGameApiClient } from './game-api'

it.each([false, true])('negotiates catalogue support without adding persisted DTO fields: %s', async capable => {
  const preference = { version: 1, status: 'NOT_STARTED', stepId: null }
  const fetchImplementation = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(capable ? { catalog: 'r1093', preference } : preference)))
  const client = createGameApiClient({ baseUrl: 'https://api.example', getAccessToken: async () => 'test', fetchImplementation })
  expect(await client.getTutorial()).toEqual(preference)
  expect(client.tutorialLegacyCatalog()).toBe(!capable)
  fetchImplementation.mockImplementation(async () => new Response(JSON.stringify(preference)))
  await client.putTutorial(preference as Parameters<typeof client.putTutorial>[0])
  expect(fetchImplementation.mock.calls.map(([url]) => url)).toEqual(['https://api.example/api/v1/me/tutorial?catalog=r1093', 'https://api.example/api/v1/me/tutorial?catalog=r1093'])
  expect(JSON.parse((fetchImplementation.mock.calls[1] as unknown as [string, RequestInit])[1].body as string)).toEqual(preference)
})

it.each([false, true])('detects capability from autostart even when launch is declined: %s', async capable => {
  const fetchImplementation = vi.fn(async () => new Response(JSON.stringify(capable ? { shouldLaunch: false, catalog: 'r1093' } : { shouldLaunch: false })))
  const client = createGameApiClient({ baseUrl: 'https://api.example', getAccessToken: async () => 'test', fetchImplementation })
  expect((await client.claimTutorialAutostart()).shouldLaunch).toBe(false)
  expect(client.tutorialLegacyCatalog()).toBe(!capable)
})
