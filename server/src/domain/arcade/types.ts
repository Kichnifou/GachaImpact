export const arcadeGames = ['MEMORY', 'CONNECT_FOUR', 'TIC_TAC_TOE'] as const;
export const arcadeDifficulties = ['EASY', 'MEDIUM', 'HARD'] as const;
export type ArcadeGame = typeof arcadeGames[number];
export type ArcadeDifficulty = typeof arcadeDifficulties[number];
export type Side = 'PLAYER' | 'AI';
export type Outcome = 'WIN' | 'DRAW' | 'LOSS';
export type Face = { id: string; name: string; elementKey: string; assetPaths: (string | null)[] };
export type Observation = { position: number; faceId: string };
export type MemoryState = {
  kind: 'MEMORY'; cards: (Face | null)[]; matched: (Side | null)[]; revealed: number[];
  /** Absent on immutable V1 snapshots (36 cards, 18 pairs). */
  layout?: { columns: number; totalPairs: number };
  observations: Observation[]; turn: Side; phase: 'PICK' | 'REVEAL';
  playerPairs: number; aiPairs: number; outcome: Outcome | null;
};
export type LineState = {
  kind: 'CONNECT_FOUR' | 'TIC_TAC_TOE'; cells: (Side | null)[]; turn: Side;
  outcome: Outcome | null; winningCells: number[]; lastMove: number | null;
};
export type ArcadeState = MemoryState | LineState;
export const otherSide = (side: Side): Side => side === 'PLAYER' ? 'AI' : 'PLAYER';
export const outcomeFor = (side: Side): Outcome => side === 'PLAYER' ? 'WIN' : 'LOSS';

/** Private state is saved with every accepted action, including all random choices. */
export class ArcadeRandom {
  constructor(public state: number) { this.state >>>= 0; }
  nextInt(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive < 1) throw new RangeError('Invalid random bound');
    this.state = (this.state + 0x6D2B79F5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return Math.floor(((t ^ t >>> 14) >>> 0) / 4294967296 * maxExclusive);
  }
}
export function shuffle<T>(items: readonly T[], random: ArcadeRandom): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = random.nextInt(i + 1); [result[i], result[j]] = [result[j]!, result[i]!]; }
  return result;
}
