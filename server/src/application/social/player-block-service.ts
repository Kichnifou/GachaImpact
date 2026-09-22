import { Prisma } from '../../../generated/prisma/client.js';

/** Social-owned block transition, reusable by HTTP experiences such as direct messages. */
export async function applyPlayerBlock(tx: Prisma.TransactionClient, blockerPlayerId: string, blockedPlayerId: string, at: Date) {
  const existing = await tx.playerBlock.findUnique({ where: { blockerPlayerId_blockedPlayerId: { blockerPlayerId, blockedPlayerId } } });
  if (!existing) await tx.playerBlock.create({ data: { blockerPlayerId, blockedPlayerId, createdAt: at } });
  const pair = [blockerPlayerId, blockedPlayerId].sort();
  await tx.friendship.updateMany({
    where: { playerAId: pair[0]!, playerBId: pair[1]!, state: 'ACTIVE' },
    data: { state: 'ARCHIVED', archivedAt: at },
  });
  return { blocked: true, changed: !existing };
}
