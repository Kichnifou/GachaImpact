import { createHash } from 'node:crypto';
import { z } from 'zod';
import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import type { AppConfig } from '../../config/environment.js';
import { getBusinessDate } from '../../domain/time/business-date.js';
import { playerRecoverySchema } from '../player/player-recovery-readiness.js';
import { STREAMERBOT_PATH_DISABLED, TwitchNativeAuthority } from '../twitch/twitch-native-authority.js';
import { communityHash as hash, communityRecord as record, requireCommunityMutationGates } from './legacy-community-proof.js';
import { parseLegacyParisInstant } from './legacy-box-mapping.js';
import { normalizeLegacyName, resolveSnapshotViewer } from './streamerbot-snapshot.js';
import { validateRecoverySource, type RecoverySource } from './legacy-recovery.js';
import { applyLegacyGiveaway, type LegacyGiveawayPlan } from './legacy-giveaway-apply.js';
import { recoveryBossFacts } from './legacy-recovery-boss-facts.js';
import { oncePerBackup, recoveryTransaction } from './legacy-recovery-transaction.js';

type Tx = Prisma.TransactionClient;
export type SharedRecoveryKind = 'BOSS_HISTORY' | 'GIVEAWAY_HISTORY' | 'EVENT_MESSAGES';
export type SharedRecoveryInput = { source: RecoverySource; kind: SharedRecoveryKind; operatorPlayerId: string; expectedRevision: number; now?: Date };
type ApplyInput = SharedRecoveryInput & { operationId: string; expectedFingerprint: string; acknowledgement: string };
const version = 'r1063-shared-v1', options = { isolationLevel: 'Serializable' as const, timeout: 30_000 };
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const kindSchema = z.enum(['BOSS_HISTORY', 'GIVEAWAY_HISTORY', 'EVENT_MESSAGES']);
function fail(reason: string): never { throw Error('RECOVERY_SHARED_' + reason); }
const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value, (_key, v: unknown) => typeof v === 'bigint' ? v.toString() : v)) as Prisma.InputJsonValue;
export const sharedRecoveryBackupSchema = z.object({ version: z.literal(1), kind: kindSchema, operationId: z.uuid(), operatorPlayerId: z.uuid(),
  inputHash: digest, snapshotHash: digest, fingerprint: digest, createdAt: z.iso.datetime(), preimage: z.json(), facts: z.json(), hash: digest }).strict();
export type SharedRecoveryBackup = z.infer<typeof sharedRecoveryBackupSchema>;
const journalSchema = z.object({ version: z.literal(1), kind: kindSchema, state: z.enum(['APPLIED', 'ROLLED_BACK']),
  inputHash: digest, sourceKey: digest, fingerprint: digest, backupHash: digest, postHash: digest, facts: z.json(), result: z.json(), rolledBackAt: z.iso.datetime().optional() }).strict();

function checked(input: SharedRecoveryInput) {
  kindSchema.parse(input.kind); z.uuid().parse(input.operatorPlayerId); z.number().int().positive().parse(input.expectedRevision);
  const source = validateRecoverySource(input.source), now = input.now ?? new Date();
  const event = record(source.snapshot.sources['monthly_events_data.json']), giveaway = record(source.snapshot.sources['giveaway.json']);
  const sourceKey = hash({ kind: input.kind, source: input.kind === 'BOSS_HISTORY' ? source.snapshot.sources['monthly_boss.json']
    : input.kind === 'EVENT_MESSAGES' ? { year: event.year, month: event.month, messages: event.messages }
      : { openedAt: giveaway.openedAt, closedAt: giveaway.closedAt, openedBy: giveaway.openedBy, closedBy: giveaway.closedBy } });
  return { ...source, now, inputHash: hash({ kind: input.kind, operatorPlayerId: input.operatorPlayerId, sourceOperationId: input.source.operationId,
    snapshotHash: source.snapshot.hash, populationHash: source.populationHash }), sourceOperationId: input.source.operationId, sourceKey };
}

/** Source names are resolved only after the frozen population and live immutable
 * identity have selected the canonical Player. Archives never receive a write. */
async function mappings(tx: Tx, proof: ReturnType<typeof checked>) {
  const ids = proof.population.approved.map(m => m.twitchUserId);
  const [identities, targets, runs, resolutions] = await Promise.all([
    tx.twitchIdentity.findMany({ where: { twitchUserId: { in: ids } }, include: { player: true } }),
    tx.twitchNativeTarget.findMany({ where: { twitchUserId: { in: ids } } }),
    tx.twitchCanaryImport.findMany({ where: { twitchUserId: { in: ids } }, orderBy: [{ importedAt: 'desc' }, { id: 'desc' }] }),
    tx.twitchLinkResolution.findMany({ where: { twitchUserId: { in: ids }, completedAt: { not: null } }, include: { webIdentity: true } }),
  ]);
  const result = proof.population.approved.map(member => {
    if (!proof.report.users.some(u => u.twitchUserId === member.twitchUserId)) fail('FRESH_IDENTITY_MISSING');
    const identity = identities.find(i => i.twitchUserId === member.twitchUserId), target = targets.find(t => t.twitchUserId === member.twitchUserId), run = runs.find(r => r.twitchUserId === member.twitchUserId);
    if (!identity || identity.player.status !== 'ACTIVE' || !target || target.playerId !== identity.playerId || !target.canary || target.dataAuthority !== 'NATIVE'
      || !target.transferredAt || target.acknowledgement !== STREAMERBOT_PATH_DISABLED || !run || run.playerId !== identity.playerId || run.status !== 'DATA_IMPORTED' || run.rolledBackAt) fail('CANONICAL_IDENTITY_CONFLICT');
    if (resolutions.filter(r => r.twitchUserId === member.twitchUserId).some(r => (r.choice === 'TWITCH' ? r.twitchPlayerId : r.choice === 'WEB' ? r.webPlayerId : null) !== identity.playerId || r.webIdentity.playerId !== identity.playerId)) fail('R1055_CONFLICT');
    const viewer = resolveSnapshotViewer(proof.snapshot, member.legacyLogin);
    const marker = identity.player.legacyRecovery === null ? null : playerRecoverySchema.parse(identity.player.legacyRecovery);
    if (marker !== null) {
      if (marker.operationId !== proof.sourceOperationId || marker.populationHash !== proof.populationHash || marker.snapshotHash !== proof.snapshot.hash
        || marker.importId !== run.id || marker.backupHash !== run.backupHash) fail('RECOVERY_BINDING_INVALID');
    }
    return { legacyUsername: viewer.name, legacyKey: normalizeLegacyName(viewer.name), twitchUserId: member.twitchUserId, playerId: identity.playerId,
      importedAt: run.importedAt, marker, importId: run.id };
  });
  if (new Set(result.map(r => r.playerId)).size !== result.length || new Set(result.map(r => r.legacyKey)).size !== result.length) fail('IDENTITY_COLLISION');
  return result;
}

function stableMessageId(value: unknown) {
  const h = createHash('sha256').update('r1063-event-message:' + hash(value)).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
function giveawayKey(proof: ReturnType<typeof checked>, map: Awaited<ReturnType<typeof mappings>>) {
  const source = record(proof.snapshot.sources['giveaway.json']);
  const identity = (name: unknown) => map.find(m => m.legacyKey === normalizeLegacyName(String(name)))?.twitchUserId ?? fail('GIVEAWAY_ENDPOINT_UNPROVEN');
  return 'streamerbot:giveaway:' + hash({ openedAt: source.openedAt, closedAt: source.closedAt,
    openedBy: identity(source.openedBy), closedBy: identity(source.closedBy), winner: identity(source.winner) });
}
function sourceMessages(proof: ReturnType<typeof checked>, map: Awaited<ReturnType<typeof mappings>>) {
  const source = record(proof.snapshot.sources['monthly_events_data.json']);
  if (`${source.year}-${String(source.month).padStart(2, '0')}` !== getBusinessDate(proof.now).slice(0, 7)) fail('EVENT_EDITION_NOT_CURRENT');
  const messages: { id: string; senderPlayerId: string; recipientPlayerId: string; content: string; createdAt: Date; businessDate: Date }[] = [];
  for (const [recipientName, rawRows] of Object.entries(record(source.messages))) {
    if (!Array.isArray(rawRows)) fail('MESSAGE_SOURCE_INVALID');
    for (const [index, raw] of rawRows.entries()) {
      const row = record(raw); if (row.read === true) continue;
      const sender = map.find(m => m.legacyKey === normalizeLegacyName(String(row.sender))), recipient = map.find(m => m.legacyKey === normalizeLegacyName(recipientName));
      const at = parseLegacyParisInstant(row.createdAt);
      if (!sender || !recipient || sender.playerId === recipient.playerId || !at || at >= sender.importedAt || at >= recipient.importedAt
        || typeof row.text !== 'string' || !row.text.length || row.read !== false) fail('MESSAGE_PROOF_INCOMPLETE');
      for (const endpoint of [sender, recipient]) {
        const marker = playerRecoverySchema.parse(endpoint.marker);
        if (marker.snapshotHash !== proof.snapshot.hash || marker.populationHash !== proof.populationHash || marker.importId !== endpoint.importId) fail('MESSAGE_ENDPOINT_NOT_RECOVERED');
      }
      messages.push({ id: stableMessageId({ source: proof.snapshot.hash, recipient: recipient.twitchUserId, sender: sender.twitchUserId, index, raw }),
        senderPlayerId: sender.playerId, recipientPlayerId: recipient.playerId, content: row.text, createdAt: at, businessDate: new Date(getBusinessDate(at) + 'T00:00:00Z') });
    }
  }
  return { source, messages };
}

async function scope(tx: Tx, input: SharedRecoveryInput, proof: ReturnType<typeof checked>, map: Awaited<ReturnType<typeof mappings>>) {
  if (input.kind === 'BOSS_HISTORY') return {
    bosses: await tx.monthlyBoss.findMany({ orderBy: { id: 'asc' } }),
    aggregates: await tx.bossLegacyAggregate.findMany({ orderBy: { bossId: 'asc' } }),
    contributions: await tx.bossLegacyContribution.findMany({ orderBy: [{ bossId: 'asc' }, { playerId: 'asc' }] }),
  };
  if (input.kind === 'GIVEAWAY_HISTORY') {
    const session = await tx.giveawaySession.findUnique({ where: { legacySessionKey: giveawayKey(proof, map) }, include: {
      participants: { orderBy: { playerId: 'asc' } }, chatStats: { orderBy: { playerId: 'asc' } }, wins: { orderBy: { drawIndex: 'asc' } },
      rewards: { orderBy: { id: 'asc' } }, announcements: { orderBy: { id: 'asc' } }, countedMessages: { orderBy: { twitchMessageId: 'asc' } },
      deferredMessages: { orderBy: { twitchMessageId: 'asc' } }, commandReceipts: { orderBy: { commandId: 'asc' } },
    } });
    return { session };
  }
  const ids = sourceMessages(proof, map).messages.map(m => m.id);
  return { messages: await tx.eventSocialMessage.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' } }),
    deliveries: await tx.businessOperation.findMany({ where: { operationType: 'event.message.delivery', idempotencyKey: { in: ids.map(id => `event-message-delivery:${id}`) } }, orderBy: { id: 'asc' } }) };
}

async function inspect(tx: Tx, input: SharedRecoveryInput, proof: ReturnType<typeof checked>) {
  const map = await mappings(tx, proof), preimage = await scope(tx, input, proof, map);
  let facts: Prisma.InputJsonValue;
  if (input.kind === 'BOSS_HISTORY') {
    // All source participants, including the old native canary, remain proven in
    // a separate ledger. These are not participations in the homonymous natives.
    const rows = map.map(m => ({ twitchUserId: m.twitchUserId, playerId: m.playerId, legacyKey: m.legacyKey,
      facts: recoveryBossFacts(proof.snapshot, m.legacyUsername, m.marker === null ? proof.now : m.importedAt, proof.now).facts }));
    facts = json({ source: proof.snapshot.sources['monthly_boss.json'], bindings: rows });
  } else if (input.kind === 'GIVEAWAY_HISTORY') {
    if (record(preimage).session !== null) fail('GIVEAWAY_ARCHIVE_ALREADY_EXISTS');
    const source = record(proof.snapshot.sources['giveaway.json']);
    const opened = parseLegacyParisInstant(source.openedAt), closed = parseLegacyParisInstant(source.closedAt);
    if (source.status !== 'closed' || !opened || !closed || opened > closed || closed >= proof.now || source.chatRewardsDistributed !== true) fail('GIVEAWAY_CLOSED_PROOF_REQUIRED');
    const names = [source.openedBy, source.closedBy, source.winner, source.lastParticipant,
      ...(Array.isArray(source.participants) ? source.participants : []), ...Object.keys(record(source.messageCounts))];
    if (names.some(name => typeof name !== 'string' || !map.some(m => m.legacyKey === normalizeLegacyName(name)))) fail('GIVEAWAY_ENDPOINT_UNPROVEN');
    if (!Array.isArray(source.participants) || new Set(source.participants.map(n => normalizeLegacyName(String(n)))).size !== source.participants.length
      || source.participantCount !== source.participants.length || map.some(m => names.some(n => normalizeLegacyName(String(n)) === m.legacyKey) && m.marker !== null && closed >= m.importedAt)) fail('GIVEAWAY_SOURCE_CONFLICT');
    facts = json({ source, sessionKey: giveawayKey(proof, map), bindings: map.map(({ legacyUsername, playerId, twitchUserId }) => ({ legacyUsername, playerId, twitchUserId })) });
  } else {
    if (record(preimage).messages instanceof Array && (record(preimage).messages as unknown[]).length) fail('MESSAGE_ALREADY_EXISTS');
    const { source, messages } = sourceMessages(proof, map);
    const endpoints = new Set(messages.flatMap(message => [message.senderPlayerId, message.recipientPlayerId]));
    if (map.some(member => endpoints.has(member.playerId) && member.marker?.restrictedDomains.includes('EVENT'))) fail('MESSAGE_EVENT_NOT_OPEN');
    const edition = await tx.eventEdition.findFirst({ where: { year: Number(source.year), definition: { calendarMonth: Number(source.month) }, status: 'ACTIVE', startsAt: { lte: proof.now }, endsAt: { gt: proof.now } }, select: { id: true } });
    if (!edition) fail('EVENT_EDITION_REQUIRED');
    facts = json({ source: source.messages, editionId: edition.id, messages });
  }
  return { map, preimage, facts, fingerprint: hash({ inputHash: proof.inputHash, preimage, facts }) };
}

async function locks(tx: Tx, input: SharedRecoveryInput, proof: ReturnType<typeof checked>) {
  await tx.$executeRaw`SET LOCAL statement_timeout='5000ms'`;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`recovery-shared:${proof.sourceKey}`},0))::text`;
  for (const id of proof.population.approved.map(m => m.twitchUserId).sort()) await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`twitch-provision:${id}`},0))::text`;
  if (input.kind === 'GIVEAWAY_HISTORY') await tx.$executeRaw`SELECT pg_advisory_xact_lock(7861450867001::bigint)`;
  const map = await mappings(tx, proof);
  // The Boss archive writes no Player and needs no broad Player lock. Message
  // delivery follows Game B -> Players; Giveaway follows its shared lock.
  if (input.kind === 'EVENT_MESSAGES') await tx.$queryRaw`SELECT event_edition_id FROM event_game_b_daily_states ORDER BY event_edition_id,business_date FOR UPDATE`;
  const messageIds = input.kind === 'EVENT_MESSAGES' ? sourceMessages(proof, map).messages.flatMap(m => [m.senderPlayerId, m.recipientPlayerId]) : [];
  const giveaway = record(proof.snapshot.sources['giveaway.json']);
  const giveawayNames = input.kind === 'GIVEAWAY_HISTORY' ? [giveaway.openedBy, giveaway.closedBy, giveaway.winner, giveaway.lastParticipant,
    ...(Array.isArray(giveaway.participants) ? giveaway.participants : []), ...Object.keys(record(giveaway.messageCounts))].map(n => normalizeLegacyName(String(n))) : [];
  const ids = [...new Set([input.operatorPlayerId, ...messageIds, ...map.filter(m => giveawayNames.includes(m.legacyKey)).map(m => m.playerId)])].sort();
  await tx.$queryRaw(Prisma.sql`SELECT id FROM players WHERE id IN (${Prisma.join(ids.map(id => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`);
  await tx.$queryRaw`SELECT id FROM twitch_native_authorities WHERE id='twitch-commands' FOR UPDATE`;
}

export async function planSharedRecovery(db: PrismaClient, config: AppConfig, input: SharedRecoveryInput) {
  const proof = checked(input);
  return db.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    await new TwitchNativeAuthority(tx as PrismaClient, config).requireOperator(tx, input.operatorPlayerId);
    const plan = await inspect(tx, input, proof);
    return { status: 'READY' as const, kind: input.kind, fingerprint: plan.fingerprint, facts: plan.facts };
  }, { ...options, isolationLevel: 'RepeatableRead' });
}

export async function applySharedRecovery(db: PrismaClient, config: AppConfig, input: ApplyInput, writeBackup: (backup: SharedRecoveryBackup) => Promise<void>) {
  const proof = checked(input); z.uuid().parse(input.operationId); digest.parse(input.expectedFingerprint);
  if (input.acknowledgement !== STREAMERBOT_PATH_DISABLED) fail('ACK_REQUIRED');
  const saveBackup = oncePerBackup(writeBackup);
  return recoveryTransaction(db, async tx => {
    await locks(tx, input, proof);
    await new TwitchNativeAuthority(tx as PrismaClient, config).requireOperator(tx, input.operatorPlayerId);
    const previous = await tx.migrationBatch.findUnique({ where: { id: input.operationId } });
    if (previous) {
      const saved = journalSchema.parse(previous.summary);
      if (previous.migratorVersion !== version || previous.snapshotHash !== proof.snapshot.hash || previous.status !== 'COMPLETED' || previous.mode !== 'CUTOVER'
        || saved.kind !== input.kind || saved.state !== 'APPLIED' || saved.inputHash !== proof.inputHash || saved.fingerprint !== input.expectedFingerprint) fail('JOURNAL_CONFLICT');
      return { status: 'APPLIED' as const, replayed: true, backupHash: saved.backupHash, result: saved.result };
    }
    await requireCommunityMutationGates(tx, config, input);
    if (await tx.migrationBatch.count({ where: { migratorVersion: version, status: 'COMPLETED', AND: [
      { summary: { path: ['sourceKey'], equals: proof.sourceKey } }, { summary: { path: ['state'], equals: 'APPLIED' } },
    ] } })) fail('SOURCE_ALREADY_ARCHIVED');
    const plan = await inspect(tx, input, proof);
    if (plan.fingerprint !== input.expectedFingerprint) fail('PLAN_CHANGED');
    const body = { version: 1 as const, kind: input.kind, operationId: input.operationId, operatorPlayerId: input.operatorPlayerId,
      inputHash: proof.inputHash, snapshotHash: proof.snapshot.hash, fingerprint: plan.fingerprint, createdAt: proof.now.toISOString(), preimage: json(plan.preimage), facts: plan.facts };
    const backup = sharedRecoveryBackupSchema.parse({ ...body, hash: hash(body) });
    await saveBackup(backup);
    let result: Prisma.InputJsonValue;
    if (input.kind === 'GIVEAWAY_HISTORY') {
      const partial: LegacyGiveawayPlan = { players: plan.map.map(m => ({ legacyUsername: m.legacyUsername, playerId: m.playerId, personalImport: true })),
        identityQuarantined: [], ownerDiscardedKeys: [] };
      // This owner writes only the closed history, never personal progression.
      result = await applyLegacyGiveaway(tx, proof.snapshot, partial, input.operationId, giveawayKey(proof, plan.map));
    } else if (input.kind === 'EVENT_MESSAGES') {
      const facts = record(plan.facts), messages = sourceMessages(proof, plan.map).messages;
      for (const message of messages) await tx.eventSocialMessage.create({ data: { ...message, eventEditionId: String(facts.editionId) } });
      result = { messages: messages.length, payments: 0, deliveries: 0 };
    } else result = { sourceBosses: Array.isArray(record(proof.snapshot.sources['monthly_boss.json']).history) ? (record(proof.snapshot.sources['monthly_boss.json']).history as unknown[]).length + 1 : 1, nativeBossesChanged: 0, payments: 0 };
    const postHash = hash(await scope(tx, input, proof, plan.map));
    const summary = journalSchema.parse({ version: 1, kind: input.kind, state: 'APPLIED', inputHash: proof.inputHash, sourceKey: proof.sourceKey,
      fingerprint: plan.fingerprint, backupHash: backup.hash, postHash, facts: plan.facts, result });
    await tx.migrationBatch.create({ data: { id: input.operationId, snapshotHash: proof.snapshot.hash, status: 'COMPLETED', mode: 'CUTOVER', migratorVersion: version, completedAt: proof.now, summary } });
    await tx.twitchNativeAudit.create({ data: { actorPlayerId: input.operatorPlayerId, action: `RECOVERY_${input.kind}_APPLIED:${input.operationId}`, mode: 'OFF', revision: input.expectedRevision, acknowledgement: input.acknowledgement } });
    return { status: 'APPLIED' as const, replayed: false, backupHash: backup.hash, result };
  });
}

/** A domain can open only after its separately journaled history is durable. */
export async function requireSharedRecovery(tx: Tx, operationId: string, kind: SharedRecoveryKind, snapshotHash: string) {
  const row = await tx.migrationBatch.findUnique({ where: { id: operationId } });
  if (!row || row.snapshotHash !== snapshotHash || row.migratorVersion !== version || row.status !== 'COMPLETED' || row.mode !== 'CUTOVER') fail('HISTORY_JOURNAL_REQUIRED');
  const saved = journalSchema.parse(row.summary);
  if (saved.state !== 'APPLIED' || saved.kind !== kind) fail('HISTORY_JOURNAL_REQUIRED');
  return saved;
}

export async function rollbackSharedRecovery(db: PrismaClient, config: AppConfig, input: SharedRecoveryInput, raw: SharedRecoveryBackup) {
  const proof = checked(input), backup = sharedRecoveryBackupSchema.parse(raw), { hash: checksum, ...body } = backup;
  if (hash(body) !== checksum || backup.inputHash !== proof.inputHash || backup.kind !== input.kind) fail('BACKUP_CONFLICT');
  return recoveryTransaction(db, async tx => {
    await locks(tx, input, proof); await requireCommunityMutationGates(tx, config, input);
    const map = await mappings(tx, proof), saved = await requireSharedRecovery(tx, backup.operationId, input.kind, proof.snapshot.hash);
    if (saved.backupHash !== checksum || saved.postHash !== hash(await scope(tx, input, proof, map))) fail('ROLLBACK_POSTIMAGE_CHANGED');
    const domain = input.kind === 'BOSS_HISTORY' ? 'BOSS' : input.kind === 'GIVEAWAY_HISTORY' ? 'GIVEAWAY' : null;
    if (domain && map.some(m => m.marker !== null && !playerRecoverySchema.parse(m.marker).restrictedDomains.includes(domain))) fail('HISTORY_DOMAIN_ALREADY_OPEN');
    if (input.kind === 'GIVEAWAY_HISTORY') {
      const session = await tx.giveawaySession.findUniqueOrThrow({ where: { legacySessionKey: giveawayKey(proof, map) } });
      await tx.giveawayWin.deleteMany({ where: { sessionId: session.id } });
      await tx.giveawayChatStat.deleteMany({ where: { sessionId: session.id } });
      await tx.giveawayParticipant.deleteMany({ where: { sessionId: session.id } });
      await tx.giveawaySession.delete({ where: { id: session.id } });
    } else if (input.kind === 'EVENT_MESSAGES') await tx.eventSocialMessage.deleteMany({ where: { id: { in: sourceMessages(proof, map).messages.map(m => m.id) } } });
    if (hash(await scope(tx, input, proof, map)) !== hash(backup.preimage)) fail('ROLLBACK_NOT_EXACT');
    await tx.migrationBatch.update({ where: { id: backup.operationId }, data: { summary: { ...saved, state: 'ROLLED_BACK', rolledBackAt: proof.now.toISOString() } } });
    return { status: 'ROLLED_BACK' as const };
  });
}
