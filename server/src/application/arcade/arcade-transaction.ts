import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import { AppError } from '../../api/errors.js';
import { isPrismaConcurrencyCollision } from '../../infrastructure/database/prisma-concurrency.js';
import { elementKeys, type ElementKey } from '../../domain/economy/resources.js';
import type { Clock } from '../../domain/time/business-date.js';
import { assertPlayerRecoveryActivated } from '../player/player-mutation-guard.js';

export const arcadeJson = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export const arcadeConflict = (message: string, code = 'ARCADE_CONFLICT') => new AppError(message, 409, code);
export async function lockArcadePlayers(tx: Prisma.TransactionClient, ids: readonly string[]) {
  for (const id of [...new Set(ids)].sort()) await tx.$queryRaw`SELECT id FROM players WHERE id = ${id}::uuid FOR UPDATE`;
  for (const id of new Set(ids)) await assertPlayerRecoveryActivated(tx, id);
}
export async function arcadeTransaction<T extends { operationId: string; alreadyProcessed: boolean }>(db: PrismaClient, clock: Clock,
  actorId: string, ids: readonly string[], key: string, intent: unknown,
  change: (tx: Prisma.TransactionClient, element: ElementKey, operationId: string, now: Date) => Promise<{ response: T; sessionId?: string; invitationId?: string }>) {
  const fingerprint = JSON.stringify(intent);
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await db.$transaction(async tx => {
        await lockArcadePlayers(tx, [actorId, ...ids]);
        const old = await tx.arcadeReceipt.findUnique({ where: { playerId_idempotencyKey: { playerId: actorId, idempotencyKey: key } } });
        if (old) {
          if (old.fingerprint !== fingerprint) throw arcadeConflict('Cette clé appartient à une autre action.', 'ARCADE_IDEMPOTENCY_CONFLICT');
          return { ...(old.response as unknown as T), alreadyProcessed: true };
        }
        const actor = await tx.player.findUniqueOrThrow({ where: { id: actorId } });
        if (actor.status !== 'ACTIVE' || !elementKeys.includes(actor.elementKey as ElementKey)) throw new AppError('Profil indisponible.', 403, 'ARCADE_UNAVAILABLE');
        if (await tx.businessOperation.findFirst({ where: { sourceChannel: 'UI', idempotencyKey: key } })) throw arcadeConflict('Clé déjà utilisée.', 'ARCADE_IDEMPOTENCY_CONFLICT');
        const now = clock.now();
        const operation = await tx.businessOperation.create({ data: { playerId: actorId, sourceChannel: 'UI', operationType: 'arcade.action', idempotencyKey: key, startedAt: now } });
        const result = await change(tx, actor.elementKey as ElementKey, operation.id, now);
        await tx.arcadeReceipt.create({ data: { playerId: actorId, sessionId: result.sessionId, invitationId: result.invitationId, idempotencyKey: key, fingerprint, operationId: operation.id, response: arcadeJson(result.response), createdAt: now } });
        await tx.businessOperation.update({ where: { id: operation.id }, data: { status: 'COMPLETED', completedAt: now, resultSummary: { sessionId: result.sessionId ?? null, invitationId: result.invitationId ?? null } } });
        return result.response;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 });
    } catch (error) { if (attempt < 4 && isPrismaConcurrencyCollision(error)) continue; throw error; }
  }
  throw new Error('Arcade transaction retries exhausted');
}
