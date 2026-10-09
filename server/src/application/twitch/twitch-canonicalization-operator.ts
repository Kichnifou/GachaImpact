import { createHash } from 'node:crypto';
import { operatorConsentEvidence } from './consent-activity-evidence.js';
import { isDeepStrictEqual } from 'node:util';
import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import { AppError } from '../../api/errors.js';
import type { AppConfig } from '../../config/environment.js';
import { targetedRowMetadata, rowGraphIdentifier as ident } from '../migration/targeted-player-rows.js';
import { captureCanonicalizationGraph, graphRecordsets, groups, join } from './canonicalization-graph.js';
import { assessPlayerCanonicalizationSafety, canonicalizationOwnedTables } from './player-canonicalization-safety.js';
import { receiptSafety } from './twitch-operations-in-flight.js';
import { STREAMERBOT_PATH_DISABLED, TwitchNativeAuthority } from './twitch-native-authority.js';
import { planLosingSocialState, archiveLosingSocialState, losingSocialDecisionEvidence } from '../social/progression-retirement.js';
import { legacyFriendshipAffectedPlayers, legacyFriendshipDecisionEvidence, assertLegacyFriendshipResolutionReady } from '../migration/legacy-friendship-reconciliation.js';

type Tx = Prisma.TransactionClient;
type Choice = 'WEB' | 'TWITCH';
type Metadata = Awaited<ReturnType<typeof targetedRowMetadata>>;
export type CanonicalizationPair = { webIdentityId: string; webPlayerId: string; twitchPlayerId: string; twitchUserId: string };
export type OperatorConsequences = { friendships: number; friendRequests: number; directRequests: number; directParticipants: number; abandonProgression: true; preserveThirdPartyHistory: true };
export type OperatorChoiceDto = { id: string; expiresAt: string; consequences: OperatorConsequences };
export type OperatorPlans = Partial<Record<Choice, OperatorChoiceDto>>;
const version = 1;
const serialize = (value: unknown) => JSON.stringify(value, (_key, item: unknown) => typeof item === 'bigint' ? item.toString() : item);
const hash = (value: unknown) => createHash('sha256').update(serialize(value)).digest('hex');
const blocked = () => new AppError('Le plan d’abandon nécessite un nouveau contrôle opérateur.', 409, 'TWITCH_OPERATOR_PLAN_BLOCKED');
const technical = new Set(['web_identities', 'twitch_identities', 'player_sessions', 'twitch_link_states', 'twitch_link_resolutions', 'twitch_canonicalization_plans', 'migration_previews', 'global_chat_read_states']);
const historical = new Set(['admin_audit_entries', 'twitch_native_audit', 'twitch_canary_imports', 'global_chat_messages']);

// Only these reviewed foreign-key shapes have an abandonment contract. A new
// table/column never inherits permission just because its name resembles one.
const operatorEdges = new Set([
  ...['host_player_id', 'guest_player_id'].map(column => `arcade_invitations(${column})->players(id)`),
  'arcade_invitations(session_id)->arcade_sessions(id)',
  'arcade_receipts(session_id)->arcade_sessions(id):external',
  'arcade_stats(best_session_id)->arcade_sessions(id):external',
  ...['boss_attacks', 'player_boss_participations', 'boss_legacy_contributions', 'boss_rewards'].map(table => `${table}(player_id)->players(id)`),
  'boss_attacks(operation_id)->business_operations(id)', 'boss_rewards(operation_id)->business_operations(id)',
  ...['player_a_id', 'player_b_id'].map(column => `direct_conversations(${column})->players(id)`),
  'direct_conversation_participants(player_id)->players(id)',
  ...['sender_player_id', 'recipient_player_id'].map(column => `direct_conversation_requests(${column})->players(id)`),
  'direct_conversation_requests(first_message_id)->direct_messages(id)',
  'direct_messages(author_player_id)->players(id)', 'direct_messages(operation_id)->business_operations(id)',
  'event_game_b_daily_states(discoverer_player_id)->players(id)', 'event_participants(player_id)->players(id)',
  ...['sender_player_id', 'recipient_player_id'].map(column => `event_social_messages(${column})->players(id)`),
  'friend_hearts(operation_id)->business_operations(id)',
  ...['sender_player_id', 'recipient_player_id'].map(column => `friend_hearts(${column})->players(id)`),
  ...['sender_player_id', 'recipient_player_id'].map(column => `friend_requests(${column})->players(id)`),
  ...['player_a_id', 'player_b_id'].map(column => `friendships(${column})->players(id)`),
  ...['blocker_player_id', 'blocked_player_id'].map(column => `player_blocks(${column})->players(id)`),
  'friendship_legacy_heart_state(sender_player_id)->players(id)',
  'global_chat_mentions(mentioned_player_id)->players(id)',
  'player_expeditions(player_id)->players(id)',
  'resource_movements(operation_id)->business_operations(id):external',
]);

/** Twitch identity, authority, Social/cycle, then affected Players in UUID order. */
export async function lockCanonicalizationPair(tx: Tx, ids: string[], twitchUserId: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`twitch-provision:${twitchUserId}`},0))::text`;
  await tx.$queryRaw`SELECT id FROM twitch_native_authorities WHERE id='twitch-commands' FOR SHARE`;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('social:friendship'))::text`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(70422401)`;
  const meta = await targetedRowMetadata(tx), endpoints = new Set(ids);
  const roots = meta.fks.filter(fk => fk.parent === 'players' && fk.child_columns.length === 1 && !technical.has(fk.child));
  const branches: string[] = [];
  for (const table of new Set(roots.map(fk => fk.child))) {
    const columns = roots.filter(fk => fk.child === table).map(fk => fk.child_columns[0]!);
    const where = columns.map(column => `c.${ident(column)}=ANY($1::uuid[])`).join(' OR ');
    for (const column of columns) branches.push(`SELECT c.${ident(column)} id FROM ${ident(meta.schema)}.${ident(table)} c WHERE (${where}) AND c.${ident(column)} IS NOT NULL`);
  }
  for (const batch of groups(branches)) for (const row of await tx.$queryRawUnsafe<{ id: string }[]>(batch.join(' UNION '), ids)) endpoints.add(row.id);
  for (const id of await legacyFriendshipAffectedPlayers(tx, [twitchUserId])) endpoints.add(id);
  await tx.$queryRaw(Prisma.sql`SELECT id FROM players WHERE id IN (${Prisma.join([...endpoints].sort().map(id => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`);
}

async function validatePair(tx: Tx, pair: CanonicalizationPair) {
  const web = await tx.webIdentity.findUnique({ where: { id: pair.webIdentityId } });
  const twitch = await tx.twitchIdentity.findUnique({ where: { twitchUserId: pair.twitchUserId } });
  if (!web || web.state !== 'ACTIVE' || web.playerId !== pair.webPlayerId || twitch?.playerId !== pair.twitchPlayerId || pair.webPlayerId === pair.twitchPlayerId
    || await tx.player.count({ where: { id: { in: [pair.webPlayerId, pair.twitchPlayerId] }, status: 'ACTIVE' } }) !== 2
    || await tx.webIdentity.count({ where: { playerId: pair.twitchPlayerId } }) || await tx.twitchIdentity.count({ where: { playerId: pair.webPlayerId } })) throw blocked();
}

async function guards(tx: Tx, pair: CanonicalizationPair, choice: Choice, config: AppConfig) {
  if (config.twitchCommandPilot?.enabled !== false) throw blocked();
  const control = await tx.twitchNativeAuthority.findUnique({ where: { id: 'twitch-commands' } });
  if (!control || control.desiredMode !== 'OFF') throw blocked();
  const loser = choice === 'TWITCH' ? pair.webPlayerId : pair.twitchPlayerId;
  const target = await tx.twitchNativeTarget.findUnique({ where: { twitchUserId: pair.twitchUserId } });
  if (target?.dataAuthority === 'MIGRATION_PENDING' || target?.playerId && target.playerId !== pair.twitchPlayerId
    || await tx.businessOperation.count({ where: { status: 'PENDING' } })
    || await tx.playerRoleAssignment.count({ where: { playerId: loser, revokedAt: null, role: { in: ['ADMIN', 'MODERATOR'] } } })
    || await tx.twitchNativeAuthority.count({ where: { operatorPlayerId: loser } })
    || await tx.twitchGiftSupremeCredential.count({ where: { playerId: loser } })
    || await tx.twitchGiveawayCredential.count({ where: { playerId: loser } })
    || await tx.giveawayDeferredMessage.count({ where: { playerId: loser } })
    || await tx.giveawaySession.count({ where: { status: 'OPEN', OR: [{ openedByPlayerId: loser }, { winnerPlayerId: loser }, { participants: { some: { playerId: loser } } }, { chatStats: { some: { playerId: loser } } }] } })
    || await tx.arcadeSession.count({ where: { OR: [{ playerId: loser }, { opponentPlayerId: loser }], status: 'ACTIVE' } })
    || await tx.arcadeInvitation.count({ where: { OR: [{ hostPlayerId: loser }, { guestPlayerId: loser }], status: { in: ['PENDING', 'ACCEPTED'] } } })
    || await tx.contestParticipant.count({ where: { OR: [{ playerId: loser }, { originalPlayerId: loser }], contest: { status: { in: ['LOBBY', 'RUNNING'] } } } })
    || await tx.contest.count({ where: { organizerPlayerId: loser, status: { in: ['LOBBY', 'RUNNING'] } } })
    || await tx.tradeRequest.count({ where: { OR: [{ senderPlayerId: loser }, { recipientPlayerId: loser }], state: 'PENDING' } })) throw blocked();
  const receipts = await tx.twitchEventReceipt.findMany({ select: { eventType: true, state: true, processedAt: true, externalReference: true, payloadMinimal: true } });
  if (receipts.some(row => receiptSafety(row).blocking)) throw blocked();
  const sessions = await tx.arcadeSession.findMany({ where: { OR: [{ playerId: loser }, { opponentPlayerId: loser }] } });
  if (sessions.some(session => !['FINISHED', 'ABANDONED'].includes(session.status) || !session.finishedAt)) throw blocked();
  const invitations = await tx.arcadeInvitation.findMany({ where: { OR: [{ hostPlayerId: loser }, { guestPlayerId: loser }] }, include: { session: true } });
  for (const invitation of invitations) {
    if (!invitation.resolvedAt) throw blocked();
    if (invitation.status === 'STARTED') {
      if (!invitation.session || !['FINISHED', 'ABANDONED'].includes(invitation.session.status) || !invitation.session.finishedAt
        || invitation.session.playerId !== invitation.hostPlayerId || invitation.session.opponentPlayerId !== invitation.guestPlayerId) throw blocked();
    } else if (!['REFUSED', 'CANCELLED', 'EXPIRED', 'INVALIDATED'].includes(invitation.status) || invitation.sessionId) throw blocked();
  }
  for (const receipt of await tx.arcadeReceipt.findMany({ where: { playerId: loser, sessionId: { not: null } }, include: { session: true } }))
    if (!receipt.session || !['FINISHED', 'ABANDONED'].includes(receipt.session.status) || !receipt.session.finishedAt
      || ![receipt.session.playerId, receipt.session.opponentPlayerId].includes(loser)) throw blocked();
  for (const stat of await tx.arcadeStat.findMany({ where: { playerId: loser }, include: { bestSession: true } }))
    if (!['FINISHED', 'ABANDONED'].includes(stat.bestSession.status) || !stat.bestSession.finishedAt
      || ![stat.bestSession.playerId, stat.bestSession.opponentPlayerId].includes(loser)) throw blocked();
  return { control, target, loser };
}

/** Complete row text stays lossless (int8/timestamps); never round-trip through JS numbers. */
async function completeEvidence(tx: Tx, playerId: string, meta: Metadata) {
  const { graph, tables } = await captureCanonicalizationGraph(tx, playerId, meta, canonicalizationOwnedTables);
  const shared = new Map<string, Map<string, string>>();
  const incoming = meta.fks.filter(fk => graph.get(fk.parent)?.size && !technical.has(fk.child) && !historical.has(fk.child));
  for (const batch of groups(incoming)) {
    const records = graphRecordsets(meta.schema, graph);
    const query = records.query(batch.map(fk => `SELECT '${fk.child}'::text table_name,to_jsonb(c)::text row FROM ${ident(meta.schema)}.${ident(fk.child)} c JOIN ${records.table(fk.parent)} p ON ${join(fk)}`).join(' UNION ALL '));
    for (const row of await tx.$queryRawUnsafe<{ table_name: string; row: string }[]>(query.sql, query.input)) {
      const bucket = shared.get(row.table_name) ?? new Map<string, string>(); bucket.set(row.row, row.row); shared.set(row.table_name, bucket);
    }
  }
  // The affected relation rows must not acquire unknown nested dependents.
  const relationTables = new Set(['friendships', 'direct_conversations', 'direct_conversation_participants', 'friend_requests', 'direct_conversation_requests']);
  const supportedChildren = new Set([...canonicalizationOwnedTables, ...technical, ...historical, 'friend_hearts', 'friendship_legacy_heart_state', 'direct_messages', 'direct_conversation_requests', 'direct_conversation_participants', 'direct_message_reports', 'legacy_friendship_facts']);
  for (const fk of meta.fks) if (relationTables.has(fk.parent) && shared.get(fk.parent)?.size && !supportedChildren.has(fk.child)) throw blocked();
  const all = new Map(graph);
  for (const [table, rows] of shared) { const bucket = new Map(all.get(table)); for (const row of rows.keys()) bucket.set(row, row); all.set(table, bucket); }
  // Preserve the whole affected conversation/friendship, including other players'
  // messages, cursors and heart receipts. Do not expand through third-party Players.
  const relationChildren = new Set(['friend_hearts', 'friendship_legacy_heart_state', 'direct_messages', 'direct_message_reports', 'direct_conversation_requests', 'direct_conversation_participants']);
  const nestedParents = new Set([...relationTables, ...relationChildren]);
  for (let depth = 0; ; depth++) {
    if (depth > meta.fks.length) throw blocked();
    let added = false;
    const nested = meta.fks.filter(fk => nestedParents.has(fk.parent) && all.get(fk.parent)?.size && relationChildren.has(fk.child));
    for (const batch of groups(nested)) {
      const records = graphRecordsets(meta.schema, all);
      const query = records.query(batch.map(fk => `SELECT '${fk.child}'::text table_name,to_jsonb(c)::text row FROM ${ident(meta.schema)}.${ident(fk.child)} c JOIN ${records.table(fk.parent)} p ON ${join(fk)}`).join(' UNION ALL '));
      for (const row of await tx.$queryRawUnsafe<{ table_name: string; row: string }[]>(query.sql, query.input)) {
        const bucket = shared.get(row.table_name) ?? new Map<string, string>();
        if (!bucket.has(row.row)) { bucket.set(row.row, row.row); added = true; }
        shared.set(row.table_name, bucket);
        const combined = all.get(row.table_name) ?? new Map<string, string>(); combined.set(row.row, row.row); all.set(row.table_name, combined);
      }
    }
    if (!added) break;
  }
  for (const fk of meta.fks) if (nestedParents.has(fk.parent) && all.get(fk.parent)?.size && !supportedChildren.has(fk.child)) throw blocked();
  const parents = new Map<string, Set<string>>();
  const outgoing = meta.fks.filter(fk => all.get(fk.child)?.size && !technical.has(fk.parent));
  for (const batch of groups(outgoing)) {
    const records = graphRecordsets(meta.schema, all);
    const query = records.query(batch.map(fk => `SELECT '${fk.parent}'::text table_name,to_jsonb(p)::text row FROM ${records.table(fk.child)} c JOIN ${ident(meta.schema)}.${ident(fk.parent)} p ON ${join(fk)}`).join(' UNION ALL '));
    for (const row of await tx.$queryRawUnsafe<{ table_name: string; row: string }[]>(query.sql, query.input)) {
      const bucket = parents.get(row.table_name) ?? new Set<string>(); bucket.add(row.row); parents.set(row.table_name, bucket);
    }
  }
  const canonical = (rows: Map<string, Iterable<string>>) => Object.fromEntries([...rows].sort(([a], [b]) => a.localeCompare(b)).map(([table, values]) => [table, [...values].sort()]));
  const sharedRows = canonical(new Map([...shared].map(([table, rows]) => [table, rows.keys()]))), parentRows = canonical(parents);
  for (const row of [...(sharedRows.business_operations ?? []), ...(parentRows.business_operations ?? [])])
    if (!['COMPLETED', 'FAILED'].includes((JSON.parse(row) as { status: string }).status)) throw blocked();
  return { tables, shared: sharedRows, parents: parentRows };
}

export async function operatorDecisionProof(tx: Tx, pair: CanonicalizationPair, choice: Choice, config: AppConfig) {
  await validatePair(tx, pair);
  const gate = await guards(tx, pair, choice, config), meta = await targetedRowMetadata(tx);
  try { await assertLegacyFriendshipResolutionReady(tx, { twitchUserId: pair.twitchUserId, winnerPlayerId: choice === 'WEB' ? pair.webPlayerId : pair.twitchPlayerId, loserPlayerId: gate.loser }); }
  catch (error) { if (error instanceof Error && error.message.startsWith('LEGACY_FRIENDSHIP_')) throw blocked(); throw error; }
  const loserSafety = await assessPlayerCanonicalizationSafety(tx, gate.loser, meta);
  if (loserSafety.classifications.some(row => row.classification === 'SHARED_ACTIVE' && row.count !== '0' && !operatorEdges.has(row.edge))) throw blocked();
  const social = await planLosingSocialState(tx, gate.loser);
  if (social.blockers.length) throw blocked();
  const { blockers: _blockers, ...counts } = social;
  const consequences: OperatorConsequences = { ...counts, abandonProgression: true, preserveThirdPartyHistory: true };
  const evidence = { version, pair, choice, foreignKeys: meta.fks, control: gate.control, target: gate.target,
    identities: {
      web: (await tx.$queryRaw<{ row: string }[]>`SELECT to_jsonb(w)::text row FROM web_identities w WHERE id=${pair.webIdentityId}::uuid`)[0]!.row,
      twitch: (await tx.$queryRaw<{ row: string }[]>`SELECT to_jsonb(t)::text row FROM twitch_identities t WHERE twitch_user_id=${pair.twitchUserId}`)[0]!.row,
    },
    web: await completeEvidence(tx, pair.webPlayerId, meta), twitch: await completeEvidence(tx, pair.twitchPlayerId, meta),
    social: JSON.parse(serialize(await losingSocialDecisionEvidence(tx, gate.loser))) as Prisma.InputJsonValue,
    legacy: JSON.parse(serialize(await legacyFriendshipDecisionEvidence(tx, [pair.twitchUserId]))) as Prisma.InputJsonValue, consequences };
  return { fingerprint: hash({ consentVersion: 2, evidence: operatorConsentEvidence(evidence) }), evidence, consequences };
}

export type OperatorBackup = { kind: 'R1055_OPERATOR_PREIMAGE'; version: 1; fingerprint: string; evidence: Awaited<ReturnType<typeof operatorDecisionProof>>['evidence']; hash: string };
export class TwitchCanonicalizationOperator {
  constructor(private readonly db: PrismaClient, private readonly config: AppConfig) {}
  async prepare(input: { operatorPlayerId: string; webIdentityId: string; expectedWebPlayerId: string; twitchUserId: string; choice: Choice; expectedRevision: number; acknowledgement: string }, writeBackup: (backup: OperatorBackup) => Promise<void>) {
    if (input.acknowledgement !== STREAMERBOT_PATH_DISABLED) throw blocked();
    return this.db.$transaction(async tx => {
      await new TwitchNativeAuthority(this.db, this.config).requireOperator(tx, input.operatorPlayerId);
      const twitch = await tx.twitchIdentity.findUnique({ where: { twitchUserId: input.twitchUserId } });
      if (!twitch) throw blocked();
      const pair = { webIdentityId: input.webIdentityId, webPlayerId: input.expectedWebPlayerId, twitchPlayerId: twitch.playerId, twitchUserId: input.twitchUserId };
      await lockCanonicalizationPair(tx, [pair.webPlayerId, pair.twitchPlayerId], pair.twitchUserId);
      const proof = await operatorDecisionProof(tx, pair, input.choice, this.config);
      if (proof.evidence.control.revision !== input.expectedRevision) throw blocked();
      const preimage = { kind: 'R1055_OPERATOR_PREIMAGE' as const, version: 1 as const, fingerprint: proof.fingerprint, evidence: proof.evidence };
      const backup: OperatorBackup = { ...preimage, hash: hash(preimage) };
      await writeBackup(backup); // Durable preimage exists before publishing any authorization.
      const plan = await tx.twitchCanonicalizationPlan.create({ data: { ...pair, choice: input.choice, operatorPlayerId: input.operatorPlayerId,
        contractVersion: version, fingerprint: proof.fingerprint, backupHash: backup.hash, consequences: proof.consequences,
        expiresAt: new Date(Date.now() + 15 * 60_000) } });
      return { id: plan.id, expiresAt: plan.expiresAt.toISOString(), backupHash: backup.hash, consequences: proof.consequences };
    }, { isolationLevel: 'Serializable', timeout: 30_000 });
  }
}

/** A plan changes permission, never the underlying conservative safety result. */
export async function currentOperatorPlans(tx: Tx, pair: CanonicalizationPair, config?: AppConfig): Promise<OperatorPlans> {
  if (!config || config.twitchCommandPilot?.enabled !== false) return {};
  const plans = await tx.twitchCanonicalizationPlan.findMany({ where: { ...pair, consumedAt: null, expiresAt: { gt: new Date() }, contractVersion: version }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
  const result: OperatorPlans = {};
  for (const choice of ['WEB', 'TWITCH'] as const) {
    const candidates = plans.filter(plan => plan.choice === choice);
    if (!candidates.length) continue;
    let proof: Awaited<ReturnType<typeof operatorDecisionProof>>;
    try { proof = await operatorDecisionProof(tx, pair, choice, config); }
    catch (error) { if (error instanceof AppError && error.code === 'TWITCH_OPERATOR_PLAN_BLOCKED') continue; throw error; }
    for (const plan of candidates) {
      if (plan.fingerprint !== proof.fingerprint || !isDeepStrictEqual(plan.consequences, proof.consequences)) continue;
      try { await new TwitchNativeAuthority(tx as PrismaClient, config).requireOperator(tx, plan.operatorPlayerId); }
      catch (error) { if (error instanceof AppError && error.statusCode === 403) continue; throw error; }
      result[choice] = { id: plan.id, expiresAt: plan.expiresAt.toISOString(), consequences: proof.consequences }; break;
    }
  }
  return result;
}

export async function executeOperatorClosure(tx: Tx, pair: CanonicalizationPair, choice: Choice, planId: string, resolutionId: string, config: AppConfig, now: Date) {
  const plan = await tx.twitchCanonicalizationPlan.findUnique({ where: { id: planId } });
  if (!plan || plan.consumedAt || plan.expiresAt <= now || plan.choice !== choice || plan.contractVersion !== version
    || Object.entries(pair).some(([key, value]) => plan[key as keyof typeof pair] !== value)) throw blocked();
  await new TwitchNativeAuthority(tx as PrismaClient, config).requireOperator(tx, plan.operatorPlayerId);
  const proof = await operatorDecisionProof(tx, pair, choice, config);
  if (proof.fingerprint !== plan.fingerprint || !isDeepStrictEqual(proof.consequences, plan.consequences)) throw blocked();
  const loser = choice === 'TWITCH' ? pair.webPlayerId : pair.twitchPlayerId;
  await archiveLosingSocialState(tx, loser, now);
  await tx.twitchCanonicalizationPlan.update({ where: { id: plan.id }, data: { consumedAt: now, resolutionId } });
}
