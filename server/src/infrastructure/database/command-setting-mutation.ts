import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import { AppError } from '../../api/errors.js';
import { commandSource } from '../../application/player/player-command-execution.js';
import { freezeCommandValue, thawCommandValue } from '../../application/chat/command-value.js';
import { isPrismaConcurrencyCollision } from './prisma-concurrency.js';

/** Existing setting owners retain UI behavior. A Twitch receipt supplies a durable
 * operation key so a replay cannot overwrite a later, independent setting. */
export async function commandSettingMutation<T>(db: PrismaClient, playerId: string, type: string,
  key: string | undefined, request: unknown, action: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  if (!key) return db.$transaction(action);
  const sourceChannel = commandSource('UI'), idempotencyKey = `setting:${type}:${key}`;
  const fingerprint = JSON.stringify(freezeCommandValue(request));
  for (let retry = 0; ; retry++) {
    try {
      return await db.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM players WHERE id = ${playerId}::uuid FOR UPDATE`;
        const previous = await tx.businessOperation.findFirst({ where: { sourceChannel, idempotencyKey } });
        if (previous) {
          const summary = previous.resultSummary as { fingerprint?: string; result?: Prisma.JsonValue } | null;
          if (previous.playerId !== playerId || previous.operationType !== type || previous.status !== 'COMPLETED'
            || summary?.fingerprint !== fingerprint || summary.result === undefined) throw new AppError('Cette intention ne correspond pas à son premier traitement.', 409, 'SETTING_IDEMPOTENCY_CONFLICT');
          return thawCommandValue(summary.result) as T;
        }
        if ((await tx.player.findUnique({ where: { id: playerId }, select: { status: true } }))?.status !== 'ACTIVE') throw new AppError('Compte indisponible.', 403, 'PLAYER_INACTIVE');
        const result = await action(tx);
        await tx.businessOperation.create({ data: { playerId, sourceChannel, idempotencyKey, operationType: type, status: 'COMPLETED', completedAt: new Date(), resultSummary: { fingerprint, result: freezeCommandValue(result) } } });
        return result;
      // Every setting belongs to this locked Player. ReadCommitted reads the
      // winner after waiting; the unique operation key also protects collisions
      // across Players. Serializable adds unrelated-player SSI conflicts under
      // chat load without strengthening these per-Player invariants.
      }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
    } catch (error) { if (retry < 5 && isPrismaConcurrencyCollision(error)) continue; throw error; }
  }
}
