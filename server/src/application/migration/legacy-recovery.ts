import { z } from 'zod';
import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { AppConfig } from '../../config/environment.js';
import { parseStreamerbotSnapshot, type SnapshotFiles } from './streamerbot-snapshot.js';
import { validateOwnerApprovedPopulation } from './owner-approved-population.js';
import { createVerifiedTwitchReport, validateVerifiedTwitchReport } from './verified-twitch-report.js';
import { applyLegacyCanary, canaryBackupHash, planLegacyCanary, type CanaryBackup } from './legacy-canary.js';
import { assertRecoveryDailyFacts } from './legacy-recovery-facts.js';
import { communityHash } from './legacy-community-proof.js';
import { playerRecoverySchema } from '../player/player-recovery-readiness.js';
import { STREAMERBOT_PATH_DISABLED, TwitchNativeAuthority, type ImportedCanaryAddition } from '../twitch/twitch-native-authority.js';

export type RecoverySource = { operationId: string; sourceFiles: SnapshotFiles; historicalSourceFiles: SnapshotFiles;
  population: unknown; historicalReport: unknown; freshReport: unknown; cutoverAt: Date };
function fail(reason: string): never { throw Error('LEGACY_RECOVERY_' + reason); }

/** The exact R1041 population is mandatory, even for a one-profile retry. */
export function validateRecoverySource(input: RecoverySource) {
  z.uuid().parse(input.operationId);
  if (!Number.isFinite(input.cutoverAt.getTime())) fail('CUTOVER_INVALID');
  const snapshot = parseStreamerbotSnapshot(input.sourceFiles), historical = parseStreamerbotSnapshot(input.historicalSourceFiles);
  const population = validateOwnerApprovedPopulation(input.population, input.historicalReport, historical);
  const report = validateVerifiedTwitchReport(input.freshReport, snapshot, new Date(), { kind: 'FINAL_POPULATION', population });
  if (report.duplicates || report.conflicts.length || report.users.some(user => !population.approved.some(member =>
    member.twitchUserId === user.twitchUserId && member.legacyLogin.toLowerCase() === user.legacyLogin.toLowerCase()))) fail('FRESH_IDENTITY_CONFLICT');
  return { snapshot, population, report, populationHash: communityHash(population) };
}

export async function planRecoveryProfile(db: PrismaClient, input: RecoverySource, twitchUserId: string) {
  const source = validateRecoverySource(input);
  const member = source.population.approved.find(m => m.twitchUserId === twitchUserId);
  if (!member) fail('OUTSIDE_POPULATION');
  const user = source.report.users.find(u => u.twitchUserId === twitchUserId);
  if (!user) return { status: 'BLOCKED' as const, twitchUserId, blockers: ['FRESH_IDENTITY_MISSING'] };
  const identity = await db.twitchIdentity.findUnique({ where: { twitchUserId }, include: { player: { include: { webIdentity: true } } } });
  const target = await db.twitchNativeTarget.findUnique({ where: { twitchUserId } });
  const run = await db.twitchCanaryImport.findFirst({ where: { twitchUserId }, orderBy: [{ importedAt: 'desc' }, { id: 'desc' }] });
  if (target?.dataAuthority === 'NATIVE') {
    if (!target.canary || identity?.playerId !== target.playerId || identity.player.status !== 'ACTIVE' || !run || run.playerId !== target.playerId
      || run.status !== 'DATA_IMPORTED' || run.rolledBackAt) fail('NATIVE_PROOF_INVALID');
    return { status: 'NATIVE' as const, twitchUserId, playerId: target.playerId, runId: run.id };
  }
  if (identity) {
    const marker = playerRecoverySchema.safeParse(identity.player.legacyRecovery);
    if (!marker.success || marker.data.operationId !== input.operationId || marker.data.snapshotHash !== source.snapshot.hash
      || marker.data.populationHash !== source.populationHash || !run || marker.data.importId !== run.id || marker.data.backupHash !== run.backupHash
      || run.snapshotHash !== source.snapshot.hash || run.playerId !== identity.playerId || run.status !== 'DATA_IMPORTED' || run.rolledBackAt
      || identity.player.status !== 'ACTIVE' || identity.player.webIdentity || target?.canary || target?.dataAuthority !== 'LEGACY'
      || target.playerId !== identity.playerId) return { status: 'BLOCKED' as const, twitchUserId, blockers: ['EXISTING_PROFILE_REQUIRES_REVIEW'] };
    return { status: 'IMPORTED' as const, twitchUserId, playerId: identity.playerId, marker: marker.data, runId: run.id };
  }
  if (run || target && (target.playerId || target.canary || target.dataAuthority !== 'LEGACY')) return { status: 'BLOCKED' as const, twitchUserId, blockers: ['TARGET_WITHOUT_IDENTITY'] };
  const report = createVerifiedTwitchReport(source.snapshot, { users: [user], missing: [], conflicts: [], duplicates: 0 }, new Date(source.report.resolvedAt), { kind: 'CANARY', legacyLogin: member.legacyLogin });
  const plan = await planLegacyCanary(db, source.snapshot, report, twitchUserId, null, input.cutoverAt);
  try { assertRecoveryDailyFacts(source.snapshot, plan.player, input.cutoverAt); } catch (error) { plan.blockers.push(error instanceof Error ? error.message : 'DAILY_PROOF_INVALID'); }
  return { status: plan.blockers.length ? 'BLOCKED' as const : 'READY' as const, twitchUserId, plan, blockers: plan.blockers };
}

/** Local operator orchestration. DB journal+marker commit together; a process
 * restart reads them before deciding whether a first import is still needed. */
export async function applyRecoveryProfile(db: PrismaClient, config: AppConfig, actorPlayerId: string, input: RecoverySource, twitchUserId: string,
  writeBackup: (backup: CanaryBackup) => Promise<void>, readBackup: (hash: string) => Promise<CanaryBackup>) {
  const current = await planRecoveryProfile(db, input, twitchUserId);
  if (current.status === 'BLOCKED') return current;
  if (current.status === 'NATIVE') return current; // Absolute personal reimport barrier, including changed gameplay.
  if (current.status === 'IMPORTED') {
    const backup = await readBackup(current.marker.backupHash), { hash, ...body } = backup;
    if (canaryBackupHash(body) !== hash || hash !== current.marker.backupHash || backup.version !== 4
      || backup.twitchUserId !== twitchUserId || backup.snapshotHash !== current.marker.snapshotHash || backup.rows.playerIds[0] !== current.playerId
      || backup.recovery.operationId !== input.operationId || backup.recovery.populationHash !== current.marker.populationHash) fail('BACKUP_DRIFT');
    return current;
  }
  const source = validateRecoverySource(input);
  await applyLegacyCanary(db, config, actorPlayerId, current.plan, STREAMERBOT_PATH_DISABLED, writeBackup,
    { operationId: input.operationId, populationHash: source.populationHash });
  return planRecoveryProfile(db, input, twitchUserId);
}

/** Never pass configure a reconstructed target list. Existing targets are owned
 * by the canonical extension primitive and remain byte-for-byte intact. */
export async function activateRecoveryProfiles(db: PrismaClient, config: AppConfig, actorPlayerId: string, input: RecoverySource,
  twitchUserIds: readonly string[], expectedRevision: number, readBackup: (hash: string) => Promise<CanaryBackup>) {
  if (!twitchUserIds.length || twitchUserIds.length > 43 || new Set(twitchUserIds).size !== twitchUserIds.length) fail('ACTIVATION_SCOPE_INVALID');
  validateRecoverySource(input);
  const additions: ImportedCanaryAddition[] = [];
  for (const twitchUserId of twitchUserIds) {
    const current = await applyRecoveryProfile(db, config, actorPlayerId, input, twitchUserId, async () => fail('ACTIVATION_IMPORT_FORBIDDEN'), readBackup);
    if (current.status === 'NATIVE') continue;
    if (current.status !== 'IMPORTED') fail('ACTIVATION_PROFILE_NOT_READY');
    const { backupHash, ...expectedRecovery } = current.marker;
    additions.push({ twitchUserId, expectedPlayerId: current.playerId, backupHash, expectedRecovery });
  }
  const authority = new TwitchNativeAuthority(db, config);
  if (!additions.length) {
    const control = await authority.read();
    if (control.desiredMode !== 'CANARY') fail('ACTIVATION_REPLAY_NOT_CANARY');
    return { status: 'ALREADY_NATIVE' as const, ...control };
  }
  return { status: 'ACTIVATED' as const, ...await authority.extendImportedCanaries(actorPlayerId, additions, STREAMERBOT_PATH_DISABLED, expectedRevision) };
}
