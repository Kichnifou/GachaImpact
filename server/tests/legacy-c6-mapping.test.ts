import { describe, expect, it } from 'vitest';
import { mapLegacyC6 } from '../src/application/migration/legacy-c6-mapping.js';

const box = [{ characterId: 'character-1', constellation: 6, provenance: { legacyKey: '1' } }];
const catalog = [{ id: 'character-1', rarity: 5 }];
const stats = { strength: 20, intelligence: 12, beauty: 8, charisma: 9, popularity: 3 };

describe('personal C6 migration mapping', () => {
  it('maps known counters without inventing missing thematic history', () => {
    const source = { Kichnifou: { characters: { '1': { characterId: 1, createdAt: '2026-09-01 12:00:00', stats,
      contestStats: { totalContests: 7, totalWins: 2, intelligenceContests: 3, intelligenceWins: 1 }, titles: { intelligence: 'Sage de Bronze' } } } } };
    const result = mapLegacyC6(source, 'kichnifou', box, catalog);
    expect(result.blockers).toEqual([]);
    expect(result.rows).toMatchObject([{ characterId: 'character-1', strength: 20, strengthParticipations: 0n,
      intelligenceParticipations: 3n, intelligenceWins: 1n, intelligenceTitleFloor: 1, totalContests: 7n, totalWins: 2n }]);
    expect(result.rows[0]?.unlockedAt).toEqual(new Date('2026-09-01T10:00:00.000Z'));
  });
  it('blocks an unknown unlock date instead of inventing one', () => {
    const source = { Kichnifou: { characters: { '1': { characterId: 1, createdAt: '', stats } } } };
    expect(mapLegacyC6(source, 'kichnifou', box, catalog).blockers).not.toEqual([]);
  });
});
