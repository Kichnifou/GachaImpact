import type { ArcadeDifficulty, ArcadeGame, Outcome } from './types.js';

export const ARCADE_RULES_VERSION = 1;
export const ARCADE_SCORING_VERSION = 1;
export const linePoints = { EASY: { LOSS: 2, DRAW: 3, WIN: 6 }, MEDIUM: { LOSS: 3, DRAW: 5, WIN: 8 }, HARD: { LOSS: 4, DRAW: 7, WIN: 10 } } as const;
const memoryBands = { EASY: { lossMax: 2, draw: 3, winMin: 4, winMax: 6 }, MEDIUM: { lossMax: 4, draw: 5, winMin: 6, winMax: 8 }, HARD: { lossMax: 6, draw: 7, winMin: 8, winMax: 10 } } as const;
export function performancePoints(game: ArcadeGame, difficulty: ArcadeDifficulty, outcome: Outcome, playerPairs = 0): number {
  if (game !== 'MEMORY') return linePoints[difficulty][outcome];
  if (!Number.isInteger(playerPairs) || playerPairs < 0 || playerPairs > 18 || outcome !== (playerPairs > 9 ? 'WIN' : playerPairs === 9 ? 'DRAW' : 'LOSS')) throw new RangeError('Inconsistent Memory result');
  const band = memoryBands[difficulty];
  if (outcome === 'LOSS') return 1 + Math.floor(playerPairs * (band.lossMax - 1) / 8);
  if (outcome === 'DRAW') return band.draw;
  return band.winMin + Math.floor((playerPairs - 10) * (band.winMax - band.winMin) / 8);
}
