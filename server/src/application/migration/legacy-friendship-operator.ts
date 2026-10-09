import { createHash } from 'node:crypto';
import { z } from 'zod';
import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import type { AppConfig } from '../../config/environment.js';
import { STREAMERBOT_PATH_DISABLED, TwitchNativeAuthority } from '../twitch/twitch-native-authority.js';
import { receiptSafety, receiptSafetyCandidates } from '../twitch/twitch-operations-in-flight.js';
import { captureLegacyFriendshipBackup, legacyFriendshipBackupPostHash, restoreLegacyFriendshipBackup, type LegacyFriendshipBackup } from './legacy-friendship-backup.js';
import { legacyFriendshipAffectedPlayers, legacyFriendshipDecisionEvidence, planLegacyFriendshipRegistration, reconcileLegacyFriendships, registerLegacyFriendships } from './legacy-friendship-reconciliation.js';
import { identityProofHash } from './owner-approved-population.js';
import type { Snapshot } from './streamerbot-snapshot.js';
import { validateVerifiedTwitchReport, type VerifiedTwitchReport } from './verified-twitch-report.js';

type Tx = Prisma.TransactionClient;
const kind = 'TARGETED_LEGACY_SOCIAL' as const;
const hashText = z.string().regex(/^[a-f0-9]{64}$/);
const canonical = (value: unknown): unknown => typeof value === 'bigint' ? value.toString() : value instanceof Date ? value.toISOString()
  : Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonical(child)])) : value;
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const fail = (reason: string): never => { throw Error(`LEGACY_SOCIAL_${reason}`); };
const transactionOptions = { isolationLevel: 'Serializable' as const, timeout: 30_000 };
type Scope = { operatorPlayerId: string; expectedRevision: number };
type Evidence = { snapshot: Snapshot; reports: readonly VerifiedTwitchReport[]; sourcePairKeyHash: string; now?: Date };
export type LegacySocialPlanInput = Scope & Evidence;
export type LegacySocialApplyInput = LegacySocialPlanInput & { operationId: string; expectedFingerprint: string; acknowledgement: string };

export const legacySocialBackupSchema = z.object({
  kind: z.literal(kind), version: z.literal(1), operationId: z.uuid(), operatorPlayerId: z.uuid(), expectedRevision: z.number().int().nonnegative(),
  snapshotHash: hashText, sourcePairKeyHash: hashText, twitchUserIds: z.array(z.string().regex(/^[1-9][0-9]*$/)).length(2),
  playerIds: z.array(z.uuid()).min(2), fingerprint: hashText, inputHash: hashText, createdAt: z.iso.datetime(),
  preimage: z.object({ version: z.literal(1), schema: z.string(), sourcePairKeyHashes: z.array(hashText).length(1), playerIds: z.array(z.uuid()),
    rows: z.object({ legacy_friendship_facts: z.array(z.string()), friendships: z.array(z.string()), friend_hearts: z.array(z.string()), friendship_legacy_heart_state: z.array(z.string()) }).strict(), hash: hashText }).strict(),
  hash: hashText,
}).strict();
export type LegacySocialBackup = z.infer<typeof legacySocialBackupSchema>;
const journalSchema = z.object({ kind: z.literal(kind), version: z.literal(1), state: z.enum(['APPLIED', 'ROLLED_BACK']),
  inputHash: hashText, fingerprint: hashText, backupHash: hashText, postHash: hashText, postEvidenceHash: hashText,
  sourcePairKeyHash: hashText, materialized: z.number().int(), retained: z.number().int(), rolledBackAt: z.iso.datetime().optional(), rollbackHash: hashText.optional(),
}).strict();

function inputs(input: LegacySocialPlanInput) {
  if (!z.uuid().safeParse(input.operatorPlayerId).success || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0
    || !hashText.safeParse(input.sourcePairKeyHash).success || input.snapshot.files !== 17 || input.reports.length !== 2) return fail('INPUT_INVALID');
  const now = input.now ?? new Date();
  const reports = input.reports.map(report => {
    if (report.users.length !== 1) return fail('PAIR_PROOFS_REQUIRED');
    return validateVerifiedTwitchReport(report, input.snapshot, now, { kind: 'CANARY', legacyLogin: report.users[0]!.legacyLogin });
  }).sort((a, b) => a.users[0]!.twitchUserId.localeCompare(b.users[0]!.twitchUserId));
  const twitchUserIds = reports.map(report => report.users[0]!.twitchUserId);
  if (new Set(twitchUserIds).size !== 2 || reports.some(report => report.missing.length || report.conflicts.length || report.duplicates)) return fail('PAIR_PROOFS_REQUIRED');
  const inputHash = hash({ kind, operatorPlayerId: input.operatorPlayerId, expectedRevision: input.expectedRevision, snapshotHash: input.snapshot.hash,
    sourcePairKeyHash: input.sourcePairKeyHash, proofs: reports.map(identityProofHash) });
  return { reports, twitchUserIds, inputHash, now };
}

async function gates(tx: Tx, config: AppConfig, input: Scope) {
  await new TwitchNativeAuthority(tx as PrismaClient, config).requireOperator(tx, input.operatorPlayerId);
  const control = await tx.twitchNativeAuthority.findUnique({ where: { id: 'twitch-commands' } });
  if (config.twitchCommandPilot?.enabled !== false || control?.desiredMode !== 'OFF' || control.revision !== input.expectedRevision) return fail('OFF_GATE_REQUIRED');
  if (await tx.businessOperation.count({ where: { status: 'PENDING' } })) return fail('OPERATION_IN_FLIGHT');
  const receipts = await tx.twitchEventReceipt.findMany({ where: receiptSafetyCandidates(),
    select: { eventType: true, state: true, processedAt: true, externalReference: true, payloadMinimal: true } });
  if (receipts.some(receipt => receiptSafety(receipt).blocking)
    || await tx.giveawayAnnouncement.count({ where: { state: { in: ['RESERVED', 'AMBIGUOUS'] } } })) return fail('OUTBOUND_IN_FLIGHT');
}

async function prefixLocks(tx: Tx, twitchUserIds: readonly string[]) {
  for (const id of [...new Set(twitchUserIds)].sort()) await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`twitch-provision:${id}`},0))::text`;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('social:friendship'))::text`;
}
async function playerLocks(tx: Tx, ids: readonly string[]) {
  await tx.$queryRaw(Prisma.sql`SELECT id FROM players WHERE id IN (${Prisma.join([...new Set(ids)].sort().map(id => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`);
}
async function inspect(tx: Tx, config: AppConfig, input: LegacySocialPlanInput, verified: ReturnType<typeof inputs>) {
  await gates(tx, config, input);
  const registration = await planLegacyFriendshipRegistration(tx, { snapshot: input.snapshot, reports: verified.reports, sourcePairKeyHash: input.sourcePairKeyHash, now: verified.now });
  return { ...registration, fingerprint: hash({ inputHash: verified.inputHash, registration: registration.fingerprint }) };
}

/** READ ONLY: no registry/proof/journal is created by preparation. */
export async function planLegacySocialPair(db: PrismaClient, config: AppConfig, input: LegacySocialPlanInput) {
  const verified = inputs(input);
  return db.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    return inspect(tx, config, input, verified);
  }, { ...transactionOptions, isolationLevel: 'RepeatableRead' });
}

async function postEvidenceHash(tx: Tx, twitchUserIds: readonly string[]) { return hash(await legacyFriendshipDecisionEvidence(tx, twitchUserIds)); }
async function journal(tx: Tx, operationId: string) {
  const row = await tx.migrationBatch.findUnique({ where: { id: operationId } });
  if (!row) return null;
  const parsed = journalSchema.safeParse(row.summary);
  if (row.mode !== 'CUTOVER' || row.status !== 'COMPLETED' || row.migratorVersion !== 'r1055-social-v1' || !parsed.success) return fail('JOURNAL_CONFLICT');
  return { row, summary: parsed.data };
}

/** One exact pair only; durable backup must complete before the first DB write. */
export async function applyLegacySocialPair(db: PrismaClient, config: AppConfig, input: LegacySocialApplyInput, writeBackup: (backup: LegacySocialBackup) => Promise<void>) {
  const verified = inputs(input);
  if (!z.uuid().safeParse(input.operationId).success || !hashText.safeParse(input.expectedFingerprint).success || input.acknowledgement !== STREAMERBOT_PATH_DISABLED) return fail('CONFIRMATIONS_REQUIRED');
  return db.$transaction(async tx => {
    await prefixLocks(tx, verified.twitchUserIds);
    const plan = await inspect(tx, config, input, verified);
    if (plan.status === 'DEFERRED') return fail('PAIR_NOT_READY');
    const owner = verified.reports[0]!.users[0]!;
    const identity = await tx.twitchIdentity.findUniqueOrThrow({ where: { twitchUserId: owner.twitchUserId } });
    const preimage = await captureLegacyFriendshipBackup(tx, { snapshot: input.snapshot, report: verified.reports[0]!, ownerTwitchUserId: owner.twitchUserId,
      ownerPlayerId: identity.playerId, sourcePairKeyHash: input.sourcePairKeyHash });
    const playerIds = [...new Set([...plan.playerIds, ...preimage.playerIds, input.operatorPlayerId])].sort();
    await playerLocks(tx, playerIds);
    await tx.$queryRaw`SELECT id FROM twitch_native_authorities WHERE id='twitch-commands' FOR UPDATE`;
    const locked = await inspect(tx, config, input, verified);
    if (locked.fingerprint !== plan.fingerprint) return fail('PLAN_CHANGED');
    const prior = await journal(tx, input.operationId);
    if (prior) {
      if (prior.summary.state !== 'APPLIED' || prior.summary.inputHash !== verified.inputHash || prior.summary.fingerprint !== input.expectedFingerprint
        || prior.summary.sourcePairKeyHash !== input.sourcePairKeyHash || prior.row.snapshotHash !== input.snapshot.hash
        || prior.summary.postHash !== await legacyFriendshipBackupPostHash(tx, preimage)
        || prior.summary.postEvidenceHash !== await postEvidenceHash(tx, verified.twitchUserIds)) return fail('JOURNAL_CONFLICT');
      return { status: 'APPLIED' as const, replayed: true, operationId: input.operationId, backupHash: prior.summary.backupHash, postHash: prior.summary.postHash,
        materialized: prior.summary.materialized, retained: prior.summary.retained };
    }
    if (locked.fingerprint !== input.expectedFingerprint) return fail('PLAN_CHANGED');
    const body = { kind, version: 1 as const, operationId: input.operationId, operatorPlayerId: input.operatorPlayerId, expectedRevision: input.expectedRevision,
      snapshotHash: input.snapshot.hash, sourcePairKeyHash: input.sourcePairKeyHash, twitchUserIds: verified.twitchUserIds, playerIds,
      fingerprint: input.expectedFingerprint, inputHash: verified.inputHash, createdAt: verified.now.toISOString(), preimage };
    const backup: LegacySocialBackup = { ...body, hash: hash(body) };
    await writeBackup(backup);
    for (const report of verified.reports) await registerLegacyFriendships(tx, { snapshot: input.snapshot, report, ownerTwitchUserId: report.users[0]!.twitchUserId, now: verified.now, sourcePairKeyHash: input.sourcePairKeyHash });
    const result = await reconcileLegacyFriendships(tx, { now: verified.now, sourcePairKeyHashes: [input.sourcePairKeyHash] });
    if (result.deferred || result.materialized + result.retained !== 1) return fail('POSTCONDITION_FAILED');
    const postHash = await legacyFriendshipBackupPostHash(tx, preimage), evidenceHash = await postEvidenceHash(tx, verified.twitchUserIds);
    await tx.migrationBatch.create({ data: { id: input.operationId, snapshotHash: input.snapshot.hash, mode: 'CUTOVER', status: 'COMPLETED', migratorVersion: 'r1055-social-v1', completedAt: verified.now,
      summary: { kind, version: 1, state: 'APPLIED', inputHash: verified.inputHash, fingerprint: input.expectedFingerprint, backupHash: backup.hash, postHash, postEvidenceHash: evidenceHash,
        sourcePairKeyHash: input.sourcePairKeyHash, materialized: result.materialized, retained: result.retained } } });
    await tx.twitchNativeAudit.create({ data: { actorPlayerId: input.operatorPlayerId, action: `TARGETED_LEGACY_SOCIAL_APPLIED:${input.operationId}`, mode: 'OFF', revision: input.expectedRevision, acknowledgement: input.acknowledgement } });
    return { status: 'APPLIED' as const, replayed: false, operationId: input.operationId, backupHash: backup.hash, postHash, materialized: result.materialized, retained: result.retained };
  }, transactionOptions);
}

/** Exact scoped restoration only; journals and audits are retained, never deleted. */
export async function rollbackLegacySocialPair(db: PrismaClient, config: AppConfig, input: Scope & { backup: LegacySocialBackup; expectedBackupHash: string; acknowledgement: string; now?: Date }) {
  const parsed = legacySocialBackupSchema.safeParse(input.backup);
  if (!parsed.success || input.acknowledgement !== STREAMERBOT_PATH_DISABLED) return fail('BACKUP_INVALID');
  const backup = parsed.data, { hash: expected, ...body } = backup;
  if (hash(body) !== expected || input.expectedBackupHash !== expected || backup.sourcePairKeyHash !== backup.preimage.sourcePairKeyHashes[0]
    || backup.operatorPlayerId !== input.operatorPlayerId || backup.expectedRevision !== input.expectedRevision) return fail('BACKUP_INVALID');
  return db.$transaction(async tx => {
    await prefixLocks(tx, backup.twitchUserIds);
    const affected = await legacyFriendshipAffectedPlayers(tx, backup.twitchUserIds);
    await playerLocks(tx, [...backup.playerIds, ...backup.preimage.playerIds, ...affected]);
    await tx.$queryRaw`SELECT id FROM twitch_native_authorities WHERE id='twitch-commands' FOR UPDATE`;
    await gates(tx, config, input);
    const prior = await journal(tx, backup.operationId);
    if (!prior || prior.summary.backupHash !== backup.hash || prior.summary.inputHash !== backup.inputHash || prior.summary.fingerprint !== backup.fingerprint
      || prior.row.snapshotHash !== backup.snapshotHash || prior.summary.sourcePairKeyHash !== backup.sourcePairKeyHash) return fail('JOURNAL_CONFLICT');
    if (prior.summary.state === 'ROLLED_BACK') {
      if (await legacyFriendshipBackupPostHash(tx, backup.preimage) !== prior.summary.rollbackHash) return fail('POSTIMAGE_CHANGED');
      return { mode: 'EXACT_PREIMAGE' as const, replayed: true };
    }
    if (await postEvidenceHash(tx, backup.twitchUserIds) !== prior.summary.postEvidenceHash) return fail('POSTIMAGE_CHANGED');
    const result = await restoreLegacyFriendshipBackup(tx, backup.preimage as LegacyFriendshipBackup, prior.summary.postHash);
    const restoredHash = await legacyFriendshipBackupPostHash(tx, backup.preimage);
    await tx.migrationBatch.update({ where: { id: backup.operationId }, data: { summary: { ...prior.summary, state: 'ROLLED_BACK', rollbackHash: restoredHash, rolledBackAt: (input.now ?? new Date()).toISOString() } } });
    await tx.twitchNativeAudit.create({ data: { actorPlayerId: input.operatorPlayerId, action: `TARGETED_LEGACY_SOCIAL_ROLLED_BACK:${backup.operationId}`, mode: 'OFF', revision: input.expectedRevision, acknowledgement: input.acknowledgement } });
    return { ...result, replayed: false };
  }, transactionOptions);
}
