import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildApp } from '../src/app.js'
import { BusinessError } from '../src/application/errors.js'
import type { ModerationStateDto, ModerationTools } from '../src/application/moderation/moderation-tools.js'
import { GetOrProvisionCurrentPlayer } from '../src/application/player/get-or-provision-current-player.js'

const identity = { subject: 'subject' }
const player = { id: crypto.randomUUID(), displayName: 'Test', elementKey: 'hydro' as const, status: 'ACTIVE' as const }
const state: ModerationStateDto = {
  player: { id: player.id, displayName: player.displayName, elementKey: player.elementKey, level: 0, tester: true, rank: 'TESTER' },
  permissions: { roles: ['TESTER'], capabilities: { moderationAccess: true, selfResourceTools: true, selfGameplayTools: true, superTools: false, canSelectPlayers: false, canManageTesters: false } },
  resources: { primogems: '10', moras: '20', particles: { pyro: '0', hydro: '0', cryo: '0', electro: '0', anemo: '0', geo: '0', dendro: '0' } },
  progression: { totalXp: '28', level: 0, xpIntoCurrentStep: '28', xpPerStep: '30', isMaxLevel: false, level100OverflowRewardsClaimed: 0, totalMessages: '0', countedMessages: '0' },
  gachaState: { pity5: 89, pity4: 9, guaranteedFeatured5: false, captureProgress: 3, fiftyFiftyLostStreak: 0, selectedBannerCharacterId: null, totalPulls: '0', totalFiveStars: '0', totalFourStars: '0', fiftyFiftyWon: '0', fiftyFiftyLost: '0', capturesTriggered: '0' },
  stella: { quantity: '1' },
}

describe('moderation self-test API', () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = []
  afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())))
  async function setup(tools: ModerationTools) {
    const store = { findByIdentity: async () => player, provision: vi.fn() }
    const app = await buildApp({ host: '127.0.0.1', port: 3001, supabase: {} }, { authIdentityVerifier: { verify: async () => identity }, getOrProvisionCurrentPlayer: new GetOrProvisionCurrentPlayer(store), moderationTools: tools })
    apps.push(app)
    return app
  }
  const allowed = (): ModerationTools => ({
    getPermissions: vi.fn(async () => state.permissions), getState: vi.fn(async () => state),
    listPlayers: vi.fn(async () => ({ players: [], page: 1, pageSize: 10 as const, total: 0, totalPages: 1 })), adjustResource: vi.fn(async () => state), setXp: vi.fn(async () => state), setGacha: vi.fn(async () => state), setStella: vi.fn(async () => state), setTester: vi.fn(async () => state),
  })

  it('requires authentication for permissions and every moderation endpoint', async () => {
    const app = await setup(allowed())
    for (const [method, url] of [['GET','/api/v1/me/permissions'],['GET','/api/v1/moderation/me'],['POST','/api/v1/moderation/me/resources'],['POST','/api/v1/moderation/me/xp'],['POST','/api/v1/moderation/me/gacha'],['POST','/api/v1/moderation/me/stella']] as const) expect((await app.inject({ method, url })).statusCode).toBe(401)
  })

  it('returns 403 when server-side capability authorization refuses a normal or MODERATOR-only player', async () => {
    const forbidden = () => { throw new BusinessError('MODERATION_FORBIDDEN', 'Interdit') }
    const tools = { ...allowed(), getState: vi.fn(forbidden), adjustResource: vi.fn(forbidden) }
    const app = await setup(tools)
    const headers = { authorization: 'Bearer token' }
    expect((await app.inject({ url: '/api/v1/moderation/me', headers })).statusCode).toBe(403)
    expect((await app.inject({ method: 'POST', url: '/api/v1/moderation/me/resources', headers, payload: { resourceKey: 'primogems', amount: '1', direction: 'add', idempotencyKey: crypto.randomUUID() } })).statusCode).toBe(403)
  })

  it('accepts the self-only TESTER surface and rejects targetPlayerId or invalid bounds', async () => {
    const tools = allowed(); const app = await setup(tools); const headers = { authorization: 'Bearer token' }
    expect((await app.inject({ url: '/api/v1/moderation/me', headers })).statusCode).toBe(200)
    const key = crypto.randomUUID()
    expect((await app.inject({ method: 'POST', url: '/api/v1/moderation/me/resources', headers, payload: { resourceKey: 'particles_dendro', amount: '9007199254740993', direction: 'add', idempotencyKey: key } })).statusCode).toBe(200)
    expect(tools.adjustResource).toHaveBeenCalledWith(identity, player.id, { resourceKey: 'particles_dendro', amount: 9007199254740993n, direction: 'add', idempotencyKey: key })
    expect((await app.inject({ method: 'POST', url: '/api/v1/moderation/me/resources', headers, payload: { resourceKey: 'primogems', amount: '1', direction: 'add', idempotencyKey: crypto.randomUUID(), targetPlayerId: crypto.randomUUID() } })).statusCode).toBe(400)
    expect((await app.inject({ method: 'POST', url: '/api/v1/moderation/me/gacha', headers, payload: { pity5: 90, idempotencyKey: crypto.randomUUID() } })).statusCode).toBe(400)
    expect((await app.inject({ method: 'POST', url: '/api/v1/moderation/me/gacha', headers, payload: { pity4: 10, idempotencyKey: crypto.randomUUID() } })).statusCode).toBe(400)
    expect((await app.inject({ method: 'POST', url: '/api/v1/moderation/me/gacha', headers, payload: { captureProgress: 4, idempotencyKey: crypto.randomUUID() } })).statusCode).toBe(400)
  })

  it('forwards XP, prepare, guarantee/capture and Stella mutations with UUID idempotency keys', async () => {
    const tools = allowed(); const app = await setup(tools); const headers = { authorization: 'Bearer token' }
    expect((await app.inject({ method: 'POST', url: '/api/v1/moderation/me/xp', headers, payload: { totalXp: '2999', idempotencyKey: crypto.randomUUID() } })).statusCode).toBe(200)
    expect((await app.inject({ method: 'POST', url: '/api/v1/moderation/me/xp', headers, payload: { prepareNextLevel: true, idempotencyKey: crypto.randomUUID() } })).statusCode).toBe(200)
    expect((await app.inject({ method: 'POST', url: '/api/v1/moderation/me/gacha', headers, payload: { pity5: 0, pity4: 0, captureProgress: 0, guaranteedFeatured5: true, idempotencyKey: crypto.randomUUID() } })).statusCode).toBe(200)
    expect((await app.inject({ method: 'POST', url: '/api/v1/moderation/me/stella', headers, payload: { quantity: '999999999999', idempotencyKey: crypto.randomUUID() } })).statusCode).toBe(200)
    expect((await app.inject({ method: 'POST', url: '/api/v1/moderation/me/stella', headers, payload: { quantity: '-1', idempotencyKey: crypto.randomUUID() } })).statusCode).toBe(400)
  })

  it('validates and forwards the structured ten-player browser query', async () => {
    const tools = allowed(); const app = await setup(tools); const headers = { authorization: 'Bearer token' }
    expect((await app.inject({ url: '/api/v1/moderation/players?query=ceo&elementKey=geo&tester=tester&sort=level&direction=desc&page=2', headers })).statusCode).toBe(200)
    expect(tools.listPlayers).toHaveBeenCalledWith(identity, { query: 'ceo', elementKey: 'geo', tester: 'tester', sort: 'level', direction: 'desc', page: 2 })
    expect((await app.inject({ url: '/api/v1/moderation/players?page=0', headers })).statusCode).toBe(400)
    expect((await app.inject({ url: '/api/v1/moderation/players?elementKey=light', headers })).statusCode).toBe(400)
  })
})
