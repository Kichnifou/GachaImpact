import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';
import { AppError } from '../../api/errors.js';
import { AdminOperation } from './admin-operation.js';
import type { ModerationRole } from './moderation-tools.js';

const ROLE_LOCK = 70422402;

export class RoleAdminService {
  private readonly operation: AdminOperation;
  constructor(database: PrismaClient, getPlayer: GetCurrentPlayer) {
    this.operation = new AdminOperation(database, getPlayer);
  }

  async setRole(identity: AuthenticatedIdentity, targetPlayerId: string, role: ModerationRole, enabled: boolean, idempotencyKey: string) {
    if (!['TESTER', 'MODERATOR', 'ADMIN'].includes(role)) throw new AppError('Rôle invalide.', 400, 'VALIDATION_ERROR');
    return this.operation.run(identity, {
      scope: 'ADMIN', targetPlayerId, domain: 'roles', action: enabled ? `grant-${role.toLowerCase()}` : `revoke-${role.toLowerCase()}`,
      idempotencyKey, request: { role, enabled }, lockKey: ROLE_LOCK,
      change: async (tx, actorId) => {
        const target = await tx.player.findUnique({ where: { id: targetPlayerId }, select: { id: true, status: true } });
        if (!target || target.status !== 'ACTIVE') throw new AppError('Joueur introuvable ou inactif.', 404, 'MODERATION_TARGET_NOT_FOUND');
        const active = await tx.playerRoleAssignment.findFirst({ where: { playerId: targetPlayerId, role, revokedAt: null }, select: { id: true } });
        if (!enabled && role === 'ADMIN' && active) {
          const total = await tx.playerRoleAssignment.count({ where: { role: 'ADMIN', revokedAt: null, player: { status: 'ACTIVE' } } });
          if (total <= 1) throw new AppError('Impossible de retirer le dernier administrateur actif.', 409, 'MODERATION_LAST_ADMIN');
        }
        if (enabled && !active) await tx.playerRoleAssignment.create({ data: {
          playerId: targetPlayerId, role, grantedByPlayerId: actorId, source: 'moderation-admin-ui',
        } });
        if (!enabled && active) await tx.playerRoleAssignment.update({ where: { id: active.id }, data: { revokedAt: new Date() } });
        return { before: { playerId: targetPlayerId, role, enabled: Boolean(active) }, after: { playerId: targetPlayerId, role, enabled } };
      },
    });
  }
}
