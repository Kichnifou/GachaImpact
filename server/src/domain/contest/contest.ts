import type { RandomSource } from '../wheel/wheel.js';

export const contestThemes = ['STRENGTH', 'INTELLIGENCE', 'BEAUTY', 'CHARISMA', 'POPULARITY'] as const;
export type ContestThemeKey = typeof contestThemes[number];
export type ContestAction = 'BASIC' | 'RISK';

export const CONTEST_WINNING_SCORE = 50;
export const CONTEST_LOBBY_TIMEOUT_MS = 10 * 60_000;
export const CONTEST_TURN_TIMEOUT_MS = 60_000;
export const CONTEST_SUPPORT_TIMEOUT_MS = 30_000;
export const CONTEST_MAX_SPECTATORS = 10;
export const CONTEST_REWARDS = [800n, 400n, 200n, 0n] as const;

export const contestThemePresentation: Readonly<Record<ContestThemeKey, { label: string; statKey: 'strength' | 'intelligence' | 'beauty' | 'charisma' | 'popularity'; title: string }>> = {
  STRENGTH: { label: 'Force', statKey: 'strength', title: 'Titan' },
  INTELLIGENCE: { label: 'Intelligence', statKey: 'intelligence', title: 'Sage' },
  BEAUTY: { label: 'Beauté', statKey: 'beauty', title: 'Éclat' },
  CHARISMA: { label: 'Charisme', statKey: 'charisma', title: 'Icône' },
  POPULARITY: { label: 'Popularité', statKey: 'popularity', title: 'Idôle' },
};

export const contestTitleRanks = ['', 'Bronze', 'Argent', 'Or', 'Platine'] as const;
const contestTitleRankConnectors = ['', 'de Bronze', 'd’Argent', 'd’Or', 'de Platine'] as const;

export function contestBasePoints(stat: number): number {
  if (!Number.isInteger(stat) || stat < 1 || stat > 20) throw new RangeError('A contest stat must be an integer from 1 through 20.');
  return Math.floor(stat / 5) + 1;
}

export function contestTitleFloor(wins: bigint | number): number {
  const value = typeof wins === 'bigint' ? wins : BigInt(wins);
  if (value >= 15n) return 4;
  if (value >= 7n) return 3;
  if (value >= 3n) return 2;
  if (value >= 1n) return 1;
  return 0;
}

export function contestTitle(theme: ContestThemeKey, rank: number): string | null {
  if (rank < 1 || rank > 4) return null;
  return `${contestThemePresentation[theme].title} ${contestTitleRankConnectors[rank]}`;
}

export function contestLiveRanks(participants: readonly Readonly<{ slot: number; score: number; turnOrder: number | null }>[]): ReadonlyMap<number, number> {
  return new Map([...participants]
    .sort((left, right) => right.score - left.score || (left.turnOrder ?? Number.MAX_SAFE_INTEGER) - (right.turnOrder ?? Number.MAX_SAFE_INTEGER) || left.slot - right.slot)
    .map((participant, index) => [participant.slot, index + 1]));
}

export function selectContestTheme(random: RandomSource): ContestThemeKey {
  return contestThemes[random.nextInt(contestThemes.length)]!;
}

export function selectRiskPoints(basePoints: number, random: RandomSource): number {
  if (!Number.isInteger(basePoints) || basePoints < 1 || basePoints > 5) throw new RangeError('Contest base points must be from 1 through 5.');
  return random.nextInt(3) * basePoints;
}

export function selectSupportPoints(random: RandomSource): number {
  return random.nextInt(3) + 1;
}

export function selectBotStat(humanStats: readonly number[], random: RandomSource): number {
  if (humanStats.length === 0) throw new RangeError('At least one human stat is required to create a contest bot.');
  const mean = humanStats.reduce((sum, value) => sum + value, 0) / humanStats.length;
  return Math.max(1, Math.min(20, Math.round(mean - 2 + (random.nextInt(5) - 2))));
}

export function selectBotAction(input: Readonly<{ score: number; leadingScore: number; basePoints: number }>, random: RandomSource): ContestAction {
  if (input.score + input.basePoints >= CONTEST_WINNING_SCORE) return 'BASIC';
  const gap = input.leadingScore - input.score;
  const riskPercent = gap >= 15 ? 70 : gap >= 5 ? 40 : 20;
  return random.nextInt(100) < riskPercent ? 'RISK' : 'BASIC';
}

export function shuffledTurnOrder(slots: readonly number[], random: RandomSource): number[] {
  const result = [...slots];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = random.nextInt(index + 1);
    [result[index], result[other]] = [result[other]!, result[index]!];
  }
  return result;
}

export function botIdentity(slot: number, random: RandomSource): { name: string; avatarKey: string } {
  const names = ['Astra', 'Braise', 'Céleste', 'Dune', 'Écho', 'Flocon', 'Ginkgo', 'Halo'];
  const name = names[random.nextInt(names.length)]!;
  return { name: `${name} · Bot ${slot}`, avatarKey: `bot-${random.nextInt(6) + 1}` };
}
