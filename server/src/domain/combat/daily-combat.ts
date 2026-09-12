import { elementKeys, type ElementKey } from '../economy/resources.js';

export const DAILY_COMBAT_REWARD = { primogems: 800n, moras: 20_000n } as const;

export type CombatMember = Readonly<{
  id: string;
  rarity: 4 | 5;
  constellation: number;
  elementKey: ElementKey;
}>;

export type CombatPreview = Readonly<{
  baseHalfPoints: 100;
  rarityBonusHalfPoints: number;
  constellationBonusHalfPoints: number;
  favorableMatchups: number;
  favorableBonusHalfPoints: number;
  unfavorableMatchups: number;
  unfavorableMalusHalfPoints: number;
  rawHalfPoints: number;
  clamp: 'MINIMUM' | 'MAXIMUM' | null;
  finalHalfPoints: number;
  memberContributions: readonly Readonly<{ characterId: string; halfPoints: number }>[];
}>;

export function calculateDailyCombatPreview(
  members: readonly CombatMember[],
  enemyElements: readonly ElementKey[],
  relations: ReadonlyMap<string, number>,
): CombatPreview {
  const rarityBonusHalfPoints = members.reduce((sum, member) => sum + (member.rarity === 5 ? 12 : 6), 0);
  const constellationBonusHalfPoints = members.reduce((sum, member) => sum + member.constellation * (member.rarity === 5 ? 2 : 1), 0);
  let favorableMatchups = 0;
  let unfavorableMatchups = 0;
  const memberContributions = members.map((member) => {
    let relationHalfPoints = 0;
    for (const enemy of enemyElements) {
      const relation = relations.get(`${member.elementKey}:${enemy}`) ?? 0;
      if (relation > 0) { favorableMatchups += 1; relationHalfPoints += 8; }
      if (relation < 0) { unfavorableMatchups += 1; relationHalfPoints -= 8; }
    }
    return { characterId: member.id, halfPoints: (member.rarity === 5 ? 12 : 6) + member.constellation * (member.rarity === 5 ? 2 : 1) + relationHalfPoints };
  });
  const favorableBonusHalfPoints = favorableMatchups * 8;
  const unfavorableMalusHalfPoints = unfavorableMatchups * 8;
  const rawHalfPoints = 100 + rarityBonusHalfPoints + constellationBonusHalfPoints + favorableBonusHalfPoints - unfavorableMalusHalfPoints;
  const finalHalfPoints = Math.max(10, Math.min(190, rawHalfPoints));
  return {
    baseHalfPoints: 100,
    rarityBonusHalfPoints,
    constellationBonusHalfPoints,
    favorableMatchups,
    favorableBonusHalfPoints,
    unfavorableMatchups,
    unfavorableMalusHalfPoints,
    rawHalfPoints,
    clamp: rawHalfPoints < 10 ? 'MINIMUM' : rawHalfPoints > 190 ? 'MAXIMUM' : null,
    finalHalfPoints,
    memberContributions,
  };
}

export function combatPercent(halfPoints: number): number { return halfPoints / 2; }

export function projectElementMatchups(
  defenderElement: ElementKey,
  relations: ReadonlyMap<string, number>,
): Readonly<{ weakAgainstElements: readonly ElementKey[]; resistantAgainstElements: readonly ElementKey[] }> {
  return {
    weakAgainstElements: elementKeys.filter((attacker) => relations.get(`${attacker}:${defenderElement}`) === 1),
    resistantAgainstElements: elementKeys.filter((attacker) => relations.get(`${attacker}:${defenderElement}`) === -1),
  };
}
