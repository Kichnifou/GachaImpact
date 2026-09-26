import { describe, expect, it } from 'vitest';
import { permanentMissionCatalog, permanentMissionMetrics } from '../src/domain/missions/permanent-mission-catalog.js';
import { mapLegacyPermanentMissions } from '../src/application/migration/legacy-mission-mapping.js';

const cutoverAt = new Date('2026-09-26T19:00:00.000Z');
const counters = Object.fromEntries(permanentMissionMetrics.map(metric => [metric, 0n]));

describe('legacy permanent Missions without invented dates', () => {
  it('keeps an active chain without a known start instant', () => {
    const result = mapLegacyPermanentMissions({ longMissions: { categories: {
      messages: { active: true, activeRank: 'B', progress: 5 },
    } } }, permanentMissionCatalog, counters, cutoverAt);
    const messagesB = permanentMissionCatalog.find(definition => definition.externalKey === 'messages_b')!;
    expect(result.blockers).toEqual([]);
    expect(result.rows.find(row => row.definitionId === messagesB.id)).toMatchObject({ status: 'ACTIVE', progress: 5n, startedAt: null });
  });

  it('blocks a claimed Z unlock whose date cannot be represented honestly', () => {
    const result = mapLegacyPermanentMissions({ longMissions: { unlockedZ: true } }, permanentMissionCatalog, counters, cutoverAt);
    expect(result.blockers).toContain('Date de déblocage Z inconnue : représentation physique à résoudre sans date inventée.');
    expect(result.zUnlockedAt).toBeNull();
  });
});
