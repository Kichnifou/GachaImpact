import { describe, expect, it } from 'vitest';
import { getParisWeekWindow, selectBannerFeatured, type GachaCharacter } from '../src/domain/gacha/gacha.js';

const catalog: GachaCharacter[] = Array.from({ length: 30 }, (_, index) => ({
  id: `c${index}`, externalKey: `legacy:${index}`, name: `Character ${index}`,
  rarity: index < 15 ? 5 : 4, elementKey: 'hydro', weaponType: null, region: null,
  classKey: null, iconPath: null, splashPath: null, wishPath: null, fullbodyPath: null,
}));
const random = { nextInt: (max: number) => max - 1 };

describe('weekly Gacha banner domain', () => {
  it('uses Paris Monday boundaries including DST', () => {
    expect(getParisWeekWindow(new Date('2026-03-29T12:00:00Z'))).toEqual({ startsAt: new Date('2026-03-22T23:00:00Z'), endsAt: new Date('2026-03-29T22:00:00Z') });
    expect(getParisWeekWindow(new Date('2026-10-25T12:00:00Z'))).toEqual({ startsAt: new Date('2026-10-18T22:00:00Z'), endsAt: new Date('2026-10-25T23:00:00Z') });
  });
  it('creates four five-stars and six four-stars with unique valid slots', () => {
    const result = selectBannerFeatured(catalog, new Set(), [], random);
    expect(result).toHaveLength(10);
    expect(new Set(result.map(({ character }) => character.id)).size).toBe(10);
    expect(result.filter(({ character }) => character.rarity === 5).map(({ slot }) => slot)).toEqual([1, 2, 3, 4]);
    expect(result.filter(({ character }) => character.rarity === 4).map(({ slot }) => slot)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(result[3]?.selectionSource).toBe('RANDOM_FALLBACK');
  });
  it('excludes the previous week and honors controlled weighted votes', () => {
    const previous = new Set(['c14', 'c13', 'c12', 'c29', 'c28', 'c27']);
    const result = selectBannerFeatured(catalog, previous, [{ characterId: 'c4', votes: 3 }], { nextInt: () => 0 });
    expect(result.some(({ character }) => previous.has(character.id))).toBe(false);
    expect(result.find(({ selectionSource }) => selectionSource === 'COMMUNITY_VOTE')?.character.id).toBe('c4');
  });
  it('refuses an insufficient catalog before a banner can be published', () => {
    expect(() => selectBannerFeatured(catalog.slice(0, 18), new Set(), [], random)).toThrow(/cannot produce/);
  });
});
