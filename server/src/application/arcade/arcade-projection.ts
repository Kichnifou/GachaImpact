import type { ArcadeSession, ArcadeStat, Prisma } from '../../../generated/prisma/client.js';
import { projectMemory, memoryLayout } from '../../domain/arcade/memory.js';
import { arcadeGames, type ArcadeGame, type ArcadeDifficulty, type ArcadeState, type Outcome } from '../../domain/arcade/types.js';
import { banterText } from '../../domain/arcade/banter.js';

export function projectSession(row: ArcadeSession) {
  const state = row.privateState as unknown as ArcadeState;
  return { id: row.id, game: row.game as ArcadeGame, difficulty: row.difficulty as ArcadeDifficulty, status: row.status as 'ACTIVE' | 'FINISHED' | 'ABANDONED',
    rulesVersion: row.rulesVersion, scoringVersion: row.scoringVersion, version: row.version, firstSide: row.firstSide,
    createdAt: row.createdAt.toISOString(), nextActionAt: row.nextActionAt.toISOString(),
    board: state.kind === 'MEMORY' ? projectMemory(state) : { ...state, cells: [...state.cells], winningCells: [...state.winningCells] },
    banter: { id: row.banterId, text: banterText(row.banterId) },
    result: row.status === 'FINISHED' ? { outcome: row.outcome as Outcome, performancePoints: row.performancePoints!, scoreAwarded: row.performancePoints!,
      xpAwarded: row.xpAwarded!, businessDate: row.businessDate!.toISOString().slice(0, 10), finishedAt: row.finishedAt!.toISOString(), operationId: row.finishOperationId! } : null };
}
export function projectStat(row: ArcadeStat & { bestSession: Pick<ArcadeSession, 'rulesVersion' | 'difficulty'> }) {
  return { game: row.game as ArcadeGame, difficulty: row.difficulty as ArcadeDifficulty, score: row.score.toString(), played: row.played.toString(),
    wins: row.wins.toString(), draws: row.draws.toString(), losses: row.losses.toString(),
    best: { points: row.bestPoints, pairs: row.bestPairs, totalPairs: row.game === 'MEMORY' ? memoryLayout(row.bestSession.difficulty as ArcadeDifficulty, row.bestSession.rulesVersion).totalPairs : null, outcome: row.bestOutcome as Outcome } };
}
export function scoreSummary(rows: readonly Pick<ArcadeStat, 'game' | 'score'>[]) {
  const scores = Object.fromEntries(arcadeGames.map(game => [game, rows.filter(row => row.game === game).reduce((sum, row) => sum + row.score, 0n).toString()])) as Record<ArcadeGame, string>;
  return { scores, totalScore: Object.values(scores).reduce((sum, value) => sum + BigInt(value), 0n).toString() };
}
export async function personalSummary(tx: Prisma.TransactionClient, playerId: string, businessDate: Date) {
  const [stats, grants] = await Promise.all([
    tx.arcadeStat.findMany({ where: { playerId }, include: { bestSession: { select: { rulesVersion: true, difficulty: true } } }, orderBy: [{ game: 'asc' }, { difficulty: 'asc' }] }),
    tx.arcadeDailyGrant.findMany({ where: { playerId, businessDate }, select: { game: true, xpAwarded: true } }),
  ]);
  return { ...scoreSummary(stats), records: stats.map(projectStat), businessDate: businessDate.toISOString().slice(0, 10),
    daily: arcadeGames.map(game => ({ game, used: grants.some(row => row.game === game), xpAwarded: grants.find(row => row.game === game)?.xpAwarded ?? 0 })) };
}
