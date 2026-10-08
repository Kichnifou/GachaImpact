import type { ArcadeSession, ArcadeStat, Prisma } from '../../../generated/prisma/client.js';
import { projectMemory, memoryLayout } from '../../domain/arcade/memory.js';
import { arcadeGames, type ArcadeGame, type ArcadeDifficulty, type ArcadeState, type Outcome } from '../../domain/arcade/types.js';
import { banterText } from '../../domain/arcade/banter.js';
import { performancePoints } from '../../domain/arcade/points.js';
import { inverseOutcome } from './arcade-finalization.js';

export function projectSession(row: ArcadeSession & { player?: { id: string; displayName: string; status?: string }; opponent?: { id: string; displayName: string; status?: string } | null }, viewer = row.playerId) {
  const state = row.privateState as unknown as ArcadeState;
  const multiplayer = row.mode === 'MULTIPLAYER';
  const present = (player: typeof row.player) => player ? { id: player.id, displayName: player.status === 'ARCHIVED' ? 'Progression archivée' : player.displayName } : null;
  const player = present(row.player), opponent = present(row.opponent ?? undefined);
  const guest = multiplayer && viewer === row.opponentPlayerId;
  const outcome = row.outcome ? guest ? inverseOutcome(row.outcome as Outcome) : row.outcome as Outcome : null;
  const points = multiplayer && outcome ? performancePoints(row.game as ArcadeGame, row.difficulty as ArcadeDifficulty, outcome, state.kind === 'MEMORY' ? guest ? state.aiPairs : state.playerPairs : 0, row.scoringVersion) : row.performancePoints;
  return { id: row.id, game: row.game as ArcadeGame, difficulty: row.difficulty as ArcadeDifficulty, status: row.status as 'ACTIVE' | 'FINISHED' | 'ABANDONED',
    rulesVersion: row.rulesVersion, scoringVersion: row.scoringVersion, version: row.version, firstSide: row.firstSide,
    mode: multiplayer ? 'MULTIPLAYER' as const : 'SOLO' as const, viewerSide: guest ? 'AI' as const : 'PLAYER' as const,
    participants: multiplayer && player && opponent ? { PLAYER: player, AI: opponent } : null,
    opponent: multiplayer ? guest ? player : opponent : null,
    createdAt: row.createdAt.toISOString(), nextActionAt: row.nextActionAt.toISOString(),
    board: state.kind === 'MEMORY' ? projectMemory(state) : { ...state, cells: [...state.cells], winningCells: [...state.winningCells] },
    banter: { id: row.banterId, text: multiplayer ? '' : banterText(row.banterId) },
    result: row.status === 'FINISHED' ? { outcome: outcome!, performancePoints: points!, scoreAwarded: points!,
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
