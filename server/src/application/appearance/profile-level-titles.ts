import type { Prisma } from '../../../generated/prisma/client.js';
import { unlockCosmeticInTransaction } from './appearance-service.js';

export const profileLevelTitleThresholds = [10, 25, 50, 75, 100] as const;
/** Called inside the XP transaction, only for newly crossed levels. */
export async function unlockProfileLevelTitles(tx: Prisma.TransactionClient, input: { playerId: string; levelsReached: readonly number[]; operationId: string }) {
  const levels = profileLevelTitleThresholds.filter(level => input.levelsReached.includes(level));
  if (!levels.length) return;
  const definitions = await tx.cosmeticDefinition.findMany({ where: { externalKey: { in: levels.map(level => 'title-level-'+level) }, type: 'TITLE', isActive: true }, select: { externalKey: true } });
  for (const definition of definitions) await unlockCosmeticInTransaction(tx, { playerId: input.playerId, externalKey: definition.externalKey, source: 'PLAYER_LEVEL', notificationMode: 'PLAYER_FACING', provenance: { operationId: input.operationId } });
}
