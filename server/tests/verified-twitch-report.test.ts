import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { buildLegacyGlobalPlan, fixtureTwitchResolution } from '../src/application/migration/legacy-global-plan.js';
import { parseStreamerbotSnapshot, snapshotFileNames } from '../src/application/migration/streamerbot-snapshot.js';
import { assertIdentityRehearsalReady, createVerifiedTwitchReport, identityResolutionSummary, loadVerifiedTwitchReport, parseRehearsalArguments,
  validateVerifiedTwitchReport } from '../src/application/migration/verified-twitch-report.js';

const now = new Date('2026-10-05T09:00:00.000Z');
const files = Object.fromEntries(snapshotFileNames.map(name => [name, name === 'monthly_events.json' ? '' : '{}']));
files['viewers_data.json'] = JSON.stringify({ alice: { element: 'pyro' }, carla: { element: 'geo' }, excluded: {} });
const snapshot = parseStreamerbotSnapshot(files);
const report = () => createVerifiedTwitchReport(snapshot, { users: [
  { legacyLogin: 'alice', twitchUserId: '123', currentLogin: 'alice_new', displayName: 'Private test name', renamed: true },
  { legacyLogin: 'carla', twitchUserId: '456', currentLogin: 'carla', displayName: 'Carla fixture', renamed: false },
], missing: [], conflicts: [], duplicates: 0 }, now);

describe('verified Twitch rehearsal input', () => {
  it('accepts a complete 45-profile current report and gates missing/conflicts before schema construction', () => {
    const files45 = { ...files, 'viewers_data.json': JSON.stringify(Object.fromEntries(Array.from({ length: 45 }, (_, index) => [`fixture_${index}`, { element: 'pyro' }]))) };
    const snapshot45 = parseStreamerbotSnapshot(files45);
    const users = Array.from({ length: 45 }, (_, index) => ({ legacyLogin: `fixture_${index}`, twitchUserId: String(index + 1),
      currentLogin: `fixture_${index}`, displayName: `Fixture ${index}`, renamed: false }));
    const verified = createVerifiedTwitchReport(snapshot45, { users, missing: [], conflicts: [], duplicates: 0 }, now);
    const constructSchema = vi.fn();
    const start = (r: typeof verified) => { assertIdentityRehearsalReady(r, 0, r.users.length); constructSchema(); };
    start(verified); expect(constructSchema).toHaveBeenCalledOnce(); constructSchema.mockClear();
    for (const field of ['missing', 'conflicts'] as const) {
      const partial = validateVerifiedTwitchReport({ ...verified, users: users.slice(1), [field]: ['fixture_0'] }, snapshot45, now);
      expect(() => start(partial)).toThrow('IDENTITY_PREFLIGHT_BLOCKED');
      expect(constructSchema).not.toHaveBeenCalled();
    }
  });
  it('keeps a verified rename and reuses only the immutable ID, while fixture mode stays distinct', () => {
    const verified = validateVerifiedTwitchReport(report(), snapshot, now);
    expect(identityResolutionSummary(verified)).toEqual({ resolved: 2, renamed: 1, missing: 0, conflicts: 0, duplicates: 0 });
    const plan = buildLegacyGlobalPlan(snapshot, verified.users, [{ id: 'web', displayName: 'Web nickname', twitchUserId: '123' }], new Set(), [{ playerId: 'web', twitchUserId: '123' }]);
    expect(plan.players[0]).toMatchObject({ playerId: 'web', displayName: 'Web nickname', twitchLogin: 'alice_new', mappingMode: 'EXISTING_VERIFIED_TWITCH' });
    expect(plan.players[1]!.mappingMode).toBe('TWITCH_ONLY');
    expect(fixtureTwitchResolution(snapshot)).toHaveLength(2);
    expect(parseRehearsalArguments(['snapshot', now.toISOString()]).identityMode).toBe('ISOLATED_FIXTURE');
    expect(parseRehearsalArguments(['snapshot', now.toISOString(), '--identities', 'private.json']).identityMode).toBe('VERIFIED_TWITCH_IDENTITIES');
  });
  it('classifies explicit not-found and conflicts without making up mappings', () => {
    const partial = { ...report(), users: [], missing: ['alice'], conflicts: ['carla'] };
    expect(identityResolutionSummary(validateVerifiedTwitchReport(partial, snapshot, now))).toMatchObject({ resolved: 0, missing: 1, conflicts: 1 });
    expect(buildLegacyGlobalPlan(snapshot, partial.users, [], new Set()).issues.filter(row => row.severity === 'BLOCKER')).toHaveLength(2);
  });
  it.each([
    ['wrong hash', (r: ReturnType<typeof report>) => { r.snapshotHash = 'a'.repeat(64); }],
    ['stale', (r: ReturnType<typeof report>) => { r.resolvedAt = '2026-10-03T09:00:00.000Z'; }],
    ['future', (r: ReturnType<typeof report>) => { r.resolvedAt = '2026-10-06T09:00:00.000Z'; }],
    ['missing classification', (r: ReturnType<typeof report>) => { r.users.pop(); }],
    ['duplicate ID', (r: ReturnType<typeof report>) => { r.users[1]!.twitchUserId = '123'; }],
    ['duplicate legacy login', (r: ReturnType<typeof report>) => { r.users[1]!.legacyLogin = 'ALICE'; }],
    ['duplicate current login', (r: ReturnType<typeof report>) => { r.users[1]!.currentLogin = 'alice_new'; }],
    ['false rename', (r: ReturnType<typeof report>) => { r.users[0]!.renamed = false; }],
    ['unknown profile', (r: ReturnType<typeof report>) => { r.users[1]!.legacyLogin = 'other'; }],
  ])('rejects %s without exposing identity details', (_, mutate) => {
    const raw = report(); mutate(raw);
    expect(() => validateVerifiedTwitchReport(raw, snapshot, now)).toThrow(/^TWITCH_REPORT_/);
  });
  it('rejects injected secrets and logs no identity, JSON or credential', () => {
    const log = vi.spyOn(console, 'log'); const error = vi.spyOn(console, 'error');
    expect(() => validateVerifiedTwitchReport({ ...report(), access_token: 'private-secret-fixture' }, snapshot, now)).toThrow('TWITCH_REPORT_INVALID');
    expect(log).not.toHaveBeenCalled(); expect(error).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
  it('accepts only an ignored local report and rejects traversal, incoherence and stale files', async () => {
    const root = resolve('..', 'local-data', 'identity-resolutions'); await mkdir(root, { recursive: true });
    const dir = await mkdtemp(resolve(root, 'unit-report-'));
    try {
      const file = resolve(dir, 'report.json'); await writeFile(file, JSON.stringify(report()));
      expect((await loadVerifiedTwitchReport(file, snapshot, now)).users).toHaveLength(2);
      await expect(loadVerifiedTwitchReport(file, snapshot, new Date('2026-10-07T09:00:00.000Z'))).rejects.toThrow('TWITCH_REPORT_UNUSABLE');
      await writeFile(file, '{"private-login":broken');
      await expect(loadVerifiedTwitchReport(file, snapshot, now)).rejects.toThrow('TWITCH_REPORT_UNUSABLE');
      await expect(loadVerifiedTwitchReport(resolve('package.json'), snapshot, now)).rejects.toThrow('TWITCH_REPORT_UNUSABLE');
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
  it('redacts unexpected CLI failures and rejects misspelled or repeated options', () => {
    expect(() => parseRehearsalArguments(['snapshot', '--identity', 'private.json'])).toThrow('REHEARSAL_ARGUMENTS_INVALID');
    expect(() => parseRehearsalArguments(['snapshot', '--identities', 'one', '--identities', 'two'])).toThrow('REHEARSAL_ARGUMENTS_INVALID');
    const result = spawnSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'scripts/rehearse-legacy-global.mts', 'private_login_secret_missing'], { encoding: 'utf8' });
    expect(result.status).toBe(1); expect(result.stdout).toBe('');
    expect(result.stderr).toContain('PRIVATE_REHEARSAL_FAILED; private details withheld.');
    expect(result.stderr).not.toContain('private_login_secret_missing');
  });
  it('blocks an incompatible existing Player and reuses an already linked Twitch-only Player', () => {
    const existing = [{ id: 'existing', displayName: 'Name', twitchUserId: '123', hasWebAccount: false }];
    const compatible = buildLegacyGlobalPlan(snapshot, report().users, existing, new Set(), [{ playerId: 'existing', twitchUserId: '123' }]);
    expect(compatible.players[0]!.playerId).toBe('existing'); expect(compatible.unmatchedWebPlayerIds).toEqual([]);
    expect(buildLegacyGlobalPlan(snapshot, report().users, existing, new Set(), [{ playerId: 'other', twitchUserId: '123' }]).issues.map(row => row.code)).toContain('TWITCH_EXISTING_IDENTITY_CONFLICT');
  });
});
