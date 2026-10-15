import { describe, expect, it } from 'vitest';
import { readGachaActiveTeam } from '../src/application/gacha/gacha-snapshot-storage.js';

describe('Gacha Team receipt compatibility', () => {
  const original = { teamId: 'original', elements: ['hydro'], effects: { fiveStarChanceBonusBasisPoints: 30 } };
  it('reads historical inline snapshots and operation v2 without live state', () => {
    expect(readGachaActiveTeam({ activeTeam: original }, null)).toEqual(original);
    expect(readGachaActiveTeam({ snapshotVersion: 2, activeTeamRef: 'operation' }, { gachaSnapshotVersion: 2, activeTeam: original })).toEqual(original);
  });
  it('refuses a missing/unknown referenced snapshot', () => {
    expect(() => readGachaActiveTeam({ snapshotVersion: 2, activeTeamRef: 'operation' }, null)).toThrow('GACHA_TEAM_SNAPSHOT_MISSING');
    expect(() => readGachaActiveTeam({ snapshotVersion: 3 }, { activeTeam: original })).toThrow();
  });
});
