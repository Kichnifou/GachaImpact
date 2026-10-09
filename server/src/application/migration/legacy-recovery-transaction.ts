import type { Prisma, PrismaClient } from '../../../generated/prisma/client.js';
import { isPrismaConcurrencyCollision } from '../../infrastructure/database/prisma-concurrency.js';

/** Restart the whole transaction after a database collision, never an individual
 * write. Each attempt rechecks the fingerprint and journal under the same locks. */
export async function recoveryTransaction<T>(db: PrismaClient, action: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await db.$transaction(action, { isolationLevel: 'Serializable', timeout: 30_000 }); }
    catch (error) { if (attempt >= 3 || !isPrismaConcurrencyCollision(error)) throw error; }
  }
}

/** An aborted DB attempt does not invalidate a backup already durably written.
 * A changed preimage produces a new hash; no backup is overwritten. */
export function oncePerBackup<T extends { hash: string }>(write: (backup: T) => Promise<void>) {
  const saved = new Set<string>();
  return async (backup: T) => {
    if (saved.has(backup.hash)) return;
    await write(backup);
    saved.add(backup.hash);
  };
}
