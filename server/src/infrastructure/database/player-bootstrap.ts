import { Prisma } from '../../../generated/prisma/client.js';
import { PermanentMissionService } from '../../application/missions/permanent-mission-service.js';

export const currentPlayerSelection = { id: true, displayName: true, elementKey: true, status: true } satisfies Prisma.PlayerSelect;

/** Both identities start from these defaults; no auth identity is implied. */
export async function bootstrapPlayer(tx: Prisma.TransactionClient, input: {
  displayName: string; webIdentity?: { provider: string; providerSubject: string };
  twitchIdentity?: { twitchUserId: string; login: string; displayName: string; firstSeenAt: Date };
}, initializedAt = new Date(), missions = new PermanentMissionService()) {
  const resources = await tx.resourceDefinition.findMany({ where: { isActive: true }, select: { key: true }, orderBy: { key: 'asc' } });
  if (resources.length !== 9) throw new Error('Player provisioning requires exactly 9 active resource definitions.');
  const player = await tx.player.create({ data: {
    displayName: input.displayName,
    ...(input.webIdentity ? { webIdentity: { create: input.webIdentity } } : {}),
    ...(input.twitchIdentity ? { twitchIdentity: { create: input.twitchIdentity } } : {}),
    economyStats: { create: {} }, wheelStats: { create: {} }, dailyRewardState: { create: {} },
    progression: { create: {} }, gachaState: { create: {} },
    privacySettings: { create: [{ categoryKey: 'PRIVATE_MESSAGES', level: 'PUBLIC' }] },
    resourceBalances: { create: resources.map(({ key }) => ({ resourceKey: key, amount: 0n })) },
  }, select: currentPlayerSelection });
  await missions.initializePlayer(tx, player.id, initializedAt, true);
  return player;
}
