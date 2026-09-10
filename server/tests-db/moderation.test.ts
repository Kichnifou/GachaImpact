import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config/environment.js'
import { resourceKeys } from '../src/domain/economy/resources.js'
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js'
import { createDatabase } from '../src/infrastructure/database/prisma-database.js'
import { PrismaCurrentPlayerStore } from '../src/infrastructure/database/prisma-current-player-store.js'
import { PrismaModerationTools } from '../src/infrastructure/database/prisma-moderation-tools.js'

const config = loadConfig()
if (!config.databaseUrl) throw new Error('DATABASE_URL is required for Moderation database tests.')
const database = createDatabase(config.databaseUrl)
const playerIds = new Set<string>()
const tools = new PrismaModerationTools(database, new GetCurrentPlayer(new PrismaCurrentPlayerStore(database)))

afterEach(cleanup)
afterAll(async () => { await cleanup(); await database.$disconnect() })

async function createPlayer(roles: readonly ('MODERATOR'|'TESTER'|'ADMIN')[]) {
  const subject = `moderation-test-${randomUUID()}`
  const player = await database.player.create({ data: {
    displayName: `Moderation ${randomUUID().slice(0,8)}`, elementKey: 'hydro',
    webIdentity: { create: { provider: 'supabase', providerSubject: subject } },
    resourceBalances: { create: resourceKeys.map((resourceKey) => ({ resourceKey, amount: 1000n })) },
    economyStats: { create: { totalPrimosEarned: 17n, totalPrimosSpent: 9n, totalMorasEarned: 8n, totalMorasSpent: 4n, totalMainElementParticlesEarned: 3n } },
    progression: { create: { xp: 61n, totalMessages: 12n, countedMessages: 7n, lastXpMessageAt: new Date('2026-09-01T12:00:00Z') } },
    gachaState: { create: {} },
    rolesGranted: { create: roles.map((role) => ({ role, source: 'test' })) },
  } })
  playerIds.add(player.id)
  return { id: player.id, identity: { subject } }
}

async function cleanup() {
  const ids = [...playerIds]; if (!ids.length) return
  await database.adminAuditEntry.deleteMany({ where: { targetPlayerId: { in: ids } } })
  await database.resourceMovement.deleteMany({ where: { playerId: { in: ids } } })
  await database.businessOperation.deleteMany({ where: { playerId: { in: ids } } })
  await database.webIdentity.deleteMany({ where: { playerId: { in: ids } } })
  await database.player.deleteMany({ where: { id: { in: ids } } })
  playerIds.clear()
}

describe('privileged self-test persistence', () => {
  it('keeps MODERATOR powerless while TESTER and ADMIN receive the capability', async () => {
    const moderator = await createPlayer(['MODERATOR'])
    expect(await tools.getPermissions(moderator.identity)).toEqual({ roles: ['MODERATOR'], capabilities: { moderationAccess: false, selfTestTools: false } })
    await expect(tools.getState(moderator.identity)).rejects.toMatchObject({ code: 'MODERATION_FORBIDDEN' })
    const tester = await createPlayer(['TESTER'])
    expect((await tools.getState(tester.identity)).permissions.capabilities.selfTestTools).toBe(true)
    const admin = await createPlayer(['ADMIN'])
    expect((await tools.getState(admin.identity)).permissions.capabilities.selfTestTools).toBe(true)
  })

  it('adjusts all resources losslessly without gameplay stats and makes retries one movement/audit', async () => {
    const player = await createPlayer(['TESTER'])
    for (const resourceKey of resourceKeys) await tools.adjustResource(player.identity, { resourceKey, amount: 5n, direction: 'add', idempotencyKey: randomUUID() })
    const key = randomUUID()
    await tools.adjustResource(player.identity, { resourceKey: 'primogems', amount: 9007199254740993n, direction: 'add', idempotencyKey: key })
    await tools.adjustResource(player.identity, { resourceKey: 'primogems', amount: 9007199254740993n, direction: 'add', idempotencyKey: key })
    await expect(tools.adjustResource(player.identity, { resourceKey: 'primogems', amount: 1n, direction: 'add', idempotencyKey: key })).rejects.toMatchObject({ code: 'MODERATION_IDEMPOTENCY_CONFLICT' })
    await tools.adjustResource(player.identity, { resourceKey: 'moras', amount: 6n, direction: 'remove', idempotencyKey: randomUUID() })
    await expect(tools.adjustResource(player.identity, { resourceKey: 'moras', amount: 999999n, direction: 'remove', idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'MODERATION_INSUFFICIENT_RESOURCE' })
    expect((await database.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId: player.id, resourceKey: 'primogems' } } })).amount).toBe(1005n + 9007199254740993n)
    expect(await database.resourceMovement.count({ where: { playerId: player.id, operation: { idempotencyKey: key } } })).toBe(1)
    expect(await database.adminAuditEntry.count({ where: { targetPlayerId: player.id, operation: { idempotencyKey: key } } })).toBe(1)
    expect(await database.playerEconomyStats.findUniqueOrThrow({ where: { playerId: player.id } })).toMatchObject({ totalPrimosEarned: 17n, totalPrimosSpent: 9n, totalMorasEarned: 8n, totalMorasSpent: 4n, totalMainElementParticlesEarned: 3n })
  }, 20_000)

  it('sets XP and 28/30 without rewards or message-stat changes', async () => {
    const player = await createPlayer(['TESTER'])
    let state = await tools.setXp(player.identity, { totalXp: 90n, idempotencyKey: randomUUID() })
    expect(state.progression).toMatchObject({ level: 3, xpIntoCurrentStep: '0' })
    state = await tools.setXp(player.identity, { prepareNextLevel: true, idempotencyKey: randomUUID() })
    expect(state.progression).toMatchObject({ level: 3, xpIntoCurrentStep: '28', xpPerStep: '30', totalMessages: '12', countedMessages: '7' })
    await expect(tools.setXp(player.identity, { totalXp: 3000n, idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'MODERATION_INVALID_XP' })
    expect(await database.resourceMovement.count({ where: { playerId: player.id } })).toBe(0)
  })

  it('sets bounded pity, guarantee, capture and Stella without pulls or characters', async () => {
    const player = await createPlayer(['TESTER'])
    let state = await tools.setGacha(player.identity, { pity5: 89, pity4: 9, guaranteedFeatured5: true, captureProgress: 3, idempotencyKey: randomUUID() })
    expect(state.gachaState).toMatchObject({ pity5: 89, pity4: 9, guaranteedFeatured5: true, captureProgress: 3, totalPulls: '0' })
    await expect(tools.setGacha(player.identity, { pity5: 90, idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'MODERATION_INVALID_PITY' })
    await expect(tools.setGacha(player.identity, { pity4: 10, idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'MODERATION_INVALID_PITY' })
    await expect(tools.setGacha(player.identity, { captureProgress: 4, idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'MODERATION_INVALID_CAPTURE' })
    for (const quantity of [0n, 1n, 9007199254740993n]) state = await tools.setStella(player.identity, { quantity, idempotencyKey: randomUUID() })
    expect(state.stella.quantity).toBe('9007199254740993')
    await expect(tools.setStella(player.identity, { quantity: -1n, idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'MODERATION_INVALID_AMOUNT' })
    expect(await database.playerCharacter.count({ where: { playerId: player.id } })).toBe(0)
    expect(await database.pullOperation.count({ where: { playerId: player.id } })).toBe(0)
  })
})
