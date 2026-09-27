import { describe, expect, it } from 'vitest';
import { parseStreamerbotSnapshot, snapshotFileNames } from '../src/application/migration/streamerbot-snapshot.js';
import { buildLegacyGlobalPlan } from '../src/application/migration/legacy-global-plan.js';

const id = '00000000-0000-4000-a000-000000000001';
function snapshot() {
  const files: Record<string, string> = Object.fromEntries(snapshotFileNames.map(name => [name, name === 'monthly_events.json' ? '' : '{}']));
  files['viewers_data.json'] = JSON.stringify({ alice: { element: 'pyro' }, bob: { element: null } });
  files['friendships_data.json'] = JSON.stringify({ friendships: { one: { users: ['alice', 'bob'] } }, requests: [{ from: 'bob', to: 'alice' }] });
  return parseStreamerbotSnapshot(files);
}
const twitch = [{ legacyLogin: 'alice', twitchUserId: '123', currentLogin: 'alice', displayName: 'Alice on Twitch', renamed: false }];

describe('global legacy population and identity plan', () => {
  it('ignores a matching display name without a verified TwitchIdentity and drops excluded relations', () => {
    const plan = buildLegacyGlobalPlan(snapshot(), twitch, [{ id, displayName: 'alice', twitchUserId: null }], new Set());
    expect(plan.players).toHaveLength(1);
    expect(plan.players[0]).toMatchObject({ displayName: 'Alice on Twitch', mappingMode: 'TWITCH_ONLY', twitchUserId: '123' });
    expect(plan.players[0]!.playerId).not.toBe(id);
    expect(plan.unmatchedWebPlayerIds).toEqual([id]);
    expect(plan).toMatchObject({ excludedProfiles: 1, friendshipCount: 0, friendshipExcluded: 1, requestCount: 0, requestExcluded: 1 });
  });

  it('reuses the verified web Player while retaining its GachaImpact name', () => {
    const plan = buildLegacyGlobalPlan(snapshot(), twitch, [{ id, displayName: 'Web nickname', twitchUserId: '123' }], new Set(),
      [{ playerId: id, twitchUserId: '123' }]);
    expect(plan.players[0]).toMatchObject({ playerId: id, displayName: 'Web nickname', twitchDisplayName: 'Alice on Twitch',
      mappingMode: 'EXISTING_VERIFIED_TWITCH' });
    expect(plan.issues.filter(issue => issue.severity === 'BLOCKER')).toEqual([]);
  });

  it('blocks a Twitch ID already linked to a different Player', () => {
    const plan = buildLegacyGlobalPlan(snapshot(), twitch, [{ id, displayName: 'Web nickname', twitchUserId: '123' }], new Set(),
      [{ playerId: '00000000-0000-4000-a000-000000000002', twitchUserId: '123' }]);
    expect(plan.issues.map(issue => issue.code)).toContain('TWITCH_EXISTING_IDENTITY_CONFLICT');
    expect(plan.players).toHaveLength(0);
  });

  it('classifies an invalid present XP day as a blocker before import', () => {
    const files: Record<string, string> = Object.fromEntries(snapshotFileNames.map(name => [name, name === 'monthly_events.json' ? '' : '{}']));
    files['viewers_data.json'] = JSON.stringify({ alice: { element: 'pyro', dates: { lastXpDate: '2026-02-30' } } });
    const plan = buildLegacyGlobalPlan(parseStreamerbotSnapshot(files), twitch, [], new Set());
    expect(plan.issues).toContainEqual({ code: 'LEGACY_XP_DATE_INVALID', severity: 'BLOCKER',
      source: 'viewers_data.json', path: '*.dates.lastXpDate', legacyKey: 'alice' });
  });
});
