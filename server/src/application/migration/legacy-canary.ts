import { parseLegacyElement } from './legacy-element.js';
import { randomUUID, createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import type { Snapshot } from './streamerbot-snapshot.js';
import { normalizeLegacyName, resolveSnapshotViewer } from './streamerbot-snapshot.js';
import { identityProofHash } from './owner-approved-population.js';
import { validateVerifiedTwitchReport, validateHistoricalTwitchReport, type VerifiedTwitchReport } from './verified-twitch-report.js';
import { SnapshotPilotService } from './snapshot-pilot-service.js';
import { applyLegacyPersonalState } from './legacy-personal-apply.js';
import { compareLegacyPersonalState } from './legacy-personal-compare.js';
import type { PlannedPlayer } from './legacy-global-plan.js';
import { planDeferredIdentityFacts } from './legacy-identity-deferrals.js';
import { captureTargetedPlayerRows, assertTargetedDeletionSafe, deleteTargetedRows, personalReplacementTables, restoreTargetedRows, type RowGraph } from './targeted-player-rows.js';
import { TwitchNativeAuthority, STREAMERBOT_PATH_DISABLED } from '../twitch/twitch-native-authority.js';
import { assessTwitchOperationsInFlight } from '../twitch/twitch-operations-in-flight.js';
import type { AppConfig } from '../../config/environment.js';

export type CanaryPlan = { snapshot: Snapshot; report: VerifiedTwitchReport; identityReportHash: string; cutoverAt: Date; player: PlannedPlayer;
  expectedPlayerId: string | null; mapping: Awaited<ReturnType<SnapshotPilotService['globalPlayerPlan']>>; blockers: string[];
  deferred: ReturnType<typeof planDeferredIdentityFacts> };
export type CanaryBackup = { version: 1; kind: 'TARGETED_LEGACY_CANARY'; twitchUserId: string; snapshotHash: string; identityReportHash: string; hash: string;
  target: Prisma.TwitchNativeTargetGetPayload<Record<string, never>> | null; rows: RowGraph };
function canonicalBackup(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalBackup);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonicalBackup(child)]));
  return value;
}
export const canaryBackupHash = (backup: Omit<CanaryBackup, 'hash'>) => createHash('sha256').update(JSON.stringify(canonicalBackup(backup))).digest('hex');

export async function planLegacyCanary(db: PrismaClient, snapshot: Snapshot, rawReport: unknown, twitchUserId: string,
  expectedPlayerId: string | null, cutoverAt: Date): Promise<CanaryPlan> {
  const proof = validateHistoricalTwitchReport(rawReport);
  const candidate = proof.users.find(row => row.twitchUserId === twitchUserId);
  if (!candidate) throw new Error('CANARY_VERIFIED_ID_REQUIRED');
  const report = validateVerifiedTwitchReport(rawReport, snapshot, new Date(), { kind: 'CANARY', legacyLogin: candidate.legacyLogin });
  const identities = report.users.filter(row => row.twitchUserId === twitchUserId);
  if (identities.length !== 1 || report.conflicts.length || report.duplicates || !Number.isFinite(cutoverAt.getTime())) throw new Error('CANARY_VERIFIED_ID_REQUIRED');
  const identity = identities[0]!, viewer = resolveSnapshotViewer(snapshot, identity.legacyLogin);
  const linked = await db.twitchIdentity.findUnique({ where: { twitchUserId }, include: { player: true } });
  const target = await db.twitchNativeTarget.findUnique({ where: { twitchUserId } });
  const blockers: string[] = [];
  if ((linked?.playerId ?? null) !== expectedPlayerId) blockers.push('CANARY_EXPECTED_PLAYER_MISMATCH');
  if (target && (target.dataAuthority !== 'LEGACY' || target.canary)) blockers.push('CANARY_LEGACY_AUTHORITY_REQUIRED');
  if (linked && linked.player.status !== 'ACTIVE' || target?.playerId && target.playerId !== linked?.playerId) blockers.push('CANARY_TARGET_CONFLICT');
  const playerId = linked?.playerId ?? randomUUID();
  const player: PlannedPlayer = { playerId, legacyUsername: viewer.name, elementKey: parseLegacyElement(viewer.data.element).elementKey,
    displayName: linked?.player.displayName ?? identity.displayName, twitchUserId, twitchLogin: identity.currentLogin,
    twitchDisplayName: identity.displayName, mappingMode: linked ? 'EXISTING_VERIFIED_TWITCH' : 'TWITCH_ONLY', viewer: viewer.data, personalImport: true };
  const mapping = await new SnapshotPilotService(db, {} as never, 'local-canary-only').globalPlayerPlan(playerId, identity.legacyLogin, snapshot, cutoverAt);
  for (const domain of mapping.domains) if (domain.category === 'BLOCKED_AMBIGUOUS' || domain.action === 'PENDING_MAPPING') blockers.push(`PERSONAL_MAPPING_${domain.name}`);
  await assertCanaryIdle(db, twitchUserId, linked?.playerId).catch(() => blockers.push('CANARY_OPERATIONS_IN_FLIGHT'));
  if (linked) await captureTargetedPlayerRows(db, [linked.playerId]).then(rows => assertTargetedDeletionSafe(db, rows, new Set<string>(personalReplacementTables)))
    .catch(() => blockers.push('CANARY_SHARED_REFERENCE_REQUIRES_OPERATOR'));
  return { snapshot, report, identityReportHash: identityProofHash(report), cutoverAt, player, expectedPlayerId, mapping, blockers,
    deferred: planDeferredIdentityFacts(snapshot, new Set([normalizeLegacyName(identity.legacyLogin)]), cutoverAt) };
}

export const canarySummary = (plan: CanaryPlan) => ({ snapshotHash: plan.snapshot.hash, identityReportHash: plan.identityReportHash,
  sourceFound: true, target: plan.player.mappingMode, targetExists: plan.expectedPlayerId !== null, cutoverAt: plan.cutoverAt.toISOString(),
  personalDomains: plan.mapping.domains.filter(row => row.category === 'PLAYER_LOCAL_PHYSICAL').map(row => row.name),
  sharedFacts: { classification: 'DEFERRED_CANARY_SHARED_FACT', total: plan.deferred.total, byDomain: plan.deferred.byDomain },
  blockers: [...new Set(plan.blockers)], phases: ['DATA_IMPORTED', 'AUTHORITY_TRANSFERRED_SEPARATELY'] });

async function assertCanaryIdle(db: Prisma.TransactionClient, twitchUserId: string, playerId?: string) {
  const operations = await assessTwitchOperationsInFlight(db, twitchUserId, playerId);
  if (operations.unresolvedOutbound) throw new Error('CANARY_OUTBOUND_UNRESOLVED');
  if (operations.blocked) throw new Error('CANARY_OPERATIONS_IN_FLIGHT');
}

/** Callable from the guarded local CLI/private fixtures only. No public HTTP application endpoint. */
export async function applyLegacyCanary(db: PrismaClient, config: AppConfig, actorPlayerId: string, plan: CanaryPlan,
  frozenAcknowledgement: string, writeBackup: (backup: CanaryBackup) => Promise<void>) {
  if (plan.blockers.length || frozenAcknowledgement !== STREAMERBOT_PATH_DISABLED) throw new Error('CANARY_PREFLIGHT_BLOCKED');
  validateVerifiedTwitchReport(plan.report, plan.snapshot, new Date(), { kind: 'CANARY', legacyLogin: plan.player.legacyUsername });
  return db.$transaction(async tx => {
    await new TwitchNativeAuthority(db, config).requireOperator(tx, actorPlayerId);
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`twitch-provision:${plan.player.twitchUserId}`},0))::text`;
    await tx.$queryRaw`SELECT id FROM players WHERE id=${plan.player.playerId}::uuid FOR UPDATE`;
    const identity = await tx.twitchIdentity.findUnique({ where: { twitchUserId: plan.player.twitchUserId } });
    const target = await tx.twitchNativeTarget.findUnique({ where: { twitchUserId: plan.player.twitchUserId } });
    if ((identity?.playerId ?? null) !== plan.expectedPlayerId || target && (target.dataAuthority !== 'LEGACY' || target.canary)
      || target?.playerId && target.playerId !== identity?.playerId) throw new Error('CANARY_TARGET_CHANGED');
    await assertCanaryIdle(tx, plan.player.twitchUserId, plan.expectedPlayerId ?? undefined);
    const rows = await captureTargetedPlayerRows(tx, [plan.player.playerId]);
    const preimage: Omit<CanaryBackup, 'hash'> = { version: 1, kind: 'TARGETED_LEGACY_CANARY', twitchUserId: plan.player.twitchUserId,
      snapshotHash: plan.snapshot.hash, identityReportHash: plan.identityReportHash, target, rows };
    const backup: CanaryBackup = { ...preimage, hash: canaryBackupHash(preimage) };
    await writeBackup(backup); // Durable ignored local preimage must exist before the first business write.
    await tx.twitchNativeTarget.upsert({ where: { twitchUserId: plan.player.twitchUserId }, create: { twitchUserId: plan.player.twitchUserId, dataAuthority: 'MIGRATION_PENDING' },
      update: { dataAuthority: 'MIGRATION_PENDING', canary: false } });
    await deleteTargetedRows(tx, rows, new Set<string>(personalReplacementTables));
    const mapping = await new SnapshotPilotService(tx as PrismaClient, {} as never, 'local-canary-only').globalPlayerPlan(plan.player.playerId,
      plan.player.legacyUsername, plan.snapshot, plan.cutoverAt);
    const batch = await tx.migrationBatch.create({ data: { snapshotHash: plan.snapshot.hash, status: 'APPLYING', mode: rows.schema === 'public' ? 'CUTOVER' : 'REHEARSAL',
      migratorVersion: 'targeted-canary-v1', capturedAt: plan.cutoverAt,
      summary: { kind: 'TARGETED_CANARY', classification: 'DEFERRED_CANARY_SHARED_FACT', total: plan.deferred.total, byDomain: plan.deferred.byDomain } } });
    await applyLegacyPersonalState(tx, plan.player, mapping, batch.id, plan.snapshot.hash, plan.cutoverAt);
    await compareLegacyPersonalState(tx, plan.player, mapping, plan.snapshot.hash, plan.cutoverAt);
    if (await tx.twitchIdentity.count({ where: { twitchUserId: plan.player.twitchUserId, playerId: plan.player.playerId } }) !== 1
      || plan.expectedPlayerId === null && await tx.webIdentity.count({ where: { playerId: plan.player.playerId } })) throw new Error('CANARY_IMPORT_IDENTITY_MISMATCH');
    await tx.migrationBatch.update({ where: { id: batch.id }, data: { status: 'COMPLETED', completedAt: new Date() } });
    await tx.twitchNativeTarget.update({ where: { twitchUserId: plan.player.twitchUserId }, data: { dataAuthority: 'LEGACY', playerId: plan.player.playerId } });
    const run = await tx.twitchCanaryImport.create({ data: { twitchUserId: plan.player.twitchUserId, playerId: plan.player.playerId,
      snapshotHash: plan.snapshot.hash, identityReportHash: plan.identityReportHash, backupHash: backup.hash, status: 'DATA_IMPORTED' } });
    await tx.twitchNativeAudit.create({ data: { actorPlayerId, twitchUserId: plan.player.twitchUserId, action: 'DATA_IMPORTED', acknowledgement: frozenAcknowledgement } });
    return { runId: run.id, backupHash: backup.hash, playerId: plan.player.playerId, dataAuthority: 'LEGACY', status: 'DATA_IMPORTED' };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120_000 });
}

/** The caller must explicitly switch OFF and relinquish Native ownership first; no import implicitly does so. */
export async function rollbackLegacyCanary(db: PrismaClient, config: AppConfig, actorPlayerId: string, backup: CanaryBackup) {
  if (backup.version !== 1 || backup.kind !== 'TARGETED_LEGACY_CANARY') throw new Error('CANARY_BACKUP_INVALID');
  const { hash, ...preimage } = backup;
  if (canaryBackupHash(preimage) !== hash) throw new Error('CANARY_BACKUP_HASH_MISMATCH');
  return db.$transaction(async tx => {
    const authority = new TwitchNativeAuthority(db, config);
    await authority.requireOperator(tx, actorPlayerId);
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`twitch-provision:${backup.twitchUserId}`},0))::text`;
    const control = await tx.twitchNativeAuthority.findUnique({ where: { id: 'twitch-commands' } });
    if (control?.desiredMode && control.desiredMode !== 'OFF') throw new Error('CANARY_ROLLBACK_OFF_REQUIRED');
    const target = await tx.twitchNativeTarget.findUnique({ where: { twitchUserId: backup.twitchUserId } });
    const playerId = backup.rows.playerIds[0]!;
    if (!target || target.dataAuthority !== 'LEGACY' || target.canary || target.playerId !== playerId) throw new Error('CANARY_ROLLBACK_LEGACY_REQUIRED');
    await tx.$queryRaw`SELECT id FROM players WHERE id=${playerId}::uuid FOR UPDATE`;
    await assertCanaryIdle(tx, backup.twitchUserId, playerId);
    const run = await tx.twitchCanaryImport.findFirst({ where: { twitchUserId: backup.twitchUserId, playerId, status: 'DATA_IMPORTED' }, orderBy: { importedAt: 'desc' } });
    if (!run || run.backupHash !== backup.hash || run.snapshotHash !== backup.snapshotHash || run.identityReportHash !== backup.identityReportHash)
      throw new Error('CANARY_ROLLBACK_PROVENANCE_MISMATCH');
    // Journal rows are operational provenance, not the gameplay preimage. Audit survives absent-Player rollback.
    await tx.twitchCanaryImport.delete({ where: { id: run.id } });
    await tx.twitchNativeTarget.update({ where: { twitchUserId: backup.twitchUserId }, data: { playerId: null } });
    await restoreTargetedRows(tx, backup.rows);
    if (backup.target) {
      const restored = { ...backup.target, updatedAt: new Date(backup.target.updatedAt), transferredAt: backup.target.transferredAt ? new Date(backup.target.transferredAt) : null };
      await tx.twitchNativeTarget.update({ where: { twitchUserId: backup.twitchUserId }, data: restored });
    } else await tx.twitchNativeTarget.delete({ where: { twitchUserId: backup.twitchUserId } });
    await tx.twitchNativeAudit.create({ data: { actorPlayerId, twitchUserId: backup.twitchUserId, action: 'CANARY_ROLLBACK_EXACT' } });
    return { status: 'ROLLED_BACK', preimageHash: backup.rows.hash, dataAuthority: 'LEGACY' };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120_000 });
}
