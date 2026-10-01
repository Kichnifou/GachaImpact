import { dimensions, legalLineMoves, playLineMove } from './line-games.js';
import type { ArcadeDifficulty, ArcadeRandom, LineState } from './types.js';

export const linePolicies = {
  EASY: { depth: 1, nodeBudget: 80, mistakePercent: 65 },
  MEDIUM: { depth: 3, nodeBudget: 1400, mistakePercent: 12 },
  HARD: { depth: 6, nodeBudget: 12000, mistakePercent: 3 },
} as const;
function evaluate(state: LineState): number {
  if (state.outcome) return state.outcome === 'LOSS' ? 100000 : state.outcome === 'WIN' ? -100000 : 0;
  const { width, height, line } = dimensions(state.kind);
  let score = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 1]] as const) {
    if (x + (line - 1) * dx < 0 || x + (line - 1) * dx >= width || y + (line - 1) * dy >= height) continue;
    const cells = Array.from({ length: line }, (_, i) => state.cells[(y + i * dy) * width + x + i * dx]);
    const ai = cells.filter(cell => cell === 'AI').length, human = cells.filter(cell => cell === 'PLAYER').length;
    if (!human) score += 4 ** ai; if (!ai) score -= 4 ** human;
  }
  return score;
}
export function chooseLineMove(state: LineState, difficulty: ArcadeDifficulty, random: ArcadeRandom): { move: number; nodes: number } {
  const legal = legalLineMoves(state);
  if (!legal.length || state.turn !== 'AI') throw new RangeError('No AI turn');
  const policy = linePolicies[difficulty];
  if (random.nextInt(100) < policy.mistakePercent) return { move: legal[random.nextInt(legal.length)]!, nodes: 0 };
  const immediateWin = legal.find(move => playLineMove(state, move).outcome === 'LOSS');
  if (immediateWin !== undefined) return { move: immediateWin, nodes: 0 };
  if (difficulty !== 'EASY') {
    const block = legal.find(move => playLineMove({ ...state, turn: 'PLAYER' }, move).outcome === 'WIN');
    if (block !== undefined) return { move: block, nodes: 0 };
  }
  let nodes = 0;
  const search = (board: LineState, depth: number, alpha: number, beta: number): number => {
    if (nodes >= policy.nodeBudget) return evaluate(board);
    nodes++;
    if (!depth || board.outcome) return evaluate(board);
    let best = board.turn === 'AI' ? -Infinity : Infinity;
    for (const move of legalLineMoves(board)) {
      const value = search(playLineMove(board, move), depth - 1, alpha, beta);
      if (board.turn === 'AI') { best = Math.max(best, value); alpha = Math.max(alpha, best); }
      else { best = Math.min(best, value); beta = Math.min(beta, best); }
      if (beta <= alpha || nodes >= policy.nodeBudget) break;
    }
    return best;
  };
  const ordered = [...legal].sort((a, b) => Math.abs(a - (state.kind === 'CONNECT_FOUR' ? 3 : 4)) - Math.abs(b - (state.kind === 'CONNECT_FOUR' ? 3 : 4)));
  let best = -Infinity, selected = ordered[0]!;
  const depth = state.kind === 'TIC_TAC_TOE' && difficulty === 'HARD' ? 9 : policy.depth;
  for (const move of ordered) {
    const value = search(playLineMove(state, move), depth - 1, -Infinity, Infinity);
    if (value > best) { best = value; selected = move; }
    if (nodes >= policy.nodeBudget) break;
  }
  return { move: selected, nodes };
}
