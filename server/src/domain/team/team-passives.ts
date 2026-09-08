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
  const counts = new Map<ElementKey, number>();
  for (const element of elements) counts.set(element, Math.min(2, (counts.get(element) ?? 0) + 1));

  return elementKeys.flatMap((elementKey) => {
    const count = counts.get(elementKey) ?? 0;
    if (count === 0) return [];
    const stacks = count === 1 ? 1 : 2;
    const definition = definitions[elementKey];
    return [{ ...definition, stacks, description: stacks === 1 ? definition.levelOne : definition.levelTwo }];
  });
}
