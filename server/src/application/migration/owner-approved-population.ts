import { createHash } from 'node:crypto';
import { z } from 'zod';
import { readLocalIdentityJson } from './local-identity-file.js';
import { normalizeLegacyName, type Snapshot } from './streamerbot-snapshot.js';
import { validateHistoricalTwitchReport, validateVerifiedTwitchReport, type VerifiedTwitchReport } from './verified-twitch-report.js';

const member = z.object({ legacyLogin: z.string().regex(/^[a-zA-Z0-9_]{1,25}$/), twitchUserId: z.string().regex(/^[1-9][0-9]{0,127}$/) }).strict();
const schema = z.object({ version: z.literal(1), decision: z.literal('OWNER_APPROVED_FINAL_LEGACY_POPULATION'), createdAt: z.iso.datetime(),
  historicalProof: z.object({ requirement: z.literal('R1041'), reportHash: z.string().regex(/^[a-f0-9]{64}$/),
    snapshotHash: z.string().regex(/^[a-f0-9]{64}$/), sourceProfiles: z.literal(216), ownerDiscarded: z.literal(171),
    ownerDiscardedLogins: z.array(z.string().regex(/^[a-zA-Z0-9_]{1,25}$/)).length(171) }).strict(),
  approved: z.array(member).length(43), quarantined: z.array(z.string().regex(/^[a-zA-Z0-9_]{1,25}$/)).length(2) }).strict();
export type OwnerApprovedPopulation = z.infer<typeof schema>;
export const identityProofHash = (report: VerifiedTwitchReport) => createHash('sha256').update(JSON.stringify(report)).digest('hex');

/** Creates only a local operator decision document; membership is derived from the existing historical evidence. */
export function createOwnerApprovedPopulation(historicalRaw: unknown, historicalSnapshot: Snapshot, now = new Date()): OwnerApprovedPopulation {
  const report = validateHistoricalTwitchReport(historicalRaw);
  const approved = report.users.map(({ legacyLogin, twitchUserId }) => ({ legacyLogin, twitchUserId }));
  const classified = new Set([...approved.map(row => normalizeLegacyName(row.legacyLogin)), ...report.missing.map(normalizeLegacyName)]);
  return validateOwnerApprovedPopulation({ version: 1, decision: 'OWNER_APPROVED_FINAL_LEGACY_POPULATION', createdAt: now.toISOString(),
    historicalProof: { requirement: 'R1041', reportHash: identityProofHash(report), snapshotHash: report.snapshotHash, sourceProfiles: 216,
      ownerDiscarded: 171, ownerDiscardedLogins: Object.keys(historicalSnapshot.sources['viewers_data.json'] as object).filter(name => !classified.has(normalizeLegacyName(name))) },
    approved, quarantined: report.missing }, report, historicalSnapshot, now);
}

/** Historical membership is fixed by the author's R1041 evidence, never by a later element. */
export function validateOwnerApprovedPopulation(raw: unknown, historicalRaw: unknown, historicalSnapshot: Snapshot, now = new Date()): OwnerApprovedPopulation {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new Error('FINAL_POPULATION_INVALID');
  const population = parsed.data, historical = validateHistoricalTwitchReport(historicalRaw);
  if (new Date(population.createdAt) > now || historical.users.length !== 43 || historical.missing.length !== 2 || historical.conflicts.length || historical.duplicates
    || historical.resolvedAt > population.createdAt || population.historicalProof.snapshotHash !== historical.snapshotHash
    || population.historicalProof.reportHash !== identityProofHash(historical)) throw new Error('FINAL_POPULATION_PROOF_MISMATCH');
  const names = population.approved.map(row => normalizeLegacyName(row.legacyLogin));
  if (new Set(names).size !== 43 || new Set(population.approved.map(row => row.twitchUserId)).size !== 43
    || population.approved.some(row => !historical.users.some(proof => normalizeLegacyName(proof.legacyLogin) === normalizeLegacyName(row.legacyLogin) && proof.twitchUserId === row.twitchUserId))
    || new Set(population.quarantined.map(normalizeLegacyName)).size !== 2
    || population.quarantined.some(name => !historical.missing.some(proof => normalizeLegacyName(proof) === normalizeLegacyName(name))))
    throw new Error('FINAL_POPULATION_MEMBERSHIP_MISMATCH');
  const sourceNames = Object.keys(historicalSnapshot.sources['viewers_data.json'] as object).map(normalizeLegacyName);
  const classified = [...names, ...population.quarantined.map(normalizeLegacyName), ...population.historicalProof.ownerDiscardedLogins.map(normalizeLegacyName)];
  if (historicalSnapshot.hash !== historical.snapshotHash || sourceNames.length !== 216 || new Set(sourceNames).size !== 216
    || new Set(classified).size !== 216 || classified.some(name => !sourceNames.includes(name))) throw new Error('FINAL_POPULATION_SOURCE_PROOF_MISMATCH');
  return population;
}

export function revalidateFinalPopulation(population: OwnerApprovedPopulation, freshRaw: unknown, snapshot: Snapshot, now = new Date()): VerifiedTwitchReport {
  const report = validateVerifiedTwitchReport(freshRaw, snapshot, now, { kind: 'FINAL_POPULATION', population });
  if (report.conflicts.length || report.duplicates || population.approved.some(member =>
    !report.users.some(row => normalizeLegacyName(row.legacyLogin) === normalizeLegacyName(member.legacyLogin) && row.twitchUserId === member.twitchUserId)))
    throw new Error('FINAL_POPULATION_REVALIDATION_FAILED');
  return report;
}

export async function loadOwnerApprovedPopulation(file: string, historicalFile: string, historicalSnapshot: Snapshot, snapshot: Snapshot, fresh: VerifiedTwitchReport) {
  const population = validateOwnerApprovedPopulation(await readLocalIdentityJson(file), await readLocalIdentityJson(historicalFile), historicalSnapshot);
  revalidateFinalPopulation(population, fresh, snapshot);
  return population;
}

/** Membership proof can be loaded before resolving a fresh snapshot: no element filter participates. */
export async function loadHistoricalOwnerPopulation(file: string, historicalFile: string, historicalSnapshot: Snapshot) {
  return validateOwnerApprovedPopulation(await readLocalIdentityJson(file), await readLocalIdentityJson(historicalFile), historicalSnapshot);
}
