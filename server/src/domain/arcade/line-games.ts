import { otherSide, outcomeFor, type LineState, type Side } from './types.js';

export const dimensions = (kind: LineState['kind']) => kind === 'CONNECT_FOUR' ? { width: 7, height: 6, line: 4 } : { width: 3, height: 3, line: 3 };
export function createLineGame(kind: LineState['kind'], first: Side): LineState {
  const { width, height } = dimensions(kind);
  return { kind, cells: Array<Side | null>(width * height).fill(null), turn: first, outcome: null, winningCells: [], lastMove: null };
}
export function legalLineMoves(state: LineState): number[] {
  if (state.outcome) return [];
  return state.kind === 'CONNECT_FOUR' ? Array.from({ length: 7 }, (_, i) => i).filter(i => state.cells[i] === null)
    : state.cells.flatMap((cell, i) => cell === null ? [i] : []);
}
export function winningLine(cells: readonly (Side | null)[], kind: LineState['kind']): number[] {
  const { width, height, line } = dimensions(kind);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const side = cells[y * width + x]; if (!side) continue;
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 1]] as const) {
      const endX = x + (line - 1) * dx, endY = y + (line - 1) * dy;
      if (endX < 0 || endX >= width || endY >= height) continue;
      const indices = Array.from({ length: line }, (_, i) => (y + i * dy) * width + x + i * dx);
      if (indices.every(i => cells[i] === side)) return indices;
    }
  }
  return [];
}
export function playLineMove(state: LineState, move: number): LineState {
  if (!legalLineMoves(state).includes(move)) throw new RangeError('Illegal board move');
  const next = { ...state, cells: [...state.cells] };
  let position = move;
  if (state.kind === 'CONNECT_FOUR') while (position + 7 < 42 && next.cells[position + 7] === null) position += 7;
  next.cells[position] = state.turn; next.lastMove = position;
  next.winningCells = winningLine(next.cells, next.kind);
  next.outcome = next.winningCells.length ? outcomeFor(state.turn) : next.cells.every(Boolean) ? 'DRAW' : null;
  next.turn = otherSide(state.turn);
  return next;
}
