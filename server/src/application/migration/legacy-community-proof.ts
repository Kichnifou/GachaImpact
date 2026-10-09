import { createHash } from 'node:crypto';
import type { Prisma } from '../../../generated/prisma/client.js';
import { normalizeLegacyName, resolveSnapshotViewer, type Snapshot } from './streamerbot-snapshot.js';
import { identityProofHash } from './owner-approved-population.js';
import { validateHistoricalTwitchReport, type VerifiedTwitchReport } from './verified-twitch-report.js';
import type { AppConfig } from '../../config/environment.js';
import { STREAMERBOT_PATH_DISABLED, TwitchNativeAuthority } from '../twitch/twitch-native-authority.js';
import { receiptSafety, receiptSafetyCandidates } from '../twitch/twitch-operations-in-flight.js';
import type { PrismaClient } from '../../../generated/prisma/client.js';

export const communityRecord = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
export const communityHash = (value: unknown): string => {
  const canonical = (v: unknown): unknown => typeof v === 'bigint' ? v.toString() : v instanceof Date ? v.toISOString()
    : Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object'
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, child]) => [k, canonical(child)])) : v;
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
};
export type CommunityProof = { snapshot: Snapshot; importReport: VerifiedTwitchReport; importId: string; twitchUserId: string; playerId: string };

export async function requireCommunityMutationGates(tx: Prisma.TransactionClient, config: AppConfig, input: { operatorPlayerId: string; expectedRevision: number }) {
  await new TwitchNativeAuthority(tx as PrismaClient, config).requireOperator(tx, input.operatorPlayerId);
  const control = await tx.twitchNativeAuthority.findUnique({ where: { id: 'twitch-commands' } });
  if (config.twitchCommandPilot?.enabled !== false || config.twitchCommandPilot.globalEnabled !== false
    || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1
    || control?.desiredMode !== 'OFF' || control.revision !== input.expectedRevision) throw Error('COMMUNITY_OFF_GATE_REQUIRED');
  if (await tx.businessOperation.count({ where: { status: 'PENDING' } })) throw Error('COMMUNITY_OPERATION_IN_FLIGHT');
  const receipts = await tx.twitchEventReceipt.findMany({ where: receiptSafetyCandidates(),
    select: { eventType: true, state: true, processedAt: true, externalReference: true, payloadMinimal: true } });
  if (receipts.some(row => {
    const responses = communityRecord(communityRecord(row.payloadMinimal).commandPilot).responses;
    return receiptSafety(row).blocking || Array.isArray(responses) && responses.some(response => communityRecord(response).status === 'PENDING');
  }) || await tx.giveawayAnnouncement.count({ where: { state: { in: ['RESERVED', 'AMBIGUOUS'] } } })) throw Error('COMMUNITY_OUTBOUND_IN_FLIGHT');
}

/** Historical import evidence binds source names to immutable IDs; names never choose the winner. */
export async function verifyNativeCommunityProof(tx: Prisma.TransactionClient, input: CommunityProof) {
  const report = validateHistoricalTwitchReport(input.importReport);
  if (input.snapshot.files !== 17 || report.snapshotHash !== input.snapshot.hash || report.conflicts.length || report.missing.length || report.duplicates)
    throw Error('COMMUNITY_SOURCE_PROOF_INVALID');
  const user = report.users.find(row => row.twitchUserId === input.twitchUserId);
  if (!user) throw Error('COMMUNITY_IMMUTABLE_ID_REQUIRED');
  const run = await tx.twitchCanaryImport.findUnique({ where: { id: input.importId } });
  const identity = await tx.twitchIdentity.findUnique({ where: { twitchUserId: input.twitchUserId }, include: { player: true } });
  const target = await tx.twitchNativeTarget.findUnique({ where: { twitchUserId: input.twitchUserId } });
  const latest = await tx.twitchCanaryImport.findFirst({ where: { twitchUserId: input.twitchUserId }, orderBy: [{ importedAt: 'desc' }, { id: 'desc' }], select: { id: true } });
  if (!run || run.status !== 'DATA_IMPORTED' || run.rolledBackAt || run.playerId !== input.playerId || run.twitchUserId !== input.twitchUserId
    || run.snapshotHash !== input.snapshot.hash || run.identityReportHash !== identityProofHash(report)
    || identity?.playerId !== input.playerId || identity.player.status !== 'ACTIVE' || target?.playerId !== input.playerId
    || target.dataAuthority !== 'NATIVE' || !target.canary || !target.transferredAt || target.acknowledgement !== STREAMERBOT_PATH_DISABLED
    || latest?.id !== run.id) throw Error('COMMUNITY_DEFINITIVE_PLAYER_CONFLICT');
  const resolutions = await tx.twitchLinkResolution.findMany({ where: { twitchUserId: input.twitchUserId, completedAt: { not: null } }, include: { webIdentity: true } });
  if (resolutions.some(row => (row.choice === 'TWITCH' ? row.twitchPlayerId : row.choice === 'WEB' ? row.webPlayerId : null) !== input.playerId
    || row.webIdentity.playerId !== input.playerId)) throw Error('COMMUNITY_R1055_WINNER_CONFLICT');
  const viewer = resolveSnapshotViewer(input.snapshot, user.legacyLogin);
  return { run, identity, target, resolutions, legacyName: viewer.name, legacyKey: normalizeLegacyName(viewer.name) };
}
