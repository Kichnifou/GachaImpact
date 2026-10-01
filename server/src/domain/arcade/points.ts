import type { ArcadeDifficulty, ArcadeGame, Outcome } from './types.js';
import { memoryLayout } from './memory.js';

export const ARCADE_RULES_VERSION = 2;
export const ARCADE_SCORING_VERSION = 2;
export const linePoints = { EASY: { LOSS: 2, DRAW: 3, WIN: 6 }, MEDIUM: { LOSS: 3, DRAW: 5, WIN: 8 }, HARD: { LOSS: 4, DRAW: 7, WIN: 10 } } as const;
const memoryBands = { EASY: { lossMax: 2, draw: 3, winMin: 4, winMax: 6 }, MEDIUM: { lossMax: 4, draw: 5, winMin: 6, winMax: 8 }, HARD: { lossMax: 6, draw: 7, winMin: 8, winMax: 10 } } as const;
export function performancePoints(game: ArcadeGame, difficulty: ArcadeDifficulty, outcome: Outcome, playerPairs = 0, scoringVersion = ARCADE_SCORING_VERSION): number {
  if (game !== 'MEMORY') return linePoints[difficulty][outcome];
  const total = memoryLayout(difficulty, scoringVersion).totalPairs, half = total / 2;
  if (!Number.isInteger(playerPairs) || playerPairs < 0 || playerPairs > total || outcome !== (playerPairs > half ? 'WIN' : playerPairs === half ? 'DRAW' : 'LOSS')) throw new RangeError('Inconsistent Memory result');
  const band = memoryBands[difficulty];
  if (outcome === 'LOSS') return 1 + Math.floor(playerPairs * (band.lossMax - 1) / (half - 1));
  if (outcome === 'DRAW') return band.draw;
  return band.winMin + Math.floor((playerPairs - half - 1) * (band.winMax - band.winMin) / (half - 1));
}
