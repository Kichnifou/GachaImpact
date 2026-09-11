import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js'
import { BusinessError } from '../../application/errors.js'
import type { ModerationPermissionsDto, ModerationPlayerDto, ModerationPlayerListQuery, ModerationRole, ModerationStateDto, ModerationTools } from '../../application/moderation/moderation-tools.js'
import type { GetCurrentPlayer } from '../../application/player/get-current-player.js'
import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js'
import { derivePlayerProgression, MAX_PLAYER_LEVEL, XP_PER_LEVEL } from '../../domain/player/player-progression.js'

const stellaKey = 'masterless-stella-fortuna'
const activeStatus = 'ACTIVE' as const
const playerPageSize = 10 as const
const playerNameCollator = new Intl.Collator('fr-FR', { sensitivity: 'base', numeric: true })

export class PrismaModerationTools implements ModerationTools {
  public constructor(private readonly database: PrismaClient, private readonly getCurrentPlayer: GetCurrentPlayer) {}
  public async getPermissions(identity: AuthenticatedIdentity) { return this.permissionsFor((await this.getCurrentPlayer.execute(identity)).id) }
  public async getState(identity: AuthenticatedIdentity, targetPlayerId?: string) {
    const actor = await this.getCurrentPlayer.execute(identity)
    return this.snapshot((await this.authorizeTarget(actor.id, targetPlayerId ?? actor.id, 'state')).id, await this.permissionsFor(actor.id))
  }
  public async listPlayers(identity: AuthenticatedIdentity, query: ModerationPlayerListQuery) {
    const actor = await this.getCurrentPlayer.execute(identity)
    if (!(await this.permissionsFor(actor.id)).capabilities.canSelectPlayers) throw forbidden()
    const rows = await this.database.player.findMany({
      where: { status: activeStatus },
      select: {
        id: true,
        displayName: true,
        elementKey: true,
        progression: { select: { xp: true } },
        rolesGranted: { where: { revokedAt: null }, select: { role: true } },
      },
    })
    const needle = normalizePlayerSearch(query.query)
    const direction = query.direction === 'asc' ? 1 : -1
    const players: ModerationPlayerDto[] = rows
      .map((row) => ({
        id: row.id,
        displayName: row.displayName,
        elementKey: row.elementKey,
        level: Math.min(MAX_PLAYER_LEVEL, Number((row.progression?.xp ?? 0n) / XP_PER_LEVEL)),
        tester: row.rolesGranted.some(({ role }) => role === 'TESTER'),
        rank: rankFromRoles(row.rolesGranted.map(({ role }) => role)),
      }))
      .filter((player) => (!needle || normalizePlayerSearch(player.displayName).includes(needle))
        && (!query.elementKey || player.elementKey === query.elementKey)
        && (query.tester === 'all' || player.tester === (query.tester === 'tester')))
      .sort((left, right) => {
        const primary = query.sort === 'level'
          ? left.level - right.level
          : playerNameCollator.compare(left.displayName, right.displayName)
        if (primary !== 0) return primary * direction
        const nameTieBreak = playerNameCollator.compare(left.displayName, right.displayName)
        if (nameTieBreak !== 0) return nameTieBreak
        return left.id.localeCompare(right.id)
      })
    const total = players.length
    const totalPages = Math.max(1, Math.ceil(total / playerPageSize))
    const page = Math.min(query.page, totalPages)
    const offset = (page - 1) * playerPageSize
    return { players: players.slice(offset, offset + playerPageSize), page, pageSize: playerPageSize, total, totalPages }
  }
  public async adjustResource(identity: AuthenticatedIdentity, targetPlayerId: string, input: Parameters<ModerationTools['adjustResource']>[2]) {
    const actor = await this.getCurrentPlayer.execute(identity); const target = await this.authorizeTarget(actor.id, targetPlayerId, 'resource')
    if (input.amount <= 0n) throw new BusinessError('MODERATION_INVALID_AMOUNT', 'Le montant doit être un entier strictement positif.')
    await this.mutate(actor.id, target.id, 'resources', 'adjust-resource', input.idempotencyKey, input, async (tx, operationId) => {
      await tx.$queryRaw`SELECT amount FROM player_resource_balances WHERE player_id = ${target.id}::uuid AND resource_key = ${input.resourceKey} FOR UPDATE`
      const balance = await tx.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId: target.id, resourceKey: input.resourceKey } } }); const delta = input.direction === 'add' ? input.amount : -input.amount; const amountAfter = balance.amount + delta
      if (amountAfter < 0n) throw new BusinessError('MODERATION_INSUFFICIENT_RESOURCE', 'Le solde de cette ressource est insuffisant.')
      await tx.playerResourceBalance.update({ where: { playerId_resourceKey: { playerId: target.id, resourceKey: input.resourceKey } }, data: { amount: amountAfter } })
      await tx.resourceMovement.create({ data: { playerId: target.id, resourceKey: input.resourceKey, delta, balanceBefore: balance.amount, balanceAfter: amountAfter, causeKey: 'moderation.test-tool', domainKey: 'moderation', operationId, sourceChannel: 'ADMIN' } })
      return [{ resourceKey: input.resourceKey, amount: balance.amount.toString() }, { resourceKey: input.resourceKey, amount: amountAfter.toString() }]
    }); return this.snapshot(target.id, await this.permissionsFor(actor.id))
  }
  public async setXp(identity: AuthenticatedIdentity, targetPlayerId: string, input: Parameters<ModerationTools['setXp']>[2]) {
    const actor = await this.getCurrentPlayer.execute(identity); const target = await this.authorizeTarget(actor.id, targetPlayerId, 'gameplay')
    await this.mutate(actor.id, target.id, 'progression', input.prepareNextLevel ? 'prepare-next-level' : 'set-xp', input.idempotencyKey, input, async (tx) => {
      const before = await tx.playerProgression.findUniqueOrThrow({ where: { playerId: target.id } }); const value = input.prepareNextLevel ? (before.xp / XP_PER_LEVEL) * XP_PER_LEVEL + 29n : input.totalXp
      if (value === undefined || value < 0n || value >= XP_PER_LEVEL * BigInt(MAX_PLAYER_LEVEL)) throw new BusinessError('MODERATION_INVALID_XP', 'L’XP doit produire un niveau strictement inférieur à 100.')
      await tx.playerProgression.update({ where: { playerId: target.id }, data: { xp: value } }); return [{ totalXp: before.xp.toString() }, { totalXp: value.toString() }]
    }); return this.snapshot(target.id, await this.permissionsFor(actor.id))
  }
  public async setGacha(identity: AuthenticatedIdentity, targetPlayerId: string, input: Parameters<ModerationTools['setGacha']>[2]) {
    const actor = await this.getCurrentPlayer.execute(identity); const target = await this.authorizeTarget(actor.id, targetPlayerId, 'gameplay')
    if ((input.pity5 !== undefined && (input.pity5 < 0 || input.pity5 > 89)) || (input.pity4 !== undefined && (input.pity4 < 0 || input.pity4 > 9))) throw new BusinessError('MODERATION_INVALID_PITY', 'La valeur de pity est hors limites.')
    if (input.captureProgress !== undefined && (input.captureProgress < 0 || input.captureProgress > 3)) throw new BusinessError('MODERATION_INVALID_CAPTURE', 'La Capture doit être comprise entre 0 et 3.')
    await this.mutate(actor.id, target.id, 'gacha', 'set-state', input.idempotencyKey, input, async (tx) => { const before = await tx.playerGachaState.findUniqueOrThrow({ where: { playerId: target.id } }); const after = await tx.playerGachaState.update({ where: { playerId: target.id }, data: { pity5: input.pity5, pity4: input.pity4, guaranteedFeatured5: input.guaranteedFeatured5, captureProgress: input.captureProgress } }); return [gachaAudit(before), gachaAudit(after)] }); return this.snapshot(target.id, await this.permissionsFor(actor.id))
  }
  public async setStella(identity: AuthenticatedIdentity, targetPlayerId: string, input: Parameters<ModerationTools['setStella']>[2]) {
    const actor = await this.getCurrentPlayer.execute(identity); const target = await this.authorizeTarget(actor.id, targetPlayerId, 'gameplay')
    if (input.quantity < 0n) throw new BusinessError('MODERATION_INVALID_AMOUNT', 'La quantité de Stella ne peut pas être négative.')
    await this.mutate(actor.id, target.id, 'objects', 'set-stella', input.idempotencyKey, input, async (tx) => { const definition = await tx.itemDefinition.findUniqueOrThrow({ where: { externalKey: stellaKey }, select: { id: true } }); const before = await tx.playerItem.findUnique({ where: { playerId_itemId: { playerId: target.id, itemId: definition.id } } }); await tx.playerItem.upsert({ where: { playerId_itemId: { playerId: target.id, itemId: definition.id } }, create: { playerId: target.id, itemId: definition.id, quantity: input.quantity, firstObtainedAt: input.quantity > 0n ? new Date() : null }, update: { quantity: input.quantity, firstObtainedAt: input.quantity > 0n ? before?.firstObtainedAt ?? new Date() : before?.firstObtainedAt } }); return [{ quantity: before?.quantity.toString() ?? '0' }, { quantity: input.quantity.toString() }] }); return this.snapshot(target.id, await this.permissionsFor(actor.id))
  }
  public async setTester(identity: AuthenticatedIdentity, targetPlayerId: string, enabled: boolean, idempotencyKey: string) {
    const actor = await this.getCurrentPlayer.execute(identity); const target = await this.authorizeTarget(actor.id, targetPlayerId, 'roles')
    if (target.id === actor.id) throw new BusinessError('MODERATION_SELF_ROLE_FORBIDDEN', 'Vous ne pouvez pas modifier votre propre rôle Testeur ici.')
    await this.mutate(actor.id, target.id, 'roles', enabled ? 'grant-tester' : 'revoke-tester', idempotencyKey, { enabled }, async (tx) => { const active = await tx.playerRoleAssignment.findFirst({ where: { playerId: target.id, role: 'TESTER', revokedAt: null }, orderBy: { grantedAt: 'desc' } }); if (enabled && !active) await tx.playerRoleAssignment.create({ data: { playerId: target.id, role: 'TESTER', grantedByPlayerId: actor.id, source: 'moderation-super-ui' } }); if (!enabled && active) await tx.playerRoleAssignment.update({ where: { id: active.id }, data: { revokedAt: new Date() } }); return [{ tester: Boolean(active) }, { tester: enabled }] }); return this.snapshot(target.id, await this.permissionsFor(actor.id))
  }
  private async authorizeTarget(actorPlayerId: string, targetPlayerId: string, purpose: 'state' | 'resource' | 'gameplay' | 'roles') {
    const permissions = await this.permissionsFor(actorPlayerId); const self = actorPlayerId === targetPlayerId
    if (purpose === 'state' && (!permissions.capabilities.moderationAccess || (!self && !permissions.capabilities.superTools))) throw forbidden()
    if (purpose === 'resource' && !(self ? permissions.capabilities.selfResourceTools : permissions.capabilities.superTools)) throw forbidden()
    if (purpose === 'gameplay' && !(self ? permissions.capabilities.selfGameplayTools : permissions.capabilities.superTools)) throw forbidden()
    if (purpose === 'roles' && !permissions.capabilities.canManageTesters) throw forbidden()
    const target = await this.database.player.findUnique({ where: { id: targetPlayerId }, select: { id: true, status: true } }); if (!target || target.status !== activeStatus) throw new BusinessError('MODERATION_TARGET_NOT_FOUND', 'Le joueur ciblé est introuvable ou inactif.'); return target
  }
  private async permissionsFor(playerId: string): Promise<ModerationPermissionsDto> {
    const rows = await this.database.playerRoleAssignment.findMany({ where: { playerId, revokedAt: null }, select: { role: true }, orderBy: { grantedAt: 'asc' } }); const roles = rows.map(({ role }) => role).filter((role): role is ModerationRole => role === 'MODERATOR' || role === 'TESTER' || role === 'ADMIN'); const superTools = roles.includes('ADMIN'); const testerTools = roles.includes('TESTER'); const selfResourceTools = superTools || testerTools; const selfGameplayTools = superTools || testerTools; return { roles, capabilities: { moderationAccess: selfResourceTools || selfGameplayTools, selfResourceTools, selfGameplayTools, superTools, canSelectPlayers: superTools, canManageTesters: superTools } }
  }
  private async mutate(actorPlayerId: string, targetPlayerId: string, domain: string, action: string, idempotencyKey: string, payload: unknown, change: (tx: Prisma.TransactionClient, operationId: string) => Promise<readonly [Prisma.InputJsonValue, Prisma.InputJsonValue]>) {
    const request = serializeModerationRequest({ actorPlayerId, targetPlayerId, action, payload }); await this.database.$transaction(async (tx) => { const existing = await tx.businessOperation.findFirst({ where: { sourceChannel: 'ADMIN', idempotencyKey } }); if (existing) { const summary = existing.resultSummary && typeof existing.resultSummary === 'object' && !Array.isArray(existing.resultSummary) ? existing.resultSummary : null; if (existing.playerId !== targetPlayerId || existing.operationType !== `moderation.${domain}.${action}` || jsonFingerprint(summary?.request) !== jsonFingerprint(request) || existing.status !== 'COMPLETED') throw new BusinessError('MODERATION_IDEMPOTENCY_CONFLICT', 'Cette clé d’idempotence appartient à une autre opération.'); return } const operation = await tx.businessOperation.create({ data: { playerId: targetPlayerId, operationType: `moderation.${domain}.${action}`, sourceChannel: 'ADMIN', idempotencyKey, status: 'PENDING', resultSummary: { request } } }); const [before, after] = await change(tx, operation.id); await tx.adminAuditEntry.create({ data: { actorPlayerId, targetPlayerId, action, domain, before, after, operationId: operation.id } }); await tx.businessOperation.update({ where: { id: operation.id }, data: { status: 'COMPLETED', completedAt: new Date(), resultSummary: { domain, action, request } } }) }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  }
  private async snapshot(playerId: string, actorPermissions?: ModerationPermissionsDto): Promise<ModerationStateDto> {
    const [permissions, player, balances, progressionState, gacha, stella] = await Promise.all([actorPermissions ?? this.permissionsFor(playerId), this.database.player.findUniqueOrThrow({ where: { id: playerId }, select: { id: true, displayName: true, elementKey: true, rolesGranted: { where: { revokedAt: null }, select: { role: true } } } }), this.database.playerResourceBalance.findMany({ where: { playerId }, select: { resourceKey: true, amount: true } }), this.database.playerProgression.findUniqueOrThrow({ where: { playerId } }), this.database.playerGachaState.findUniqueOrThrow({ where: { playerId } }), this.database.playerItem.findFirst({ where: { playerId, item: { externalKey: stellaKey } }, select: { quantity: true } })]); const amounts = new Map(balances.map((value) => [value.resourceKey, value.amount.toString()])); const progression = derivePlayerProgression(progressionState); const roles = player.rolesGranted.map(({ role }) => role); return { player: { id: player.id, displayName: player.displayName, elementKey: player.elementKey, level: progression.level, tester: roles.includes('TESTER'), rank: rankFromRoles(roles) }, permissions, resources: { primogems: amounts.get('primogems') ?? '0', moras: amounts.get('moras') ?? '0', particles: Object.fromEntries(['pyro','hydro','cryo','electro','anemo','geo','dendro'].map((key) => [key, amounts.get(`particles_${key}`) ?? '0'])) }, progression: { totalXp: progression.totalXp.toString(), level: progression.level, xpIntoCurrentStep: progression.xpIntoCurrentStep.toString(), xpPerStep: progression.xpPerStep.toString(), isMaxLevel: progression.isMaxLevel, level100OverflowRewardsClaimed: progression.level100OverflowRewardsClaimed, totalMessages: progression.totalMessages.toString(), countedMessages: progression.countedMessages.toString() }, gachaState: { ...gacha, totalPulls: gacha.totalPulls.toString(), totalFiveStars: gacha.totalFiveStars.toString(), totalFourStars: gacha.totalFourStars.toString(), fiftyFiftyWon: gacha.fiftyFiftyWon.toString(), fiftyFiftyLost: gacha.fiftyFiftyLost.toString(), capturesTriggered: gacha.capturesTriggered.toString() }, stella: { quantity: stella?.quantity.toString() ?? '0' } }
  }
}
function forbidden() { return new BusinessError('MODERATION_FORBIDDEN', 'Vous n’avez pas accès à ces outils de test.') }
export function rankFromRoles(roles: readonly string[]) { if (roles.includes('ADMIN')) return 'SUPER' as const; if (roles.includes('MODERATOR')) return 'MODERATOR' as const; if (roles.includes('TESTER')) return 'TESTER' as const; return 'PLAYER' as const }
function gachaAudit(value: { pity5: number; pity4: number; guaranteedFeatured5: boolean; captureProgress: number }) { return { pity5: value.pity5, pity4: value.pity4, guaranteedFeatured5: value.guaranteedFeatured5, captureProgress: value.captureProgress } }
function serializeModerationRequest(value: unknown): Prisma.InputJsonValue { return JSON.parse(JSON.stringify(value, (_key, entry) => typeof entry === 'bigint' ? entry.toString() : entry)) as Prisma.InputJsonValue }
function jsonFingerprint(value: unknown): string { if (Array.isArray(value)) return `[${value.map(jsonFingerprint).join(',')}]`; if (value && typeof value === 'object') return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => `${JSON.stringify(key)}:${jsonFingerprint(entry)}`).join(',')}}`; return JSON.stringify(value) }
function normalizePlayerSearch(value: string): string { return value.trim().normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('fr-FR') }
