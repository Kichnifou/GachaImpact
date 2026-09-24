import { describe, expect, it } from 'vitest';
import {
  PERMANENT_MISSION_BAS_COUNT,
  PERMANENT_MISSION_DEFINITION_COUNT,
  PERMANENT_MISSION_Z_COUNT,
  permanentMissionCatalog,
} from '../src/domain/missions/permanent-mission-catalog.js';

describe('Permanent Mission catalog', () => {
  it('contains the exact deterministic 27 B/A/S and 4 Z definitions', () => {
    expect(permanentMissionCatalog).toHaveLength(PERMANENT_MISSION_DEFINITION_COUNT);
    expect(permanentMissionCatalog.filter(mission => mission.rank !== 'Z')).toHaveLength(PERMANENT_MISSION_BAS_COUNT);
    expect(permanentMissionCatalog.filter(mission => mission.rank === 'Z')).toHaveLength(PERMANENT_MISSION_Z_COUNT);
    expect(new Set(permanentMissionCatalog.map(mission => mission.externalKey)).size).toBe(PERMANENT_MISSION_DEFINITION_COUNT);
    expect(new Set(permanentMissionCatalog.map(mission => mission.id)).size).toBe(PERMANENT_MISSION_DEFINITION_COUNT);
    expect(permanentMissionCatalog.map(mission => `${mission.rank}:${mission.displayOrder}`)).toEqual([
      ...['B', 'A', 'S'].flatMap(rank => Array.from({ length: 9 }, (_, index) => `${rank}:${index + 1}`)),
      ...Array.from({ length: 4 }, (_, index) => `Z:${index + 1}`),
    ]);
  });

  it('keeps exact thresholds, rewards and Z secrecy', () => {
    const expected = new Map([
      ['COUNTED_MESSAGES', [50n, 200n, 1_000n]], ['PULLS', [50n, 200n, 1_000n]],
      ['DISTINCT_CHARACTERS_4', [3n, 10n, 30n]], ['DISTINCT_CHARACTERS_5', [1n, 5n, 20n]],
      ['MORAS_EARNED', [50_000n, 200_000n, 1_000_000n]], ['MAIN_ELEMENT_PARTICLES_EARNED', [500n, 2_000n, 10_000n]],
      ['EXPEDITIONS_COMPLETED', [3n, 10n, 30n]], ['COMBAT_WINS', [5n, 20n, 100n]],
      ['FRIEND_HEARTS_SENT', [10n, 40n, 200n]],
    ]);
    for (const [metric, targets] of expected) {
      const chain = permanentMissionCatalog.filter(mission => mission.metric === metric);
      expect(chain.map(mission => mission.target)).toEqual(targets);
      expect(chain.map(mission => mission.rewardPrimogems)).toEqual([160n, 1_600n, 16_000n]);
      expect(chain.every(mission => !mission.isSecret)).toBe(true);
    }
    const z = permanentMissionCatalog.filter(mission => mission.rank === 'Z');
    expect(z.map(mission => [mission.metric, mission.target, mission.rewardPrimogems])).toEqual([
      ['C6_CHARACTERS', 5n, 160_000n], ['PERFECT_FRIENDSHIP', 1n, 160_000n],
      ['PLAYER_LEVEL', 100n, 160_000n], ['MANUAL_COMBAT_WINS', 50n, 160_000n],
    ]);
    expect(z.every(mission => mission.isSecret)).toBe(true);
    expect(permanentMissionCatalog.find(mission => mission.externalKey === 'messages_a')?.displayName).toBe('Voix infatigable');
    expect(permanentMissionCatalog.find(mission => mission.externalKey === 'moras_s')?.displayName).toBe('Millionnaire');
  });
});
