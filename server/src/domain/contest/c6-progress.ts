import type { RandomSource } from '../wheel/wheel.js';

export const c6StatKeys = ['strength', 'intelligence', 'beauty', 'charisma', 'popularity'] as const;
export type C6StatKey = typeof c6StatKeys[number];
export type C6Stats = Readonly<Record<C6StatKey, number>>;

export type C6Progression = Readonly<
  | { type: 'stat'; stat: C6StatKey; stats: C6Stats }
  | { type: 'moras'; amount: bigint; stats: C6Stats }
>;

export function initialC6Stats(): C6Stats {
  return { strength: 1, intelligence: 1, beauty: 1, charisma: 1, popularity: 1 };
}

export function progressC6(stats: C6Stats, random: RandomSource): C6Progression {
  const available = c6StatKeys.filter((key) => stats[key] < 20);
  if (available.length === 0) return { type: 'moras', amount: 100_000n, stats };
  const stat = available[random.nextInt(available.length)]!;
  return { type: 'stat', stat, stats: { ...stats, [stat]: stats[stat] + 1 } };
}
