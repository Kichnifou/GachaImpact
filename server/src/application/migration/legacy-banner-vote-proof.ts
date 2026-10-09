import { createHash } from 'node:crypto';
import type { Prisma } from '../../../generated/prisma/client.js';
import { communityHash } from './legacy-community-proof.js';
import { identityProofHash, validateOwnerApprovedPopulation, type OwnerApprovedPopulation } from './owner-approved-population.js';
import { validateVerifiedTwitchReport, type VerifiedTwitchReport } from './verified-twitch-report.js';
import { normalizeLegacyName, parseStreamerbotSnapshot, type Snapshot, type SnapshotFiles } from './streamerbot-snapshot.js';
import type { legacyBannerEvidence } from './legacy-banner-reconciliation.js';

export type LegacyBannerVoterProof = {
  population: OwnerApprovedPopulation; historicalSnapshot: Snapshot; historicalReport: VerifiedTwitchReport;
  sourceFiles: SnapshotFiles; historicalSourceFiles: SnapshotFiles;
  voterReports: VerifiedTwitchReport[];
};
/** Fixed historical membership plus one fresh, narrowly scoped report per voter. */
export async function verifyLegacyBannerVoters(tx: Prisma.TransactionClient, snapshot: Snapshot,
  evidence: ReturnType<typeof legacyBannerEvidence>, proof: LegacyBannerVoterProof, now: Date) {
  for (const [claimed, files] of [[snapshot, proof.sourceFiles], [proof.historicalSnapshot, proof.historicalSourceFiles]] as const) {
    const parsed = parseStreamerbotSnapshot(files);
    if (parsed.hash !== claimed.hash || communityHash(parsed.sources) !== communityHash(claimed.sources)) throw Error('LEGACY_VOTES_SOURCE_HASH_MISMATCH');
  }
  const population = validateOwnerApprovedPopulation(proof.population, proof.historicalReport, proof.historicalSnapshot, now);
  if (proof.voterReports.length !== evidence.individual.length) throw Error('LEGACY_VOTES_REPORT_SET_MISMATCH');
  const seen = new Set<string>(), result = [];
  for (const vote of evidence.individual) {
    const member = population.approved.find(m => normalizeLegacyName(m.legacyLogin) === vote.legacyKey);
    if (!member || !vote.eligible) throw Error('LEGACY_VOTES_SOURCE_NOT_APPROVED');
    const reports = proof.voterReports.filter(r => r.users.some(u => normalizeLegacyName(u.legacyLogin) === vote.legacyKey));
    if (reports.length !== 1) throw Error('LEGACY_VOTES_REPORT_SET_MISMATCH');
    const report = validateVerifiedTwitchReport(reports[0], snapshot, now, { kind: 'CANARY', legacyLogin: member.legacyLogin });
    if (report.users.length !== 1 || report.missing.length || report.conflicts.length || report.duplicates
      || report.users[0]!.twitchUserId !== member.twitchUserId || seen.has(member.twitchUserId)) throw Error('LEGACY_VOTES_IDENTITY_CONFLICT');
    seen.add(member.twitchUserId);
    const identity = await tx.twitchIdentity.findUnique({ where: { twitchUserId: member.twitchUserId }, include: { player: true } });
    if (identity && identity.player.status !== 'ACTIVE') throw Error('LEGACY_VOTES_IDENTITY_CONFLICT');
    const target = await tx.twitchNativeTarget.findUnique({ where: { twitchUserId: member.twitchUserId } });
    if (target && (target.dataAuthority === 'MIGRATION_PENDING' || target.playerId !== (identity?.playerId ?? null))) throw Error('LEGACY_VOTES_IDENTITY_CONFLICT');
    const pending = await tx.twitchLinkResolution.findFirst({ where: { twitchUserId: member.twitchUserId, completedAt: null, expiresAt: { gt: now } } });
    const provenance = { source: 'banner_votes.json.voters', snapshotHash: snapshot.hash, weekId: evidence.week,
      legacyKey: vote.legacyKey, twitchUserId: member.twitchUserId, characterId: vote.characterId,
      originalSourceHash: createHash('sha256').update(proof.sourceFiles['banner_votes.json']!, 'utf8').digest('hex'), populationHash: communityHash(population),
      historicalReportHash: identityProofHash(proof.historicalReport), verificationReportHash: identityProofHash(report),
      verifiedAt: report.resolvedAt, voteTimeKnown: false };
    result.push({ ...vote, twitchUserId: member.twitchUserId, playerId: pending ? null : identity?.playerId ?? null,
      deferred: Boolean(pending), provenance, proofHash: communityHash(provenance) });
  }
  return result;
}
