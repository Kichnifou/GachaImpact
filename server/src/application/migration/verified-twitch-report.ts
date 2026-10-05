import { execFileSync } from 'node:child_process';
import { readFile, realpath } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { z } from 'zod';
import { normalizeLegacyName, type Snapshot } from './streamerbot-snapshot.js';
import type { TwitchResolution } from './twitch-identity-resolver.js';

const login = z.string().regex(/^[a-zA-Z0-9_]{1,25}$/);
const reportSchema = z.object({
  version: z.literal(1), verification: z.literal('TWITCH_HELIX'),
  snapshotHash: z.string().regex(/^[a-f0-9]{64}$/), resolvedAt: z.iso.datetime(),
  users: z.array(z.object({ legacyLogin: login, twitchUserId: z.string().regex(/^[1-9][0-9]*$/),
    currentLogin: login, displayName: z.string().trim().min(1), renamed: z.boolean() }).strict()),
  missing: z.array(login), conflicts: z.array(login), duplicates: z.number().int().nonnegative(),
}).strict();
export type VerifiedTwitchReport = z.infer<typeof reportSchema>;
const elements = new Set(['pyro', 'hydro', 'cryo', 'electro', 'anemo', 'geo', 'dendro']);

export function eligibleLegacyLogins(snapshot: Snapshot): string[] {
  const viewers = snapshot.sources['viewers_data.json'] as Record<string, { element?: unknown }>;
  return Object.entries(viewers).filter(([, row]) => elements.has(String(row?.element).toLowerCase())).map(([name]) => name);
}

/** Errors intentionally contain no row, ID, login, path or raw JSON. Reports are fresh operator evidence. */
export function validateVerifiedTwitchReport(raw: unknown, snapshot: Snapshot, now = new Date()): VerifiedTwitchReport {
  const parsed = reportSchema.safeParse(raw);
  if (!parsed.success) throw new Error('TWITCH_REPORT_INVALID');
  const report = parsed.data;
  if (report.duplicates > report.conflicts.length) throw new Error('TWITCH_REPORT_INVALID');
  if (report.snapshotHash !== snapshot.hash) throw new Error('TWITCH_REPORT_SNAPSHOT_MISMATCH');
  const age = now.getTime() - new Date(report.resolvedAt).getTime();
  if (!Number.isFinite(age) || age < 0 || age > 24 * 60 * 60 * 1000) throw new Error('TWITCH_REPORT_STALE');
  const expected = eligibleLegacyLogins(snapshot).map(normalizeLegacyName);
  const classified = [...report.users.map(row => row.legacyLogin), ...report.missing, ...report.conflicts].map(normalizeLegacyName);
  if (new Set(expected).size !== expected.length || new Set(classified).size !== classified.length ||
      classified.length !== expected.length || classified.some(name => !expected.includes(name))) throw new Error('TWITCH_REPORT_POPULATION_MISMATCH');
  if (new Set(report.users.map(row => row.twitchUserId)).size !== report.users.length ||
      new Set(report.users.map(row => normalizeLegacyName(row.currentLogin))).size !== report.users.length) throw new Error('TWITCH_REPORT_DUPLICATE');
  if (report.users.some(row => row.renamed !== (normalizeLegacyName(row.legacyLogin) !== normalizeLegacyName(row.currentLogin))))
    throw new Error('TWITCH_REPORT_RENAME_MISMATCH');
  return report;
}

export function createVerifiedTwitchReport(snapshot: Snapshot, resolution: TwitchResolution, now = new Date()): VerifiedTwitchReport {
  return validateVerifiedTwitchReport({ version: 1, verification: 'TWITCH_HELIX', snapshotHash: snapshot.hash,
    resolvedAt: now.toISOString(), ...resolution }, snapshot, now);
}

export async function loadVerifiedTwitchReport(file: string, snapshot: Snapshot, now = new Date()): Promise<VerifiedTwitchReport> {
  try {
    const root = await realpath(resolve('..', 'local-data', 'identity-resolutions'));
    const target = await realpath(resolve(file));
    if (!target.startsWith(root + sep) || !target.endsWith('.json')) throw new Error();
    execFileSync('git', ['check-ignore', '--quiet', '--', target], { stdio: 'ignore' });
    return validateVerifiedTwitchReport(JSON.parse(await readFile(target, 'utf8')), snapshot, now);
  } catch { throw new Error('TWITCH_REPORT_UNUSABLE'); }
}

export function identityResolutionSummary(report: VerifiedTwitchReport) {
  return { resolved: report.users.length, renamed: report.users.filter(row => row.renamed).length,
    missing: report.missing.length, conflicts: report.conflicts.length, duplicates: report.duplicates };
}

export function parseRehearsalArguments(args: readonly string[]) {
  const [directory, ...rest] = args;
  if (!directory || directory.startsWith('--')) throw new Error('REHEARSAL_ARGUMENTS_INVALID');
  const cutover = rest[0] && !rest[0].startsWith('--') ? rest.shift() : undefined;
  let identities: string | undefined;
  if (rest.length) {
    if (rest.length !== 2 || rest[0] !== '--identities' || !rest[1] || rest[1].startsWith('--')) throw new Error('REHEARSAL_ARGUMENTS_INVALID');
    identities = rest[1];
  }
  const cutoverAt = new Date(cutover ?? new Date().toISOString());
  if (Number.isNaN(cutoverAt.getTime())) throw new Error('REHEARSAL_ARGUMENTS_INVALID');
  return { directory, cutoverAt, identities,
    identityMode: identities ? 'VERIFIED_TWITCH_IDENTITIES' as const : 'ISOLATED_FIXTURE' as const };
}
