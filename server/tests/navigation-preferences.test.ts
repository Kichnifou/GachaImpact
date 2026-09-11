import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildApp } from '../src/app.js'
import { mergeNavigationMenuPreference, NavigationPreferencesService, type NavigationPreferenceStore } from '../src/application/navigation/navigation-preferences.js'
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js'
import { GetOrProvisionCurrentPlayer } from '../src/application/player/get-or-provision-current-player.js'

const player = { id: crypto.randomUUID(), displayName: 'Menu Test', elementKey: 'hydro' as const, status: 'ACTIVE' as const }
const identity = { subject: 'navigation-subject' }

describe('navigation preferences', () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = []
  afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())))
  it('merges known saved order, appends new ids, ignores unknown ids and restores Configuration', () => {
    const merged = mergeNavigationMenuPreference({ version: 1, order: ['shop', 'unknown', 'home', 'shop'], hidden: ['configuration', 'bank', 'unknown'] })
    expect(merged.order.slice(0, 2)).toEqual(['shop', 'home'])
    expect(new Set(merged.order).size).toBe(merged.order.length)
    expect(merged.order.at(-1)).toBe('configuration')
    expect(merged.hidden).toEqual(['bank'])
    expect(mergeNavigationMenuPreference('{bad json')).toMatchObject({ version: 1, hidden: [] })
  })
  it('authenticates GET/PUT, rejects invalid shapes and persists only player-owned ids', async () => {
    let stored: unknown = null
    const store: NavigationPreferenceStore = { read: vi.fn(async () => stored), write: vi.fn(async (_playerId, value) => { stored = value }) }
    const playerStore = { findByIdentity: async () => player, provision: vi.fn() }
    const current = new GetCurrentPlayer(playerStore)
    const app = await buildApp({ host: '127.0.0.1', port: 3001, supabase: {} }, { authIdentityVerifier: { verify: async () => identity }, getOrProvisionCurrentPlayer: new GetOrProvisionCurrentPlayer(playerStore), navigationPreferences: new NavigationPreferencesService(current, store) })
    apps.push(app)
    expect((await app.inject({ url: '/api/v1/me/navigation-preferences' })).statusCode).toBe(401)
    const headers = { authorization: 'Bearer token' }
    expect((await app.inject({ method: 'PUT', url: '/api/v1/me/navigation-preferences', headers, payload: { version: 2, order: [], hidden: [] } })).statusCode).toBe(400)
    const response = await app.inject({ method: 'PUT', url: '/api/v1/me/navigation-preferences', headers, payload: { version: 1, order: ['bank', 'unknown'], hidden: ['configuration', 'shop', 'unknown'] } })
    expect(response.statusCode).toBe(200)
    expect(response.json().order[0]).toBe('bank')
    expect(response.json().hidden).toEqual(['shop'])
    expect(store.write).toHaveBeenCalledWith(player.id, expect.objectContaining({ version: 1 }))
    expect((await app.inject({ url: '/api/v1/me/navigation-preferences', headers })).json()).toEqual(response.json())
  })
})
