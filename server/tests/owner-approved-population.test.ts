import { describe, expect, it } from 'vitest';
import { parseStreamerbotSnapshot, snapshotFileNames } from '../src/application/migration/streamerbot-snapshot.js';
import { createOwnerApprovedPopulation, validateOwnerApprovedPopulation, revalidateFinalPopulation, identityProofHash } from '../src/application/migration/owner-approved-population.js';
import { buildLegacyGlobalPlan } from '../src/application/migration/legacy-global-plan.js';

function evidence() {
  const files = Object.fromEntries(snapshotFileNames.map(name => [name, name === 'monthly_events.json' ? '' : '{}']));
  const approved = Array.from({ length: 43 }, (_, index) => ({ legacyLogin: `approved${index}`, twitchUserId: String(900000000000 + index) }));
  const discarded = Array.from({ length: 171 }, (_, index) => `discarded${index}`), quarantined = ['missingone', 'missingtwo'];
  const viewers = Object.fromEntries([...approved.map(row => [row.legacyLogin, { element: 'pyro' }]), ...quarantined.map(name => [name, { element: 'pyro' }]),
    ...discarded.map(name => [name, { element: null }])]);
  files['viewers_data.json'] = JSON.stringify(viewers);
  files['friendships_data.json'] = JSON.stringify({ friendships: { discarded: { users: ['approved0', 'discarded0'] },
    quarantine: { users: ['approved0', 'missingone'] }, discardedQuarantine: { users: ['missingone', 'discarded0'] } }, requests: [] });
  const snapshot = parseStreamerbotSnapshot(files), now = new Date();
  const report = { version: 1 as const, verification: 'TWITCH_HELIX' as const, snapshotHash: snapshot.hash, resolvedAt: now.toISOString(),
    users: approved.map(row => ({ ...row, currentLogin: row.legacyLogin, displayName: row.legacyLogin, renamed: false })),
    missing: quarantined, conflicts: [] as string[], duplicates: 0 };
  const raw = { version: 1 as const, decision: 'OWNER_APPROVED_FINAL_LEGACY_POPULATION' as const, createdAt: now.toISOString(),
    historicalProof: { requirement: 'R1041' as const, reportHash: identityProofHash(report), snapshotHash: snapshot.hash, sourceProfiles: 216 as const,
      ownerDiscarded: 171 as const, ownerDiscardedLogins: discarded }, approved, quarantined };
  return { files, raw, report, snapshot, now };
}
describe('strict final historical population', () => {
  it('constructs the local membership only from the existing historical 216-profile evidence', () => {
    const f = evidence();
    expect(createOwnerApprovedPopulation(f.report, f.snapshot, f.now)).toEqual(f.raw);
  });
  it('validates exactly 43 approved, 171 author discarded and two quarantined against the original report and source', () => {
    const f = evidence(), population = validateOwnerApprovedPopulation(f.raw, f.report, f.snapshot, f.now);
    revalidateFinalPopulation(population, f.report, f.snapshot, f.now);
    const plan = buildLegacyGlobalPlan(f.snapshot, f.report.users, [], new Set(), [], undefined, undefined, population);
    expect(plan).toMatchObject({ sourceProfiles: 216, approvedPopulation: 43, ownerDiscarded: 171, quarantined: 2, unapprovedAdditional: 0, friendshipExcluded: 2 });
    expect(plan.players).toHaveLength(43);
    expect(plan.deferredIdentityFacts.byDomain.SOCIAL).toBe(1);
    expect(plan.discardedSharedFacts.byDomain.SOCIAL).toBe(2);
    expect(plan.issues.filter(row => row.severity === 'BLOCKER')).toEqual([]);
  });
  it.each(['unknown field', 'secret', '44th', 'duplicate', 'wrong ID', 'wrong proof', 'wrong discarded source'])('rejects %s', reason => {
    const f = evidence(), raw = structuredClone(f.raw);
    if (reason === 'unknown field' || reason === 'secret') Object.assign(raw, { [reason]: 'rejected' });
    if (reason === '44th') raw.approved.push({ legacyLogin: 'extra', twitchUserId: '99' });
    if (reason === 'duplicate') raw.approved[1] = raw.approved[0]!;
    if (reason === 'wrong ID') raw.approved[0]!.twitchUserId = '99';
    if (reason === 'wrong proof') raw.historicalProof.reportHash = '0'.repeat(64);
    if (reason === 'wrong discarded source') raw.historicalProof.ownerDiscardedLogins[0] = 'notinthehistoricalsource';
    expect(() => validateOwnerApprovedPopulation(raw, f.report, f.snapshot, f.now)).toThrow();
  });
  it('requires a fresh revalidation of the same immutable IDs', () => {
    const f = evidence(), population = validateOwnerApprovedPopulation(f.raw, f.report, f.snapshot, f.now);
    const stale = { ...f.report, resolvedAt: new Date(f.now.getTime() - 25 * 60 * 60 * 1000).toISOString() };
    expect(() => revalidateFinalPopulation(population, stale, f.snapshot, f.now)).toThrow('TWITCH_REPORT_STALE');
    const changed = structuredClone(f.report); changed.users[0]!.twitchUserId = '99';
    expect(() => revalidateFinalPopulation(population, changed, f.snapshot, f.now)).toThrow('FINAL_POPULATION_REVALIDATION_FAILED');
  });
  it('never auto-includes a later element or the additional future Twitch-only test account', () => {
    const f = evidence(), population = validateOwnerApprovedPopulation(f.raw, f.report, f.snapshot, f.now);
    const viewers = JSON.parse(f.files['viewers_data.json']!) as Record<string, { element: string | null }>;
    viewers.discarded0!.element = 'pyro'; viewers.future_test = { element: 'hydro' };
    f.files['viewers_data.json'] = JSON.stringify(viewers);
    const fresh = parseStreamerbotSnapshot(f.files), report = { ...f.report, snapshotHash: fresh.hash, missing: [] };
    revalidateFinalPopulation(population, report, fresh, f.now);
    const plan = buildLegacyGlobalPlan(fresh, report.users, [], new Set(), [], undefined, undefined, population);
    expect(plan.players).toHaveLength(43);
    expect(plan).toMatchObject({ sourceProfiles: 217, ownerDiscarded: 171, unapprovedAdditional: 1 });
    expect(plan.players.some(row => row.twitchUserId === '999000' || row.twitchUserId === '999001')).toBe(false);
  });
  it('uses a Native canary as a shared endpoint and omits its personal viewer even when the final snapshot has different gameplay', () => {
    const f = evidence(), population = validateOwnerApprovedPopulation(f.raw, f.report, f.snapshot, f.now);
    const id = '11111111-1111-4111-8111-111111111111';
    const plan = buildLegacyGlobalPlan(f.snapshot, f.report.users, [{ id, displayName: 'Native fixture', twitchUserId: f.report.users[0]!.twitchUserId,
      dataAuthority: 'NATIVE', canaryImported: true }], new Set(), [{ playerId: id, twitchUserId: f.report.users[0]!.twitchUserId }], undefined, undefined, population);
    expect(plan.players[0]).toMatchObject({ playerId: id, mappingMode: 'EXISTING_VERIFIED_TWITCH', personalImport: false, viewer: {} });
  });
});


it('resolves the fixed 43 independently of absent elements and blocks a real typo', () => {
  const f = evidence(), population = validateOwnerApprovedPopulation(f.raw, f.report, f.snapshot, f.now);
  const viewers = JSON.parse(f.files['viewers_data.json']!) as Record<string, { element?: string | null }>;
  delete viewers.approved0!.element; viewers.approved1!.element = null; viewers.approved2!.element = '';
  viewers.discarded0!.element = 'pyro'; viewers.additional = { element: 'geo' };
  f.files['viewers_data.json'] = JSON.stringify(viewers);
  let snapshot = parseStreamerbotSnapshot(f.files), report = { ...f.report, snapshotHash: snapshot.hash, missing: [] };
  revalidateFinalPopulation(population, report, snapshot, f.now);
  const plan = buildLegacyGlobalPlan(snapshot, report.users, [], new Set(), [], undefined, undefined, population);
  expect(plan.players).toHaveLength(43);
  expect(plan.players.slice(0, 3).map(row => row.elementKey)).toEqual([null, null, null]);
  expect(plan).toMatchObject({ ownerDiscarded: 171, quarantined: 2, unapprovedAdditional: 1 });
  expect(plan.issues.filter(row => row.severity === 'BLOCKER')).toEqual([]);
  const extra = { ...report, users: [...report.users, { legacyLogin: 'discarded0', twitchUserId: '999000', currentLogin: 'discarded0', displayName: 'Fixture', renamed: false }] };
  expect(() => revalidateFinalPopulation(population, extra, snapshot, f.now)).toThrow('TWITCH_REPORT_POPULATION_MISMATCH');
  viewers.approved0!.element = 'pyrp'; f.files['viewers_data.json'] = JSON.stringify(viewers); snapshot = parseStreamerbotSnapshot(f.files);
  const invalid = buildLegacyGlobalPlan(snapshot, report.users, [], new Set(), [], undefined, undefined, population);
  expect(invalid.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'LEGACY_ELEMENT_INVALID', severity: 'BLOCKER' })]));
});


it('never remaps an already Native element from ignored legacy personal data', () => {
  const f = evidence(), population = validateOwnerApprovedPopulation(f.raw, f.report, f.snapshot, f.now);
  const viewers = JSON.parse(f.files['viewers_data.json']!); viewers.approved0.element = 'pyrp';
  f.files['viewers_data.json'] = JSON.stringify(viewers); const snapshot = parseStreamerbotSnapshot(f.files);
  const plan = buildLegacyGlobalPlan(snapshot, f.report.users, [{ id: 'native-id', displayName: 'Native', twitchUserId: f.report.users[0]!.twitchUserId,
    elementKey: 'hydro', dataAuthority: 'NATIVE', canaryImported: true }], new Set(), [], undefined, undefined, population);
  expect(plan.players[0]).toMatchObject({ elementKey: 'hydro', personalImport: false, viewer: {} });
  expect(plan.issues.filter(row => row.severity === 'BLOCKER')).toEqual([]);
});
