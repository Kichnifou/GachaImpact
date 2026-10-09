import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import type { AppConfig } from '../../config/environment.js';
import { STREAMERBOT_PATH_DISABLED } from '../twitch/twitch-native-authority.js';
import { communityHash as hash, requireCommunityMutationGates, verifyNativeCommunityProof, type CommunityProof } from './legacy-community-proof.js';
import { legacyBannerEvidence, planLegacyVotes } from './legacy-banner-reconciliation.js';
import type { Snapshot } from './streamerbot-snapshot.js';
import { captureTargetedPlayerRows, rowGraphIdentifier } from './targeted-player-rows.js';
import { verifyLegacyBannerVoters, type LegacyBannerVoterProof } from './legacy-banner-vote-proof.js';
import { bannerVoteContributions } from '../gacha/banner-vote-contributions.js';

type Tx = Prisma.TransactionClient;
const kind = 'LEGACY_BANNER_REPLACEMENT' as const, version = 'r1061-banner-v2';
const fail = (reason: string): never => { throw Error(`LEGACY_BANNER_${reason}`); };
type Input = { snapshot: Snapshot; bindings: readonly CommunityProof[]; voterProof?: LegacyBannerVoterProof; operatorPlayerId: string; expectedRevision: number; expectedNativeRotationId: string; now?: Date };
const options = { isolationLevel: 'Serializable' as const, timeout: 30_000 };
const hashText = z.string().regex(/^[a-f0-9]{64}$/);
const protectedTables = ['players', 'player_gacha_states', 'player_resource_balances', 'player_characters', 'player_economy_stats',
  'player_progression', 'pull_operations', 'pull_results', 'business_operations', 'resource_movements'] as const;

/** Caller time is only a loopback/private fixture facility, never a production clock. */
export async function readBannerReplacementTime(tx: Tx, privateNow?: Date): Promise<Date> {
  const row = (await tx.$queryRaw<{ now: Date; schema: string; host: string | null }[]>`
    SELECT clock_timestamp() AS now,current_schema() AS schema,host(inet_server_addr()) AS host`)[0]!;
  if (privateNow !== undefined) {
    if (!/^batch_test_[0-9a-f]{32}$/.test(row.schema) || !['127.0.0.1', '::1'].includes(row.host ?? '')
      || !z.date().safeParse(privateNow).success) return fail('PRIVATE_CLOCK_ONLY');
    return new Date(privateNow);
  }
  return row.now;
}
async function currentWeek(tx: Tx, input: Input, evidence: { startsAt: Date; endsAt: Date }) {
  const now = await readBannerReplacementTime(tx, input.now);
  if (now < evidence.startsAt || now >= evidence.endsAt) return fail('SOURCE_WEEK_NOT_CURRENT');
  return now;
}

async function protectedState(tx: Tx) {
  const ids = (await tx.player.findMany({ select: { id: true }, orderBy: { id: 'asc' } })).map(p => p.id);
  const graph = await captureTargetedPlayerRows(tx, ids, protectedTables);
  // PostgreSQL removes the two target fields before serialization; int8 never passes through JS Number.
  const gacha = (await tx.$queryRaw<{ row: string }[]>`SELECT (to_jsonb(t)-'selected_banner_character_id'-'updated_at')::text AS row FROM player_gacha_states t ORDER BY player_id`).map(r => r.row);
  const { player_gacha_states: _targets, ...other } = graph.tables;
  return { graph, immutableHash: hash({ other, gacha }) };
}
const bindingHash = (input: Input) => hash({ snapshotHash: input.snapshot.hash, operatorPlayerId: input.operatorPlayerId, expectedRevision: input.expectedRevision,
  expectedNativeRotationId: input.expectedNativeRotationId, voterProof: input.voterProof ? { ...input.voterProof, historicalSnapshot: input.voterProof.historicalSnapshot.hash } : null,
  bindings: input.bindings.map(b => ({ playerId: b.playerId, twitchUserId: b.twitchUserId, importId: b.importId, importReport: b.importReport })).sort((a, b) => a.playerId.localeCompare(b.playerId)) });

async function inspect(tx: Tx, input: Input) {
  await readBannerReplacementTime(tx, input.now);
  const verified = [];
  for (const binding of input.bindings) {
    if (binding.snapshot.hash !== input.snapshot.hash) return fail('SOURCE_BINDING_CONFLICT');
    verified.push(await verifyNativeCommunityProof(tx, binding));
  }
  if (!verified.length || new Set(verified.map(v => v.identity.playerId)).size !== verified.length) return fail('DEFINITIVE_BINDINGS_REQUIRED');
  const evidence = legacyBannerEvidence(input.snapshot, await tx.character.findMany());
  const checkedAt = await currentWeek(tx, input, evidence);
  const native = await tx.bannerRotation.findUnique({ where: { id: input.expectedNativeRotationId }, include: { featuredCharacters: true, votes: true } });
  if (!native || native.status !== 'ACTIVE' || native.supersededAt || native.startsAt.getTime() !== evidence.startsAt.getTime() || native.endsAt.getTime() !== evidence.endsAt.getTime()) return fail('EXACT_ACTIVE_NATIVE_REQUIRED');
  if (native.legacyProvenance && typeof native.legacyProvenance === 'object' && !Array.isArray(native.legacyProvenance) && native.legacyProvenance.source === 'genshin_characters.json') return fail('ALREADY_LEGACY');
  if (await tx.bannerRotation.count({ where: { status: 'ACTIVE' } }) !== 1) return fail('MULTIPLE_ACTIVE_AUTHORITIES');
  const external = input.voterProof ? await verifyLegacyBannerVoters(tx, input.snapshot, evidence, input.voterProof, checkedAt) : [];
  for (const binding of verified) {
    const source = external.find(v => v.twitchUserId === binding.identity.twitchUserId);
    if (input.voterProof && (!source || source.playerId !== binding.identity.playerId)) return fail('SOURCE_BINDING_CONFLICT');
  }
  if (await tx.externalBannerVote.count({ where: { cycleStartsAt: evidence.startsAt } })) return fail('SOURCE_ALREADY_REGISTERED');
  const votePlan = planLegacyVotes(evidence, input.voterProof
    ? external.filter(v => v.playerId).map(v => ({ legacyUsername: v.legacyKey, playerId: v.playerId! }))
    : verified.map(v => ({ legacyUsername: v.legacyName, playerId: v.identity.playerId })), native.votes)
    .map(v => ({ ...v, action: v.action === 'EXCLUDED' && external.some(e => e.legacyKey === v.legacyKey && !e.deferred)
      ? 'EXTERNAL_PROVEN' as const : v.action }));
  if (votePlan.some(v => v.action === 'CONFLICT' || v.action === 'INELIGIBLE')) return fail('VOTE_COLLISION');
  const voterIds = [...new Set(native.votes.map(v => v.playerId))];
  if (await tx.player.count({ where: { id: { in: voterIds }, status: 'ACTIVE' } }) !== voterIds.length) return fail('NATIVE_VOTER_NOT_ACTIVE');
  const catalog = await tx.character.findMany({ where: { id: { in: native.votes.map(v => v.characterId) } } });
  const five = new Set(evidence.featured.filter(c => c.rarity === 5).map(c => c.id));
  if (native.votes.some(v => five.has(v.characterId) || !catalog.some(c => c.id === v.characterId && c.rarity === 5 && c.isActive))) return fail('NATIVE_VOTE_NOW_INELIGIBLE');
  const state = await protectedState(tx);
  const targets = await tx.playerGachaState.findMany({ where: { player: { status: { not: 'ARCHIVED' } }, selectedBannerCharacterId: { not: null, notIn: [...five] } }, select: { playerId: true }, orderBy: { playerId: 'asc' } });
  const deferredLegacyVotes = votePlan.filter(v => v.action === 'EXCLUDED').length;
  const plan = { status: deferredLegacyVotes ? 'BLOCKED_VOTES' as const : 'READY' as const, oldRotationId: native.id, week: evidence.week,
    applicationGate: deferredLegacyVotes ? 'LEGACY_VOTES_REQUIRE_DECISION' as const : null,
    legacyVoteDisposition: votePlan.map(v => ({ ...v, action: v.action === 'EXCLUDED' ? 'DEFERRED' as const : v.action })),
    preservedPullOperations: state.graph.tables.pull_operations!.filter(row => (JSON.parse(row) as { banner_rotation_id: string }).banner_rotation_id === native.id).length,
    preservedNativeVotes: native.votes.length, importedLegacyVotes: votePlan.filter(v => v.action === 'IMPORT').length,
    retainedLegacyVotes: votePlan.filter(v => v.action === 'RETAIN').length, unresolvedLegacyVotes: deferredLegacyVotes,
    externalProvenVotes: votePlan.filter(v => v.action === 'EXTERNAL_PROVEN').length,
    invalidTargetPlayerIds: targets.map(t => t.playerId), fingerprint: hash({ bindingHash: bindingHash(input), verified, external, evidence, native, state: state.graph.hash, targets }) };
  return { plan, native, evidence, votePlan, state, external };
}
export async function planLegacyBannerReplacement(db: PrismaClient, input: Input) {
  return db.$transaction(async tx => { await tx.$executeRaw`SET TRANSACTION READ ONLY`; await tx.$executeRaw`SET LOCAL statement_timeout='5000ms'`; return (await inspect(tx, input)).plan; }, { ...options, isolationLevel: 'RepeatableRead' });
}
async function locks(tx: Tx, input: Input) {
  await tx.$executeRaw`SET LOCAL statement_timeout='5000ms'`;
  for (const id of [...new Set([...input.bindings.map(b => b.twitchUserId), ...input.voterProof?.voterReports.flatMap(r => r.users.map(u => u.twitchUserId)) ?? []])].sort()) await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`twitch-provision:${id}`},0))::text`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(70422401)`; // Same cycle lock as native votes and scheduler.
  await tx.$executeRaw`LOCK TABLE players IN SHARE ROW EXCLUSIVE MODE`; // No new Player can pull outside the bounded row set.
  await tx.$queryRaw`SELECT id FROM players ORDER BY id FOR UPDATE`; // Native pulls hold this same row lock.
  // A selector can commit while this SERIALIZABLE transaction waits for the
  // cycle. Lock its updated row too, so a stale snapshot fails before backup,
  // including when the selected character stays compatible with the new cycle.
  await tx.$queryRaw`SELECT player_id FROM player_gacha_states ORDER BY player_id FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM twitch_native_authorities WHERE id='twitch-commands' FOR UPDATE`;
}
async function currentHash(tx: Tx, input: Input, newRotationId: string) {
  const rotations = await tx.bannerRotation.findMany({ where: { id: { in: [input.expectedNativeRotationId, newRotationId] } }, orderBy: { id: 'asc' }, include: { featuredCharacters: { orderBy: [{ rarity: 'desc' }, { slot: 'asc' }] }, votes: { orderBy: { playerId: 'asc' } } } });
  const external = await tx.externalBannerVote.findMany({ where: { bannerRotationId: { in: [input.expectedNativeRotationId, newRotationId] } }, orderBy: { id: 'asc' } });
  return hash({ rotations, external, protected: (await protectedState(tx)).graph.hash });
}
export const legacyBannerReplacementBackupSchema = z.object({ kind: z.literal(kind), version: z.literal(2), operationId: z.uuid(), inputHash: hashText, fingerprint: hashText,
  oldRotationId: z.uuid(), newRotationId: z.uuid(), schema: z.string(), priorStateHash: hashText, immutableHash: hashText, targetRows: z.array(z.string()),
  nativeRotationProof: z.string(), protectedPlayerRows: z.record(z.string(), z.array(z.string())), createdAt: z.iso.datetime(), hash: hashText }).strict();
export type LegacyBannerReplacementBackup = z.infer<typeof legacyBannerReplacementBackupSchema>;
const journalSchema = z.object({ kind: z.literal(kind), state: z.enum(['APPLIED', 'ROLLED_BACK']), inputHash: hashText, fingerprint: hashText, backupHash: hashText,
  newRotationId: z.uuid(), oldRotationId: z.uuid(), postHash: hashText, rollbackHash: hashText.optional(), preservedNativeVotes: z.number().int(), importedLegacyVotes: z.number().int(), unresolvedLegacyVotes: z.number().int() }).strict();

/** Owner-authorized direction only; no route/command/CLI wiring. Public apply remains a separate reviewed mission. */
export async function applyLegacyBannerReplacement(db: PrismaClient, config: AppConfig, input: Input & { operationId: string; expectedFingerprint: string; acknowledgement: string }, writeBackup: (backup: LegacyBannerReplacementBackup) => Promise<void>) {
  if (!z.uuid().safeParse(input.operationId).success || !hashText.safeParse(input.expectedFingerprint).success || input.acknowledgement !== STREAMERBOT_PATH_DISABLED) return fail('CONFIRMATIONS_REQUIRED');
  return db.$transaction(async tx => {
    await locks(tx, input); await requireCommunityMutationGates(tx, config, input);
    await readBannerReplacementTime(tx, input.now);
    const cycle = await tx.bannerRotation.findUniqueOrThrow({ where: { id: input.expectedNativeRotationId } });
    await currentWeek(tx, input, cycle);
    const prior = await tx.migrationBatch.findUnique({ where: { id: input.operationId } });
    if (prior) {
      const j = journalSchema.safeParse(prior.summary);
      if (prior.mode !== 'CUTOVER' || prior.status !== 'COMPLETED' || prior.migratorVersion !== version || prior.snapshotHash !== input.snapshot.hash || !j.success || j.data.state !== 'APPLIED'
        || j.data.inputHash !== bindingHash(input) || j.data.fingerprint !== input.expectedFingerprint || j.data.oldRotationId !== input.expectedNativeRotationId
        || j.data.postHash !== await currentHash(tx, input, j.data.newRotationId)) return fail('JOURNAL_OR_POSTIMAGE_CONFLICT');
      return { replayed: true, rotationId: j.data.newRotationId, backupHash: j.data.backupHash };
    }
    const { plan, native, evidence, votePlan, state, external } = await inspect(tx, input);
    if (plan.fingerprint !== input.expectedFingerprint) return fail('PLAN_CHANGED');
    if (plan.applicationGate) return fail(plan.applicationGate);
    const newRotationId = randomUUID(), now = await currentWeek(tx, input, evidence);
    const targetSet = new Set(plan.invalidTargetPlayerIds);
    const targetRows = state.graph.tables.player_gacha_states!.filter(row => targetSet.has((JSON.parse(row) as { player_id: string }).player_id));
    const body = { kind, version: 2 as const, operationId: input.operationId, inputHash: bindingHash(input), fingerprint: plan.fingerprint, oldRotationId: native.id,
      newRotationId, schema: state.graph.schema, priorStateHash: await currentHash(tx, input, newRotationId), immutableHash: state.immutableHash, targetRows,
      nativeRotationProof: JSON.stringify(native), protectedPlayerRows: state.graph.tables, createdAt: now.toISOString() };
    const backup = legacyBannerReplacementBackupSchema.parse({ ...body, hash: hash(body) });
    await writeBackup(backup);
    await currentWeek(tx, input, evidence); // A slow backup must not cross Monday unnoticed.
    await tx.bannerRotation.update({ where: { id: native.id }, data: { status: 'ENDED', supersededAt: now } });
    const slots = { 4: 0, 5: 0 };
    await tx.bannerRotation.create({ data: { id: newRotationId, startsAt: evidence.startsAt, endsAt: evidence.endsAt, status: 'ACTIVE', generationVoteSnapshot: Prisma.JsonNull,
      legacyProvenance: { source: 'genshin_characters.json', kind, operationId: input.operationId, snapshotHash: input.snapshot.hash, replacedNativeRotationId: native.id, selectionSourceKnown: false },
      featuredCharacters: { create: evidence.featured.map(c => ({ characterId: c.id, rarity: c.rarity, slot: ++slots[c.rarity as 4 | 5], selectionSource: 'LEGACY_UNKNOWN' })) } } });
    for (const vote of native.votes) await tx.bannerVote.create({ data: { bannerRotationId: newRotationId, playerId: vote.playerId, characterId: vote.characterId,
      sourceChannel: vote.sourceChannel, votedAt: vote.votedAt, legacyProvenance: { kind, originalVoteId: vote.id, originalRotationId: native.id, originalProvenance: vote.legacyProvenance } } });
    for (const vote of votePlan.filter(v => v.action === 'IMPORT')) await tx.bannerVote.create({ data: { bannerRotationId: newRotationId, playerId: vote.playerId!, characterId: vote.characterId,
      sourceChannel: 'MIGRATION', votedAt: null, legacyProvenance: { source: 'banner_votes.json.voters', snapshotHash: input.snapshot.hash, weekId: evidence.week, operationId: input.operationId, voteTimeKnown: false } } });
    for (const vote of external) await tx.externalBannerVote.create({ data: { cycleStartsAt: evidence.startsAt, bannerRotationId: newRotationId,
      twitchUserId: vote.twitchUserId, characterId: vote.characterId, playerId: vote.playerId, proofHash: vote.proofHash,
      provenance: { ...vote.provenance, operationId: input.operationId },
      bindingHistory: vote.playerId ? [{ playerId: vote.playerId, resolutionId: null }] : [] } });
    await bannerVoteContributions(tx, newRotationId);
    if (plan.invalidTargetPlayerIds.length) await tx.playerGachaState.updateMany({ where: { playerId: { in: plan.invalidTargetPlayerIds } }, data: { selectedBannerCharacterId: null } });
    if ((await protectedState(tx)).immutableHash !== state.immutableHash || await tx.bannerRotation.count({ where: { status: 'ACTIVE' } }) !== 1) return fail('PULL_OR_GAMEPLAY_CHANGED');
    const postHash = await currentHash(tx, input, newRotationId);
    await tx.migrationBatch.create({ data: { id: input.operationId, mode: 'CUTOVER', status: 'COMPLETED', snapshotHash: input.snapshot.hash, migratorVersion: version, completedAt: now,
      summary: { kind, state: 'APPLIED', inputHash: backup.inputHash, fingerprint: backup.fingerprint, backupHash: backup.hash, newRotationId, oldRotationId: native.id, postHash,
        preservedNativeVotes: plan.preservedNativeVotes, importedLegacyVotes: plan.importedLegacyVotes, unresolvedLegacyVotes: plan.unresolvedLegacyVotes } } });
    await tx.twitchNativeAudit.create({ data: { actorPlayerId: input.operatorPlayerId, action: `LEGACY_BANNER_REPLACEMENT_APPLIED:${input.operationId}`, mode: 'OFF', revision: input.expectedRevision, acknowledgement: input.acknowledgement } });
    await currentWeek(tx, input, evidence); // Refuse an expiry during writes, rolling everything back.
    return { replayed: false, rotationId: newRotationId, backupHash: backup.hash };
  }, options);
}

export async function rollbackLegacyBannerReplacement(db: PrismaClient, config: AppConfig, input: Input & { backup: LegacyBannerReplacementBackup; expectedBackupHash: string; acknowledgement: string }) {
  const parsed = legacyBannerReplacementBackupSchema.safeParse(input.backup);
  if (!parsed.success || input.acknowledgement !== STREAMERBOT_PATH_DISABLED) return fail('BACKUP_INVALID');
  const backup = parsed.data, { hash: expected, ...body } = backup;
  if (hash(body) !== expected || expected !== input.expectedBackupHash || backup.inputHash !== bindingHash(input) || backup.oldRotationId !== input.expectedNativeRotationId) return fail('BACKUP_INVALID');
  return db.$transaction(async tx => {
    await locks(tx, input); await requireCommunityMutationGates(tx, config, input);
    await readBannerReplacementTime(tx, input.now);
    const cycle = await tx.bannerRotation.findUniqueOrThrow({ where: { id: backup.oldRotationId } });
    await currentWeek(tx, input, cycle);
    const prior = await tx.migrationBatch.findUniqueOrThrow({ where: { id: backup.operationId } }), j = journalSchema.safeParse(prior.summary);
    if (prior.mode !== 'CUTOVER' || prior.status !== 'COMPLETED' || prior.snapshotHash !== input.snapshot.hash || prior.migratorVersion !== version || !j.success
      || j.data.inputHash !== backup.inputHash || j.data.backupHash !== backup.hash || j.data.fingerprint !== backup.fingerprint || j.data.newRotationId !== backup.newRotationId || j.data.oldRotationId !== backup.oldRotationId) return fail('JOURNAL_OR_POSTIMAGE_CONFLICT');
    const current = await currentHash(tx, input, backup.newRotationId);
    if (j.data.state === 'ROLLED_BACK') {
      if (current !== j.data.rollbackHash) return fail('POSTIMAGE_CHANGED');
      return { replayed: true };
    }
    if (current !== j.data.postHash) return fail('POSTIMAGE_CHANGED');
    const schema = (await tx.$queryRaw<{ schema: string }[]>`SELECT current_schema() AS schema`)[0]?.schema;
    if (schema !== backup.schema) return fail('BACKUP_SCHEMA_MISMATCH');
    // Only the replacement's copied/imported ballots disappear; the original native ballots remain.
    await tx.bannerVote.deleteMany({ where: { bannerRotationId: backup.newRotationId } });
    await tx.externalBannerVote.deleteMany({ where: { bannerRotationId: backup.newRotationId } });
    await tx.bannerRotation.delete({ where: { id: backup.newRotationId } }); // FK refuses any later pull/reference atomically.
    await tx.bannerRotation.update({ where: { id: backup.oldRotationId }, data: { status: 'ACTIVE', supersededAt: null } });
    if (backup.targetRows.length) await tx.$executeRawUnsafe(`UPDATE ${rowGraphIdentifier(schema)}.player_gacha_states t SET selected_banner_character_id=p.selected_banner_character_id,updated_at=p.updated_at FROM json_populate_recordset(NULL::${rowGraphIdentifier(schema)}.player_gacha_states,$1::json) p WHERE t.player_id=p.player_id`, `[${backup.targetRows.join(',')}]`);
    const restored = await currentHash(tx, input, backup.newRotationId);
    if (restored !== backup.priorStateHash || (await protectedState(tx)).immutableHash !== backup.immutableHash) return fail('RESTORATION_MISMATCH');
    await tx.migrationBatch.update({ where: { id: backup.operationId }, data: { summary: { ...j.data, state: 'ROLLED_BACK', rollbackHash: restored } } });
    await tx.twitchNativeAudit.create({ data: { actorPlayerId: input.operatorPlayerId, action: `LEGACY_BANNER_REPLACEMENT_ROLLED_BACK:${backup.operationId}`, mode: 'OFF', revision: input.expectedRevision, acknowledgement: input.acknowledgement } });
    return { replayed: false };
  }, options);
}
