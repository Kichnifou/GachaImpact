import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js'
import { BusinessError } from '../../application/errors.js'
import type { ModerationPermissionsDto, ModerationRole, ModerationStateDto, ModerationTools } from '../../application/moderation/moderation-tools.js'
import type { GetCurrentPlayer } from '../../application/player/get-current-player.js'
import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js'
import { derivePlayerProgression, MAX_PLAYER_LEVEL, XP_PER_LEVEL } from '../../domain/player/player-progression.js'

const stellaKey = 'masterless-stella-fortuna'

export class PrismaModerationTools implements ModerationTools {
  constructor(private readonly database: PrismaClient, private readonly getCurrentPlayer: GetCurrentPlayer) {}

  async getPermissions(identity: AuthenticatedIdentity) {
    const player = await this.getCurrentPlayer.execute(identity)
    return this.permissionsFor(player.id)
  }

  async getState(identity: AuthenticatedIdentity) {
    const player = await this.authorizedPlayer(identity)
    return this.snapshot(player.id)
  }

  async adjustResource(identity: AuthenticatedIdentity, input: Parameters<ModerationTools['adjustResource']>[1]) {
    const player = await this.authorizedPlayer(identity)
    if (input.amount <= 0n) throw new BusinessError('MODERATION_INVALID_AMOUNT', 'Le montant doit être un entier strictement positif.')
    await this.mutate(player.id, 'resources', 'adjust-resource', input.idempotencyKey, serializeModerationRequest(input), async (tx) => {
      await tx.$queryRaw`SELECT amount FROM player_resource_balances WHERE player_id = ${player.id}::uuid AND resource_key = ${input.resourceKey} FOR UPDATE`
      const balance = await tx.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId: player.id, resourceKey: input.resourceKey } } })
      const delta = input.direction === 'add' ? input.amount : -input.amount
      const amountAfter = balance.amount + delta
      if (amountAfter < 0n) throw new BusinessError('MODERATION_INSUFFICIENT_RESOURCE', 'Le solde de cette ressource est insuffisant.')
      await tx.playerResourceBalance.update({ where: { playerId_resourceKey: { playerId: player.id, resourceKey: input.resourceKey } }, data: { amount: amountAfter } })
      await tx.resourceMovement.create({ data: { playerId: player.id, resourceKey: input.resourceKey, delta, balanceBefore: balance.amount, balanceAfter: amountAfter, causeKey: 'moderation.self-test', domainKey: 'moderation', operationId: currentOperationId(tx), sourceChannel: 'ADMIN' } })
      return [{ resourceKey: input.resourceKey, amount: balance.amount.toString() }, { resourceKey: input.resourceKey, amount: amountAfter.toString() }]
    })
    return this.snapshot(player.id)
  }

  async setXp(identity: AuthenticatedIdentity, input: Parameters<ModerationTools['setXp']>[1]) {
    const player = await this.authorizedPlayer(identity)
    await this.mutate(player.id, 'progression', input.prepareNextLevel ? 'prepare-next-level' : 'set-xp', input.idempotencyKey, serializeModerationRequest(input), async (tx) => {
      const before = await tx.playerProgression.findUniqueOrThrow({ where: { playerId: player.id } })
      const value = input.prepareNextLevel ? (before.xp / XP_PER_LEVEL) * XP_PER_LEVEL + 28n : input.totalXp
      if (value === undefined || value < 0n || value >= XP_PER_LEVEL * BigInt(MAX_PLAYER_LEVEL)) throw new BusinessError('MODERATION_INVALID_XP', 'L’XP doit produire un niveau strictement inférieur à 100.')
      await tx.playerProgression.update({ where: { playerId: player.id }, data: { xp: value } })
      return [{ totalXp: before.xp.toString() }, { totalXp: value.toString() }]
    })
    return this.snapshot(player.id)
  }

  async setGacha(identity: AuthenticatedIdentity, input: Parameters<ModerationTools['setGacha']>[1]) {
    const player = await this.authorizedPlayer(identity)
    if (input.pity5 !== undefined && (input.pity5 < 0 || input.pity5 > 89) || input.pity4 !== undefined && (input.pity4 < 0 || input.pity4 > 9)) throw new BusinessError('MODERATION_INVALID_PITY', 'La valeur de pity est hors limites.')
    if (input.captureProgress !== undefined && (input.captureProgress < 0 || input.captureProgress > 3)) throw new BusinessError('MODERATION_INVALID_CAPTURE', 'La Capture doit être comprise entre 0 et 3.')
    await this.mutate(player.id, 'gacha', 'set-state', input.idempotencyKey, serializeModerationRequest(input), async (tx) => {
      const before = await tx.playerGachaState.findUniqueOrThrow({ where: { playerId: player.id } })
      const after = await tx.playerGachaState.update({ where: { playerId: player.id }, data: { pity5: input.pity5, pity4: input.pity4, guaranteedFeatured5: input.guaranteedFeatured5, captureProgress: input.captureProgress } })
      return [gachaAudit(before), gachaAudit(after)]
    })
    return this.snapshot(player.id)
  }

  async setStella(identity: AuthenticatedIdentity, input: Parameters<ModerationTools['setStella']>[1]) {
    const player = await this.authorizedPlayer(identity)
    if (input.quantity < 0n) throw new BusinessError('MODERATION_INVALID_AMOUNT', 'La quantité de Stella ne peut pas être négative.')
    await this.mutate(player.id, 'objects', 'set-stella', input.idempotencyKey, serializeModerationRequest(input), async (tx) => {
      const definition = await tx.itemDefinition.findUniqueOrThrow({ where: { externalKey: stellaKey }, select: { id: true } })
      const before = await tx.playerItem.findUnique({ where: { playerId_itemId: { playerId: player.id, itemId: definition.id } } })
      await tx.playerItem.upsert({ where: { playerId_itemId: { playerId: player.id, itemId: definition.id } }, create: { playerId: player.id, itemId: definition.id, quantity: input.quantity, firstObtainedAt: input.quantity > 0n ? new Date() : null }, update: { quantity: input.quantity, firstObtainedAt: input.quantity > 0n ? before?.firstObtainedAt ?? new Date() : before?.firstObtainedAt } })
      return [{ quantity: before?.quantity.toString() ?? '0' }, { quantity: input.quantity.toString() }]
    })
    return this.snapshot(player.id)
  }

  private async authorizedPlayer(identity: AuthenticatedIdentity) {
    const player = await this.getCurrentPlayer.execute(identity)
    const permissions = await this.permissionsFor(player.id)
    if (!permissions.capabilities.selfTestTools) throw new BusinessError('MODERATION_FORBIDDEN', 'Vous n’avez pas accès aux outils de test.')
    return player
  }

  private async permissionsFor(playerId: string): Promise<ModerationPermissionsDto> {
    const rows = await this.database.playerRoleAssignment.findMany({ where: { playerId, revokedAt: null }, select: { role: true }, orderBy: { grantedAt: 'asc' } })
    const roles = rows.map(({ role }) => role).filter((role): role is ModerationRole => role === 'MODERATOR' || role === 'TESTER' || role === 'ADMIN')
    const selfTestTools = roles.includes('TESTER') || roles.includes('ADMIN')
    return { roles, capabilities: { moderationAccess: selfTestTools, selfTestTools } }
  }

  private async mutate(playerId: string, domain: string, action: string, idempotencyKey: string, request: Prisma.InputJsonValue, change: (tx: Prisma.TransactionClient) => Promise<readonly [Prisma.InputJsonValue, Prisma.InputJsonValue]>) {
    await this.database.$transaction(async (tx) => {
      const existing = await tx.businessOperation.findFirst({ where: { sourceChannel: 'ADMIN', idempotencyKey } })
      if (existing) {
        const summary = existing.resultSummary && typeof existing.resultSummary === 'object' && !Array.isArray(existing.resultSummary) ? existing.resultSummary : null
        if (existing.playerId !== playerId || existing.operationType !== `moderation.${domain}.${action}` || jsonFingerprint(summary?.request) !== jsonFingerprint(request) || existing.status !== 'COMPLETED') throw new BusinessError('MODERATION_IDEMPOTENCY_CONFLICT', 'Cette clé d’idempotence appartient à une autre opération.')
        return
      }
      const operation = await tx.businessOperation.create({ data: { playerId, operationType: `moderation.${domain}.${action}`, sourceChannel: 'ADMIN', idempotencyKey, status: 'PENDING', resultSummary: { request } } })
      operationContext.set(tx, operation.id)
      const [before, after] = await change(tx)
      await tx.adminAuditEntry.create({ data: { actorPlayerId: playerId, targetPlayerId: playerId, action, domain, before, after, operationId: operation.id } })
      await tx.businessOperation.update({ where: { id: operation.id }, data: { status: 'COMPLETED', completedAt: new Date(), resultSummary: { domain, action, request } } })
      operationContext.delete(tx)
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  }

  private async snapshot(playerId: string): Promise<ModerationStateDto> {
    const [permissions, balances, progressionState, gacha, stella] = await Promise.all([
      this.permissionsFor(playerId),
      this.database.playerResourceBalance.findMany({ where: { playerId }, select: { resourceKey: true, amount: true } }),
      this.database.playerProgression.findUniqueOrThrow({ where: { playerId } }),
      this.database.playerGachaState.findUniqueOrThrow({ where: { playerId } }),
      this.database.playerItem.findFirst({ where: { playerId, item: { externalKey: stellaKey } }, select: { quantity: true } }),
    ])
    const amounts = new Map(balances.map((value) => [value.resourceKey, value.amount.toString()]))
    const progression = derivePlayerProgression({ xp: progressionState.xp, level100OverflowRewardsClaimed: progressionState.level100OverflowRewardsClaimed, totalMessages: progressionState.totalMessages, countedMessages: progressionState.countedMessages, lastXpAt: progressionState.lastXpAt, lastXpMessageAt: progressionState.lastXpMessageAt })
    return {
      permissions,
      resources: { primogems: amounts.get('primogems') ?? '0', moras: amounts.get('moras') ?? '0', particles: Object.fromEntries(['pyro','hydro','cryo','electro','anemo','geo','dendro'].map((key) => [key, amounts.get(`particles_${key}`) ?? '0'])) },
      progression: { totalXp: progression.totalXp.toString(), level: progression.level, xpIntoCurrentStep: progression.xpIntoCurrentStep.toString(), xpPerStep: progression.xpPerStep.toString(), isMaxLevel: progression.isMaxLevel, level100OverflowRewardsClaimed: progression.level100OverflowRewardsClaimed, totalMessages: progression.totalMessages.toString(), countedMessages: progression.countedMessages.toString() },
      gachaState: { ...gacha, totalPulls: gacha.totalPulls.toString(), totalFiveStars: gacha.totalFiveStars.toString(), totalFourStars: gacha.totalFourStars.toString(), fiftyFiftyWon: gacha.fiftyFiftyWon.toString(), fiftyFiftyLost: gacha.fiftyFiftyLost.toString(), capturesTriggered: gacha.capturesTriggered.toString() },
      stella: { quantity: stella?.quantity.toString() ?? '0' },
    }
  }
}

const operationContext = new WeakMap<object, string>()
function currentOperationId(tx: Prisma.TransactionClient) { const id = operationContext.get(tx); if (!id) throw new Error('Missing moderation operation context.'); return id }
function gachaAudit(value: { pity5: number; pity4: number; guaranteedFeatured5: boolean; captureProgress: number }) { return { pity5: value.pity5, pity4: value.pity4, guaranteedFeatured5: value.guaranteedFeatured5, captureProgress: value.captureProgress } }
function serializeModerationRequest(value: unknown): Prisma.InputJsonValue { return JSON.parse(JSON.stringify(value, (_key, entry) => typeof entry === 'bigint' ? entry.toString() : entry)) as Prisma.InputJsonValue }
function jsonFingerprint(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(jsonFingerprint).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => `${JSON.stringify(key)}:${jsonFingerprint(entry)}`).join(',')}}`
  return JSON.stringify(value)
}
