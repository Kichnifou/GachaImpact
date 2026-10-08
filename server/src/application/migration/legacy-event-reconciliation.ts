import { z } from 'zod';
import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import type { AppConfig } from '../../config/environment.js';
import { getBusinessDate } from '../../domain/time/business-date.js';
import { EVENT_COLLECTION_COST } from '../../domain/event/shop.js';
import { STREAMERBOT_PATH_DISABLED } from '../twitch/twitch-native-authority.js';
import { parseLegacyParisInstant } from './legacy-box-mapping.js';
import { normalizeLegacyName } from './streamerbot-snapshot.js';
import { communityHash as hash, communityRecord as object, requireCommunityMutationGates as gates, verifyNativeCommunityProof, type CommunityProof } from './legacy-community-proof.js';

type Tx = Prisma.TransactionClient;
const kind = 'TARGETED_LEGACY_EVENT' as const;
const version = 'r1056-event-v1';
const fail = (reason: string): never => { throw Error(`LEGACY_EVENT_${reason}`); };
type Scope = { operatorPlayerId: string; expectedRevision: number };
type Input = CommunityProof & Scope & { now?: Date };
type ApplyInput = Input & { operationId: string; expectedFingerprint: string; acknowledgement: string };
const hashText = z.string().regex(/^[a-f0-9]{64}$/);
const options = { isolationLevel: 'Serializable' as const, timeout: 30_000 };

/** Narrow reconciliation: proved current-month baseline plus supported native receipts.
 * Unsupported rewards/shared credits/overlapping daily facts fail closed, never estimated. */
async function inspect(tx: Tx, input: Input) {
  const binding = await verifyNativeCommunityProof(tx, input), now = input.now ?? new Date();
  const source = object(input.snapshot.sources['monthly_events_data.json']);
  if (!Number.isSafeInteger(source.year) || !Number.isSafeInteger(source.month)
    || `${source.year}-${String(source.month).padStart(2, '0')}` !== getBusinessDate(now).slice(0, 7)) return fail('SOURCE_EDITION_NOT_CURRENT');
  const rows = Object.entries(object(source.participants)).filter(([name]) => normalizeLegacyName(name) === binding.legacyKey);
  if (rows.length !== 1) return fail('SOURCE_PARTICIPANT_AMBIGUOUS');
  const legacy = object(rows[0]![1]);
  const legacyPoints = legacy.points, legacyCurrency = legacy.currency;
  if (legacy.joined !== true || !Number.isSafeInteger(legacyPoints) || Number(legacyPoints) < 0 || !Number.isSafeInteger(legacyCurrency) || Number(legacyCurrency) < 0)
    return fail('SOURCE_BASELINE_INVALID');
  const joinedAt = parseLegacyParisInstant(legacy.joinedAt);
  if (!joinedAt || joinedAt >= binding.run.importedAt || Object.keys(object(legacy.daily)).some(day => !/^\d{4}-\d{2}-\d{2}$/.test(day) || day >= getBusinessDate(binding.run.importedAt)))
    return fail('SOURCE_NATIVE_DATE_OVERLAP');
  const claimed = legacy.milestonesClaimed;
  if (!Array.isArray(claimed) || claimed.some(m => !Number.isSafeInteger(m) || m < 10 || m > 80 || m % 10 || m > Number(legacyPoints))
    || new Set(claimed).size !== claimed.length || Array.from({ length: Math.min(8, Math.floor(Number(legacyPoints) / 10)) }, (_, i) => (i + 1) * 10).some(m => !claimed.includes(m)))
    return fail('SOURCE_MILESTONE_PROOF_INCOMPLETE');
  for (const buyers of Object.values(object(source.collectionPurchases))) {
    if (Object.entries(object(buyers)).some(([name, items]) => normalizeLegacyName(name) === binding.legacyKey && (!Array.isArray(items) || items.length)))
      return fail('LEGACY_COLLECTION_REQUIRES_SEPARATE_PROOF');
  }
  const edition = await tx.eventEdition.findFirst({ where: { year: Number(source.year), status: 'ACTIVE', definition: { calendarMonth: Number(source.month) } }, include: { definition: true } });
  if (!edition || now < edition.startsAt || now >= edition.endsAt) return fail('CURRENT_EDITION_REQUIRED');
  const playerId = input.playerId, eventEditionId = edition.id, eventDefinitionId = edition.eventDefinitionId;
  const participant = await tx.eventParticipant.findUnique({ where: { eventEditionId_playerId: { eventEditionId, playerId } } });
  const balance = await tx.playerEventCurrencyBalance.findUnique({ where: { playerId_eventDefinitionId: { playerId, eventDefinitionId } } });
  const claims = await tx.eventMilestoneClaim.findMany({ where: { playerId, eventEditionId }, orderBy: { milestone: 'asc' } });
  const daily = await tx.eventDailyPlayerState.findMany({ where: { playerId, eventEditionId }, orderBy: { businessDate: 'asc' } });
  const acquisitions = await tx.eventCollectionAcquisition.findMany({ where: { playerId, eventEditionId }, orderBy: { itemId: 'asc' } });
  const global = await tx.eventGameBDailyState.findMany({ where: { eventEditionId }, orderBy: { businessDate: 'asc' } });
  const operations = await tx.businessOperation.findMany({ where: { operationType: { startsWith: 'event.' }, startedAt: { gte: binding.run.importedAt } }, orderBy: [{ completedAt: 'asc' }, { startedAt: 'asc' }, { id: 'asc' }] });
  const own = operations.filter(op => op.playerId === playerId);
  if (!participant || !balance || !own.length || participant.legacyProvenance || claims.length) return fail('BASELINE_OR_NATIVE_CLAIMS_REQUIRE_REVIEW');
  // A correct Game B credits recipients without an individual receipt: require a separate membership ledger.
  if (operations.some(op => object(object(op.resultSummary).request).editionId === edition.id && op.operationType === 'event.game-b.attempt' && object(op.resultSummary).kind === 'CORRECT')
    || global.some(row => row.solvedAt && row.solvedAt >= binding.run.importedAt)) return fail('SHARED_GAME_B_MEMBERSHIP_PROOF_REQUIRED');
  let points = 0, currency = 0n, enrollmentPoints = 0, enrollmentCurrency = 0n;
  for (const [index, op] of own.entries()) {
    const summary = object(op.resultSummary), request = object(summary.request), snapshot = object(summary.snapshot);
    if (op.status !== 'COMPLETED' || !op.completedAt || request.editionId !== edition.id || object(snapshot.edition).id !== edition.id) return fail('NATIVE_RECEIPT_INCOMPLETE');
    let dp = 0, dc = 0n;
    if (op.operationType === 'event.join') {
      if (index !== 0 || summary.credited !== true || ![1, 2].includes(Number(summary.creditedCurrency))) return fail('ENROLLMENT_BASELINE_UNPROVEN');
      enrollmentCurrency = BigInt(Number(summary.creditedCurrency)); enrollmentPoints = enrollmentCurrency === 2n ? 1 : 0;
      dp = enrollmentPoints; dc = enrollmentCurrency;
    } else if (index === 0) return fail('ENROLLMENT_BASELINE_UNPROVEN');
    else if (op.operationType === 'event.daily-bonus.claim') dc = 1n;
    else if (op.operationType === 'event.game-a.attempt') {
      if (typeof summary.succeeded !== 'boolean') return fail('NATIVE_RECEIPT_INCOMPLETE');
      dp = summary.succeeded ? 1 : 0; dc = BigInt(dp);
    } else if (op.operationType === 'event.game-b.attempt') {
      if (!['INCORRECT', 'ALREADY_TESTED'].includes(String(summary.kind))) return fail('SHARED_GAME_B_MEMBERSHIP_PROOF_REQUIRED');
    } else if (op.operationType === 'event.game-c.send') { dp = 1; dc = 1n; }
    else if (op.operationType === 'event.shop.convert') {
      if (!Number.isSafeInteger(request.quantity) || Number(request.quantity) <= 0 || !['PRIMOGEMS', 'MORAS'].includes(String(request.target))) return fail('NATIVE_RECEIPT_INCOMPLETE');
      dc = -BigInt(Number(request.quantity));
    } else if (op.operationType === 'event.shop.collection') dc = -EVENT_COLLECTION_COST;
    else return fail('NATIVE_OPERATION_REQUIRES_SEPARATE_PROOF');
    points += dp; currency += dc;
    const sp = object(snapshot.participation), sc = object(snapshot.currency);
    if (sp.joined !== true || sp.points !== points || sc.amount !== currency.toString() || currency < 0n) return fail('NATIVE_LEDGER_MISMATCH');
  }
  if (points !== participant.points || currency !== balance.amount) return fail('CURRENT_STATE_DRIFT');
  const targetPoints = Number(legacyPoints) + points - enrollmentPoints;
  const targetCurrency = BigInt(Number(legacyCurrency)) + currency - enrollmentCurrency;
  if (!Number.isSafeInteger(targetPoints) || targetPoints < 0 || targetCurrency < 0n) return fail('TARGET_INVALID');
  if (Array.from({ length: Math.min(8, Math.floor(targetPoints / 10)) }, (_, i) => (i + 1) * 10).some(m => !claimed.includes(m))) return fail('NEW_MILESTONE_REWARD_REQUIRES_OWNER');
  const evidence = { binding, legacy, legacyCollectionPurchases: source.collectionPurchases ?? null, edition, participant, balance, claims, daily, acquisitions, global, operations };
  const plan = { status: 'READY' as const, playerId, eventEditionId, eventDefinitionId, importId: input.importId, snapshotHash: input.snapshot.hash,
    targetPoints, targetCurrency: targetCurrency.toString(), deltaPoints: targetPoints - points, deltaCurrency: (targetCurrency - currency).toString(),
    sourceJoinedAt: joinedAt.toISOString(), retainedNativeOperations: own.length, deduplicatedEnrollmentCurrency: enrollmentCurrency.toString(),
    legacyMilestones: claimed as number[], fingerprint: hash(evidence) };
  return { plan, evidence };
}

/** Read-only preparation works while CANARY is live; it neither arms nor pauses it. */
export async function planNativeLegacyEvent(db: PrismaClient, input: Input) {
  return db.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    await tx.$executeRaw`SET LOCAL statement_timeout='5000ms'`;
    return (await inspect(tx, input)).plan;
  }, { ...options, isolationLevel: 'RepeatableRead' });
}

async function locks(tx: Tx, input: Input) {
  await tx.$executeRaw`SET LOCAL statement_timeout='5000ms'`;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`twitch-provision:${input.twitchUserId}`},0))::text`;
  // Native Game B takes its edition/day lock before Player locks. Match that ordering.
  await tx.$queryRaw`SELECT event_edition_id FROM event_game_b_daily_states ORDER BY event_edition_id,business_date FOR UPDATE`;
  await tx.$queryRaw(Prisma.sql`SELECT id FROM players WHERE id IN (${Prisma.join([...new Set([input.playerId, input.operatorPlayerId])].sort().map(id => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`);
  await tx.$queryRaw`SELECT id FROM twitch_native_authorities WHERE id='twitch-commands' FOR UPDATE`;
}
async function stateHash(tx: Tx, input: CommunityProof, eventEditionId: string, eventDefinitionId: string) {
  const playerId = input.playerId;
  return hash({ binding: await verifyNativeCommunityProof(tx, input),
    participant: await tx.eventParticipant.findUnique({ where: { eventEditionId_playerId: { playerId, eventEditionId } } }),
    balance: await tx.playerEventCurrencyBalance.findUnique({ where: { playerId_eventDefinitionId: { playerId, eventDefinitionId } } }),
    claims: await tx.eventMilestoneClaim.findMany({ where: { playerId, eventEditionId }, orderBy: { milestone: 'asc' } }),
    daily: await tx.eventDailyPlayerState.findMany({ where: { playerId, eventEditionId }, orderBy: { businessDate: 'asc' } }),
    acquisitions: await tx.eventCollectionAcquisition.findMany({ where: { playerId, eventEditionId }, orderBy: { itemId: 'asc' } }),
    operations: await tx.businessOperation.findMany({ where: { playerId, operationType: { startsWith: 'event.' } }, orderBy: { id: 'asc' } }),
    edition: await tx.eventEdition.findUnique({ where: { id: eventEditionId } }),
    global: await tx.eventGameBDailyState.findMany({ where: { eventEditionId }, orderBy: { businessDate: 'asc' } }),
  });
}
export const legacyEventBackupSchema = z.object({ kind: z.literal(kind), version: z.literal(1), operationId: z.uuid(), operatorPlayerId: z.uuid(), expectedRevision: z.number().int().nonnegative(),
  playerId: z.uuid(), twitchUserId: z.string().regex(/^[1-9][0-9]*$/), importId: z.uuid(), snapshotHash: hashText, eventEditionId: z.uuid(), eventDefinitionId: z.uuid(),
  inputHash: hashText, fingerprint: hashText, createdAt: z.iso.datetime(), preHash: hashText,
  participant: z.object({ points: z.number().int().nonnegative(), joinedAt: z.iso.datetime().nullable(), legacyProvenance: z.json().nullable() }).strict(),
  balance: z.object({ amount: z.string().regex(/^\d+$/), updatedAt: z.iso.datetime() }).strict(), addedMilestones: z.array(z.number().int()), hash: hashText,
}).strict();
export type LegacyEventBackup = z.infer<typeof legacyEventBackupSchema>;
const journalSchema = z.object({ kind: z.literal(kind), state: z.enum(['APPLIED', 'ROLLED_BACK']), inputHash: hashText, fingerprint: hashText, backupHash: hashText,
  eventEditionId: z.uuid(), eventDefinitionId: z.uuid(), targetPoints: z.number().int(), targetCurrency: z.string(), deltaPoints: z.number().int(), deltaCurrency: z.string(),
  deduplicatedEnrollmentCurrency: z.string(), addedMilestones: z.array(z.number().int()), postHash: hashText, rollbackHash: hashText.optional() }).strict();
const inputHash = (input: Input) => hash({ playerId: input.playerId, twitchUserId: input.twitchUserId, importId: input.importId, snapshotHash: input.snapshot.hash,
  operatorPlayerId: input.operatorPlayerId, expectedRevision: input.expectedRevision });

/** Internal operator owner only. No HTTP/command/CLI entry point is registered in this review candidate. */
export async function applyNativeLegacyEvent(db: PrismaClient, config: AppConfig, input: ApplyInput, writeBackup: (backup: LegacyEventBackup) => Promise<void>) {
  if (!z.uuid().safeParse(input.operationId).success || !hashText.safeParse(input.expectedFingerprint).success || input.acknowledgement !== STREAMERBOT_PATH_DISABLED) return fail('CONFIRMATIONS_REQUIRED');
  return db.$transaction(async tx => {
    await locks(tx, input); await gates(tx, config, input);
    const prior = await tx.migrationBatch.findUnique({ where: { id: input.operationId } });
    if (prior) {
      const j = journalSchema.safeParse(prior.summary);
      if (prior.migratorVersion !== version || prior.status !== 'COMPLETED' || prior.mode !== 'CUTOVER' || !j.success || j.data.state !== 'APPLIED'
        || j.data.inputHash !== inputHash(input) || j.data.fingerprint !== input.expectedFingerprint || prior.snapshotHash !== input.snapshot.hash
        || j.data.postHash !== await stateHash(tx, input, j.data.eventEditionId, j.data.eventDefinitionId)) return fail('JOURNAL_OR_POSTIMAGE_CONFLICT');
      return { replayed: true, backupHash: j.data.backupHash };
    }
    const { plan, evidence } = await inspect(tx, input);
    if (plan.fingerprint !== input.expectedFingerprint) return fail('PLAN_CHANGED');
    const preHash = await stateHash(tx, input, plan.eventEditionId, plan.eventDefinitionId);
    const body = { kind, version: 1 as const, operationId: input.operationId, operatorPlayerId: input.operatorPlayerId, expectedRevision: input.expectedRevision,
      playerId: input.playerId, twitchUserId: input.twitchUserId, importId: input.importId, snapshotHash: input.snapshot.hash, eventEditionId: plan.eventEditionId, eventDefinitionId: plan.eventDefinitionId,
      inputHash: inputHash(input), fingerprint: plan.fingerprint, createdAt: (input.now ?? new Date()).toISOString(), preHash,
      participant: { points: evidence.participant.points, joinedAt: evidence.participant.joinedAt?.toISOString() ?? null, legacyProvenance: evidence.participant.legacyProvenance },
      balance: { amount: evidence.balance.amount.toString(), updatedAt: evidence.balance.updatedAt.toISOString() }, addedMilestones: plan.legacyMilestones };
    const backup = legacyEventBackupSchema.parse({ ...body, hash: hash(body) });
    await writeBackup(backup); // Durable, exclusive file creation + fsync is the operator adapter's responsibility.
    const provenance = { source: 'monthly_events_data.json.participants', kind, operationId: input.operationId, snapshotHash: input.snapshot.hash, importId: input.importId };
    await tx.eventParticipant.update({ where: { eventEditionId_playerId: { eventEditionId: plan.eventEditionId, playerId: input.playerId } },
      data: { points: plan.targetPoints, joinedAt: new Date(plan.sourceJoinedAt), legacyProvenance: provenance } });
    await tx.playerEventCurrencyBalance.update({ where: { playerId_eventDefinitionId: { playerId: input.playerId, eventDefinitionId: plan.eventDefinitionId } }, data: { amount: BigInt(plan.targetCurrency) } });
    for (const milestone of plan.legacyMilestones) await tx.eventMilestoneClaim.create({ data: { playerId: input.playerId, eventEditionId: plan.eventEditionId, milestone,
      origin: 'LEGACY', operationId: null, claimedAt: null, legacyProvenance: provenance } });
    const postHash = await stateHash(tx, input, plan.eventEditionId, plan.eventDefinitionId);
    await tx.migrationBatch.create({ data: { id: input.operationId, snapshotHash: input.snapshot.hash, mode: 'CUTOVER', status: 'COMPLETED', migratorVersion: version, completedAt: input.now ?? new Date(),
      summary: { kind, state: 'APPLIED', inputHash: backup.inputHash, fingerprint: plan.fingerprint, backupHash: backup.hash, eventEditionId: plan.eventEditionId, eventDefinitionId: plan.eventDefinitionId,
        targetPoints: plan.targetPoints, targetCurrency: plan.targetCurrency, deltaPoints: plan.deltaPoints, deltaCurrency: plan.deltaCurrency,
        deduplicatedEnrollmentCurrency: plan.deduplicatedEnrollmentCurrency, addedMilestones: plan.legacyMilestones, postHash } } });
    await tx.twitchNativeAudit.create({ data: { actorPlayerId: input.operatorPlayerId, action: `TARGETED_LEGACY_EVENT_APPLIED:${input.operationId}`, mode: 'OFF', revision: input.expectedRevision, acknowledgement: input.acknowledgement } });
    return { replayed: false, backupHash: backup.hash };
  }, options);
}

/** Compensation is exact only while the scoped postimage is unchanged. Audits/journal remain. */
export async function rollbackNativeLegacyEvent(db: PrismaClient, config: AppConfig, input: Input & { backup: LegacyEventBackup; expectedBackupHash: string; acknowledgement: string }) {
  const parsed = legacyEventBackupSchema.safeParse(input.backup);
  if (!parsed.success || input.acknowledgement !== STREAMERBOT_PATH_DISABLED) return fail('BACKUP_INVALID');
  const backup = parsed.data, { hash: expected, ...body } = backup;
  if (hash(body) !== expected || input.expectedBackupHash !== expected || backup.inputHash !== inputHash(input)
    || backup.playerId !== input.playerId || backup.twitchUserId !== input.twitchUserId || backup.importId !== input.importId || backup.snapshotHash !== input.snapshot.hash) return fail('BACKUP_INVALID');
  return db.$transaction(async tx => {
    await locks(tx, input); await gates(tx, config, input);
    const prior = await tx.migrationBatch.findUniqueOrThrow({ where: { id: backup.operationId } }), j = journalSchema.safeParse(prior.summary);
    if (prior.migratorVersion !== version || prior.mode !== 'CUTOVER' || prior.status !== 'COMPLETED' || prior.snapshotHash !== input.snapshot.hash || !j.success
      || j.data.backupHash !== expected || j.data.inputHash !== backup.inputHash || j.data.fingerprint !== backup.fingerprint
      || j.data.eventEditionId !== backup.eventEditionId || j.data.eventDefinitionId !== backup.eventDefinitionId) return fail('JOURNAL_OR_POSTIMAGE_CONFLICT');
    const currentHash = await stateHash(tx, input, backup.eventEditionId, backup.eventDefinitionId);
    if (j.data.state === 'ROLLED_BACK') {
      if (currentHash !== j.data.rollbackHash) return fail('POSTIMAGE_CHANGED');
      return { replayed: true };
    }
    if (currentHash !== j.data.postHash) return fail('POSTIMAGE_CHANGED');
    await tx.eventMilestoneClaim.deleteMany({ where: { playerId: input.playerId, eventEditionId: backup.eventEditionId, milestone: { in: backup.addedMilestones } } });
    await tx.eventParticipant.update({ where: { eventEditionId_playerId: { playerId: input.playerId, eventEditionId: backup.eventEditionId } }, data: {
      points: backup.participant.points, joinedAt: backup.participant.joinedAt ? new Date(backup.participant.joinedAt) : null,
      legacyProvenance: backup.participant.legacyProvenance === null ? Prisma.DbNull : backup.participant.legacyProvenance as Prisma.InputJsonValue,
    } });
    await tx.playerEventCurrencyBalance.update({ where: { playerId_eventDefinitionId: { playerId: input.playerId, eventDefinitionId: backup.eventDefinitionId } },
      data: { amount: BigInt(backup.balance.amount), updatedAt: new Date(backup.balance.updatedAt) } });
    const restoredHash = await stateHash(tx, input, backup.eventEditionId, backup.eventDefinitionId);
    if (restoredHash !== backup.preHash) return fail('RESTORATION_MISMATCH');
    await tx.migrationBatch.update({ where: { id: backup.operationId }, data: { summary: { ...j.data, state: 'ROLLED_BACK', rollbackHash: restoredHash } } });
    await tx.twitchNativeAudit.create({ data: { actorPlayerId: input.operatorPlayerId, action: `TARGETED_LEGACY_EVENT_ROLLED_BACK:${backup.operationId}`, mode: 'OFF', revision: input.expectedRevision, acknowledgement: input.acknowledgement } });
    return { replayed: false };
  }, options);
}
