import type { ArcadeSession, Prisma } from '../../../generated/prisma/client.js';
import { type ArcadeState, type ArcadeGame, type ArcadeDifficulty, ArcadeRandom } from '../../domain/arcade/types.js';
import { performancePoints } from '../../domain/arcade/points.js';
import { businessDateToDatabaseDate, getBusinessDate } from '../../domain/time/business-date.js';
import { derivePlayerProgression } from '../../domain/player/player-progression.js';
import { resourceKeys, type ElementKey } from '../../domain/economy/resources.js';
import { PrismaPlayerXpService } from '../../infrastructure/database/prisma-player-xp-service.js';
import { toPlayerProgressionDto, toPlayerResourcesDto } from '../../api/serializers/gameplay.js';
import type { PlayerResourceBalances } from '../player/player-resource-store.js';

export async function finalizeArcade(tx: Prisma.TransactionClient, session: ArcadeSession, state: ArcadeState, operationId: string,
  elementKey: ElementKey, now: Date, random: ArcadeRandom, xp: PrismaPlayerXpService) {
  if (!state.outcome || session.status !== 'ACTIVE') throw new Error('Arcade finalization requires a terminal transition');
  const points = performancePoints(session.game as ArcadeGame, session.difficulty as ArcadeDifficulty, state.outcome, state.kind === 'MEMORY' ? state.playerPairs : 0);
  const businessDate = businessDateToDatabaseDate(getBusinessDate(now));
  const grant = await tx.arcadeDailyGrant.findUnique({ where: { playerId_game_businessDate: { playerId: session.playerId, game: session.game, businessDate } } });
  const xpAwarded = grant ? 0 : points;
  let award = null;
  if (xpAwarded) {
    await tx.arcadeDailyGrant.create({ data: { playerId: session.playerId, game: session.game, businessDate, sessionId: session.id, operationId, xpAwarded } });
    const plan = await xp.grant(tx, { playerId: session.playerId, playerElementKey: elementKey, amount: BigInt(xpAwarded), source: `arcade.${session.game.toLowerCase()}`,
      now, operationId, sourceChannel: 'UI', random });
    const balances = await tx.playerResourceBalance.findMany({ where: { playerId: session.playerId }, select: { resourceKey: true, amount: true } });
    const byKey = new Map(balances.map(row => [row.resourceKey, row.amount]));
    const complete = Object.fromEntries(resourceKeys.map(key => { const value = byKey.get(key); if (value === undefined) throw new Error('Incomplete player resources'); return [key, value]; })) as PlayerResourceBalances;
    award = { operationId, progression: toPlayerProgressionDto(derivePlayerProgression(plan.stateAfter)), resources: toPlayerResourcesDto(complete),
      levelsReached: plan.levelsReached, overflowRewardsGranted: plan.overflowRewardsGranted,
      rewards: plan.rewards.map(row => ({ resourceKey: row.resourceKey, amount: row.amount.toString() })) };
  }
  const key = { playerId: session.playerId, game: session.game, difficulty: session.difficulty };
  const old = await tx.arcadeStat.findUnique({ where: { playerId_game_difficulty: key } });
  const pairs = state.kind === 'MEMORY' ? state.playerPairs : null;
  const best = !old || points > old.bestPoints || points === old.bestPoints && (pairs ?? 0) > (old.bestPairs ?? 0);
  const record = { bestPoints: points, bestPairs: pairs, bestOutcome: state.outcome, bestSessionId: session.id };
  await tx.arcadeStat.upsert({ where: { playerId_game_difficulty: key },
    create: { ...key, score: BigInt(points), played: 1n, wins: state.outcome === 'WIN' ? 1n : 0n, draws: state.outcome === 'DRAW' ? 1n : 0n, losses: state.outcome === 'LOSS' ? 1n : 0n, ...record },
    update: { score: { increment: points }, played: { increment: 1 }, wins: { increment: state.outcome === 'WIN' ? 1 : 0 },
      draws: { increment: state.outcome === 'DRAW' ? 1 : 0 }, losses: { increment: state.outcome === 'LOSS' ? 1 : 0 }, ...(best ? record : {}) } });
  return { terminal: { status: 'FINISHED', outcome: state.outcome, performancePoints: points, xpAwarded, businessDate, finishedAt: now, finishOperationId: operationId }, award };
}
