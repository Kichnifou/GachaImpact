import { otherSide, shuffle, type ArcadeDifficulty, type ArcadeRandom, type Face, type MemoryState, type Side } from './types.js';
import { memoryPolicies, type MemoryAiView } from './memory-ai.js';

export function createMemory(catalog: readonly Face[], first: Side, random: ArcadeRandom): MemoryState {
  const unique = [...new Map(catalog.map(face => [face.id, face])).values()];
  if (unique.length < 18) throw new RangeError('At least eighteen portraits are required');
  const selected = shuffle(unique, random).slice(0, 18);
  return { kind: 'MEMORY', cards: shuffle([...selected, ...selected], random), matched: Array<Side | null>(36).fill(null),
    revealed: [], observations: [], turn: first, phase: 'PICK', playerPairs: 0, aiPairs: 0, outcome: null };
}
export function memoryAvailable(state: MemoryState): number[] {
  return state.matched.flatMap((owner, i) => owner === null && !state.revealed.includes(i) ? [i] : []);
}
export function memoryAiView(state: MemoryState): MemoryAiView {
  return { available: memoryAvailable(state), observations: state.observations.map(row => ({ ...row })),
    visible: state.revealed.map(position => ({ position, faceId: state.cards[position]!.id })) };
}
export function revealMemory(state: MemoryState, position: number, difficulty: ArcadeDifficulty): MemoryState {
  if (state.outcome || state.phase !== 'PICK' || !memoryAvailable(state).includes(position)) throw new RangeError('Illegal Memory move');
  const next = structuredClone(state);
  next.revealed.push(position);
  next.observations = [...next.observations.filter(row => row.position !== position), { position, faceId: next.cards[position]!.id }].slice(-memoryPolicies[difficulty].capacity);
  if (next.revealed.length === 2) {
    const [a, b] = next.revealed as [number, number];
    if (next.cards[a]!.id === next.cards[b]!.id) {
      next.matched[a] = next.turn; next.matched[b] = next.turn;
      if (next.turn === 'PLAYER') next.playerPairs++; else next.aiPairs++;
      next.observations = next.observations.filter(row => row.position !== a && row.position !== b);
      next.revealed = [];
      if (next.playerPairs + next.aiPairs === 18) next.outcome = next.playerPairs > 9 ? 'WIN' : next.playerPairs === 9 ? 'DRAW' : 'LOSS';
    } else next.phase = 'REVEAL';
  }
  return next;
}
export function concealMemory(state: MemoryState): MemoryState {
  if (state.outcome || state.phase !== 'REVEAL') throw new RangeError('No Memory reveal to resolve');
  return { ...state, revealed: [], phase: 'PICK', turn: otherSide(state.turn) };
}
/** The sole client projection: hidden positions do not carry a Face or its URL. */
export function projectMemory(state: MemoryState) {
  return { kind: state.kind, turn: state.turn, phase: state.phase, playerPairs: state.playerPairs, aiPairs: state.aiPairs,
    remainingPairs: 18 - state.playerPairs - state.aiPairs, outcome: state.outcome,
    cards: state.cards.map((face, position) => state.matched[position] || state.revealed.includes(position)
      ? { position, status: state.matched[position] ? 'MATCHED' as const : 'VISIBLE' as const, owner: state.matched[position] ?? null, face: { ...face, assetPaths: [...face.assetPaths] } }
      : { position, status: 'HIDDEN' as const }) };
}
