import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';
import { AppError } from '../../api/errors.js';
import { isPrismaConcurrencyCollision } from '../../infrastructure/database/prisma-concurrency.js';

export type AdminScope = 'ADMIN' | 'COMMUNITY';
export type AdminChange = Readonly<{ before: Prisma.InputJsonValue; after: Prisma.InputJsonValue }>;

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${stable(entry)}`).join(',')}}`;
  return JSON.stringify(value);
}

export class AdminOperation {
  constructor(private readonly database: PrismaClient, private readonly getPlayer: GetCurrentPlayer) {}

  async actor(identity: AuthenticatedIdentity, scope: AdminScope): Promise<string> {
    const actor = await this.getPlayer.execute(identity);
    const allowed = await this.database.playerRoleAssignment.count({ where: {
      playerId: actor.id, revokedAt: null, role: { in: scope === 'ADMIN' ? ['ADMIN'] : ['ADMIN', 'MODERATOR'] },
    } });
    if (!allowed) throw new AppError('Accès interdit.', 403, 'MODERATION_FORBIDDEN');
    return actor.id;
  }

  async run(identity: AuthenticatedIdentity, input: {
    scope: AdminScope; targetPlayerId?: string; domain: string; action: string;
    idempotencyKey: string; request: Prisma.InputJsonValue; lockKey?: number;
    change: (tx: Prisma.TransactionClient, actorId: string, operationId: string) => Promise<AdminChange>;
  }): Promise<{ operationId: string; alreadyProcessed: boolean }> {
    const actorId = (await this.getPlayer.execute(identity)).id;
    const targetPlayerId = input.targetPlayerId ?? actorId;
    const operationType = `moderation.${input.domain}.${input.action}`;
    const fingerprint = stable({ actorId, targetPlayerId, request: input.request });
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        return await this.database.$transaction(async tx => {
          if (input.lockKey !== undefined) await tx.$executeRaw`SELECT pg_advisory_xact_lock(${input.lockKey})`;
          await tx.$queryRaw`SELECT id FROM players WHERE id = ${actorId}::uuid FOR UPDATE`;
          const existing = await tx.businessOperation.findFirst({ where: { sourceChannel: 'ADMIN', idempotencyKey: input.idempotencyKey } });
          if (existing) {
            const summary = existing.resultSummary && typeof existing.resultSummary === 'object' && !Array.isArray(existing.resultSummary) ? existing.resultSummary : null;
            if (existing.playerId !== targetPlayerId || existing.operationType !== operationType || summary?.fingerprint !== fingerprint || existing.status !== 'COMPLETED') {
              throw new AppError('Cette clé appartient à une autre opération.', 409, 'MODERATION_IDEMPOTENCY_CONFLICT');
            }
            return { operationId: existing.id, alreadyProcessed: true };
          }
          const allowed = await tx.playerRoleAssignment.count({ where: {
            playerId: actorId, revokedAt: null, role: { in: input.scope === 'ADMIN' ? ['ADMIN'] : ['ADMIN', 'MODERATOR'] },
          } });
          if (!allowed) throw new AppError('Accès interdit.', 403, 'MODERATION_FORBIDDEN');
          const operation = await tx.businessOperation.create({ data: {
            playerId: targetPlayerId, sourceChannel: 'ADMIN', operationType, idempotencyKey: input.idempotencyKey,
            status: 'PENDING', resultSummary: { fingerprint },
          } });
          const { before, after } = await input.change(tx, actorId, operation.id);
          await tx.adminAuditEntry.create({ data: { actorPlayerId: actorId, targetPlayerId, domain: input.domain,
            action: input.action, before, after, operationId: operation.id } });
          await tx.businessOperation.update({ where: { id: operation.id }, data: {
            status: 'COMPLETED', completedAt: new Date(), resultSummary: { fingerprint },
          } });
          return { operationId: operation.id, alreadyProcessed: false };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (attempt < 3 && isPrismaConcurrencyCollision(error)) continue;
        throw error;
      }
    }
    throw new Error('Admin operation retry exhausted.');
  }
}
