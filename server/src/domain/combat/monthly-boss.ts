import type { ElementKey } from '../economy/resources.js';
import { getBusinessDate } from '../time/business-date.js';

export const MONTHLY_BOSS_INITIAL_BASE_HP = 1_500_000n;
export const MONTHLY_BOSS_MINIMUM_BASE_HP = 500_000n;
export const MONTHLY_BOSS_MAX_MONTHLY_INCREASE = 1_500_000n;
export const MONTHLY_BOSS_DAILY_INCREASE = 75_000n;
export const MONTHLY_BOSS_REWARD = { primogems: 16_000n, moras: 500_000n } as const;

export const monthlyBossNames = [
  'Colosse du Givre Éternel',
  'Dévoreur de Lune',
  'Gardien des Racines Anciennes',
  'Bête de l’Orage Céleste',
  'Chimère des Mille Fleurs',
  'Léviathan des Profondeurs',
  'Titan du Soleil Brisé',
  'Monstre Abyssal',
  'Seigneur des Ruines Oubliées',
  'Spectre de la Nuit Sans Fin',
  'Fléau des Brumes Noires',
  'Souverain du Blizzard',
] as const;

export type BossCombatMember = Readonly<{
  id: string;
  name: string;
  rarity: 4 | 5;
  constellation: number;
  elementKey: ElementKey;
}>;

export type BossDamageContribution = Readonly<{
  characterId: string;
  characterName: string;
  rarity: 4 | 5;
  constellation: number;
  elementKey: ElementKey;
  damageBeforeResistance: bigint;
  resistanceApplied: boolean;
  damage: bigint;
}>;

export function getBusinessMonth(instant: Date): string {
  return `${getBusinessDate(instant).slice(0, 7)}-01`;
}

export function nextBusinessMonth(monthStart: string): string {
  const value = new Date(`${monthStart}T00:00:00.000Z`);
  value.setUTCMonth(value.getUTCMonth() + 1);
  return value.toISOString().slice(0, 10);
}

export function monthlyBossName(monthStart: string): string {
  const month = Number(monthStart.slice(5, 7));
  const name = monthlyBossNames[month - 1];
  if (!name) throw new Error(`Unsupported Boss month ${monthStart}.`);
  return name;
}

export function calculateBossDamage(members: readonly BossCombatMember[], resistance: ElementKey) {
  const contributions: BossDamageContribution[] = members.map((member) => {
    const damageBeforeResistance = BigInt(member.rarity === 5 ? 1_000 + 650 * member.constellation : 500 + 150 * member.constellation);
    const resistanceApplied = member.elementKey === resistance;
    return {
      characterId: member.id,
      characterName: member.name,
      rarity: member.rarity,
      constellation: member.constellation,
      elementKey: member.elementKey,
      damageBeforeResistance,
      resistanceApplied,
      damage: resistanceApplied ? damageBeforeResistance / 2n : damageBeforeResistance,
    };
  });
  return { contributions, totalDamage: contributions.reduce((total, item) => total + item.damage, 0n) } as const;
}

export function calculateBossMaxHp(baseHp: bigint, variationPercent: number): bigint {
  if (!Number.isInteger(variationPercent) || variationPercent < -15 || variationPercent > 15) throw new Error('Boss HP variation must be an integer from -15 to 15.');
  const scaledByPercent = baseHp * BigInt(100 + variationPercent);
  return ((scaledByPercent + 500_000n) / 1_000_000n) * 10_000n;
}

export function calculateNextBossBase(previous: Readonly<{ baseHp: bigint; currentHp: bigint; monthStart: string; defeatedAt: Date | null }>): Readonly<{ baseHp: bigint; adjustment: bigint }> {
  if (!previous.defeatedAt) {
    const baseHp = previous.baseHp - previous.currentHp < MONTHLY_BOSS_MINIMUM_BASE_HP ? MONTHLY_BOSS_MINIMUM_BASE_HP : previous.baseHp - previous.currentHp;
    return { baseHp, adjustment: baseHp - previous.baseHp };
  }
  const victoryBusinessDate = getBusinessDate(previous.defeatedAt);
  const victoryDay = Number(victoryBusinessDate.slice(8, 10));
  const [year, month] = previous.monthStart.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(year!, month!, 0)).getUTCDate();
  const increase = BigInt(Math.max(0, daysInMonth - victoryDay)) * MONTHLY_BOSS_DAILY_INCREASE;
  const capped = increase > MONTHLY_BOSS_MAX_MONTHLY_INCREASE ? MONTHLY_BOSS_MAX_MONTHLY_INCREASE : increase;
  return { baseHp: previous.baseHp + capped, adjustment: capped };
}

export function calculateBossVictoryTiming(monthStart: string, defeatedAt: Date | null): Readonly<{ victoryDayCount: number | null; daysRemainingAfterVictory: number | null }> {
  if (!defeatedAt) return { victoryDayCount: null, daysRemainingAfterVictory: null };
  const defeatedBusinessDate = getBusinessDate(defeatedAt);
  const monthStartTime = Date.parse(`${monthStart}T00:00:00.000Z`);
  const defeatedTime = Date.parse(`${defeatedBusinessDate}T00:00:00.000Z`);
  const nextMonthTime = Date.parse(`${nextBusinessMonth(monthStart)}T00:00:00.000Z`);
  const victoryDayCount = Math.floor((defeatedTime - monthStartTime) / 86_400_000) + 1;
  const daysInMonth = Math.floor((nextMonthTime - monthStartTime) / 86_400_000);
  if (victoryDayCount < 1 || victoryDayCount > daysInMonth) throw new Error(`Boss victory ${defeatedBusinessDate} is outside ${monthStart}.`);
  return { victoryDayCount, daysRemainingAfterVictory: daysInMonth - victoryDayCount };
}

export function calculateRoundedBossAverage(totalDamage: bigint, attackCount: bigint): bigint {
  return attackCount > 0n ? (totalDamage + attackCount / 2n) / attackCount : 0n;
}

export function calculateContributionBasisPoints(totalDamage: bigint, maxHp: bigint): bigint {
  return maxHp > 0n ? (totalDamage * 10_000n + maxHp / 2n) / maxHp : 0n;
}
