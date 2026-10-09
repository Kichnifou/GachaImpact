import { z } from 'zod';
import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import type { AppConfig } from '../../config/environment.js';
import { getBusinessDate } from '../../domain/time/business-date.js';
import { playerRecoverySchema, type RecoveryDomain } from '../player/player-recovery-readiness.js';
import { STREAMERBOT_PATH_DISABLED, TwitchNativeAuthority } from '../twitch/twitch-native-authority.js';
import { communityHash as hash, communityRecord as record, requireCommunityMutationGates, verifyNativeCommunityProof, type CommunityProof } from './legacy-community-proof.js';
import { parseLegacyParisInstant } from './legacy-box-mapping.js';
import { normalizeLegacyName } from './streamerbot-snapshot.js';
import { validateRecoverySource, type RecoverySource } from './legacy-recovery.js';
import { recoveryBossFacts } from './legacy-recovery-boss-facts.js';
import { requireSharedRecovery } from './legacy-recovery-shared.js';
import { oncePerBackup, recoveryTransaction } from './legacy-recovery-transaction.js';

type Tx = Prisma.TransactionClient;
type Domain = RecoveryDomain;
export type RecoveryDomainInput = Omit<CommunityProof, 'snapshot'> & {
  source: RecoverySource; domain: Domain; operatorPlayerId: string; expectedRevision: number; sharedOperationId?: string; now?: Date;
};
type ApplyInput = RecoveryDomainInput & { operationId: string; expectedFingerprint: string; acknowledgement: string };
const kind = 'RECOVERY_DOMAIN', version = 'r1063-domain-v1';
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const options = { isolationLevel: 'Serializable' as const, timeout: 30_000 };
function fail(reason: string): never { throw Error('RECOVERY_DOMAIN_' + reason); }
const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value, (_key, v: unknown) => typeof v === 'bigint' ? v.toString() : v)) as Prisma.InputJsonValue;

export const recoveryDomainBackupSchema = z.object({
  kind: z.literal(kind), version: z.literal(1), operationId: z.uuid(), operatorPlayerId: z.uuid(),
  playerId: z.uuid(), twitchUserId: z.string(), importId: z.uuid(), domain: z.enum(['EVENT', 'BOSS', 'GIVEAWAY']),
  snapshotHash: digest, populationHash: digest, inputHash: digest, fingerprint: digest,
  createdAt: z.iso.datetime(), preimage: z.json(), facts: z.json(), hash: digest,
}).strict();
export type RecoveryDomainBackup = z.infer<typeof recoveryDomainBackupSchema>;
const journalSchema = z.object({ kind: z.literal(kind), version: z.literal(1), state: z.enum(['APPLIED', 'ROLLED_BACK']),
  playerId: z.uuid(), domain: z.enum(['EVENT', 'BOSS', 'GIVEAWAY']), inputHash: digest, fingerprint: digest, backupHash: digest,
  postHash: digest, facts: z.json(), result: z.json(), rolledBackAt: z.iso.datetime().optional(),
}).strict();

function inputs(input: RecoveryDomainInput) {
  z.enum(['EVENT', 'BOSS', 'GIVEAWAY']).parse(input.domain); z.uuid().parse(input.operatorPlayerId);
  if (input.domain !== 'EVENT') z.uuid().parse(input.sharedOperationId);
  z.number().int().positive().parse(input.expectedRevision);
  const source = validateRecoverySource(input.source);
  if (!source.population.approved.some(m => m.twitchUserId === input.twitchUserId)
    || !source.report.users.some(m => m.twitchUserId === input.twitchUserId)) fail('OUTSIDE_VERIFIED_POPULATION');
  const proof: CommunityProof = { snapshot: source.snapshot, playerId: input.playerId, twitchUserId: input.twitchUserId,
    importId: input.importId, importReport: input.importReport };
  const inputHash = hash({ kind, playerId: input.playerId, twitchUserId: input.twitchUserId, importId: input.importId,
    domain: input.domain, operatorPlayerId: input.operatorPlayerId, sourceOperationId: input.source.operationId,
    sharedOperationId: input.sharedOperationId ?? null, snapshotHash: source.snapshot.hash, populationHash: source.populationHash });
  return { source, proof, inputHash, now: input.now ?? new Date() };
}

async function binding(tx: Tx, input: RecoveryDomainInput, checked: ReturnType<typeof inputs>) {
  const proof = await verifyNativeCommunityProof(tx, checked.proof);
  const marker = playerRecoverySchema.parse(proof.identity.player.legacyRecovery);
  if (marker.operationId !== input.source.operationId || marker.snapshotHash !== checked.source.snapshot.hash || marker.populationHash !== checked.source.populationHash
    || marker.importId !== input.importId || marker.backupHash !== proof.run.backupHash) fail('RECOVERY_BINDING_INVALID');
  return { proof, marker };
}

/** Include receipts of economic activity, not the entire personal import graph:
 * unrelated native gameplay must survive both restoration and compensation. */
async function state(tx: Tx, playerId: string, domain: Domain) {
  const player = await tx.player.findUniqueOrThrow({ where: { id: playerId }, select: { id: true, status: true, legacyRecovery: true, updatedAt: true } });
  const operations = await tx.businessOperation.findMany({ where: { playerId, operationType: { startsWith: domain === 'EVENT' ? 'event.' : domain === 'BOSS' ? 'monthly-boss.' : 'giveaway.' } }, orderBy: { id: 'asc' } });
  if (domain === 'GIVEAWAY') return { player, operations, rows: {
    participants: await tx.giveawayParticipant.findMany({ where: { playerId }, orderBy: { sessionId: 'asc' } }),
    chatStats: await tx.giveawayChatStat.findMany({ where: { playerId }, orderBy: { sessionId: 'asc' } }),
    wins: await tx.giveawayWin.findMany({ where: { playerId }, orderBy: [{ sessionId: 'asc' }, { drawIndex: 'asc' }] }),
    rewards: await tx.giveawayReward.findMany({ where: { playerId }, orderBy: { id: 'asc' } }),
    counted: await tx.giveawayCountedMessage.findMany({ where: { playerId }, orderBy: { twitchMessageId: 'asc' } }),
    deferred: await tx.giveawayDeferredMessage.findMany({ where: { playerId }, orderBy: { twitchMessageId: 'asc' } }),
  } };
  if (domain === 'BOSS') return { player, operations, rows: {
    stats: await tx.playerBossStats.findMany({ where: { playerId } }),
    participations: await tx.playerBossParticipation.findMany({ where: { playerId }, orderBy: { bossId: 'asc' } }),
    attacks: await tx.bossAttack.findMany({ where: { playerId }, orderBy: { id: 'asc' } }),
    rewards: await tx.bossReward.findMany({ where: { playerId }, orderBy: { bossId: 'asc' } }),
    contributions: await tx.bossLegacyContribution.findMany({ where: { playerId }, orderBy: { bossId: 'asc' } }),
  } };
  return { player, operations, rows: {
    participants: await tx.eventParticipant.findMany({ where: { playerId }, orderBy: { eventEditionId: 'asc' } }),
    balances: await tx.playerEventCurrencyBalance.findMany({ where: { playerId }, orderBy: { eventDefinitionId: 'asc' } }),
    claims: await tx.eventMilestoneClaim.findMany({ where: { playerId }, orderBy: [{ eventEditionId: 'asc' }, { milestone: 'asc' }] }),
    daily: await tx.eventDailyPlayerState.findMany({ where: { playerId }, orderBy: [{ eventEditionId: 'asc' }, { businessDate: 'asc' }] }),
    collections: await tx.eventCollectionAcquisition.findMany({ where: { playerId }, orderBy: { eventEditionId: 'asc' } }),
    calendar: await tx.eventCalendarClaim.findMany({ where: { playerId }, orderBy: [{ eventEditionId: 'asc' }, { calendarDay: 'asc' }] }),
    messages: await tx.eventSocialMessage.findMany({ where: { OR: [{ senderPlayerId: playerId }, { recipientPlayerId: playerId }] }, orderBy: { id: 'asc' } }),
    notifications: await tx.notification.findMany({ where: { playerId, domainKey: 'event' }, orderBy: { id: 'asc' } }),
  } };
}

function eventFacts(checked: ReturnType<typeof inputs>, legacyKey: string, importedAt: Date) {
  const source = record(checked.source.snapshot.sources['monthly_events_data.json']);
  const period = `${source.year}-${String(source.month).padStart(2, '0')}`;
  if (!Number.isInteger(source.year) || !Number.isInteger(source.month) || period !== getBusinessDate(checked.now).slice(0, 7)) fail('EVENT_EDITION_NOT_CURRENT');
  if (Object.keys(record(source.calendar)).length || Object.keys(record(source.collectionPurchases)).length
    || record(source.monthlyDraw).drawDone !== false) fail('EVENT_SHARED_FACTS_REQUIRE_REVIEW');
  const rows = Object.entries(record(source.participants)).filter(([name]) => normalizeLegacyName(name) === legacyKey);
  if (rows.length > 1) fail('EVENT_SOURCE_IDENTITY_COLLISION');
  const row = rows.length ? record(rows[0]![1]) : null;
  const day = getBusinessDate(importedAt), today = getBusinessDate(checked.now);
  const priorDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && date < day && date < today
    && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
  // No old daily lock or shared Game B result is moved to today; the exact source
  // remains in the journal. Only certain balances and acquired claims are restored.
  if (Object.keys(record(source.gameB)).some(date => !priorDate(date))) fail('EVENT_SHARED_DAY_OVERLAP');
  if (!row) return { year: Number(source.year), month: Number(source.month), joined: false as const,
    points: 0, currency: '0', milestones: [] as number[], joinedAt: null, sourceParticipant: null,
    sourceWindows: null, sharedHistorical: { gameB: source.gameB ?? null, monthlyDraw: source.monthlyDraw ?? null } };
  const joinedAt = parseLegacyParisInstant(row.joinedAt);
  const milestones = z.array(z.number().int().min(10).max(80).multipleOf(10)).parse(row.milestonesClaimed);
  const points = z.number().int().nonnegative().parse(row.points), currency = z.number().int().nonnegative().parse(row.currency);
  if (row.joined !== true || !joinedAt || joinedAt >= importedAt || joinedAt >= checked.now
    || Object.keys(record(row.daily)).some(date => !priorDate(date)) || new Set(milestones).size !== milestones.length
    || milestones.some(m => m > points) || Array.from({ length: Math.min(8, Math.floor(points / 10)) }, (_, i) => (i + 1) * 10).some(m => !milestones.includes(m))) fail('EVENT_SOURCE_FACTS_INCOMPLETE');
  return { year: Number(source.year), month: Number(source.month), joined: true as const, points, currency: String(currency),
    milestones, joinedAt: joinedAt.toISOString(), sourceParticipant: row,
    sourceWindows: record(source.dailyWindows)[rows[0]![0]] ?? null,
    sharedHistorical: { gameB: source.gameB ?? null, monthlyDraw: source.monthlyDraw ?? null } };
}

async function inspect(tx: Tx, input: RecoveryDomainInput, checked: ReturnType<typeof inputs>) {
  const bound = await binding(tx, input, checked);
  if (!bound.marker.restrictedDomains.includes(input.domain)) fail('DOMAIN_ALREADY_OPEN_REQUIRES_JOURNAL');
  const preimage = await state(tx, input.playerId, input.domain);
  if (preimage.operations.length) fail('DOMAIN_NOT_EMPTY');
  if (input.domain !== 'GIVEAWAY' && Object.values(preimage.rows).some(rows => rows.length)) fail('DOMAIN_NOT_EMPTY');
  const shared = input.domain === 'EVENT' ? null : await requireSharedRecovery(tx, input.sharedOperationId!, input.domain === 'BOSS' ? 'BOSS_HISTORY' : 'GIVEAWAY_HISTORY', checked.source.snapshot.hash);
  if (shared && !(record(shared.facts).bindings as unknown[]).some(value => record(value).playerId === input.playerId && record(value).twitchUserId === input.twitchUserId)) fail('HISTORY_IDENTITY_CONFLICT');
  let facts: unknown, edition: { id: string; eventDefinitionId: string } | null = null;
  if (input.domain === 'EVENT') {
    const event = eventFacts(checked, bound.proof.legacyKey, bound.proof.run.importedAt);
    edition = await tx.eventEdition.findFirst({ where: { year: event.year, status: 'ACTIVE', definition: { calendarMonth: event.month }, startsAt: { lte: checked.now }, endsAt: { gt: checked.now } }, select: { id: true, eventDefinitionId: true } });
    if (!edition) fail('EVENT_ACTIVE_EDITION_REQUIRED');
    facts = { ...event, edition };
  } else if (input.domain === 'BOSS') facts = { ...recoveryBossFacts(checked.source.snapshot, bound.proof.legacyName, bound.proof.run.importedAt, checked.now), sharedOperationId: input.sharedOperationId };
  else {
    const source = record(shared!.facts), key = z.string().parse(source.sessionKey);
    const session = await tx.giveawaySession.findUniqueOrThrow({ where: { legacySessionKey: key } });
    if (session.origin !== 'LEGACY' || session.status !== 'CLOSED' || record(session.legacyProvenance).batchId !== input.sharedOperationId) fail('GIVEAWAY_HISTORY_INVALID');
    // Only the exact closed archive may be present. No native participation,
    // counted message, reward or pending activity is silently overwritten.
    for (const [table, rows] of Object.entries(preimage.rows)) {
      if (['rewards', 'counted', 'deferred'].includes(table) && rows.length) fail('DOMAIN_NOT_EMPTY');
      if (rows.some((row: unknown) => record(row).sessionId !== session.id || record(record(row).legacyProvenance).batchId !== input.sharedOperationId)) fail('DOMAIN_NOT_EMPTY');
    }
    facts = { sharedOperationId: input.sharedOperationId, sessionId: session.id, historyHash: shared!.postHash };
  }
  return { bound, preimage, facts, edition, fingerprint: hash({ inputHash: checked.inputHash, preimage, facts }) };
}

async function locks(tx: Tx, input: RecoveryDomainInput) {
  await tx.$executeRaw`SET LOCAL statement_timeout='5000ms'`;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`twitch-provision:${input.twitchUserId}`},0))::text`;
  if (input.domain === 'EVENT') await tx.$queryRaw`SELECT event_edition_id FROM event_game_b_daily_states ORDER BY event_edition_id,business_date FOR UPDATE`;
  if (input.domain === 'GIVEAWAY') await tx.$executeRaw`SELECT pg_advisory_xact_lock(7861450867001::bigint)`;
  // No native Boss is mutated here. The Player lock serializes the beneficiary
  // with attacks/rewards without introducing a Boss -> Player lock inversion.
  const ids = [...new Set([input.playerId, input.operatorPlayerId])].sort();
  await tx.$queryRaw(Prisma.sql`SELECT id FROM players WHERE id IN (${Prisma.join(ids.map(id => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`);
  await tx.$queryRaw`SELECT id FROM twitch_native_authorities WHERE id='twitch-commands' FOR UPDATE`;
}

async function prior(tx: Tx, operationId: string, input: RecoveryDomainInput, checked: ReturnType<typeof inputs>, fingerprint: string) {
  const row = await tx.migrationBatch.findUnique({ where: { id: operationId } });
  if (!row) return null;
  const saved = journalSchema.parse(row.summary);
  if (row.migratorVersion !== version || row.mode !== 'CUTOVER' || row.status !== 'COMPLETED'
    || row.snapshotHash !== checked.source.snapshot.hash || saved.state !== 'APPLIED'
    || saved.inputHash !== checked.inputHash || saved.fingerprint !== fingerprint || saved.playerId !== input.playerId || saved.domain !== input.domain) fail('JOURNAL_CONFLICT');
  // Native actions after opening are acquired: replay returns the old result,
  // never a second baseline credit or an attempt to restore the old postimage.
  await binding(tx, input, checked);
  return { status: 'APPLIED' as const, replayed: true, operationId, backupHash: saved.backupHash, result: saved.result };
}

export async function planRecoveryDomain(db: PrismaClient, config: AppConfig, input: RecoveryDomainInput) {
  const checked = inputs(input);
  return db.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    await new TwitchNativeAuthority(tx as PrismaClient, config).requireOperator(tx, input.operatorPlayerId);
    const plan = await inspect(tx, input, checked);
    return { status: 'READY' as const, domain: input.domain, playerId: input.playerId, fingerprint: plan.fingerprint, facts: json(plan.facts) };
  }, { ...options, isolationLevel: 'RepeatableRead' });
}

export async function applyRecoveryDomain(db: PrismaClient, config: AppConfig, input: ApplyInput, writeBackup: (backup: RecoveryDomainBackup) => Promise<void>) {
  const checked = inputs(input); z.uuid().parse(input.operationId); digest.parse(input.expectedFingerprint);
  if (input.acknowledgement !== STREAMERBOT_PATH_DISABLED) fail('ACK_REQUIRED');
  const saveBackup = oncePerBackup(writeBackup);
  return recoveryTransaction(db, async tx => {
    await locks(tx, input);
    await new TwitchNativeAuthority(tx as PrismaClient, config).requireOperator(tx, input.operatorPlayerId);
    const replay = await prior(tx, input.operationId, input, checked, input.expectedFingerprint);
    if (replay) return replay;
    await requireCommunityMutationGates(tx, config, input);
    if (await tx.twitchEventReceipt.count({ where: { payloadMinimal: { path: ['recoveryDeferred', 'playerId'], equals: input.playerId } } })) fail('DEFERRED_RECEIPT_MARKER_REQUIRES_REVIEW');
    const plan = await inspect(tx, input, checked);
    if (plan.fingerprint !== input.expectedFingerprint) fail('PLAN_CHANGED');
    const body = { kind: kind as 'RECOVERY_DOMAIN', version: 1 as const, operationId: input.operationId, operatorPlayerId: input.operatorPlayerId,
      playerId: input.playerId, twitchUserId: input.twitchUserId, importId: input.importId, domain: input.domain,
      snapshotHash: checked.source.snapshot.hash, populationHash: checked.source.populationHash, inputHash: checked.inputHash,
      fingerprint: plan.fingerprint, createdAt: checked.now.toISOString(), preimage: json(plan.preimage), facts: json(plan.facts) };
    const backup = recoveryDomainBackupSchema.parse({ ...body, hash: hash(body) });
    await saveBackup(backup);
    let result: Prisma.InputJsonValue;
    if (input.domain === 'EVENT') {
      const fact = eventFacts(checked, plan.bound.proof.legacyKey, plan.bound.proof.run.importedAt), edition = plan.edition!;
      if (fact.joined) {
        const provenance = { source: 'monthly_events_data.json', operationId: input.operationId, snapshotHash: checked.source.snapshot.hash };
        await tx.eventParticipant.create({ data: { eventEditionId: edition.id, playerId: input.playerId, points: fact.points, joinedAt: new Date(fact.joinedAt!), legacyProvenance: provenance } });
        await tx.playerEventCurrencyBalance.create({ data: { playerId: input.playerId, eventDefinitionId: edition.eventDefinitionId, amount: BigInt(fact.currency) } });
        for (const milestone of fact.milestones) await tx.eventMilestoneClaim.create({ data: { eventEditionId: edition.id, playerId: input.playerId, milestone, origin: 'LEGACY', operationId: null, claimedAt: null, legacyProvenance: provenance } });
      }
      result = { joined: fact.joined, points: fact.points, currency: fact.currency, claims: fact.milestones.length, payments: 0 };
    } else if (input.domain === 'BOSS') {
      const fact = recoveryBossFacts(checked.source.snapshot, plan.bound.proof.legacyName, plan.bound.proof.run.importedAt, checked.now);
      await tx.playerBossStats.create({ data: { playerId: input.playerId, ...fact.stats } });
      result = json({ ...fact.counts, payments: 0, nativeBossesChanged: 0 });
    } else result = { opened: true, payments: 0, historyRetained: true };
    await tx.player.update({ where: { id: input.playerId }, data: { legacyRecovery: { ...plan.bound.marker, restrictedDomains: plan.bound.marker.restrictedDomains.filter(d => d !== input.domain) } } });
    const postHash = hash(await state(tx, input.playerId, input.domain));
    const summary = journalSchema.parse({ kind, version: 1, state: 'APPLIED', playerId: input.playerId, domain: input.domain,
      inputHash: checked.inputHash, fingerprint: plan.fingerprint, backupHash: backup.hash, postHash, facts: json(plan.facts), result });
    await tx.migrationBatch.create({ data: { id: input.operationId, snapshotHash: checked.source.snapshot.hash, status: 'COMPLETED', mode: 'CUTOVER', migratorVersion: version, completedAt: checked.now, summary } });
    await tx.twitchNativeAudit.create({ data: { actorPlayerId: input.operatorPlayerId, action: `RECOVERY_${input.domain}_APPLIED:${input.operationId}`, mode: 'OFF', revision: input.expectedRevision, acknowledgement: input.acknowledgement } });
    return { status: 'APPLIED' as const, replayed: false, operationId: input.operationId, backupHash: backup.hash, result };
  });
}

export async function rollbackRecoveryDomain(db: PrismaClient, config: AppConfig, input: RecoveryDomainInput, rawBackup: RecoveryDomainBackup) {
  const checked = inputs(input), backup = recoveryDomainBackupSchema.parse(rawBackup);
  const { hash: checksum, ...body } = backup;
  if (hash(body) !== checksum || backup.inputHash !== checked.inputHash || backup.domain !== input.domain || backup.playerId !== input.playerId) fail('BACKUP_CONFLICT');
  return recoveryTransaction(db, async tx => {
    await locks(tx, input); await requireCommunityMutationGates(tx, config, input); await binding(tx, input, checked);
    const row = await tx.migrationBatch.findUniqueOrThrow({ where: { id: backup.operationId } }), saved = journalSchema.parse(row.summary);
    if (row.migratorVersion !== version || saved.state !== 'APPLIED' || saved.inputHash !== checked.inputHash || saved.backupHash !== checksum
      || saved.postHash !== hash(await state(tx, input.playerId, input.domain))) fail('ROLLBACK_POSTIMAGE_CHANGED');
    const before = record(backup.preimage), beforeRows = record(before.rows), oldPlayer = record(before.player);
    if (Object.values(beforeRows).some(rows => !Array.isArray(rows) || input.domain !== 'GIVEAWAY' && rows.length) || !Array.isArray(before.operations) || before.operations.length) fail('BACKUP_NOT_EMPTY');
    const marker = playerRecoverySchema.parse(oldPlayer.legacyRecovery);
    if (input.domain === 'EVENT') {
      await tx.eventMilestoneClaim.deleteMany({ where: { playerId: input.playerId } });
      await tx.eventParticipant.deleteMany({ where: { playerId: input.playerId } });
      await tx.playerEventCurrencyBalance.deleteMany({ where: { playerId: input.playerId } });
    } else if (input.domain === 'BOSS') await tx.playerBossStats.delete({ where: { playerId: input.playerId } });
    await tx.player.update({ where: { id: input.playerId }, data: { legacyRecovery: marker, updatedAt: new Date(String(oldPlayer.updatedAt)) } });
    if (hash(await state(tx, input.playerId, input.domain)) !== hash(backup.preimage)) fail('ROLLBACK_NOT_EXACT');
    await tx.migrationBatch.update({ where: { id: backup.operationId }, data: { summary: { ...saved, state: 'ROLLED_BACK', rolledBackAt: checked.now.toISOString() } } });
    return { status: 'ROLLED_BACK' as const, operationId: backup.operationId };
  });
}
