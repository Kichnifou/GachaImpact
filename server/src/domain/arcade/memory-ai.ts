import type { ArcadeDifficulty, ArcadeRandom, Observation } from './types.js';

export const memoryPolicies = { EASY: { capacity: 4, exploitPercent: 50 }, MEDIUM: { capacity: 12, exploitPercent: 85 }, HARD: { capacity: 36, exploitPercent: 100 } } as const;
/** Deliberately has no board, catalog, seed, hidden identity or private-engine reference. */
export type MemoryAiView = Readonly<{ available: readonly number[]; observations: readonly Observation[]; visible: readonly Observation[] }>;
export function chooseMemoryCard(view: MemoryAiView, difficulty: ArcadeDifficulty, random: ArcadeRandom): number {
  if (!view.available.length) throw new RangeError('No available card');
  const policy = memoryPolicies[difficulty];
  const known = view.observations.slice(-policy.capacity).filter(row => view.available.includes(row.position));
  if (random.nextInt(100) < policy.exploitPercent) {
    const first = view.visible[0];
    if (first) {
      const pair = known.find(row => row.faceId === first.faceId && row.position !== first.position);
      if (pair) return pair.position;
    } else {
      const pair = known.find(row => known.some(other => row.position !== other.position && row.faceId === other.faceId));
      if (pair) return pair.position;
    }
  }
  const unknown = view.available.filter(position => !known.some(row => row.position === position));
  const choices = unknown.length ? unknown : view.available;
  return choices[random.nextInt(choices.length)]!;
}
