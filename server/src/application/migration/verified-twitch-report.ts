import { z } from 'zod';
import { readLocalIdentityJson } from './local-identity-file.js';
import { validateIdentityQuarantine, type IdentityQuarantine } from './identity-quarantine.js';
import { normalizeLegacyName, type Snapshot } from './streamerbot-snapshot.js';
import type { TwitchResolution } from './twitch-identity-resolver.js';
import type { OwnerApprovedPopulation } from './owner-approved-population.js';

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
  const report = validateHistoricalTwitchReport(raw);
  if (report.snapshotHash !== snapshot.hash) throw new Error('TWITCH_REPORT_SNAPSHOT_MISMATCH');
  const age = now.getTime() - new Date(report.resolvedAt).getTime();
  if (!Number.isFinite(age) || age < 0 || age > 24 * 60 * 60 * 1000) throw new Error('TWITCH_REPORT_STALE');
  const expected = eligibleLegacyLogins(snapshot).map(normalizeLegacyName);
  const classified = [...report.users.map(row => row.legacyLogin), ...report.missing, ...report.conflicts].map(normalizeLegacyName);
  if (new Set(expected).size !== expected.length || classified.length !== expected.length || classified.some(name => !expected.includes(name)))
    throw new Error('TWITCH_REPORT_POPULATION_MISMATCH');
  return report;
}

/** Historical evidence has its own population/snapshot/date; it never authorizes an import by itself. */
export function validateHistoricalTwitchReport(raw: unknown): VerifiedTwitchReport {
  const parsed = reportSchema.safeParse(raw);
  if (!parsed.success) throw new Error('TWITCH_REPORT_INVALID');
  const report = parsed.data;
  if (report.duplicates > report.conflicts.length) throw new Error('TWITCH_REPORT_INVALID');
  const classified = [...report.users.map(row => row.legacyLogin), ...report.missing, ...report.conflicts].map(normalizeLegacyName);
  if (new Set(classified).size !== classified.length) throw new Error('TWITCH_REPORT_POPULATION_MISMATCH');
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
    return validateVerifiedTwitchReport(await readLocalIdentityJson(file), snapshot, now);
  } catch { throw new Error('TWITCH_REPORT_UNUSABLE'); }
}

export async function loadHistoricalTwitchReport(file: string): Promise<VerifiedTwitchReport> {
  try { return validateHistoricalTwitchReport(await readLocalIdentityJson(file)); }
  catch { throw new Error('TWITCH_REPORT_UNUSABLE'); }
}

/** Must run before even constructing a private database fixture. */
export function assertIdentityRehearsalReady(report: VerifiedTwitchReport | null, blockers: number, players: number,
  quarantine?: IdentityQuarantine, population?: OwnerApprovedPopulation): void {
  if (population) {
    if (!report || blockers || players !== 43 || report.conflicts.length || report.duplicates) throw new Error('IDENTITY_PREFLIGHT_BLOCKED');
    return;
  }
  if (quarantine) {
    if (!report) throw new Error('IDENTITY_PREFLIGHT_BLOCKED');
    validateIdentityQuarantine(quarantine, report.snapshotHash, report);
  }
  if (blockers || !players || (report?.missing.length && !quarantine) || report?.conflicts.length || report?.duplicates)
    throw new Error('IDENTITY_PREFLIGHT_BLOCKED');
}

export function identityResolutionSummary(report: VerifiedTwitchReport) {
  return { resolved: report.users.length, renamed: report.users.filter(row => row.renamed).length,
    missing: report.missing.length, conflicts: report.conflicts.length, duplicates: report.duplicates };
}

export function parseRehearsalArguments(args: readonly string[]) {
  const [directory, ...rest] = args;
  if (!directory || directory.startsWith('--')) throw new Error('REHEARSAL_ARGUMENTS_INVALID');
  const cutover = rest[0] && !rest[0].startsWith('--') ? rest.shift() : undefined;
  let identities: string | undefined, quarantine: string | undefined, population: string | undefined, historicalIdentities: string | undefined, historicalSnapshot: string | undefined;
  while (rest.length) {
    const option = rest.shift(), file = rest.shift();
    if (!file || file.startsWith('--')) throw new Error('REHEARSAL_ARGUMENTS_INVALID');
    if (option === '--identities' && !identities) identities = file;
    else if (option === '--quarantine' && !quarantine) quarantine = file;
    else if (option === '--population' && !population) population = file;
    else if (option === '--historical-identities' && !historicalIdentities) historicalIdentities = file;
    else if (option === '--historical-snapshot' && !historicalSnapshot) historicalSnapshot = file;
    else throw new Error('REHEARSAL_ARGUMENTS_INVALID');
  }
  if (quarantine && !identities) throw new Error('REHEARSAL_ARGUMENTS_INVALID');
  if ((population || historicalIdentities || historicalSnapshot) && !(population && historicalIdentities && historicalSnapshot && identities)) throw new Error('REHEARSAL_ARGUMENTS_INVALID');
  const cutoverAt = new Date(cutover ?? new Date().toISOString());
  if (Number.isNaN(cutoverAt.getTime())) throw new Error('REHEARSAL_ARGUMENTS_INVALID');
  return { directory, cutoverAt, identities, quarantine, population, historicalIdentities, historicalSnapshot,
    identityMode: quarantine ? 'VERIFIED_TWITCH_IDENTITIES_WITH_QUARANTINE' as const
      : identities ? 'VERIFIED_TWITCH_IDENTITIES' as const : 'ISOLATED_FIXTURE' as const };
}
