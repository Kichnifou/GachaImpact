import { createHash, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { Prisma } from '../generated/prisma/client.js';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { bootstrapPlayer } from '../src/infrastructure/database/player-bootstrap.js';
import { assertLegacyFriendshipResolutionReady, legacyFriendshipAffectedPlayers, legacyFriendshipDecisionEvidence, legacyFriendshipSourceFacts, planLegacyFriendshipImport, planLegacyFriendshipRegistration, reconcileLegacyFriendships, registerLegacyFriendships } from '../src/application/migration/legacy-friendship-reconciliation.js';
import { archiveLosingSocialState, carryRetiredFriendshipUsage, losingSocialDecisionEvidence } from '../src/application/social/progression-retirement.js';
import { captureLegacyFriendshipBackup, legacyFriendshipBackupPostHash, restoreLegacyFriendshipBackup } from '../src/application/migration/legacy-friendship-backup.js';
import type { Snapshot } from '../src/application/migration/streamerbot-snapshot.js';
import type { VerifiedTwitchReport } from '../src/application/migration/verified-twitch-report.js';
import { FriendshipService } from '../src/application/social/friendship-service.js';
import { permanentMissionCatalog } from '../src/domain/missions/permanent-mission-catalog.js';

const fixture = isolatedBatchDatabase(), db = fixture.database;
const now = new Date('2099-10-08T12:00:00.000Z'), today = new Date('2099-10-08'), yesterday = new Date('2099-10-07');
let sequence = 0;
const pair = (a: string, b: string) => { const ids = [a, b].sort(); return { playerAId: ids[0]!, playerBId: ids[1]! }; };
const serialize = (value: unknown) => JSON.stringify(value, (_key, row: unknown) => typeof row === 'bigint' ? row.toString() : row);
const transaction = <T>(run: (tx: Prisma.TransactionClient) => Promise<T>) => db.$transaction(async tx => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('social:friendship'))`;
  return run(tx);
}, { isolationLevel: 'Serializable', timeout: 30_000 });

beforeAll(async () => {
  await fixture.setup({ prismaMigrations: true });
  await db.permanentMissionDefinition.createMany({ data: permanentMissionCatalog.map(row => ({ ...row })), skipDuplicates: true });
}, 180_000);
afterAll(async () => {
  await fixture.cleanup(); const pool = fixture.poolSnapshot();
  expect(pool.total).toBe(0); expect(pool.idle).toBe(0); expect(pool.waiting).toBe(0); expect(pool.opened).toBe(pool.closed);
}, 60_000);

async function scenario(importBoth = true) {
  const index = ++sequence, names = [`social_left_${index}`, `social_right_${index}`], ids = [String(880000000 + index * 2), String(880000001 + index * 2)];
  const snapshot: Snapshot = { hash: createHash('sha256').update(`private-social-${index}`).digest('hex'), files: 17, sources: {
    'viewers_data.json': Object.fromEntries(names.map(name => [name, {}])),
    'friendships_data.json': { friendships: { first: { users: names, level: 12, sparkleHearts: 70, createdAt: '2026-01-01', lastHeartSent: { [names[0]!]: '2099-10-07', [names[1]!]: '2099-10-06' } } }, requests: [] },
  } };
  const reports: VerifiedTwitchReport[] = names.map((name, side) => ({ version: 1, verification: 'TWITCH_HELIX', snapshotHash: snapshot.hash, resolvedAt: now.toISOString(),
    users: [{ legacyLogin: name, twitchUserId: ids[side]!, currentLogin: name, displayName: `Private ${side}`, renamed: false }], missing: [], conflicts: [], duplicates: 0 }));
  const players: string[] = [];
  for (const side of [0, 1]) {
    const player = await transaction(tx => bootstrapPlayer(tx, { displayName: `Private ${side}`, twitchIdentity: { twitchUserId: ids[side]!, login: names[side]!, displayName: `Private ${side}`, firstSeenAt: now } }));
    players.push(player.id);
    if (side === 0 || importBoth) await db.migrationRun.create({ data: { playerId: player.id, snapshotHash: snapshot.hash, summary: {} } });
  }
  const register = (side: number) => transaction(tx => registerLegacyFriendships(tx, { snapshot, report: reports[side]!, ownerTwitchUserId: ids[side]!, now }));
  const reconcile = () => transaction(tx => reconcileLegacyFriendships(tx, { now, twitchUserIds: ids }));
  const effective = () => db.friendship.findFirstOrThrow({ where: { ...pair(players[0]!, players[1]!), supersededAt: null } });
  return { snapshot, reports, players, ids, register, reconcile, effective };
}

it('defers unproved/unimported peers, then restores exactly once without any economic mutation', async () => {
  const s = await scenario(false);
  const wallets = await db.playerResourceBalance.findMany({ where: { playerId: { in: s.players } }, orderBy: [{ playerId: 'asc' }, { resourceKey: 'asc' }] });
  await s.register(0); expect(await s.reconcile()).toEqual({ materialized: 0, deferred: 1, retained: 0 });
  await s.register(1); expect(await s.reconcile()).toEqual({ materialized: 0, deferred: 1, retained: 0 });
  await db.migrationRun.create({ data: { playerId: s.players[1]!, snapshotHash: s.snapshot.hash, summary: {} } });
  expect(await s.reconcile()).toEqual({ materialized: 1, deferred: 0, retained: 0 });
  const relation = await s.effective();
  expect(relation).toMatchObject({ level: 12, totalHearts: 70n, legacyLeftPlayerId: s.players[0] });
  expect(await db.friendshipLegacyHeartState.findUniqueOrThrow({ where: { friendshipId_senderPlayerId: { friendshipId: relation.id, senderPlayerId: s.players[0]! } } })).toMatchObject({ lastHeartSentDate: yesterday });
  expect(await db.friendHeart.count({ where: { friendshipId: relation.id } })).toBe(0);
  expect(await s.reconcile()).toEqual({ materialized: 0, deferred: 0, retained: 1 });
  expect(await db.playerResourceBalance.findMany({ where: { playerId: { in: s.players } }, orderBy: [{ playerId: 'asc' }, { resourceKey: 'asc' }] })).toEqual(wallets);
});

it('rejects conflicting sources and effective standalone relationships without overwriting either graph', async () => {
  const s = await scenario(); await s.register(0); await s.register(1);
  const standalone = await db.friendship.create({ data: { ...pair(s.players[0]!, s.players[1]!), level: 41, totalHearts: 123n } });
  await expect(s.reconcile()).rejects.toThrow('LEGACY_FRIENDSHIP_EFFECTIVE_RELATION_CONFLICT');
  expect(await db.friendship.findUniqueOrThrow({ where: { id: standalone.id } })).toEqual(standalone);
  const changed: Snapshot = { ...s.snapshot, sources: { ...s.snapshot.sources, 'friendships_data.json': { friendships: { first: { users: s.reports.map(report => report.users[0]!.legacyLogin), level: 99, sparkleHearts: 98 } } } } };
  await expect(transaction(tx => registerLegacyFriendships(tx, { snapshot: changed, report: s.reports[0]!, ownerTwitchUserId: s.ids[0]!, now }))).rejects.toThrow('LEGACY_FRIENDSHIP_SOURCE_CONFLICT');
  expect((await db.legacyFriendshipFact.findFirstOrThrow({ where: { leftTwitchUserId: s.ids[0] } })).level).toBe(12);
});

it('keeps explicit blocks and revoked friendships blocked, including after a Player replacement', async () => {
  const s = await scenario(); await s.register(0); await s.register(1); await s.reconcile();
  const relation = await s.effective();
  await db.playerBlock.create({ data: { blockerPlayerId: s.players[1]!, blockedPlayerId: s.players[0]! } });
  await expect(s.reconcile()).rejects.toThrow('LEGACY_FRIENDSHIP_BLOCKED_CONTACT');
  await db.playerBlock.deleteMany({ where: { blockerPlayerId: s.players[1]!, blockedPlayerId: s.players[0]! } });
  await db.friendship.update({ where: { id: relation.id }, data: { state: 'ARCHIVED', archivedAt: now } });
  await expect(s.reconcile()).rejects.toThrow('LEGACY_FRIENDSHIP_REVOKED_RELATION');
  expect((await s.effective()).state).toBe('ARCHIVED');
});

it('moves only a legacy relationship to a free definitive WEB pair, retaining old heart endpoints and the daily claim', async () => {
  const s = await scenario(); await s.register(0); await s.register(1); await s.reconcile();
  const original = await s.effective();
  const operation = await db.businessOperation.create({ data: { playerId: s.players[0]!, operationType: 'friendship.heart', sourceChannel: 'UI', status: 'COMPLETED', completedAt: now } });
  const heart = await db.friendHeart.create({ data: { friendshipId: original.id, senderPlayerId: s.players[0]!, recipientPlayerId: s.players[1]!, businessDate: today, operationId: operation.id } });
  await db.friendship.update({ where: { id: original.id }, data: { level: 13, totalHearts: 71n } });
  const web = await transaction(tx => bootstrapPlayer(tx, { displayName: 'Private Web Winner', webIdentity: { provider: 'supabase', providerSubject: randomUUID() } }));
  const webIdentity = await db.webIdentity.findFirstOrThrow({ where: { playerId: web.id } });
  const webBefore = await db.playerResourceBalance.findMany({ where: { playerId: web.id }, orderBy: { resourceKey: 'asc' } });
  await transaction(async tx => {
    await archiveLosingSocialState(tx, s.players[0]!, now);
    await tx.twitchIdentity.update({ where: { twitchUserId: s.ids[0]! }, data: { playerId: web.id } });
    await tx.player.update({ where: { id: s.players[0]! }, data: { status: 'ARCHIVED' } });
    await tx.twitchLinkResolution.create({ data: { webIdentityId: webIdentity.id, webPlayerId: web.id, twitchPlayerId: s.players[0]!, twitchUserId: s.ids[0]!, login: s.reports[0]!.users[0]!.currentLogin,
      comparedState: {}, choice: 'WEB', createdAt: now, expiresAt: new Date(now.getTime() + 900_000), completedAt: now } });
    expect(await reconcileLegacyFriendships(tx, { now, twitchUserIds: s.ids })).toMatchObject({ materialized: 1 });
  });
  const replacement = await db.friendship.findFirstOrThrow({ where: { ...pair(web.id, s.players[1]!), supersededAt: null } });
  expect(replacement).toMatchObject({ level: 13, totalHearts: 71n, legacyLeftPlayerId: web.id });
  expect(await db.friendHeart.findUniqueOrThrow({ where: { id: heart.id } })).toEqual(heart);
  expect((await db.friendship.findUniqueOrThrow({ where: { id: original.id } })).supersededAt).toEqual(now);
  expect((await db.friendshipLegacyHeartState.findUniqueOrThrow({ where: { friendshipId_senderPlayerId: { friendshipId: replacement.id, senderPlayerId: web.id } } })).lastHeartSentDate).toEqual(today);
  expect(await new FriendshipService(db, { now: () => now }).sendHearts(web.id, s.players[1]!, randomUUID())).toMatchObject({ sent: 0, alreadySent: 1 });
  expect(await db.playerResourceBalance.findMany({ where: { playerId: web.id }, orderBy: { resourceKey: 'asc' } })).toEqual(webBefore);
});

it('retires standalone friendship/DM access without altering third-party history or read state', async () => {
  const s = await scenario(), [loser, peer] = s.players as [string, string];
  const friendship = await db.friendship.create({ data: { ...pair(loser, peer), level: 40, totalHearts: 250n } });
  const request = await db.friendRequest.create({ data: { senderPlayerId: loser, recipientPlayerId: peer, sourceChannel: 'UI' } });
  await db.notification.create({ data: { playerId: peer, domainKey: 'social', typeKey: 'FRIEND_REQUEST_RECEIVED', deduplicationKey: `friend-request:${request.id}`, state: 'UNREAD', payload: {} } });
  const conversation = await db.directConversation.create({ data: { ...pair(loser, peer), participants: { create: [{ playerId: loser, readReceiptsEnabled: false }, { playerId: peer, readReceiptsEnabled: true }] } } });
  const operation = await db.businessOperation.create({ data: { playerId: loser, operationType: 'direct-message.send', sourceChannel: 'UI', status: 'COMPLETED', completedAt: now } });
  const message = await db.directMessage.create({ data: { conversationId: conversation.id, authorPlayerId: loser, content: 'Private synthetic history', operationId: operation.id } });
  const peerState = await db.directConversationParticipant.findUniqueOrThrow({ where: { conversationId_playerId: { conversationId: conversation.id, playerId: peer } } });
  expect((await losingSocialDecisionEvidence(db, loser)).notifications).toHaveLength(1);
  const outcome = await transaction(tx => archiveLosingSocialState(tx, loser, now));
  expect(outcome).toMatchObject({ friendships: 1, friendRequests: 1, directParticipants: 1 });
  expect(await db.directMessage.findUniqueOrThrow({ where: { id: message.id } })).toEqual(message);
  expect(await db.directConversationParticipant.findUniqueOrThrow({ where: { conversationId_playerId: { conversationId: conversation.id, playerId: peer } } })).toEqual(peerState);
  expect(await db.friendship.findUniqueOrThrow({ where: { id: friendship.id } })).toMatchObject({ state: 'ARCHIVED', level: 40, totalHearts: 250n, retiredByProgressionAt: now });
  expect((await db.friendRequest.findUniqueOrThrow({ where: { id: request.id } })).state).toBe('CANCELLED');
  expect(await transaction(tx => archiveLosingSocialState(tx, loser, now))).toMatchObject({ friendships: 0, friendRequests: 0, directParticipants: 0 });
});

it('rolls back complete registry, versions and identity changes on an error after reconciliation', async () => {
  const s = await scenario(); await s.register(0); await s.register(1);
  const before = serialize(await legacyFriendshipDecisionEvidence(db, s.ids));
  await expect(transaction(async tx => {
    await reconcileLegacyFriendships(tx, { now, twitchUserIds: s.ids });
    throw new Error('PRIVATE_AFTER_RECONCILIATION_FAILURE');
  })).rejects.toThrow('PRIVATE_AFTER_RECONCILIATION_FAILURE');
  expect(serialize(await legacyFriendshipDecisionEvidence(db, s.ids))).toBe(before);
  expect(await db.friendship.count({ where: pair(s.players[0]!, s.players[1]!) })).toBe(0);
});

it('serializes duplicate restoration and fingerprints concurrent source/relationship changes', async () => {
  const s = await scenario(); await s.register(0); await s.register(1);
  expect(await legacyFriendshipAffectedPlayers(db, s.ids)).toEqual([...s.players].sort());
  const before = serialize(await legacyFriendshipDecisionEvidence(db, s.ids));
  const outcomes = await Promise.allSettled([s.reconcile(), s.reconcile()]);
  expect(outcomes.filter(result => result.status === 'fulfilled')).not.toHaveLength(0);
  const relation = await s.effective();
  expect(await db.friendship.count({ where: pair(s.players[0]!, s.players[1]!) })).toBe(1);
  const materialized = serialize(await legacyFriendshipDecisionEvidence(db, s.ids)); expect(materialized).not.toBe(before);
  await db.friendship.update({ where: { id: relation.id }, data: { level: 13 } });
  expect(serialize(await legacyFriendshipDecisionEvidence(db, s.ids))).not.toBe(materialized);
  expect(await s.reconcile()).toMatchObject({ retained: 1 });
});

it.each(['WEB', 'TWITCH'])('preserves only proven daily heart usage in both directions after explicit %s choice', async choice => {
  const s = await scenario(), [loser, peer] = s.players as [string, string];
  const winner = await transaction(tx => bootstrapPlayer(tx, { displayName: 'Private Selected Progression', ...(choice === 'WEB'
    ? { webIdentity: { provider: 'supabase', providerSubject: randomUUID() } }
    : { twitchIdentity: { twitchUserId: String(990000000 + sequence), login: `quota_winner_${sequence}`, displayName: 'Private Twitch Winner', firstSeenAt: now } }) }));
  if (choice === 'TWITCH') {
    await db.twitchIdentity.delete({ where: { twitchUserId: s.ids[0]! } });
    await db.webIdentity.create({ data: { playerId: loser, provider: 'supabase', providerSubject: randomUUID() } });
  }
  const old = await db.friendship.create({ data: { ...pair(loser, peer), level: 22, totalHearts: 310n } });
  const effective = await db.friendship.create({ data: { ...pair(winner.id, peer), level: 10, totalHearts: 40n } });
  for (const sender of [loser, peer]) {
    const operation = await db.businessOperation.create({ data: { playerId: sender, operationType: 'friendship.heart', sourceChannel: 'UI', status: 'COMPLETED', completedAt: now } });
    await db.friendHeart.create({ data: { friendshipId: old.id, senderPlayerId: sender, recipientPlayerId: sender === loser ? peer : loser, businessDate: today, operationId: operation.id } });
  }
  const hearts = await db.friendHeart.findMany({ where: { friendshipId: old.id }, orderBy: { id: 'asc' } });
  const balances = await db.playerResourceBalance.findMany({ where: { playerId: { in: [loser, winner.id, peer] } }, orderBy: [{ playerId: 'asc' }, { resourceKey: 'asc' }] });
  await transaction(async tx => {
    await archiveLosingSocialState(tx, loser, now);
    await tx.player.update({ where: { id: loser }, data: { status: 'ARCHIVED' } });
    expect(await carryRetiredFriendshipUsage(tx, { loser, winner: winner.id, now })).toEqual({ carried: 2 });
    expect(await carryRetiredFriendshipUsage(tx, { loser, winner: winner.id, now })).toEqual({ carried: 0 });
  });
  expect(await db.friendship.findUniqueOrThrow({ where: { id: effective.id } })).toEqual(effective);
  expect(await db.friendHeart.findMany({ where: { friendshipId: old.id }, orderBy: { id: 'asc' } })).toEqual(hearts);
  expect(await db.playerResourceBalance.findMany({ where: { playerId: { in: [loser, winner.id, peer] } }, orderBy: [{ playerId: 'asc' }, { resourceKey: 'asc' }] })).toEqual(balances);
  const service = new FriendshipService(db, { now: () => now });
  expect(await service.sendHearts(winner.id, peer, randomUUID())).toMatchObject({ sent: 0, alreadySent: 1 });
  expect(await service.sendHearts(peer, winner.id, randomUUID())).toMatchObject({ sent: 0, alreadySent: 1 });
  expect(await db.friendHeart.count({ where: { friendshipId: effective.id } })).toBe(0);
});

it('backs up a deferred fact before its owner proof and restores the complete exact preimage', async () => {
  const s = await scenario(); await s.register(1);
  const input = { snapshot: s.snapshot, report: s.reports[0]!, ownerTwitchUserId: s.ids[0]!, ownerPlayerId: s.players[0]! };
  const backup = await transaction(tx => captureLegacyFriendshipBackup(tx, input));
  expect(backup.playerIds).toEqual([...s.players].sort());
  await s.register(0); await s.reconcile();
  const postHash = await transaction(tx => legacyFriendshipBackupPostHash(tx, backup));
  expect(await transaction(tx => restoreLegacyFriendshipBackup(tx, backup, postHash))).toEqual({ mode: 'EXACT_PREIMAGE' });
  expect(await transaction(tx => captureLegacyFriendshipBackup(tx, input))).toEqual(backup);
  expect(await s.reconcile()).toMatchObject({ deferred: 1 });
});

it('refuses rollback after later usage or a new unknown FK without deleting a receipt or reference', async () => {
  const s = await scenario(); await s.register(1);
  const backup = await transaction(tx => captureLegacyFriendshipBackup(tx, { snapshot: s.snapshot, report: s.reports[0]!, ownerTwitchUserId: s.ids[0]!, ownerPlayerId: s.players[0]! }));
  await s.register(0); await s.reconcile();
  const relation = await s.effective(), postHash = await transaction(tx => legacyFriendshipBackupPostHash(tx, backup));
  await fixture.admin.query(`CREATE TABLE "${fixture.schema}".private_social_reference(id uuid PRIMARY KEY, friendship_id uuid REFERENCES "${fixture.schema}".friendships(id))`);
  try {
    await fixture.admin.query(`INSERT INTO "${fixture.schema}".private_social_reference VALUES($1,$2)`, [randomUUID(), relation.id]);
    await expect(transaction(tx => restoreLegacyFriendshipBackup(tx, backup, postHash))).rejects.toThrow('CANARY_SHARED_REFERENCE_REQUIRES_OPERATOR');
    expect(await s.effective()).toEqual(relation);
  } finally { await fixture.admin.query(`DROP TABLE "${fixture.schema}".private_social_reference`); }
  await db.friendship.update({ where: { id: relation.id }, data: { level: 13 } });
  await expect(transaction(tx => restoreLegacyFriendshipBackup(tx, backup, postHash))).rejects.toThrow('LEGACY_FRIENDSHIP_POSTIMAGE_CHANGED');
  expect((await s.effective()).level).toBe(13);
});

it('plans asymmetric choices without allowing a legacy collision to overwrite the WEB relationship', async () => {
  const s = await scenario(); await s.register(0); await s.register(1); await s.reconcile();
  const web = await transaction(tx => bootstrapPlayer(tx, { displayName: 'Private Significant Web', webIdentity: { provider: 'supabase', providerSubject: randomUUID() } }));
  const standalone = await db.friendship.create({ data: { ...pair(web.id, s.players[1]!), level: 41, totalHearts: 123n } });
  await expect(transaction(tx => assertLegacyFriendshipResolutionReady(tx, { twitchUserId: s.ids[0]!, winnerPlayerId: web.id, loserPlayerId: s.players[0]! }))).rejects.toThrow('LEGACY_FRIENDSHIP_EFFECTIVE_RELATION_CONFLICT');
  await expect(transaction(tx => assertLegacyFriendshipResolutionReady(tx, { twitchUserId: s.ids[0]!, winnerPlayerId: s.players[0]!, loserPlayerId: web.id }))).resolves.toBeUndefined();
  expect(await db.friendship.findUniqueOrThrow({ where: { id: standalone.id } })).toEqual(standalone);
  expect((await s.effective()).level).toBe(12);
});

it('limits operator registration, backup and reconciliation to the explicit source pair', async () => {
  const s = await scenario(), ownerName = s.reports[0]!.users[0]!.legacyLogin;
  const source = s.snapshot.sources['friendships_data.json'] as { friendships: Record<string, unknown> };
  source.friendships.second = { users: [ownerName, 'private_unproved_peer'], level: 2, sparkleHearts: 1 };
  const scope = legacyFriendshipSourceFacts(s.snapshot, ownerName).find(fact => fact.level === 12)!.sourcePairKeyHash;
  const input = { snapshot: s.snapshot, report: s.reports[0]!, ownerTwitchUserId: s.ids[0]!, ownerPlayerId: s.players[0]!, sourcePairKeyHash: scope, now };
  const backup = await transaction(tx => captureLegacyFriendshipBackup(tx, input));
  expect(backup.sourcePairKeyHashes).toEqual([scope]);
  await transaction(tx => registerLegacyFriendships(tx, input));
  const facts = await db.legacyFriendshipFact.findMany({ where: { leftTwitchUserId: s.ids[0] } });
  expect(facts).toHaveLength(1); expect(facts[0]!.sourcePairKeyHash).toBe(scope);
  expect(await transaction(tx => reconcileLegacyFriendships(tx, { now, sourcePairKeyHashes: [scope] }))).toEqual({ materialized: 0, deferred: 1, retained: 0 });
  await expect(transaction(tx => registerLegacyFriendships(tx, { ...input, sourcePairKeyHash: 'a'.repeat(64) }))).rejects.toThrow('LEGACY_FRIENDSHIP_SOURCE_PAIR_SCOPE_INVALID');
});

it('performs the full one-pair registration dry run without writing and detects a newly imported peer', async () => {
  const s = await scenario(false), scope = legacyFriendshipSourceFacts(s.snapshot, s.reports[0]!.users[0]!.legacyLogin)[0]!.sourcePairKeyHash;
  const input = { snapshot: s.snapshot, reports: s.reports, sourcePairKeyHash: scope, now };
  const before = await db.legacyFriendshipFact.count();
  const deferred = await transaction(tx => planLegacyFriendshipRegistration(tx, input));
  expect(deferred).toMatchObject({ status: 'DEFERRED', deferred: 1, materialized: 0 });
  expect(await db.legacyFriendshipFact.count()).toBe(before);
  await s.register(0); await s.register(1);
  const proofBefore = serialize(await legacyFriendshipDecisionEvidence(db, s.ids));
  await db.migrationRun.create({ data: { playerId: s.players[1]!, snapshotHash: s.snapshot.hash, summary: {} } });
  expect(serialize(await legacyFriendshipDecisionEvidence(db, s.ids))).not.toBe(proofBefore);
  const ready = await transaction(tx => planLegacyFriendshipRegistration(tx, input));
  expect(ready).toMatchObject({ status: 'READY', materialized: 1, playerIds: [...s.players].sort() });
  expect(ready.fingerprint).not.toBe(deferred.fingerprint);
  expect(await transaction(tx => planLegacyFriendshipRegistration(tx, input))).toEqual(ready);
  expect(await db.friendship.count({ where: pair(s.players[0]!, s.players[1]!) })).toBe(0);
  await s.reconcile();
  expect(await transaction(tx => planLegacyFriendshipRegistration(tx, input))).toMatchObject({ status: 'RETAINED', retained: 1 });
});

it('rejects altered immutable source evidence and never infers identities from a matching display name', async () => {
  const s = await scenario(); await s.register(0);
  await db.player.update({ where: { id: s.players[1]! }, data: { displayName: s.reports[0]!.users[0]!.displayName } });
  expect(await s.reconcile()).toMatchObject({ deferred: 1 });
  const fact = await db.legacyFriendshipFact.findFirstOrThrow({ where: { leftTwitchUserId: s.ids[0]! } });
  await db.legacyFriendshipFact.update({ where: { id: fact.id }, data: { level: 13 } });
  await expect(s.reconcile()).rejects.toThrow('LEGACY_FRIENDSHIP_SOURCE_PROVENANCE_INVALID');
  expect(await db.friendship.count({ where: pair(s.players[0]!, s.players[1]!) })).toBe(0);
  await db.legacyFriendshipFact.update({ where: { id: fact.id }, data: { level: fact.level } });
  await s.register(1); expect(await s.reconcile()).toMatchObject({ materialized: 1 });
});

it('preflights an independent future import with only its verified report and existing peer proof, without writing', async () => {
  const s = await scenario(false);
  const input = { snapshot: s.snapshot, report: s.reports[1]!, ownerTwitchUserId: s.ids[1]!, ownerPlayerId: s.players[1]!, now };
  expect(await transaction(tx => planLegacyFriendshipImport(tx, input))).toMatchObject({ registered: 1, deferred: 1, materialized: 0 });
  await s.register(0);
  const before = serialize(await db.legacyFriendshipFact.findMany({ orderBy: { id: 'asc' } }));
  const plan = await transaction(tx => planLegacyFriendshipImport(tx, input));
  expect(plan).toMatchObject({ registered: 1, deferred: 0, materialized: 1, retained: 0, playerIds: [...s.players].sort() });
  expect(await transaction(tx => planLegacyFriendshipImport(tx, { ...input, now: new Date(+now + 60_000) }))).toEqual(plan);
  expect(serialize(await db.legacyFriendshipFact.findMany({ orderBy: { id: 'asc' } }))).toBe(before);
  expect(await db.friendship.count({ where: pair(s.players[0]!, s.players[1]!) })).toBe(0);
  expect(await db.migrationRun.count({ where: { playerId: s.players[1]! } })).toBe(0);
  const collision = await db.friendship.create({ data: { ...pair(s.players[0]!, s.players[1]!), level: 41, totalHearts: 123n } });
  await expect(transaction(tx => planLegacyFriendshipImport(tx, input))).rejects.toThrow('LEGACY_FRIENDSHIP_EFFECTIVE_RELATION_CONFLICT');
  expect(await db.friendship.findUniqueOrThrow({ where: { id: collision.id } })).toEqual(collision);
  expect(serialize(await db.legacyFriendshipFact.findMany({ orderBy: { id: 'asc' } }))).toBe(before);
});

it('projects a genuinely absent Twitch-only Player, preserves source conflicts and refuses an occupied identity', async () => {
  const s = await scenario(false); await s.register(0);
  const expected = randomUUID(), input = { snapshot: s.snapshot, report: s.reports[1]!, ownerTwitchUserId: s.ids[1]!, ownerPlayerId: expected, now };
  await expect(transaction(tx => planLegacyFriendshipImport(tx, input))).rejects.toThrow('LEGACY_FRIENDSHIP_IDENTITY_CONFLICT');
  await db.twitchIdentity.delete({ where: { twitchUserId: s.ids[1]! } });
  const plan = await transaction(tx => planLegacyFriendshipImport(tx, input));
  expect(plan).toMatchObject({ materialized: 1, deferred: 0, playerIds: [s.players[0]!, expected].sort() });
  expect(await db.player.findUnique({ where: { id: expected } })).toBeNull();
  expect(await db.twitchIdentity.findUnique({ where: { twitchUserId: s.ids[1]! } })).toBeNull();
  const source = s.snapshot.sources['friendships_data.json'] as { friendships: { first: { level: number } } };
  source.friendships.first.level = 13;
  await expect(transaction(tx => planLegacyFriendshipImport(tx, input))).rejects.toThrow('LEGACY_FRIENDSHIP_SOURCE_CONFLICT');
  expect(await db.friendship.count({ where: { OR: [{ playerAId: expected }, { playerBId: expected }] } })).toBe(0);
});
