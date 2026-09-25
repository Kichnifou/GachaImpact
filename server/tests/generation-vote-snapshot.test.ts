import { describe, expect, it } from 'vitest';
import { generationVoteSnapshot, selectBannerFeatured, type GachaCharacter } from '../src/domain/gacha/gacha.js';

const character = (id: string, rarity: 4 | 5): GachaCharacter => ({ id, externalKey: id, name: id, rarity, elementKey: 'pyro', weaponType: null, region: null, classKey: null, iconPath: null, splashPath: null, wishPath: null, fullbodyPath: null });
const pool = [...Array.from({ length: 7 }, (_, index) => character(`five-${index}`, 5)), ...Array.from({ length: 6 }, (_, index) => character(`four-${index}`, 4))];
const roll = { nextInt: () => 0 };

describe('generationVoteSnapshot', () => {
  it('records all eligible candidates, including zero votes, from the generation pool', () => {
    const previous = new Set(['five-0']);
    const selected = selectBannerFeatured(pool, previous, [{ characterId: 'five-4', votes: 3 }], roll);
    const snapshot = generationVoteSnapshot('prior', new Date('2026-09-20T22:00:00Z'), pool, previous, [{ characterId: 'five-4', votes: 3 }], selected);
    expect(snapshot.sourceRotationId).toBe('prior');
    expect(snapshot.candidates).toHaveLength(6);
    expect(snapshot.candidates.find(candidate => candidate.characterId === 'five-4')?.voteCount).toBe(3);
    expect(snapshot.candidates.find(candidate => candidate.characterId === 'five-5')?.voteCount).toBe(0);
    expect(snapshot.candidates.some(candidate => candidate.characterId === 'five-0')).toBe(false);
    expect(snapshot).toMatchObject({ selectedCharacterId: 'five-4', selectionSource: 'COMMUNITY_VOTE' });
  });

  it('keeps the random fallback when no eligible vote exists', () => {
    const selected = selectBannerFeatured(pool, new Set(), [], roll);
    expect(generationVoteSnapshot(null, new Date(0), pool, new Set(), [], selected)).toMatchObject({ selectionSource: 'RANDOM_FALLBACK', selectedCharacterId: selected[3]!.character.id });
  });
});
