export const elementKeys = [
  'pyro',
  'hydro',
  'cryo',
  'electro',
  'anemo',
  'geo',
  'dendro',
] as const;

export type ElementKey = (typeof elementKeys)[number];
export type ParticleResourceKey = `particles_${ElementKey}`;
export type ResourceKey = 'primogems' | 'moras' | ParticleResourceKey;

export const resourceKeys: readonly ResourceKey[] = [
  'primogems',
  'moras',
  ...elementKeys.map((elementKey) => `particles_${elementKey}` as const),
];

export function isElementKey(value: string): value is ElementKey {
  return (elementKeys as readonly string[]).includes(value);
}

export function isResourceKey(value: string): value is ResourceKey {
  return (resourceKeys as readonly string[]).includes(value);
}

export function particleResourceKey(elementKey: ElementKey): ParticleResourceKey {
  return `particles_${elementKey}`;
}
