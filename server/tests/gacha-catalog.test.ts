import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('generated Gacha catalog', () => {
  it('contains the full valid and uniquely keyed repository catalog', async () => {
    const catalog = JSON.parse(await readFile(new URL('../prisma/data/characters.json', import.meta.url), 'utf8')) as { externalKey: string; rarity: number; elementKey: string }[];
    expect(catalog).toHaveLength(118);
    expect(catalog.filter(({ rarity }) => rarity === 5)).toHaveLength(67);
    expect(catalog.filter(({ rarity }) => rarity === 4)).toHaveLength(51);
    expect(new Set(catalog.map(({ externalKey }) => externalKey)).size).toBe(118);
    expect(catalog.every(({ externalKey }) => /^legacy:\d+$/.test(externalKey))).toBe(true);
    expect(catalog.every(({ rarity }) => rarity === 4 || rarity === 5)).toBe(true);
    expect(catalog.every(({ elementKey }) => ['anemo', 'cryo', 'dendro', 'electro', 'geo', 'hydro', 'pyro'].includes(elementKey))).toBe(true);
  });
});
