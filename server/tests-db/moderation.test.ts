import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
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

beforeAll(cleanupResidualTestFixtures)
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
  const ids = [...playerIds]
  await deletePlayers(ids)
  playerIds.clear()
}

async function deletePlayers(ids: string[]) {
  if (!ids.length) return
  await database.adminAuditEntry.deleteMany({ where: { OR: [{ actorPlayerId: { in: ids } }, { targetPlayerId: { in: ids } }] } })
  await database.resourceMovement.deleteMany({ where: { playerId: { in: ids } } })
  await database.businessOperation.deleteMany({ where: { playerId: { in: ids } } })
  await database.webIdentity.deleteMany({ where: { playerId: { in: ids } } })
  await database.player.deleteMany({ where: { id: { in: ids } } })
}

async function cleanupResidualTestFixtures() {
  const candidates = await database.player.findMany({
    where: {
      displayName: { startsWith: 'Moderation ' },
      webIdentity: { is: { provider: 'supabase', providerSubject: { startsWith: 'moderation-test-' }, state: 'ACTIVE' } },
      rolesGranted: { some: { source: 'test' } },
    },
    select: { id: true, displayName: true },
  })
  const ids = candidates.filter((candidate) => /^Moderation [0-9a-f]{8}$/.test(candidate.displayName)).map((candidate) => candidate.id)
  await deletePlayers(ids)
}

describe('privileged self-test persistence', () => {
  it('keeps MODERATOR powerless while TESTER and ADMIN receive the capability', async () => {
    const moderator = await createPlayer(['MODERATOR'])
    expect(await tools.getPermissions(moderator.identity)).toEqual({ roles: ['MODERATOR'], capabilities: { moderationAccess: false, selfResourceTools: false, selfGameplayTools: false, superTools: false, canSelectPlayers: false, canManageTesters: false } })
    await expect(tools.getState(moderator.identity)).rejects.toMatchObject({ code: 'MODERATION_FORBIDDEN' })
    const tester = await createPlayer(['TESTER'])
    expect((await tools.getState(tester.identity)).permissions.capabilities.selfResourceTools).toBe(true)
    expect((await tools.getState(tester.identity)).permissions.capabilities.selfGameplayTools).toBe(true)
    const admin = await createPlayer(['ADMIN'])
    expect((await tools.getState(admin.identity)).permissions.capabilities.superTools).toBe(true)
  })

  it('filters the database before its twenty-player search limit', async () => {
    const admin = await createPlayer(['ADMIN'])
    const prefix = `Scale ${randomUUID().slice(0, 8)}`
    const fillers = await Promise.all(Array.from({ length: 101 }, (_, index) => database.player.create({ data: { displayName: `${prefix} ${String(index).padStart(3, '0')}` } })))
    const match = await database.player.create({ data: { displayName: `${prefix} zzz-match`, elementKey: 'pyro' } })
    fillers.forEach((player) => playerIds.add(player.id)); playerIds.add(match.id)

    const result = await tools.listPlayers(admin.identity, { query: 'ZZZ-MATCH', elementKey: null, tester: 'all', sort: 'name', direction: 'asc', page: 1 })
    expect(result).toEqual({ players: [expect.objectContaining({ id: match.id, displayName: `${prefix} zzz-match`, elementKey: 'pyro', level: 0, tester: false })], page: 1, pageSize: 10, total: 1, totalPages: 1 })
  })

  it('derives the targeted player rank from the target active roles with strict hierarchy', async () => {
    const admin = await createPlayer(['ADMIN'])
    const cases = [
      { roles: ['ADMIN', 'MODERATOR', 'TESTER'] as const, rank: 'SUPER' },
      { roles: ['MODERATOR', 'TESTER'] as const, rank: 'MODERATOR' },
      { roles: ['TESTER'] as const, rank: 'TESTER' },
      { roles: [] as const, rank: 'PLAYER' },
    ]
    for (const candidate of cases) { const target = await createPlayer(candidate.roles); expect((await tools.getState(admin.identity, target.id)).player.rank).toBe(candidate.rank) }
  })

  it('normalizes accents and applies combined filters, stable sorts and ten-player pagination on the server', async () => {
    const admin = await createPlayer(['ADMIN'])
    const prefix = `Browser ${process.pid}-${Date.now()}`
    const created = await Promise.all(Array.from({ length: 23 }, (_, index) => database.player.create({ data: {
      displayName: `${prefix} ${index === 22 ? 'Céo' : String(index).padStart(2, '0')}`,
      elementKey: index < 12 ? 'hydro' : 'geo',
      progression: { create: { xp: BigInt(index * 30) } },
      rolesGranted: index < 12 ? { create: { role: 'TESTER', source: 'test' } } : undefined,
    } })))
    created.forEach(({ id }) => playerIds.add(id))

    const base = { query: prefix, elementKey: null, tester: 'all' as const, sort: 'name' as const, direction: 'asc' as const }
    const lastPage = await tools.listPlayers(admin.identity, { ...base, page: 999 })
    expect(lastPage).toMatchObject({ page: 3, pageSize: 10, total: 23, totalPages: 3 })
    expect(lastPage.players).toHaveLength(3)

    const filtered = await tools.listPlayers(admin.identity, { ...base, elementKey: 'hydro', tester: 'tester', sort: 'level', direction: 'desc', page: 1 })
    expect(filtered).toMatchObject({ page: 1, pageSize: 10, total: 12, totalPages: 2 })
    expect(filtered.players.every(({ elementKey, tester }) => elementKey === 'hydro' && tester)).toBe(true)
    expect(filtered.players.map(({ level }) => level)).toEqual([11, 10, 9, 8, 7, 6, 5, 4, 3, 2])

    for (const query of ['ce', 'ceo', 'CEO']) {
      const normalized = await tools.listPlayers(admin.identity, { ...base, query, page: 1 })
      expect(normalized.players.map(({ displayName }) => displayName)).toContain(`${prefix} Céo`)
    }
  })

  it('adjusts all resources losslessly without gameplay stats and makes retries one movement/audit', async () => {
    const player = await createPlayer(['TESTER'])
    for (const resourceKey of resourceKeys) await tools.adjustResource(player.identity, player.id, { resourceKey, amount: 5n, direction: 'add', idempotencyKey: randomUUID() })
    const key = randomUUID()
    await tools.adjustResource(player.identity, player.id, { resourceKey: 'primogems', amount: 9007199254740993n, direction: 'add', idempotencyKey: key })
    await tools.adjustResource(player.identity, player.id, { resourceKey: 'primogems', amount: 9007199254740993n, direction: 'add', idempotencyKey: key })
    await expect(tools.adjustResource(player.identity, player.id, { resourceKey: 'primogems', amount: 1n, direction: 'add', idempotencyKey: key })).rejects.toMatchObject({ code: 'MODERATION_IDEMPOTENCY_CONFLICT' })
    await tools.adjustResource(player.identity, player.id, { resourceKey: 'moras', amount: 6n, direction: 'remove', idempotencyKey: randomUUID() })
    await expect(tools.adjustResource(player.identity, player.id, { resourceKey: 'moras', amount: 999999n, direction: 'remove', idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'MODERATION_INSUFFICIENT_RESOURCE' })
    expect((await database.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId: player.id, resourceKey: 'primogems' } } })).amount).toBe(1005n + 9007199254740993n)
    expect(await database.resourceMovement.count({ where: { playerId: player.id, operation: { idempotencyKey: key } } })).toBe(1)
    expect(await database.adminAuditEntry.count({ where: { targetPlayerId: player.id, operation: { idempotencyKey: key } } })).toBe(1)
    expect(await database.playerEconomyStats.findUniqueOrThrow({ where: { playerId: player.id } })).toMatchObject({ totalPrimosEarned: 17n, totalPrimosSpent: 9n, totalMorasEarned: 8n, totalMorasSpent: 4n, totalMainElementParticlesEarned: 3n })
  }, 20_000)

  it('sets XP and 29/30 without rewards or message-stat changes', async () => {
    const player = await createPlayer(['TESTER']); const admin = await createPlayer(['ADMIN'])
    let state = await tools.setXp(admin.identity, player.id, { totalXp: 90n, idempotencyKey: randomUUID() })
    expect(state.progression).toMatchObject({ level: 3, xpIntoCurrentStep: '0' })
    state = await tools.setXp(admin.identity, player.id, { prepareNextLevel: true, idempotencyKey: randomUUID() })
    expect(state.progression).toMatchObject({ level: 3, xpIntoCurrentStep: '29', xpPerStep: '30', totalMessages: '12', countedMessages: '7' })
    await expect(tools.setXp(admin.identity, player.id, { totalXp: 3000n, idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'MODERATION_INVALID_XP' })
    expect(await database.resourceMovement.count({ where: { playerId: player.id } })).toBe(0)
  })

  it('sets bounded pity, guarantee, capture and Stella without pulls or characters', async () => {
    const player = await createPlayer(['TESTER'])
    const admin = await createPlayer(['ADMIN']); let state = await tools.setGacha(admin.identity, player.id, { pity5: 89, pity4: 9, guaranteedFeatured5: true, captureProgress: 3, idempotencyKey: randomUUID() })
    expect(state.gachaState).toMatchObject({ pity5: 89, pity4: 9, guaranteedFeatured5: true, captureProgress: 3, totalPulls: '0' })
    await expect(tools.setGacha(admin.identity, player.id, { pity5: 90, idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'MODERATION_INVALID_PITY' })
    await expect(tools.setGacha(admin.identity, player.id, { pity4: 10, idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'MODERATION_INVALID_PITY' })
    await expect(tools.setGacha(admin.identity, player.id, { captureProgress: 4, idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'MODERATION_INVALID_CAPTURE' })
    for (const quantity of [0n, 1n, 9007199254740993n]) state = await tools.setStella(admin.identity, player.id, { quantity, idempotencyKey: randomUUID() })
    expect(state.stella.quantity).toBe('9007199254740993')
    await expect(tools.setStella(admin.identity, player.id, { quantity: -1n, idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'MODERATION_INVALID_AMOUNT' })
    expect(await database.playerCharacter.count({ where: { playerId: player.id } })).toBe(0)
    expect(await database.pullOperation.count({ where: { playerId: player.id } })).toBe(0)
  })

  it('lets Super mutate another active Player once, preserving actor and target in the audit', async () => {
    const superPlayer = await createPlayer(['ADMIN'])
    const target = await createPlayer([])
    const key = randomUUID()
    await tools.adjustResource(superPlayer.identity, target.id, { resourceKey: 'primogems', amount: 1000n, direction: 'add', idempotencyKey: key })
    await tools.adjustResource(superPlayer.identity, target.id, { resourceKey: 'primogems', amount: 1000n, direction: 'add', idempotencyKey: key })
    expect((await database.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId: target.id, resourceKey: 'primogems' } } })).amount).toBe(2000n)
    expect((await database.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId: superPlayer.id, resourceKey: 'primogems' } } })).amount).toBe(1000n)
    await expect(tools.adjustResource(superPlayer.identity, superPlayer.id, { resourceKey: 'primogems', amount: 1000n, direction: 'add', idempotencyKey: key })).rejects.toMatchObject({ code: 'MODERATION_IDEMPOTENCY_CONFLICT' })
    expect(await database.adminAuditEntry.findFirstOrThrow({ where: { operation: { idempotencyKey: key } } })).toMatchObject({ actorPlayerId: superPlayer.id, targetPlayerId: target.id })
  })

  it('gives Testeur every self gameplay tool, refuses external targets, and lets Super manage TESTER idempotently', async () => {
    const superPlayer = await createPlayer(['ADMIN'])
    const tester = await createPlayer(['TESTER'])
    const target = await createPlayer([])
    await expect(tools.listPlayers(tester.identity, { query: '', elementKey: null, tester: 'all', sort: 'name', direction: 'asc', page: 1 })).rejects.toMatchObject({ code: 'MODERATION_FORBIDDEN' })
    await expect(tools.getState(tester.identity, target.id)).rejects.toMatchObject({ code: 'MODERATION_FORBIDDEN' })
    await expect(tools.adjustResource(tester.identity, target.id, { resourceKey: 'primogems', amount: 1n, direction: 'add', idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'MODERATION_FORBIDDEN' })
    await expect(tools.setXp(tester.identity, tester.id, { totalXp: 90n, idempotencyKey: randomUUID() })).resolves.toMatchObject({ progression: { totalXp: '90' } })
    await expect(tools.setGacha(tester.identity, tester.id, { pity5: 1, idempotencyKey: randomUUID() })).resolves.toMatchObject({ gachaState: { pity5: 1 } })
    await expect(tools.setStella(tester.identity, tester.id, { quantity: 1n, idempotencyKey: randomUUID() })).resolves.toMatchObject({ stella: { quantity: '1' } })
    await expect(tools.setXp(tester.identity, target.id, { totalXp: 90n, idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'MODERATION_FORBIDDEN' })
    await expect(tools.setGacha(tester.identity, target.id, { pity5: 1, idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'MODERATION_FORBIDDEN' })
    await expect(tools.setStella(tester.identity, target.id, { quantity: 1n, idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'MODERATION_FORBIDDEN' })
    const grantKey = randomUUID()
    await tools.setTester(superPlayer.identity, target.id, true, grantKey)
    await tools.setTester(superPlayer.identity, target.id, true, grantKey)
    expect(await database.playerRoleAssignment.count({ where: { playerId: target.id, role: 'TESTER', revokedAt: null } })).toBe(1)
    await tools.setTester(superPlayer.identity, target.id, false, randomUUID())
    expect(await database.playerRoleAssignment.count({ where: { playerId: target.id, role: 'TESTER', revokedAt: { not: null } } })).toBe(1)
    expect((await tools.getPermissions(target.identity)).capabilities.moderationAccess).toBe(false)
  })
})
