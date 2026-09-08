import { elementKeys, type ElementKey } from '../economy/resources.js';

export type TeamPassiveDefinition = Readonly<{
  elementKey: ElementKey;
  displayName: string;
  levelOne: string;
  levelTwo: string;
}>;

export type DerivedTeamPassive = TeamPassiveDefinition & Readonly<{
  stacks: 1 | 2;
  description: string;
}>;

type ChanceReward<TAmount extends number> = Readonly<{
  oneIn: number;
  amount: TAmount;
}>;

export type ActiveTeamGachaEffects = Readonly<{
  secondaryParticleMultiplier: number;
  fiveStarChanceBonusBasisPoints: number;
  xpReward: ChanceReward<1> | null;
  pity5Reward: ChanceReward<2> | null;
  primogemRecovery: ChanceReward<80> | null;
  secondaryMoraMultiplier: number;
  dendroBundle: Readonly<{
    oneIn: number;
    primogems: 40;
    moras: 1_000;
    particlesPerElement: 5;
  }> | null;
}>;

export const TEAM_GACHA_PASSIVE_PARAMETERS = {
  pyro: { secondaryParticleMultipliers: [1.25, 1.5] },
  hydro: { fiveStarChanceBonusBasisPoints: [30, 60] },
  cryo: { xpRewardOneIn: [20, 10], xpAmount: 1 },
  electro: { pity5RewardOneIn: [30, 20], pity5Amount: 2 },
  anemo: { primogemRecoveryOneIn: [12, 8], primogemAmount: 80 },
  geo: { secondaryMoraMultipliers: [1.25, 1.5] },
  dendro: {
    bundleOneIn: [25, 15],
    primogems: 40,
    moras: 1_000,
    particlesPerElement: 5,
  },
} as const;

const definitions: Readonly<Record<ElementKey, TeamPassiveDefinition>> = {
  pyro: {
    elementKey: 'pyro', displayName: 'Pyro',
    levelOne: 'Récompenses secondaires en particules ×1,25',
    levelTwo: 'Récompenses secondaires en particules ×1,5',
  },
  hydro: {
    elementKey: 'hydro', displayName: 'Hydro',
    levelOne: 'Probabilité 5★ augmentée de 0,3 point',
    levelTwo: 'Probabilité 5★ augmentée de 0,6 point',
  },
  cryo: {
    elementKey: 'cryo', displayName: 'Cryo',
    levelOne: '1 chance sur 20 de gagner 1 XP par vœu',
    levelTwo: '1 chance sur 10 de gagner 1 XP par vœu',
  },
  electro: {
    elementKey: 'electro', displayName: 'Électro',
    levelOne: '1 chance sur 30 de gagner 2 Pity 5★ après le vœu',
    levelTwo: '1 chance sur 20 de gagner 2 Pity 5★ après le vœu',
  },
  anemo: {
    elementKey: 'anemo', displayName: 'Anémo',
    levelOne: '1 chance sur 12 de récupérer 80 Primogemmes',
    levelTwo: '1 chance sur 8 de récupérer 80 Primogemmes',
  },
  geo: {
    elementKey: 'geo', displayName: 'Géo',
    levelOne: 'Récompenses secondaires en Moras ×1,25',
    levelTwo: 'Récompenses secondaires en Moras ×1,5',
  },
  dendro: {
    elementKey: 'dendro', displayName: 'Dendro',
    levelOne: '1 chance sur 25 : 40 Primogemmes, 1 000 Moras et 5 particules de chaque élément',
    levelTwo: '1 chance sur 15 : 40 Primogemmes, 1 000 Moras et 5 particules de chaque élément',
  },
};

export function listTeamPassiveDefinitions(): readonly TeamPassiveDefinition[] {
  return elementKeys.map((elementKey) => definitions[elementKey]);
}

export function deriveTeamPassives(elements: readonly ElementKey[]): readonly DerivedTeamPassive[] {
  const counts = countElementStacks(elements);

  return elementKeys.flatMap((elementKey) => {
    const count = counts.get(elementKey) ?? 0;
    if (count === 0) return [];
    const stacks = count === 1 ? 1 : 2;
    const definition = definitions[elementKey];
    return [{ ...definition, stacks, description: stacks === 1 ? definition.levelOne : definition.levelTwo }];
  });
}

export function deriveActiveTeamGachaEffects(elements: readonly ElementKey[]): ActiveTeamGachaEffects {
  const stacks = countElementStacks(elements);
  const pyro = levelIndex(stacks.get('pyro'));
  const hydro = levelIndex(stacks.get('hydro'));
  const cryo = levelIndex(stacks.get('cryo'));
  const electro = levelIndex(stacks.get('electro'));
  const anemo = levelIndex(stacks.get('anemo'));
  const geo = levelIndex(stacks.get('geo'));
  const dendro = levelIndex(stacks.get('dendro'));

  return {
    secondaryParticleMultiplier: pyro === null ? 1 : TEAM_GACHA_PASSIVE_PARAMETERS.pyro.secondaryParticleMultipliers[pyro],
    fiveStarChanceBonusBasisPoints: hydro === null ? 0 : TEAM_GACHA_PASSIVE_PARAMETERS.hydro.fiveStarChanceBonusBasisPoints[hydro],
    xpReward: cryo === null ? null : {
      oneIn: TEAM_GACHA_PASSIVE_PARAMETERS.cryo.xpRewardOneIn[cryo],
      amount: TEAM_GACHA_PASSIVE_PARAMETERS.cryo.xpAmount,
    },
    pity5Reward: electro === null ? null : {
      oneIn: TEAM_GACHA_PASSIVE_PARAMETERS.electro.pity5RewardOneIn[electro],
      amount: TEAM_GACHA_PASSIVE_PARAMETERS.electro.pity5Amount,
    },
    primogemRecovery: anemo === null ? null : {
      oneIn: TEAM_GACHA_PASSIVE_PARAMETERS.anemo.primogemRecoveryOneIn[anemo],
      amount: TEAM_GACHA_PASSIVE_PARAMETERS.anemo.primogemAmount,
    },
    secondaryMoraMultiplier: geo === null ? 1 : TEAM_GACHA_PASSIVE_PARAMETERS.geo.secondaryMoraMultipliers[geo],
    dendroBundle: dendro === null ? null : {
      oneIn: TEAM_GACHA_PASSIVE_PARAMETERS.dendro.bundleOneIn[dendro],
      primogems: TEAM_GACHA_PASSIVE_PARAMETERS.dendro.primogems,
      moras: TEAM_GACHA_PASSIVE_PARAMETERS.dendro.moras,
      particlesPerElement: TEAM_GACHA_PASSIVE_PARAMETERS.dendro.particlesPerElement,
    },
  };
}

function countElementStacks(elements: readonly ElementKey[]): ReadonlyMap<ElementKey, number> {
  const counts = new Map<ElementKey, number>();
  for (const element of elements) counts.set(element, Math.min(2, (counts.get(element) ?? 0) + 1));
  return counts;
}

function levelIndex(stacks: number | undefined): 0 | 1 | null {
  if (!stacks) return null;
  return stacks === 1 ? 0 : 1;
}
