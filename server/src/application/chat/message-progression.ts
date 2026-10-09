import type { Prisma } from '../../../generated/prisma/client.js';
import { isElementKey } from '../../domain/economy/resources.js';
import { getBusinessDate } from '../../domain/time/business-date.js';
import type { RandomSource } from '../../domain/wheel/wheel.js';
import { PrismaPlayerXpService } from '../../infrastructure/database/prisma-player-xp-service.js';
import type { DailyChallengeProgressor } from '../daily-challenge/daily-challenge-store.js';
import type { PermanentMissionService } from '../missions/permanent-mission-service.js';
import { XP_PER_LEVEL } from '../../domain/player/player-progression.js';

/** One Player row lock in the caller protects the shared XP timestamp across transports. */
export async function progressPlayerMessage(tx: Prisma.TransactionClient,
  input: { playerId: string; elementKey: string | null; normal: boolean; length: number; now: Date; operationId: string; source: 'TWITCH' | 'INTERNAL_CHAT' },
  owners: { xp: PrismaPlayerXpService; dailyChallenges: DailyChallengeProgressor; missions: PermanentMissionService; random: RandomSource }) {
  const { playerId, now, operationId, source } = input;
  const progression = await tx.playerProgression.findUniqueOrThrow({ where: { playerId } });
  await tx.playerProgression.update({ where: { playerId }, data: { totalMessages: { increment: 1n } } });
  const element = input.elementKey && isElementKey(input.elementKey) ? input.elementKey : null;
  const onboarding = source === 'TWITCH' && input.elementKey === null && progression.xp < 2n * XP_PER_LEVEL;
  if (!input.normal || !element && !onboarding
    || progression.lastXpMessageAt && now.getTime() - progression.lastXpMessageAt.getTime() < 2_000)
    return { xpGranted: 0, dailyChallengeCompleted: false, xpPlan: null };
  const messageXp = input.length <= 100 ? 1 : input.length <= 200 ? 2 : 3;
  const xpGranted = onboarding ? Math.min(messageXp, Number(2n * XP_PER_LEVEL - progression.xp)) : messageXp;
  const xpPlan = await owners.xp.grant(tx, { playerId, playerElementKey: element, amount: BigInt(xpGranted), source: 'chat.message', now, operationId, sourceChannel: source, random: owners.random });
  // Read only the rewarded balances, while the caller still owns the Player lock.
  // Ordinary messages add no query; the frozen presentation retains this snapshot on replay.
  const xpBalances = xpPlan.rewards.length ? Object.fromEntries((await tx.playerResourceBalance.findMany({
    where: { playerId, resourceKey: { in: xpPlan.rewards.map(reward => reward.resourceKey) } }, select: { resourceKey: true, amount: true },
  })).map(row => [row.resourceKey, row.amount])) : undefined;
  await tx.playerProgression.update({ where: { playerId }, data: { countedMessages: { increment: 1n }, lastXpMessageAt: now } });
  await owners.missions.reconcileMetrics(tx, { playerId, sourceChannel: source, now, triggerOperationId: operationId, metrics: ['COUNTED_MESSAGES'] });
  if (!element) return { xpGranted, dailyChallengeCompleted: false, xpPlan, xpBalances };
  const businessDate = getBusinessDate(now);
  const where = { playerId_businessDate: { playerId, businessDate: new Date(`${businessDate}T00:00:00.000Z`) } };
  const before = await tx.playerDailyChallenge.findUnique({ where, select: { status: true } });
  await owners.dailyChallenges.progress(tx, { playerId, playerElementKey: element, businessDate, type: 'messages', amount: 1n, now, operationId, sourceChannel: source });
  const after = await tx.playerDailyChallenge.findUnique({ where, select: { status: true } });
  return { xpGranted, dailyChallengeCompleted: before?.status === 'ACTIVE' && after?.status === 'COMPLETED', xpPlan, xpBalances };
}
