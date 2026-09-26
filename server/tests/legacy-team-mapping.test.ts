import { describe, expect, it } from 'vitest';
import { mapLegacyTeams } from '../src/application/migration/legacy-team-mapping.js';

const box = [1, 2, 3, 4, 5].map(id => ({ characterId: `character-${id}`, provenance: { legacyKey: String(id) } }));

describe('legacy Teams mapping', () => {
  it('keeps historical positions and selects the matching saved composition with active order', () => {
    const result = mapLegacyTeams({ team: [2, 1, 3, 4], savedTeams: {
      '2': { name: 'Saved', characters: [1, 2, 3, 4], savedAt: '2026-09-01 12:00:00' },
      '4': { name: 'Duplicate', characters: [4, 3, 2, 1], savedAt: '2026-09-02 12:00:00' },
    } }, box);
    expect(result.blockers).toEqual([]);
    expect(result.slots).toHaveLength(10);
    expect(result.slots[1]).toMatchObject({ position: 2, isActive: true, members: ['character-2', 'character-1', 'character-3', 'character-4'] });
    expect(result.slots[3]?.members).toEqual([]);
    expect(result.anomalies).toHaveLength(1);
  });
  it('blocks a saved team with a character absent from the Box', () => {
    const result = mapLegacyTeams({ team: [], savedTeams: { '1': { characters: [1, 99] } } }, box);
    expect(result.blockers).toHaveLength(1);
  });
});
