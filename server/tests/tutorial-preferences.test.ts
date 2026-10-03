import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildApp } from '../src/app.js'
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js'
import { GetOrProvisionCurrentPlayer } from '../src/application/player/get-or-provision-current-player.js'
import { autostartPreference, defaultTutorialPreference, TutorialPreferencesService, tutorialStepIds, tutorialStepAliases, type TutorialPreferenceDto } from '../src/application/tutorial/tutorial-preferences.js'

const players = ['first', 'second'].map(name => ({ id: crypto.randomUUID(), displayName: name, elementKey: 'hydro' as const, status: 'ACTIVE' as const }))
const headers = { authorization: 'Bearer first' }
const apps: Awaited<ReturnType<typeof buildApp>>[] = []
afterEach(async () => { await Promise.all(apps.splice(0).map(app => app.close())) })
async function harness() {
  const values = new Map<string, unknown>()
  const claimed = new Set<string>()
  const store = { claimAutostart: vi.fn(async (id: string) => { if (claimed.has(id)) return { shouldLaunch: false as const }; claimed.add(id); const preference = autostartPreference(values.get(id)); values.set(id, preference); return { shouldLaunch: true as const, preference } }), read: vi.fn(async (id: string) => values.get(id) ?? null), write: vi.fn(async (id: string, value: TutorialPreferenceDto) => { values.set(id, value) }) }
  const playerStore = { findByIdentity: async (_provider: string, subject: string) => players[subject === 'first' ? 0 : 1]!, provision: vi.fn() }
  const service = new TutorialPreferencesService(new GetCurrentPlayer(playerStore), store)
  const app = await buildApp({ host: '127.0.0.1', port: 3001, supabase: {} }, { authIdentityVerifier: { verify: async token => ({ subject: token }) }, getOrProvisionCurrentPlayer: new GetOrProvisionCurrentPlayer(playerStore), tutorialPreferences: service })
  apps.push(app)
  return { app, values, store }
}
describe('dedicated authenticated tutorial preference', () => {
  it.each(Object.entries(tutorialStepAliases))('projects and canonicalizes retired %s to %s without GET repair', async (legacy, canonical) => {
    const { app, values, store } = await harness()
    const saved = { version: 1, status: 'IN_PROGRESS', stepId: legacy }
    const current = { ...saved, stepId: canonical }
    values.set(players[0]!.id, saved)
    expect((await app.inject({ url: '/api/v1/me/tutorial', headers })).json()).toEqual(current)
    expect(store.write).not.toHaveBeenCalled()
    expect(values.get(players[0]!.id)).toEqual(saved)
    expect((await app.inject({ method: 'PUT', url: '/api/v1/me/tutorial', headers, payload: saved })).json()).toEqual(current)
    expect(store.write).toHaveBeenCalledExactlyOnceWith(players[0]!.id, current)
    expect((await app.inject({ url: '/api/v1/me/tutorial', headers: { authorization: 'Bearer second' } })).json()).toEqual(defaultTutorialPreference)
    for (const payload of [{ ...saved, extra: true }, { ...saved, status: 'COMPLETED' }, { ...saved, version: 2 }]) {
      expect((await app.inject({ method: 'PUT', url: '/api/v1/me/tutorial', headers, payload })).statusCode).toBe(400)
    }
  })
  it.each(['GET', 'PUT'] as const)('refuses unauthenticated %s', async method => {
    const { app } = await harness()
    expect((await app.inject({ method, url: '/api/v1/me/tutorial', ...(method === 'PUT' ? { payload: defaultTutorialPreference } : {}) })).statusCode).toBe(401)
  })
  it.each([null, {}, [], { version: 2, status: 'IN_PROGRESS', stepId: 'profile' }, { version: 1, status: 'IN_PROGRESS', stepId: 'retired' }, { version: 1, status: 'COMPLETED', stepId: 'profile' }])('normalizes absent/corrupt physical state %j without writing', async value => {
    const { app, values, store } = await harness(); values.set(players[0]!.id, value)
    expect((await app.inject({ url: '/api/v1/me/tutorial', headers })).json()).toEqual(defaultTutorialPreference)
    expect(store.write).not.toHaveBeenCalled()
  })
  it.each([
    { version: 2, status: 'NOT_STARTED', stepId: null }, { version: 1, status: 'OTHER', stepId: null },
    { version: 1, status: 'IN_PROGRESS', stepId: 'unknown' }, { version: 1, status: 'IN_PROGRESS', stepId: null },
    { version: 1, status: 'IN_PROGRESS' }, { version: 1, status: 'COMPLETED', stepId: 'profile' },
    { version: 1, status: 'NOT_STARTED', stepId: 'profile' }, { ...defaultTutorialPreference, playerId: players[1]!.id },
  ])('strictly rejects %j', async payload => {
    const { app, store } = await harness()
    expect((await app.inject({ method: 'PUT', url: '/api/v1/me/tutorial', headers, payload })).statusCode).toBe(400)
    expect(store.write).not.toHaveBeenCalled()
  })
  it.each(tutorialStepIds)('persists known step %s and resolves Player from token', async stepId => {
    const { app, store } = await harness(), value = { version: 1, status: 'IN_PROGRESS', stepId }
    const put = () => app.inject({ method: 'PUT', url: '/api/v1/me/tutorial', headers, payload: value })
    expect((await put()).json()).toEqual(value); expect((await put()).json()).toEqual(value)
    expect(store.write).toHaveBeenCalledWith(players[0]!.id, value)
    expect((await app.inject({ url: '/api/v1/me/tutorial', headers })).json()).toEqual(value)
    expect((await app.inject({ url: '/api/v1/me/tutorial', headers: { authorization: 'Bearer second' } })).json()).toEqual(defaultTutorialPreference)
  })
  it.each(['NOT_STARTED', 'COMPLETED'])('accepts canonical %s/null', async status => {
    const { app } = await harness(), value = { version: 1, status, stepId: null }
    expect((await app.inject({ method: 'PUT', url: '/api/v1/me/tutorial', headers, payload: value })).json()).toEqual(value)
  })
})

it('authenticates autostart, rejects client identity, and claims only for the authenticated Player', async () => {
  const { app, store } = await harness()
  const url = '/api/v1/me/tutorial/autostart'
  expect((await app.inject({ method: 'POST', url })).statusCode).toBe(401)
  for (const payload of [{ playerId: players[1]!.id }, [], 'invalid']) expect((await app.inject({ method: 'POST', url, headers: { ...headers, 'content-type': 'application/json' }, payload: JSON.stringify(payload) })).statusCode).toBe(400)
  expect(store.claimAutostart).not.toHaveBeenCalled()
  expect((await app.inject({ method: 'POST', url, headers })).json()).toEqual({ shouldLaunch: true, preference: { version: 1, status: 'IN_PROGRESS', stepId: 'profile' } })
  expect(store.claimAutostart).toHaveBeenCalledWith(players[0]!.id)
  expect((await app.inject({ method: 'POST', url, headers })).json()).toEqual({ shouldLaunch: false })
})
