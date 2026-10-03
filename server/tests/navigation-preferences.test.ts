import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildApp } from '../src/app.js'
import { mergeNavigationMenuPreference, NavigationPreferencesService, type NavigationPreferenceStore } from '../src/application/navigation/navigation-preferences.js'
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js'
import { GetOrProvisionCurrentPlayer } from '../src/application/player/get-or-provision-current-player.js'

const player = { id: crypto.randomUUID(), displayName: 'Menu Test', elementKey: 'hydro' as const, status: 'ACTIVE' as const }
const identity = { subject: 'navigation-subject' }

describe('navigation preferences', () => {
  it('uses the exact 22-destination canonical default with personal Profile and direct Arcade', () => {
    expect(mergeNavigationMenuPreference(null)).toEqual({ version: 1, hidden: [], order: ['home', 'profile', 'invocation', 'box', 'team', 'catalog', 'dailies', 'missions', 'combat', 'event', 'arcade', 'contest', 'inventory', 'shop', 'bank', 'codes', 'friends', 'trades', 'rankings', 'history', 'tutorial', 'configuration'] })
  })
  it('retires Activities and inserts only absent Profile/Arcade beside their anchors without resetting survivors', () => {
    const oldOrder = ['bank', 'event', 'combat', 'home', 'activities', 'shop', 'configuration']
    const value = mergeNavigationMenuPreference({ version: 1, order: oldOrder, hidden: ['activities', 'bank', 'home', 'configuration'] })
    expect(value.order.slice(0, 8)).toEqual(['bank', 'event', 'arcade', 'combat', 'home', 'profile', 'shop', 'invocation'])
    expect(value.order.filter(id => oldOrder.includes(id))).toEqual(oldOrder.filter(id => id !== 'activities'))
    expect(value.hidden).toEqual(['bank', 'home'])
    expect(mergeNavigationMenuPreference(value)).toEqual(value)
    expect(mergeNavigationMenuPreference({ order: ['arcade', 'shop', 'profile', 'home'], hidden: ['profile', 'arcade'] }).order.slice(0, 4)).toEqual(['arcade', 'shop', 'profile', 'home'])
    const incomplete = mergeNavigationMenuPreference({ order: ['shop'], hidden: [] })
    expect(incomplete.order.indexOf('profile')).toBe(incomplete.order.indexOf('home') + 1)
    expect(incomplete.order.indexOf('arcade')).toBe(incomplete.order.indexOf('event') + 1)
    expect(mergeNavigationMenuPreference(incomplete)).toEqual(incomplete)
  })
  it('enriches the previous complete menu with Trades before Configuration and preserves hidden choices', () => {
    const current = mergeNavigationMenuPreference(null)
    const old = { ...current, order: current.order.filter(id => id !== 'trades'), hidden: ['friends'] }
    const merged = mergeNavigationMenuPreference(old)
    expect(merged.order.at(-2)).toBe('trades')
    expect(merged.order.at(-1)).toBe('configuration')
    expect(merged.hidden).toEqual(['friends'])
  })
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
  it('inserts every newly introduced destination immediately before a saved Configuration', () => {
    const oldPreference = mergeNavigationMenuPreference({ version: 1, order: ['shop', 'home', 'configuration'], hidden: ['combat', 'codes', 'configuration', 'codes'] })
    expect(oldPreference.order.slice(0, 2)).toEqual(['shop', 'home'])
    expect(oldPreference.order.at(-1)).toBe('configuration')
    expect(oldPreference.order.at(-2)).toBe('tutorial')
    expect(oldPreference.order.indexOf('codes')).toBeLessThan(oldPreference.order.indexOf('configuration'))
    expect(oldPreference.order).toEqual(expect.arrayContaining(['profile', 'arcade', 'friends']))
    expect(oldPreference.hidden).toEqual(['combat', 'codes'])
    expect(new Set(oldPreference.order).size).toBe(navigationLength())
  })
  it('drops the retired Social menu entry without resetting other saved choices', () => {
    const merged = mergeNavigationMenuPreference({ version: 1, order: ['bank', 'social', 'friends', 'configuration'], hidden: ['shop', 'social'] })
    expect(merged.order.slice(0, 2)).toEqual(['bank', 'friends'])
    expect(merged.order).not.toContain('social')
    expect(merged.hidden).toEqual(['shop'])
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
    const legacyPreference = { version: 1, order: ['event', 'home', 'activities', 'shop', 'configuration'], hidden: ['activities', 'shop'] }
    stored = legacyPreference
    const legacyGet = (await app.inject({ url: '/api/v1/me/navigation-preferences', headers })).json()
    expect(legacyGet.order.slice(0, 5)).toEqual(['event', 'arcade', 'home', 'profile', 'shop'])
    expect(legacyGet.hidden).toEqual(['shop'])
    expect(store.write).not.toHaveBeenCalled()
    const legacyPut = await app.inject({ method: 'PUT', url: '/api/v1/me/navigation-preferences', headers, payload: legacyPreference })
    expect(legacyPut.json()).toEqual(legacyGet)
    expect((await app.inject({ url: '/api/v1/me/navigation-preferences', headers })).json()).toEqual(legacyGet)
    vi.mocked(store.write).mockClear()
    expect((await app.inject({ method: 'PUT', url: '/api/v1/me/navigation-preferences', headers, payload: { version: 2, order: [], hidden: [] } })).statusCode).toBe(400)
    const response = await app.inject({ method: 'PUT', url: '/api/v1/me/navigation-preferences', headers, payload: { version: 1, order: ['bank', 'unknown'], hidden: ['configuration', 'shop', 'unknown'] } })
    expect(response.statusCode).toBe(200)
    expect(response.json().order[0]).toBe('bank')
    expect(response.json().hidden).toEqual(['shop'])
    expect(store.write).toHaveBeenCalledWith(player.id, expect.objectContaining({ version: 1 }))
    expect((await app.inject({ url: '/api/v1/me/navigation-preferences', headers })).json()).toEqual(response.json())
  })
})

function navigationLength() { return mergeNavigationMenuPreference(null).order.length }
