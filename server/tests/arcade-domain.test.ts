import { describe, expect, it } from 'vitest';
import { ArcadeRandom, arcadeDifficulties, type Face, type LineState } from '../src/domain/arcade/types.js';
import { createMemory, concealMemory, memoryAiView, projectMemory, revealMemory, memoryLayout } from '../src/domain/arcade/memory.js';
import { chooseMemoryCard, memoryPolicies } from '../src/domain/arcade/memory-ai.js';
import { createLineGame, legalLineMoves, playLineMove, winningLine } from '../src/domain/arcade/line-games.js';
import { chooseLineMove, linePolicies } from '../src/domain/arcade/line-ai.js';
import { performancePoints, linePoints } from '../src/domain/arcade/points.js';
import { banterId, banterText } from '../src/domain/arcade/banter.js';

const faces: Face[] = Array.from({ length: 20 }, (_, i) => ({ id: 'portrait-' + i, name: 'Portrait ' + i, elementKey: 'hydro', assetPaths: ['/private-face-' + i + '.png'] }));
class RationalRandom extends ArcadeRandom { override nextInt(max: number) { return max - 1; } }
describe('Arcade Memory rules and information boundary', () => {
  it.each(arcadeDifficulties)('%s V2 deals its own grid, excludes the center from both actors and ends on a draw', difficulty => {
    const layout = memoryLayout(difficulty, 2);
    let state = createMemory(faces.slice(0, layout.totalPairs), 'PLAYER', new ArcadeRandom(33), difficulty);
    expect(state.cards).toHaveLength(layout.columns ** 2);
    expect(state.cards.filter(Boolean)).toHaveLength(layout.totalPairs * 2);
    expect(() => createMemory(faces.slice(0, layout.totalPairs - 1), 'PLAYER', new ArcadeRandom(33), difficulty)).toThrow();
    const board = projectMemory(state);
    expect(board).toMatchObject(layout);
    expect(JSON.stringify(board)).not.toMatch(/portrait-|private-face|observations/);
    if (difficulty === 'MEDIUM') {
      expect(board.cards[12]).toEqual({ position: 12, status: 'BLOCKED' });
      expect(() => revealMemory(state, 12, difficulty)).toThrow();
      expect(memoryAiView(state).available).not.toContain(12);
      for (let seed = 0; seed < 50; seed++) expect(chooseMemoryCard(memoryAiView(state), difficulty, new ArcadeRandom(seed))).not.toBe(12);
    }
    const ids = [...new Set(state.cards.flatMap(face => face ? [face.id] : []))];
    ids.forEach((id, index) => {
      state.turn = index < layout.totalPairs / 2 ? 'PLAYER' : 'AI';
      const positions = state.cards.flatMap((face, i) => face?.id === id ? [i] : []);
      state = revealMemory(revealMemory(state, positions[0]!, difficulty), positions[1]!, difficulty);
    });
    expect(state).toMatchObject({ outcome: 'DRAW', playerPairs: layout.totalPairs / 2, aiPairs: layout.totalPairs / 2 });
  });
  it('reads V1 snapshots without layout and retains their original scoring', () => {
    const state = createMemory(faces, 'PLAYER', new ArcadeRandom(17), 'MEDIUM', 1);
    const original = JSON.stringify(state);
    expect(state.layout).toBeUndefined();
    expect(projectMemory(state)).toMatchObject({ columns: 6, totalPairs: 18, remainingPairs: 18 });
    expect(performancePoints('MEMORY', 'MEDIUM', 'LOSS', 2, 1)).toBe(1);
    expect(performancePoints('MEMORY', 'EASY', 'DRAW', 9, 1)).toBe(3);
    expect(JSON.stringify(state)).toBe(original);
  });
  it('deals eighteen distinct pairs, freezes portraits and reveals no hidden identity', () => {
    const state = createMemory(faces, 'PLAYER', new ArcadeRandom(42));
    expect(state.cards).toHaveLength(36);
    const counts = new Map<string, number>();
    state.cards.forEach(face => counts.set(face!.id, (counts.get(face!.id) ?? 0) + 1));
    expect(counts.size).toBe(18); expect([...counts.values()]).toEqual(Array(18).fill(2));
    const publicBoard = projectMemory(state);
    expect(publicBoard.cards).toEqual(Array.from({ length: 36 }, (_, position) => ({ position, status: 'HIDDEN' })));
    expect(JSON.stringify(publicBoard)).not.toMatch(/portrait-|private-face|observations|random|seed/i);
    expect(memoryAiView(state)).toEqual({ available: Array.from({ length: 36 }, (_, i) => i), observations: [], visible: [] });
    expect(() => createMemory(faces.slice(0, 17), 'PLAYER', new ArcadeRandom(1))).toThrow();
  });
  it('keeps a successful turn, exposes mismatches until resolution, then alternates', () => {
    let state = createMemory(faces, 'PLAYER', new ArcadeRandom(42));
    const pair = state.cards.findIndex((face, i) => i > 0 && face!.id === state.cards[0]!.id);
    state = revealMemory(state, 0, 'HARD');
    expect(projectMemory(state).cards.filter(card => card.status !== 'HIDDEN')).toHaveLength(1);
    expect(() => revealMemory(state, 0, 'HARD')).toThrow();
    state = revealMemory(state, pair, 'HARD');
    expect(state).toMatchObject({ turn: 'PLAYER', playerPairs: 1, phase: 'PICK' });
    expect(() => revealMemory(state, pair, 'HARD')).toThrow();
    const a = state.matched.findIndex(owner => owner === null), b = state.cards.findIndex((face, i) => !state.matched[i] && face!.id !== state.cards[a]!.id);
    state = revealMemory(revealMemory(state, a, 'HARD'), b, 'HARD');
    expect(state.phase).toBe('REVEAL'); expect(state.revealed).toEqual([a, b]);
    expect(() => revealMemory(state, 35, 'HARD')).toThrow();
    state = concealMemory(state); expect(state.turn).toBe('AI'); expect(state.revealed).toEqual([]);
    expect(state.observations.map(row => row.position)).toEqual([a, b]);
  });
  it('ends naturally at eighteen assigned pairs, including nine/nine', () => {
    let state = createMemory(faces, 'PLAYER', new ArcadeRandom(5));
    const ids = [...new Set(state.cards.map(face => face!.id))];
    ids.forEach((id, index) => {
      state = { ...state, turn: index < 9 ? 'PLAYER' : 'AI' };
      const positions = state.cards.flatMap((face, i) => face!.id === id ? [i] : []);
      state = revealMemory(revealMemory(state, positions[0]!, 'HARD'), positions[1]!, 'HARD');
    });
    expect(state).toMatchObject({ playerPairs: 9, aiPairs: 9, outcome: 'DRAW' });
    expect(() => revealMemory(state, 0, 'HARD')).toThrow();
    expect(() => concealMemory(state)).toThrow();
  });
  it.each(arcadeDifficulties)('%s bot sees only observations and makes legal reproducible choices', difficulty => {
    let state = createMemory(faces, 'PLAYER', new ArcadeRandom(7), difficulty);
    state = revealMemory(state, 0, difficulty);
    const view = memoryAiView(state);
    expect(Object.keys(view).sort()).toEqual(['available', 'observations', 'visible']);
    expect(view.observations).toEqual([{ position: 0, faceId: state.cards[0]!.id }]);
    const hiddenChanged = structuredClone(state);
    [hiddenChanged.cards[1], hiddenChanged.cards[2]] = [hiddenChanged.cards[2]!, hiddenChanged.cards[1]!];
    expect(memoryAiView(hiddenChanged)).toEqual(view);
    const choice = chooseMemoryCard(view, difficulty, new ArcadeRandom(23));
    expect(choice).toBe(chooseMemoryCard(memoryAiView(hiddenChanged), difficulty, new ArcadeRandom(23)));
    expect(view.available).toContain(choice);
    const observations = Array.from({ length: 36 }, (_, position) => ({ position, faceId: 'seen-' + position }));
    const known = { available: [1, 2, 3], observations: [...observations, { position: 2, faceId: 'match' }], visible: [{ position: 0, faceId: 'match' }] };
    // A rational draw takes a known second card in every difficulty; EASY may forget older cards.
    const choice2 = chooseMemoryCard(known, difficulty, new ArcadeRandom(1));
    expect([1, 2, 3]).toContain(choice2);
    expect(memoryPolicies[difficulty].capacity).toBeLessThanOrEqual(36);
  });
  it('hard Memory exploits a seen pair and its first newly revealed card', () => {
    const observations = [{ position: 2, faceId: 'a' }, { position: 4, faceId: 'a' }];
    expect(chooseMemoryCard({ available: [1, 2, 3, 4], observations, visible: [] }, 'HARD', new ArcadeRandom(1))).toBe(2);
    expect(chooseMemoryCard({ available: [1, 4], observations, visible: [{ position: 2, faceId: 'a' }] }, 'HARD', new ArcadeRandom(1))).toBe(4);
  });
});

describe('Arcade alignment engines', () => {
  it('applies gravity, rejects full columns and stops at the first victory', () => {
    let state = createLineGame('CONNECT_FOUR', 'PLAYER');
    state = playLineMove(state, 0); expect(state.lastMove).toBe(35);
    for (let i = 0; i < 5; i++) state = playLineMove(state, 0);
    expect(legalLineMoves(state)).not.toContain(0); expect(() => playLineMove(state, 0)).toThrow();
    state = createLineGame('CONNECT_FOUR', 'PLAYER');
    for (const move of [0, 6, 1, 6, 2, 5, 3]) state = playLineMove(state, move);
    expect(state.outcome).toBe('WIN'); expect(state.winningCells).toEqual([35, 36, 37, 38]);
    expect(() => playLineMove(state, 4)).toThrow();
  });
  it.each([[35, 36, 37, 38], [0, 7, 14, 21], [0, 8, 16, 24], [3, 9, 15, 21]])('recognizes Connect Four direction %j', (...indices) => {
    const board = createLineGame('CONNECT_FOUR', 'AI').cells;
    indices.forEach(i => { board[i] = 'AI'; });
    expect(winningLine(board, 'CONNECT_FOUR')).toHaveLength(4);
  });
  it.each([[0, 1, 2], [0, 3, 6], [0, 4, 8], [2, 4, 6]])('recognizes tic-tac-toe direction %j', (...indices) => {
    const board = createLineGame('TIC_TAC_TOE', 'PLAYER').cells;
    indices.forEach(i => { board[i] = 'PLAYER'; });
    expect(winningLine(board, 'TIC_TAC_TOE')).toHaveLength(3);
  });
  it('rejects occupied tic-tac-toe cells and recognizes a full-board draw', () => {
    let state = playLineMove(createLineGame('TIC_TAC_TOE', 'PLAYER'), 0);
    expect(() => playLineMove(state, 0)).toThrow();
    for (const move of [1, 2, 4, 3, 5, 7, 6, 8]) state = playLineMove(state, move);
    expect(state.outcome).toBe('DRAW'); expect(legalLineMoves(state)).toEqual([]);
  });
  it('recognizes a full Connect Four board without an alignment', () => {
    const cells = ['PPAA PPA', 'AAPP AAP', 'PPAA PPA', 'AAPP AAP', 'PPAA PPA', 'AAPP AAP'].join('').replaceAll(' ', '').split('').map(c => c === 'P' ? 'PLAYER' as const : 'AI' as const);
    expect(cells).toHaveLength(42); expect(winningLine(cells, 'CONNECT_FOUR')).toEqual([]);
    const state: LineState = { ...createLineGame('CONNECT_FOUR', 'PLAYER'), cells: [...cells], turn: cells[0]! };
    state.cells[0] = null;
    expect(playLineMove(state, 0).outcome).toBe('DRAW');
  });
  it.each(arcadeDifficulties)('%s AI plays legal moves within its deterministic budget', difficulty => {
    for (const kind of ['CONNECT_FOUR', 'TIC_TAC_TOE'] as const) {
      const state = createLineGame(kind, 'AI');
      const result = chooseLineMove(state, difficulty, new ArcadeRandom(92));
      expect(legalLineMoves(state)).toContain(result.move); expect(result.nodes).toBeLessThanOrEqual(linePolicies[difficulty].nodeBudget);
      expect(chooseLineMove(state, difficulty, new ArcadeRandom(92))).toEqual(result);
    }
  });
  it.each(['MEDIUM', 'HARD'] as const)('%s wins and blocks immediate threats', difficulty => {
    let state = createLineGame('TIC_TAC_TOE', 'AI');
    state.cells = ['AI', 'AI', null, 'PLAYER', null, 'PLAYER', null, null, null];
    expect(chooseLineMove(state, difficulty, new RationalRandom(1)).move).toBe(2);
    state.cells = ['PLAYER', 'PLAYER', null, 'AI', null, null, null, null, null];
    expect(chooseLineMove(state, difficulty, new RationalRandom(1)).move).toBe(2);
    state = createLineGame('CONNECT_FOUR', 'AI');
    state.cells.splice(35, 3, 'PLAYER', 'PLAYER', 'PLAYER');
    expect(chooseLineMove(state, difficulty, new RationalRandom(1)).move).toBe(3);
  });
});

describe('Arcade points and reproducibility', () => {
  it.each(arcadeDifficulties)('%s awards the exact line table and monotone Memory bands', difficulty => {
    for (const outcome of ['LOSS', 'DRAW', 'WIN'] as const) for (const game of ['CONNECT_FOUR', 'TIC_TAC_TOE'] as const)
      expect(performancePoints(game, difficulty, outcome)).toBe(linePoints[difficulty][outcome]);
    const total = memoryLayout(difficulty, 2).totalPairs, half = total / 2;
    const points = Array.from({ length: total + 1 }, (_, pairs) => performancePoints('MEMORY', difficulty, pairs < half ? 'LOSS' : pairs === half ? 'DRAW' : 'WIN', pairs));
    expect(points.every((point, i) => point >= 1 && point <= 10 && (!i || point >= points[i - 1]!))).toBe(true);
    expect(points[half]).toBeGreaterThan(points[half - 1]!); expect(points[half + 1]).toBeGreaterThan(points[half]!);
    expect(points[total]).toBe(difficulty === 'EASY' ? 6 : difficulty === 'MEDIUM' ? 8 : 10);
    expect(points).toEqual(difficulty === 'EASY' ? [1, 1, 1, 2, 3, 4, 4, 5, 6]
      : difficulty === 'MEDIUM' ? [1, 1, 2, 2, 3, 4, 5, 6, 6, 6, 7, 7, 8]
      : [1, 1, 2, 2, 3, 4, 4, 5, 6, 7, 8, 8, 8, 8, 9, 9, 9, 9, 10]);
  });
  it('can restore random state and never consumes it for decorative replies', () => {
    const random = new ArcadeRandom(444); random.nextInt(36); const saved = random.state;
    const copy = new ArcadeRandom(saved); banterText(banterId('PAIR', 3));
    expect(random.nextInt(36)).toBe(copy.nextInt(36));
    expect(banterId('PAIR', 3)).not.toBe(banterId('PAIR', 4));
  });
});
