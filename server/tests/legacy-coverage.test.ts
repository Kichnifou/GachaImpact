import { describe, expect, it } from 'vitest';
import { parseStreamerbotSnapshot, snapshotFileNames } from '../src/application/migration/streamerbot-snapshot.js';
import { normalizeCoverageKey, scanLegacyCoverage } from '../src/application/migration/legacy-coverage.js';

function fixture(viewers: Record<string, unknown>, extra?: { name: string; value: unknown }) {
  const files: Record<string, string> = Object.fromEntries(snapshotFileNames.map(name => [name, name === 'monthly_events.json' ? '' : '{}']));
  files['viewers_data.json'] = JSON.stringify(viewers);
  if (extra) files[extra.name] = JSON.stringify(extra.value);
  return files;
}

describe('legacy coverage gate', () => {
  it('classifies valid and excluded profiles without skipping excluded fields', () => {
    const report = scanLegacyCoverage(parseStreamerbotSnapshot(fixture({
      eligible: { element: 'pyro', xp: 1 }, excluded: { element: null, xp: 0 },
    })));
    expect(report).toMatchObject({ files: 17, totalProfiles: 2, selectedProfiles: 1, excludedProfiles: 1, unknown: [] });
    const changed = scanLegacyCoverage(parseStreamerbotSnapshot(fixture({
      eligible: { element: 'pyro' }, excluded: { element: null, newPrivateState: 5 },
    })));
    expect(changed.unknown).toEqual([{ file: 'viewers_data.json', path: '*.newPrivateState' }]);
  });

  it('rejects an additional source file before inspection', () => {
    expect(() => parseStreamerbotSnapshot(fixture({}, { name: 'new_source.json', value: {} }))).toThrow();
  });

  it('recognizes a dynamic character ID but blocks a new nested field', () => {
    const report = scanLegacyCoverage(parseStreamerbotSnapshot(fixture({
      eligible: { box: { '98765': { characterId: 98765, constellation: 0, copies: 1, firstObtainedAt: null } }, element: 'pyro' },
    })));
    expect(report.unknown).toEqual([]);
    const changed = scanLegacyCoverage(parseStreamerbotSnapshot(fixture({
      eligible: { box: { '98765': { characterId: 98765, newlyAdded: true } }, element: 'pyro' },
    })));
    expect(changed.unknown).toEqual([{ file: 'viewers_data.json', path: '*.box.*.newlyAdded' }]);
  });

  it('accepts usernames and numeric keys only at declared map positions', () => {
    expect(normalizeCoverageKey('friendships_data.json', 'friendships.*.lastHeartSent', 'eligible')).toBe('*');
    expect(normalizeCoverageKey('monthly_events_data.json', 'dailyWindows.*', '2026-09-26')).toBe('*');
    expect(normalizeCoverageKey('element_passives.json', 'elements.pyro.effects', '1')).toBe('*');
    expect(normalizeCoverageKey('viewers_data.json', '*.options', 'eligible')).toBe('eligible');
    expect(normalizeCoverageKey('monthly_events_data.json', 'futureField', '2026-09-26')).toBe('2026-09-26');
    expect(normalizeCoverageKey('element_passives.json', 'elements.pyro.futureField', '1')).toBe('1');
  });
});
