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
  const points = performancePoints(session.game as ArcadeGame, session.difficulty as ArcadeDifficulty, state.outcome, state.kind === 'MEMORY' ? state.playerPairs : 0, session.scoringVersion);
  const businessDate = businessDateToDatabaseDate(getBusinessDate(now));
  if (session.mode === 'MULTIPLAYER') {
    if (!session.opponentPlayerId) throw new Error('Missing Arcade opponent');
    const outcome = inverseOutcome(state.outcome);
    const opponentPoints = performancePoints(session.game as ArcadeGame, session.difficulty as ArcadeDifficulty, outcome, state.kind === 'MEMORY' ? state.aiPairs : 0, session.scoringVersion);
    await recordArcadeScore(tx, session, state, session.playerId, state.outcome, points, false);
    await recordArcadeScore(tx, session, state, session.opponentPlayerId, outcome, opponentPoints, true);
    return { terminal: { status: 'FINISHED', outcome: state.outcome, performancePoints: points, xpAwarded: 0, businessDate, finishedAt: now, finishOperationId: operationId }, award: null };
  }
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
  await recordArcadeScore(tx, session, state, session.playerId, state.outcome, points, false);
  return { terminal: { status: 'FINISHED', outcome: state.outcome, performancePoints: points, xpAwarded, businessDate, finishedAt: now, finishOperationId: operationId }, award };
}

export const inverseOutcome = (outcome: 'WIN' | 'DRAW' | 'LOSS') => outcome === 'WIN' ? 'LOSS' as const : outcome === 'LOSS' ? 'WIN' as const : 'DRAW' as const;
async function recordArcadeScore(tx: Prisma.TransactionClient, session: ArcadeSession, state: ArcadeState, playerId: string, outcome: 'WIN' | 'DRAW' | 'LOSS', points: number, guest: boolean) {
  const key = { playerId, game: session.game, difficulty: session.difficulty };
  const old = await tx.arcadeStat.findUnique({ where: { playerId_game_difficulty: key } });
  const pairs = state.kind === 'MEMORY' ? (guest ? state.aiPairs : state.playerPairs) : null;
  const best = !old || points > old.bestPoints;
  const record = { bestPoints: points, bestPairs: pairs, bestOutcome: outcome, bestSessionId: session.id };
  await tx.arcadeStat.upsert({ where: { playerId_game_difficulty: key },
    create: { ...key, score: BigInt(points), played: 1n, wins: outcome === 'WIN' ? 1n : 0n, draws: outcome === 'DRAW' ? 1n : 0n, losses: outcome === 'LOSS' ? 1n : 0n, ...record },
    update: { score: { increment: points }, played: { increment: 1 }, wins: { increment: outcome === 'WIN' ? 1 : 0 },
      draws: { increment: outcome === 'DRAW' ? 1 : 0 }, losses: { increment: outcome === 'LOSS' ? 1 : 0 }, ...(best ? record : {}) } });
}
