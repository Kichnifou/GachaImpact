import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { validateIdentityQuarantine, loadIdentityQuarantine } from '../src/application/migration/identity-quarantine.js';
import { assertIdentityRehearsalReady, createVerifiedTwitchReport, parseRehearsalArguments } from '../src/application/migration/verified-twitch-report.js';
import { parseStreamerbotSnapshot, snapshotFileNames } from '../src/application/migration/streamerbot-snapshot.js';
import { buildLegacyGlobalPlan, identityQuarantineSummary } from '../src/application/migration/legacy-global-plan.js';

vi.mock('node:child_process', async importOriginal => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return { ...actual, execFileSync: vi.fn(actual.execFileSync) };
});
const files = Object.fromEntries(snapshotFileNames.map(name => [name, name === 'monthly_events.json' ? '' : '{}']));
files['viewers_data.json'] = JSON.stringify({ verified: { element: 'pyro' }, deferred_one: { element: 'hydro' }, deferred_two: { element: 'geo' }, excluded: {} });
files['friendships_data.json'] = JSON.stringify({ friendships: { deferred: { users: ['verified', 'deferred_one'], lastHeartSent: { verified: '', deferred_one: '' } } },
  requests: [{ from: 'deferred_two', to: 'verified' }] });
files['monthly_boss.json'] = JSON.stringify({ currentBoss: { participants: { deferred_one: {} }, finalBlowBy: 'deferred_one' } });
files['banner_votes.json'] = JSON.stringify({ votes: { deferred_two: 1 } });
files['monthly_events_data.json'] = JSON.stringify({ participants: { deferred_one: {} }, gameB: { '2026-10-04': { foundBy: 'deferred_two' } },
  messages: { verified: [{ sender: 'deferred_one', read: false }] } });
files['giveaway.json'] = JSON.stringify({ winner: 'deferred_one', participants: ['deferred_two'], messageCounts: { deferred_one: 1 } });
const snapshot = parseStreamerbotSnapshot(files);
const user = { legacyLogin: 'verified', twitchUserId: '123', currentLogin: 'verified', displayName: 'Fixture Verified', renamed: false };
const report = createVerifiedTwitchReport(snapshot, { users: [user], missing: ['deferred_one', 'deferred_two'], conflicts: [], duplicates: 0 });
const raw = () => ({ version: 1, decision: 'OWNER_APPROVED_IDENTITY_QUARANTINE', snapshotHash: snapshot.hash,
  createdAt: new Date().toISOString(), legacyLogins: ['DEFERRED_TWO', 'deferred_one'], reason: 'TWITCH_IDENTITY_NOT_FOUND' });
const quarantine = () => validateIdentityQuarantine(raw(), snapshot.hash, report);

describe('owner-approved identity quarantine', () => {
  it('keeps missing blocked by default and accepts only the exact explicit quarantine', () => {
    expect(() => assertIdentityRehearsalReady(report, 0, 1)).toThrow('IDENTITY_PREFLIGHT_BLOCKED');
    expect(() => assertIdentityRehearsalReady(report, 0, 1, quarantine())).not.toThrow();
    expect(report.users).toHaveLength(1); expect(report.missing).toHaveLength(2);
  });
  it.each([
    ['partial', { legacyLogins: ['deferred_one'] }], ['extra', { legacyLogins: ['deferred_one', 'deferred_two', 'other'] }],
    ['resolved', { legacyLogins: ['verified', 'deferred_two'] }], ['duplicate normalized', { legacyLogins: ['deferred_one', 'DEFERRED_ONE'] }],
    ['snapshot', { snapshotHash: 'a'.repeat(64) }], ['marker', { decision: 'MANUAL' }], ['version', { version: 2 }],
    ['date', { createdAt: 'invalid' }], ['login', { legacyLogins: ['invalid login', 'deferred_two'] }],
    ['secret', { access_token: 'fixture-secret' }], ['unknown field', { extra: true }], ['reason', { reason: 'OTHER' }],
  ])('rejects %s', (_, changes) => {
    expect(() => validateIdentityQuarantine({ ...raw(), ...changes }, snapshot.hash, report)).toThrow('IDENTITY_QUARANTINE_INVALID');
  });
  it('does not waive conflicts, duplicate IDs or other blockers', () => {
    const approved = quarantine();
    expect(() => assertIdentityRehearsalReady({ ...report, conflicts: ['other'] }, 0, 1, approved)).toThrow();
    expect(() => assertIdentityRehearsalReady({ ...report, duplicates: 1 }, 0, 1, approved)).toThrow();
    expect(() => assertIdentityRehearsalReady(report, 1, 1, approved)).toThrow('IDENTITY_PREFLIGHT_BLOCKED');
    const duplicate = buildLegacyGlobalPlan(snapshot, [user, { ...user, legacyLogin: 'deferred_one' }], [], new Set());
    expect(duplicate.issues.some(row => row.code === 'TWITCH_IDENTITY_DUPLICATE' && row.severity === 'BLOCKER')).toBe(true);
    expect(() => buildLegacyGlobalPlan(snapshot, [user, { ...user, legacyLogin: 'deferred_one', twitchUserId: '456' }], [], new Set(), [], undefined, approved)).toThrow();
  });
  it('plans no Player for quarantined identities, defers linked facts and exposes only aggregate CLI values', () => {
    const plan = buildLegacyGlobalPlan(snapshot, [user], [{ id: 'web', displayName: 'Web nickname', twitchUserId: '123' },
      { id: 'other', displayName: 'deferred_one', twitchUserId: null }], new Set(), [{ playerId: 'web', twitchUserId: '123' }], undefined, quarantine());
    expect(plan.players).toHaveLength(1); expect(plan.players[0]).toMatchObject({ playerId: 'web', displayName: 'Web nickname' });
    expect(plan.unmatchedWebPlayerIds).toEqual(['other']);
    expect(plan.identityQuarantined).toHaveLength(2);
    expect(plan.issues.filter(row => row.code === 'TWITCH_IDENTITY_QUARANTINED')).toHaveLength(2);
    expect(plan.issues.filter(row => row.severity === 'BLOCKER')).toEqual([]);
    expect(plan.friendshipCount).toBe(0); expect(plan.requestCount).toBe(0);
    expect(plan.deferredIdentityFacts.byDomain).toEqual({ BANNER: 1, BOSS: 2, EVENT: 3, GIVEAWAY: 3, SOCIAL: 4 });
    const json = JSON.stringify(identityQuarantineSummary(plan));
    expect(json).not.toMatch(/deferred_one|deferred_two|Fixture Verified|123/);
  });
  it('supports the explicit real mode and rejects quarantine-only, repeated or unknown options', () => {
    expect(parseRehearsalArguments(['snapshot', '--identities', 'report', '--quarantine', 'approved']).identityMode).toBe('VERIFIED_TWITCH_IDENTITIES_WITH_QUARANTINE');
    for (const args of [['snapshot', '--quarantine', 'approved'], ['snapshot', '--identities', 'one', '--quarantine', 'one', '--quarantine', 'two']])
      expect(() => parseRehearsalArguments(args)).toThrow('REHEARSAL_ARGUMENTS_INVALID');
  });
  it('accepts only an ignored local file, rejecting nonignored paths, links, traversal and malformed JSON', async () => {
    const root = resolve('..', 'local-data', 'identity-resolutions'); await mkdir(root, { recursive: true });
    const dir = await mkdtemp(resolve(root, 'quarantine-test-'));
    const file = resolve(dir, 'approved.json');
    try {
      await writeFile(file, JSON.stringify(raw()));
      expect((await loadIdentityQuarantine(file, snapshot.hash, report)).legacyLogins).toHaveLength(2);
      vi.mocked(execFileSync).mockImplementationOnce(() => { throw new Error('fixture nonignored'); });
      await expect(loadIdentityQuarantine(file, snapshot.hash, report)).rejects.toThrow('IDENTITY_QUARANTINE_UNUSABLE');
      await expect(loadIdentityQuarantine(resolve('package.json'), snapshot.hash, report)).rejects.toThrow('IDENTITY_QUARANTINE_UNUSABLE');
      await expect(loadIdentityQuarantine(`${dir}/inner/../approved.json`, snapshot.hash, report)).rejects.toThrow('IDENTITY_QUARANTINE_UNUSABLE');
      await symlink(dir, resolve(dir, 'link'), 'junction');
      await expect(loadIdentityQuarantine(resolve(dir, 'link', 'approved.json'), snapshot.hash, report)).rejects.toThrow('IDENTITY_QUARANTINE_UNUSABLE');
      await rm(resolve(dir, 'link'));
      await writeFile(file, '{broken');
      await expect(loadIdentityQuarantine(file, snapshot.hash, report)).rejects.toThrow('IDENTITY_QUARANTINE_UNUSABLE');
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
});
