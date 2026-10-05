import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type pg from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { collectHistoricalIdentityCandidates, readHistoricalChatEvidence, scanHistoricalTwitchReports, verifiedChatReceiptEvidence,
  type HistoricalChatReceipt } from '../src/application/migration/historical-twitch-evidence.js';
import { identityReportDirectory } from '../src/application/migration/local-identity-file.js';
import { loadHistoricalTwitchReport, validateHistoricalTwitchReport } from '../src/application/migration/verified-twitch-report.js';

vi.mock('node:child_process', async importOriginal => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return { ...actual, execFileSync: vi.fn(actual.execFileSync) };
});
const report = () => ({ version: 1 as const, verification: 'TWITCH_HELIX' as const, snapshotHash: 'a'.repeat(64),
  resolvedAt: '2020-01-01T00:00:00.000Z', users: [
    { legacyLogin: 'old_one', twitchUserId: '123', currentLogin: 'new_one', displayName: 'Fixture One', renamed: true },
    { legacyLogin: 'two', twitchUserId: '456', currentLogin: 'two', displayName: 'Fixture Two', renamed: false },
  ], missing: [], conflicts: [], duplicates: 0 });
export function receipt(login = 'old_one', id = '123', eventId = 'fixture-event'): HistoricalChatReceipt {
  const payloadMinimal = { externalEventId: eventId, eventType: 'channel.chat.message', twitchUserId: id,
    login, displayName: 'Fixture', sourceTimestamp: '2020-01-01T00:00:00.000Z', contentHash: 'a'.repeat(64), transportPayloadHash: 'b'.repeat(64) };
  return { externalEventId: eventId, eventType: 'channel.chat.message', twitchUserId: id, payloadMinimal,
    payloadHash: createHash('sha256').update(JSON.stringify(payloadMinimal)).digest('hex') };
}

describe('strict historical reports, without current snapshot/freshness assumptions', () => {
  it('accepts a complete historical report older than 24h and a different snapshot', () => {
    expect(validateHistoricalTwitchReport(report())).toEqual(report());
  });
  it.each([
    ['verification', { verification: 'MANUAL' }], ['version', { version: 2 }], ['partial', { users: undefined }],
    ['hash', { snapshotHash: 'invalid' }], ['date', { resolvedAt: 'invalid' }], ['secret', { access_token: 'fixture-secret' }],
    ['unknown field', { extra: true }], ['unknown JSON', { arbitrary: '123' }],
  ])('rejects %s with a redacted error', (_, change) => {
    expect(() => validateHistoricalTwitchReport({ ...report(), ...change })).toThrow(/^TWITCH_REPORT_/);
  });
  it.each([
    ['partial row', { twitchUserId: undefined }], ['nonnumeric ID', { twitchUserId: 'abc' }], ['zero ID', { twitchUserId: '0' }],
    ['duplicate ID', { twitchUserId: '123' }], ['duplicate legacy', { legacyLogin: 'OLD_ONE' }],
    ['duplicate current', { currentLogin: 'new_one' }], ['invalid login', { legacyLogin: 'invalid login' }],
    ['empty display', { displayName: ' ' }], ['incoherent rename', { renamed: true }], ['row secret', { clientSecret: 'fixture' }],
  ])('rejects %s', (_, change) => {
    const raw = report(); Object.assign(raw.users[1]!, change);
    expect(() => validateHistoricalTwitchReport(raw)).toThrow(/^TWITCH_REPORT_/);
  });
  it('requires ignored local files and rejects malformed JSON, traversal, outside paths and links', async () => {
    const root = identityReportDirectory(); await mkdir(root, { recursive: true });
    const dir = await mkdtemp(resolve(root, 'proof-test-'));
    const file = resolve(dir, 'report.json');
    try {
      await writeFile(file, JSON.stringify(report()));
      expect((await loadHistoricalTwitchReport(file)).users).toHaveLength(2);
      vi.mocked(execFileSync).mockImplementationOnce(() => { throw new Error('fixture nonignored'); });
      await expect(loadHistoricalTwitchReport(file)).rejects.toThrow('TWITCH_REPORT_UNUSABLE');
      await expect(loadHistoricalTwitchReport(resolve('package.json'))).rejects.toThrow('TWITCH_REPORT_UNUSABLE');
      await expect(loadHistoricalTwitchReport(`${dir}/inner/../report.json`)).rejects.toThrow('TWITCH_REPORT_UNUSABLE');
      await expect(loadHistoricalTwitchReport(`../../GachaImpact/local-data/identity-resolutions/${dir.split(/[\\/]/).at(-1)}/report.json`)).rejects.toThrow('TWITCH_REPORT_UNUSABLE');
      await symlink(dir, resolve(dir, 'link'), 'junction');
      await expect(loadHistoricalTwitchReport(resolve(dir, 'link', 'report.json'))).rejects.toThrow('TWITCH_REPORT_UNUSABLE');
      await rm(resolve(dir, 'link')); // Remove the junction before recursive cleanup.
      await writeFile(file, '{broken');
      await expect(loadHistoricalTwitchReport(file)).rejects.toThrow('TWITCH_REPORT_UNUSABLE');
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
  it('uses exact normalized legacy logins only, agrees across reports and detects divergent IDs', () => {
    const first = report(); const second = report();
    expect(collectHistoricalIdentityCandidates(['OLD_ONE', 'new_one', 'fixture_one', 'absent'], [first, second]))
      .toEqual({ knownIds: { old_one: '123' }, conflicts: [] });
    second.users[0]!.twitchUserId = '789';
    expect(collectHistoricalIdentityCandidates(['old_one'], [first, second])).toEqual({ knownIds: {}, conflicts: ['old_one'] });
  });
  it('automatically scans top-level JSON reports and discards unknown/partial JSON', async () => {
    const root = identityReportDirectory(); await mkdir(root, { recursive: true });
    const file = resolve(root, `proof-scan-fixture-${randomUUID()}.json`);
    const count = (reports: Awaited<ReturnType<typeof scanHistoricalTwitchReports>>) => reports.filter(row => row.snapshotHash === 'a'.repeat(64)
      && row.resolvedAt === '2020-01-01T00:00:00.000Z').length;
    const before = count(await scanHistoricalTwitchReports());
    try {
      await writeFile(file, JSON.stringify(report()), { flag: 'wx' });
      expect(count(await scanHistoricalTwitchReports())).toBe(before + 1);
      await writeFile(file, JSON.stringify({ users: report().users }));
      expect(count(await scanHistoricalTwitchReports())).toBe(before);
    } finally { await rm(file, { force: true }); }
  });
  it('crosses receipt/report evidence without choosing a conflicting ID', () => {
    expect(collectHistoricalIdentityCandidates(['old_one'], [report()], [{ legacyLogin: 'OLD_ONE', twitchUserId: '123' }]).knownIds).toEqual({ old_one: '123' });
    expect(collectHistoricalIdentityCandidates(['old_one'], [report()], [{ legacyLogin: 'old_one', twitchUserId: '789' }]).conflicts).toEqual(['old_one']);
  });
  it('treats prototype property names as exact login keys', () => {
    const candidates = collectHistoricalIdentityCandidates(['__proto__', 'constructor'], [], [
      { legacyLogin: '__proto__', twitchUserId: '123' }, { legacyLogin: 'constructor', twitchUserId: '456' },
    ]);
    expect(Object.entries(candidates.knownIds)).toEqual([['__proto__', '123'], ['constructor', '456']]);
  });
});

describe('stored authenticated Chat observation evidence', () => {
  it('accepts complete observer observations independently of JSONB property order', () => {
    const raw = receipt(); raw.payloadMinimal = Object.fromEntries(Object.entries(raw.payloadMinimal as object).reverse());
    expect(verifiedChatReceiptEvidence([raw])).toEqual([{ legacyLogin: 'old_one', twitchUserId: '123' }]);
  });
  it('repeated receipts with one ID agree; distinct IDs conflict; no receipt supplies no mapping', () => {
    const evidence = verifiedChatReceiptEvidence([receipt(), receipt('OLD_ONE', '123', 'other')]);
    expect(collectHistoricalIdentityCandidates(['old_one'], [], evidence).knownIds).toEqual({ old_one: '123' });
    expect(collectHistoricalIdentityCandidates(['old_one'], [], [...evidence, ...verifiedChatReceiptEvidence([receipt('old_one', '456')])]).conflicts).toEqual(['old_one']);
    expect(collectHistoricalIdentityCandidates(['old_one'], [], []).knownIds).toEqual({});
    expect(collectHistoricalIdentityCandidates(['old_on'], [], evidence).knownIds).toEqual({});
  });
  it.each([
    ['other type', { eventType: 'channel.subscribe' }], ['null ID', { twitchUserId: null }], ['wrong ID', { twitchUserId: '789' }],
    ['wrong external ID', { externalEventId: 'other' }], ['wrong hash', { payloadHash: 'c'.repeat(64) }],
    ['free JSON', { payloadMinimal: { login: 'old_one', twitchUserId: '123' } }],
  ])('ignores %s', (_, changes) => {
    expect(verifiedChatReceiptEvidence([{ ...receipt(), ...changes }])).toEqual([]);
  });
  it('requires transport and content hashes and rejects injected payload secrets', () => {
    for (const change of [{ transportPayloadHash: null }, { contentHash: null }, { secret: 'fixture' }]) {
      const raw = receipt(); raw.payloadMinimal = { ...raw.payloadMinimal as object, ...change };
      expect(verifiedChatReceiptEvidence([raw])).toEqual([]);
    }
  });
  it('queries only exact requested logins in a READ ONLY transaction and rolls back failures', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [receipt()] });
    expect(await readHistoricalChatEvidence({ query } as unknown as pg.Client, ['OLD_ONE'])).toHaveLength(1);
    expect(query.mock.calls[0]![0]).toContain('READ ONLY');
    expect(query.mock.calls[1]![0]).toContain('public.twitch_event_receipts');
    expect(query.mock.calls[1]![1]).toEqual([['old_one']]);
    expect(query.mock.calls[2]![0]).toBe('COMMIT');
    query.mockClear().mockResolvedValueOnce({ rows: [] }).mockRejectedValueOnce(new Error('private-data-fixture'));
    await expect(readHistoricalChatEvidence({ query } as unknown as pg.Client, ['old_one'])).rejects.toThrow('TWITCH_RECEIPT_READ_FAILED');
    expect(query.mock.calls.at(-1)![0]).toBe('ROLLBACK');
  });
});
