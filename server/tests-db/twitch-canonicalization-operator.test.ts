import { randomUUID } from 'node:crypto';
import { mkdtemp, open, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { bootstrapPlayer } from '../src/infrastructure/database/player-bootstrap.js';
import { captureTargetedPlayerRows } from '../src/application/migration/targeted-player-rows.js';
import { TwitchAccountLink } from '../src/application/twitch/twitch-account-link.js';
import { TwitchCanonicalizationOperator, type OperatorBackup } from '../src/application/twitch/twitch-canonicalization-operator.js';
import { STREAMERBOT_PATH_DISABLED } from '../src/application/twitch/twitch-native-authority.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { verifiedPlayerActor } from '../src/application/player/player-execution-actor.js';
import { EventService } from '../src/application/event/event-service.js';
import { ExpeditionService } from '../src/application/expedition/expedition-service.js';
import { MonthlyBossService } from '../src/application/combat/monthly-boss-service.js';
import { businessDateToDatabaseDate, getBusinessDate } from '../src/domain/time/business-date.js';
import { legacyFriendshipSourceFacts } from '../src/application/migration/legacy-friendship-reconciliation.js';

const fixture = isolatedBatchDatabase(), db = fixture.database;
const config = { host: 'localhost', port: 3001, supabase: {}, twitchCommandPilot: { enabled: false, globalEnabled: false },
  twitch: { pilotPlayerIds: [] as string[], pilotLogin: 'kichnifou' } };
const link = new TwitchAccountLink(db, config), operator = new TwitchCanonicalizationOperator(db, config);
let actor: string, directory: string, sequence = 0;
beforeAll(async () => {
  if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(process.env['DATABASE_URL']!).hostname)) throw Error('Local PostgreSQL required');
  await fixture.setup({ prismaMigrations: true });
  const player = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Operator', twitchIdentity: { twitchUserId: '970000000000', login: 'kichnifou', displayName: 'Operator', firstSeenAt: new Date() } }));
  actor = player.id; config.twitch.pilotPlayerIds.push(actor);
  await db.playerRoleAssignment.create({ data: { playerId: actor, role: 'ADMIN', source: 'fixture' } });
  await db.twitchNativeAuthority.create({ data: { id: 'twitch-commands', desiredMode: 'OFF', revision: 11, operatorPlayerId: actor } });
  directory = await mkdtemp(path.join(tmpdir(), 'gacha-operator-proof-'));
}, 180_000);
afterAll(async () => {
  await fixture.cleanup();
  const pool = fixture.poolSnapshot(); expect(pool).toMatchObject({ total: 0, idle: 0, waiting: 0 }); expect(pool.closed).toBe(pool.opened);
  if (directory) { const target = path.resolve(directory); if (path.dirname(target) !== path.resolve(tmpdir()) || !path.basename(target).startsWith('gacha-operator-proof-')) throw Error('Unsafe cleanup'); await rm(target, { recursive: true }); }
}, 60_000);

async function profiles(choice: 'WEB' | 'TWITCH', minimalTwitch = false) {
  const twitchUserId = String(970000000001 + sequence++);
  const web = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Web', webIdentity: { provider: 'supabase', providerSubject: randomUUID() } }));
  const twitch = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Twitch', twitchIdentity: { twitchUserId, login: 'verified', displayName: 'Twitch', firstSeenAt: new Date() } }));
  const peer = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Peer' }));
  await db.playerProgression.update({ where: { playerId: web.id }, data: { xp: 777n } });
  await db.playerProgression.update({ where: { playerId: twitch.id }, data: { xp: minimalTwitch ? 1n : 300n } });
  const loser = choice === 'WEB' ? twitch.id : web.id, winner = choice === 'WEB' ? web.id : twitch.id;
  const [playerAId, playerBId] = [loser, peer.id].sort() as [string, string];
  const friendship = await db.friendship.create({ data: { playerAId, playerBId, level: 3, totalHearts: 99n, becameFriendsAt: new Date() } });
  const conversation = await db.directConversation.create({ data: { playerAId, playerBId, participants: { create: [{ playerId: loser }, { playerId: peer.id }] } } });
  const operation = await db.businessOperation.create({ data: { playerId: loser, operationType: 'direct-message.send', sourceChannel: 'UI', status: 'COMPLETED', completedAt: new Date() } });
  const message = await db.directMessage.create({ data: { conversationId: conversation.id, authorPlayerId: loser, operationId: operation.id, content: 'Private fixture history' } });
  const identity = await db.webIdentity.findUniqueOrThrow({ where: { playerId: web.id } });
  const input = { operatorPlayerId: actor, webIdentityId: identity.id, expectedWebPlayerId: web.id, twitchUserId, choice, expectedRevision: 11, acknowledgement: STREAMERBOT_PATH_DISABLED };
  return { web, twitch, peer, loser, winner, identity, friendship, conversation, message, input, twitchUserId };
}
async function prepare(f: Awaited<ReturnType<typeof profiles>>) {
  const output = path.join(directory, `${randomUUID()}.json`);
  const plan = await operator.prepare(f.input, async backup => {
    const file = await open(output, 'wx', 0o600); try { await file.writeFile(JSON.stringify(backup)); await file.sync(); } finally { await file.close(); }
  });
  const backup = JSON.parse(await readFile(output, 'utf8')) as OperatorBackup;
  expect(plan.backupHash).toBe(backup.hash); expect(backup.evidence.pair.webPlayerId).toBe(f.web.id);
  await link.verified(f.identity.id, f.web.id, f.twitchUserId, 'verified', 'Twitch');
  const pending = (await link.pending(f.identity.id))!;
  expect(pending.operatorPlans?.[f.input.choice]?.id).toBe(plan.id);
  expect(pending.safety[f.input.choice].status).toBe('OPERATOR_REQUIRED');
  return { plan, pending, backup };
}
function legacySource(level: number, sparkleHearts: number) {
  const names = [`a_operator_${sequence}`, `z_operator_${sequence}`], hash = '1'.repeat(64);
  return { sourceSnapshotHash: hash, ...legacyFriendshipSourceFacts({ hash, files: 17, sources: {
    'friendships_data.json': { friendships: { fixture: { users: names, level, sparkleHearts } } },
  } }, names[0]!)[0]! };
}

it.each(['WEB', 'TWITCH'] as const)('requires explicit %s plan consent, then archives only the loser and preserves history/economy', async choice => {
  const f = await profiles(choice, choice === 'WEB'), before = await captureTargetedPlayerRows(db, [f.web.id, f.twitch.id, f.peer.id]);
  const thirdState = await db.directConversationParticipant.findUniqueOrThrow({ where: { conversationId_playerId: { conversationId: f.conversation.id, playerId: f.peer.id } } });
  const { plan, pending } = await prepare(f);
  expect((await db.friendship.findUniqueOrThrow({ where: { id: f.friendship.id } })).state).toBe('ACTIVE');
  expect(await db.player.count({ where: { id: { in: [f.web.id, f.twitch.id] }, status: 'ACTIVE' } })).toBe(2);
  await expect(link.resolve(f.identity.id, pending.id, choice, pending.revision)).rejects.toMatchObject({ code: 'TWITCH_OPERATOR_CONSENT_REQUIRED' });
  await expect(link.resolve(f.identity.id, pending.id, choice, pending.revision, plan.id)).resolves.toMatchObject({ linked: true, playerId: f.winner });
  expect(await db.friendship.findUniqueOrThrow({ where: { id: f.friendship.id } })).toMatchObject({ state: 'ARCHIVED', playerAId: f.friendship.playerAId, playerBId: f.friendship.playerBId, level: 3, totalHearts: 99n, retiredByProgressionAt: expect.any(Date) });
  expect(await db.directMessage.findUniqueOrThrow({ where: { id: f.message.id } })).toEqual(f.message);
  expect(await db.directConversationParticipant.findUniqueOrThrow({ where: { conversationId_playerId: { conversationId: f.conversation.id, playerId: f.peer.id } } })).toEqual(thirdState);
  const after = await captureTargetedPlayerRows(db, [f.web.id, f.twitch.id, f.peer.id]);
  for (const [table, rows] of Object.entries(before.tables)) if (!['players', 'web_identities', 'twitch_identities'].includes(table)) expect(after.tables[table], table).toEqual(rows);
  expect(await db.player.findUniqueOrThrow({ where: { id: f.loser } })).toMatchObject({ status: 'ARCHIVED' });
  expect(await db.webIdentity.findUniqueOrThrow({ where: { id: f.identity.id } })).toMatchObject({ playerId: f.winner });
  expect(await db.twitchIdentity.findUniqueOrThrow({ where: { twitchUserId: f.twitchUserId } })).toMatchObject({ playerId: f.winner });
  expect(await db.twitchCanonicalizationPlan.findUniqueOrThrow({ where: { id: plan.id } })).toMatchObject({ resolutionId: pending.id, consumedAt: expect.any(Date) });
  await expect(link.resolve(f.identity.id, pending.id, choice, pending.revision, plan.id)).resolves.toMatchObject({ linked: true });
  await expect(link.resolve(f.identity.id, pending.id, choice === 'WEB' ? 'TWITCH' : 'WEB', pending.revision, plan.id)).rejects.toMatchObject({ code: 'TWITCH_PROFILE_CHANGED' });
}, 120_000);

it('invalidates consent after a shared row changes without any count change', async () => {
  const f = await profiles('TWITCH'), { plan, pending } = await prepare(f);
  await db.friendship.update({ where: { id: f.friendship.id }, data: { totalHearts: 100n } });
  const result = await link.resolve(f.identity.id, pending.id, 'TWITCH', pending.revision, plan.id);
  expect(result).toMatchObject({ linked: false, resolutionRequired: true });
  expect(result.resolution!.revision).not.toBe(pending.revision); expect(result.resolution!.operatorPlans?.TWITCH).toBeUndefined();
  expect(await db.player.findUniqueOrThrow({ where: { id: f.loser } })).toMatchObject({ status: 'ACTIVE' });
  expect(await db.friendship.findUniqueOrThrow({ where: { id: f.friendship.id } })).toMatchObject({ state: 'ACTIVE', totalHearts: 100n });
}, 120_000);

it('does not publish authorization when durable backup fails', async () => {
  const f = await profiles('TWITCH');
  await expect(operator.prepare(f.input, async () => { throw Error('disk_failure'); })).rejects.toThrow('disk_failure');
  expect(await db.twitchCanonicalizationPlan.count({ where: { webIdentityId: f.identity.id } })).toBe(0);
  expect(await db.friendship.findUniqueOrThrow({ where: { id: f.friendship.id } })).toEqual(f.friendship);
}, 120_000);

it.each(['WEB', 'TWITCH'] as const)('rolls back closures, identities and plan consumption if %s archiving fails', async choice => {
  const f = await profiles(choice), { plan, pending } = await prepare(f), before = await captureTargetedPlayerRows(db, [f.web.id, f.twitch.id, f.peer.id]);
  const participants = await db.directConversationParticipant.findMany({ where: { conversationId: f.conversation.id }, orderBy: { playerId: 'asc' } });
  const schema = `"${fixture.schema}"`;
  await fixture.admin.query(`CREATE FUNCTION ${schema}.fail_operator_archive() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'operator_archive_failure'; END $$`);
  await fixture.admin.query(`CREATE TRIGGER fail_operator_archive BEFORE UPDATE ON ${schema}.players FOR EACH ROW WHEN(OLD.id='${f.loser}'::uuid AND NEW.status='ARCHIVED') EXECUTE FUNCTION ${schema}.fail_operator_archive()`);
  try {
    await expect(link.resolve(f.identity.id, pending.id, choice, pending.revision, plan.id)).rejects.toThrow('operator_archive_failure');
    expect((await captureTargetedPlayerRows(db, [f.web.id, f.twitch.id, f.peer.id])).hash).toBe(before.hash);
    expect(await db.friendship.findUniqueOrThrow({ where: { id: f.friendship.id } })).toEqual(f.friendship);
    expect(await db.directConversationParticipant.findMany({ where: { conversationId: f.conversation.id }, orderBy: { playerId: 'asc' } })).toEqual(participants);
    expect(await db.twitchCanonicalizationPlan.findUniqueOrThrow({ where: { id: plan.id } })).toMatchObject({ consumedAt: null, resolutionId: null });
  } finally { await fixture.admin.query(`DROP TRIGGER fail_operator_archive ON ${schema}.players`); await fixture.admin.query(`DROP FUNCTION ${schema}.fail_operator_archive()`); }
}, 120_000);

it('keeps active sessions, pending operations and unknown FK references fail closed', async () => {
  const f = await profiles('TWITCH');
  const pending = await db.businessOperation.create({ data: { playerId: f.peer.id, operationType: 'fixture', sourceChannel: 'UI' } });
  await expect(operator.prepare(f.input, async () => {})).rejects.toMatchObject({ code: 'TWITCH_OPERATOR_PLAN_BLOCKED' });
  await db.businessOperation.update({ where: { id: pending.id }, data: { status: 'FAILED', completedAt: new Date() } });
  const session = await db.arcadeSession.create({ data: { playerId: f.loser, game: 'MEMORY', difficulty: 'EASY', firstSide: 'PLAYER', privateState: {}, randomState: 1n, banterId: 'fixture', nextActionAt: new Date() } });
  await expect(operator.prepare(f.input, async () => {})).rejects.toMatchObject({ code: 'TWITCH_OPERATOR_PLAN_BLOCKED' });
  await db.arcadeSession.update({ where: { id: session.id }, data: { status: 'ABANDONED', finishedAt: new Date() } });
  const schema = `"${fixture.schema}"`;
  await fixture.admin.query(`CREATE TABLE ${schema}.operator_unknown_relation(player_id uuid REFERENCES ${schema}.players(id))`);
  try { await fixture.admin.query(`INSERT INTO ${schema}.operator_unknown_relation VALUES ($1)`, [f.loser]); await expect(operator.prepare(f.input, async () => {})).rejects.toMatchObject({ code: 'TWITCH_OPERATOR_PLAN_BLOCKED' }); }
  finally { await fixture.admin.query(`DROP TABLE ${schema}.operator_unknown_relation`); }
  expect(await db.twitchCanonicalizationPlan.count({ where: { webIdentityId: f.identity.id } })).toBe(0);
}, 120_000);

it.each(['WEB', 'TWITCH'] as const)('preserves the full %s discarded activity graph and nested third-party message history', async choice => {
  const f = await profiles(choice, choice === 'WEB'), now = new Date(Date.UTC(2500 + sequence, 8, 15, 12));
  const getPlayer = new GetCurrentPlayer({ findByIdentity: async () => null, provision: async () => { throw Error('No fixture provisioning'); } });
  const clock = { now: () => now }, random = { nextInt: (max: number) => Math.min(31, max - 1) };
  const player = await db.player.update({ where: { id: f.loser }, data: { elementKey: 'hydro' } }), actor = verifiedPlayerActor(player);
  const characters = [];
  for (let position = 1; position <= 4; position++) {
    const character = await db.character.create({ data: { externalKey: `operator-${randomUUID()}`, name: 'Private fixture', rarity: 4, elementKey: 'hydro' } });
    await db.playerCharacter.create({ data: { playerId: f.loser, characterId: character.id, copies: 1, constellation: 0, firstObtainedAt: now } }); characters.push(character);
  }
  const expeditionService = new ExpeditionService(getPlayer, db, clock, random);
  await expeditionService.start(actor, characters[0]!.id, randomUUID());
  const events = new EventService(getPlayer, db, clock, random);
  await events.join(actor, randomUUID());
  const eventParticipation = await db.eventParticipant.findFirstOrThrow({ where: { playerId: f.loser } });
  const eventMessage = await db.eventSocialMessage.create({ data: { eventEditionId: eventParticipation.eventEditionId, businessDate: now, senderPlayerId: f.peer.id, recipientPlayerId: f.loser, content: 'Third party Event evidence' } });
  const boss = new MonthlyBossService(getPlayer, db, clock, random), bossId = await boss.ensureCurrentBoss(now);
  for (let position = 1; position <= 4; position++) await boss.setSlot(actor, position, characters[position - 1]!.id);
  await boss.attack(actor, bossId, randomUUID(), false);
  const peerOperation = await db.businessOperation.create({ data: { playerId: f.peer.id, operationType: 'direct-message.send', sourceChannel: 'UI', status: 'COMPLETED', completedAt: now } });
  const peerMessage = await db.directMessage.create({ data: { conversationId: f.conversation.id, authorPlayerId: f.peer.id, operationId: peerOperation.id, content: 'Third party private evidence' } });
  const expedition = await db.playerExpedition.findUniqueOrThrow({ where: { playerId: f.loser } });
  const before = await captureTargetedPlayerRows(db, [f.web.id, f.twitch.id, f.peer.id]);
  const { plan, pending, backup } = await prepare(f);
  const losingEvidence = choice === 'WEB' ? backup.evidence.twitch : backup.evidence.web;
  expect(losingEvidence.shared.direct_messages!.some(row => row.includes(peerMessage.id))).toBe(true);
  expect(losingEvidence.shared.direct_conversation_participants).toHaveLength(2);
  expect(losingEvidence.parents.monthly_bosses).toHaveLength(1);
  expect(losingEvidence.parents.event_editions).toHaveLength(1);
  await expect(link.resolve(f.identity.id, pending.id, choice, pending.revision, plan.id)).resolves.toMatchObject({ linked: true });
  expect(await db.playerExpedition.findUniqueOrThrow({ where: { playerId: f.loser } })).toEqual(expedition);
  expect(await db.eventParticipant.findFirstOrThrow({ where: { playerId: f.loser } })).toEqual(eventParticipation);
  expect(await db.eventSocialMessage.findUniqueOrThrow({ where: { id: eventMessage.id } })).toEqual(eventMessage);
  expect(await db.directMessage.findUniqueOrThrow({ where: { id: peerMessage.id } })).toEqual(peerMessage);
  const after = await captureTargetedPlayerRows(db, [f.web.id, f.twitch.id, f.peer.id]);
  for (const [table, rows] of Object.entries(before.tables)) if (!['players', 'web_identities', 'twitch_identities'].includes(table)) expect(after.tables[table], table).toEqual(rows);
  await expect(expeditionService.claim(actor, randomUUID())).rejects.toMatchObject({ code: 'PLAYER_ARCHIVED' });
  await expect(events.join(actor, randomUUID())).rejects.toMatchObject({ code: 'PLAYER_ARCHIVED' });
  await expect(boss.attack(actor, bossId, randomUUID(), false)).rejects.toMatchObject({ code: 'PLAYER_ARCHIVED' });
}, 120_000);

it('invalidates a plan when a shared parent changes and refuses expired plans or changed authority', async () => {
  const f = await profiles('TWITCH');
  const boss = await db.monthlyBoss.create({ data: { monthStart: new Date('2799-01-01'), nameSnapshot: 'Parent evidence', baseHp: 500000n, hpVariationPercent: 0, maxHp: 500000n, currentHp: 500000n, resistanceElementKey: 'pyro' } });
  await db.playerBossParticipation.create({ data: { playerId: f.loser, bossId: boss.id, totalDamage: 1n, attackCount: 1n, bestHit: 1n } });
  const first = await prepare(f);
  await db.monthlyBoss.update({ where: { id: boss.id }, data: { currentHp: 499999n } });
  const changed = await link.resolve(f.identity.id, first.pending.id, 'TWITCH', first.pending.revision, first.plan.id);
  expect(changed).toMatchObject({ linked: false, resolutionRequired: true }); expect(changed.resolution!.operatorPlans?.TWITCH).toBeUndefined();
  const second = await prepare(f);
  await db.twitchCanonicalizationPlan.update({ where: { id: second.plan.id }, data: { createdAt: new Date(0), expiresAt: new Date(1) } });
  expect((await link.pending(f.identity.id))!.operatorPlans?.TWITCH).toBeUndefined();
  await db.twitchNativeAuthority.update({ where: { id: 'twitch-commands' }, data: { desiredMode: 'CANARY', revision: 12, acknowledgement: STREAMERBOT_PATH_DISABLED, acknowledgedAt: new Date() } });
  try { await expect(operator.prepare(f.input, async () => {})).rejects.toMatchObject({ code: 'TWITCH_OPERATOR_PLAN_BLOCKED' }); }
  finally { await db.twitchNativeAuthority.update({ where: { id: 'twitch-commands' }, data: { desiredMode: 'OFF', revision: 11 } }); }
  expect(await db.player.findUniqueOrThrow({ where: { id: f.loser } })).toMatchObject({ status: 'ACTIVE' });
}, 120_000);

it('revalidates after a concurrent social writer and drains every operation before releasing connections', async () => {
  const f = await profiles('TWITCH'), { plan, pending } = await prepare(f);
  let release!: () => void, locked!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; }), lock = new Promise<void>(resolve => { locked = resolve; });
  const writer = db.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('social:friendship'))::text`;
    locked(); await gate;
    await tx.friendship.update({ where: { id: f.friendship.id }, data: { totalHearts: 100n } });
  });
  await lock;
  const resolution = link.resolve(f.identity.id, pending.id, 'TWITCH', pending.revision, plan.id);
  // Observe the actual advisory-lock wait, without a Promise.race leaving work behind.
  let waiting = false;
  try {
    for (let attempt = 0; attempt < 100 && !waiting; attempt++) {
      const result = await fixture.admin.query<{ waiting: boolean }>(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE wait_event='advisory' AND query LIKE '%social:friendship%') waiting`);
      waiting = result.rows[0]!.waiting;
      if (!waiting) await new Promise(resolve => setTimeout(resolve, 10));
    }
  } finally { release(); }
  await writer; const result = await resolution;
  expect(waiting).toBe(true); expect(result).toMatchObject({ linked: false, resolutionRequired: true });
  expect(await db.friendship.findUniqueOrThrow({ where: { id: f.friendship.id } })).toMatchObject({ state: 'ACTIVE', totalHearts: 100n });
  expect(await db.player.findUniqueOrThrow({ where: { id: f.loser } })).toMatchObject({ status: 'ACTIVE' });
}, 120_000);

it('refuses uncertain global outbound even when its local business operation is completed', async () => {
  const f = await profiles('TWITCH');
  const receipt = await db.twitchEventReceipt.create({ data: { externalEventId: randomUUID(), eventType: 'channel.chat.message', twitchUserId: '970099999999', state: 'PROCESSED', processedAt: new Date(), payloadMinimal: { commandPilot: { stage: 'RESPONSES', responses: [{ status: 'AMBIGUOUS' }] } } } });
  try {
    await expect(operator.prepare(f.input, async () => {})).rejects.toMatchObject({ code: 'TWITCH_OPERATOR_PLAN_BLOCKED' });
    expect(await db.twitchCanonicalizationPlan.count({ where: { webIdentityId: f.identity.id } })).toBe(0);
  } finally { await db.twitchEventReceipt.update({ where: { id: receipt.id }, data: { payloadMinimal: { commandPilot: { stage: 'RESPONSES', responses: [{ status: 'SENT' }] } } } }); }
}, 120_000);

it('keeps external terminal Arcade references unchanged and rejects an unproven terminal invitation', async () => {
  const f = await profiles('TWITCH'), now = new Date();
  const finish = await db.businessOperation.create({ data: { playerId: f.peer.id, operationType: 'arcade.finish', sourceChannel: 'UI', status: 'COMPLETED', completedAt: now } });
  const session = await db.arcadeSession.create({ data: { playerId: f.peer.id, opponentPlayerId: f.loser, mode: 'MULTIPLAYER', game: 'MEMORY', difficulty: 'EASY', status: 'FINISHED', firstSide: 'PLAYER', privateState: {}, randomState: 1n, banterId: 'fixture', nextActionAt: now, finishedAt: now, outcome: 'WIN', performancePoints: 1, xpAwarded: 0, businessDate: now, finishOperationId: finish.id } });
  const invitation = await db.arcadeInvitation.create({ data: { hostPlayerId: f.peer.id, guestPlayerId: f.loser, game: 'MEMORY', difficulty: 'EASY', status: 'STARTED', guestReady: true, sessionId: session.id, resolvedAt: now, createdAt: now, expiresAt: new Date(+now + 120_000) } });
  const operation = await db.businessOperation.create({ data: { playerId: f.loser, operationType: 'arcade.state', sourceChannel: 'UI', status: 'COMPLETED', completedAt: now } });
  const receipt = await db.arcadeReceipt.create({ data: { playerId: f.loser, sessionId: session.id, operationId: operation.id, idempotencyKey: randomUUID(), fingerprint: 'f'.repeat(64), response: {} } });
  const stat = await db.arcadeStat.create({ data: { playerId: f.loser, game: 'MEMORY', difficulty: 'EASY', played: 1n, wins: 1n, bestPoints: 1, bestPairs: 1, bestOutcome: 'WIN', bestSessionId: session.id } });
  await db.arcadeSession.update({ where: { id: session.id }, data: { opponentPlayerId: f.twitch.id } });
  await expect(operator.prepare(f.input, async () => {})).rejects.toMatchObject({ code: 'TWITCH_OPERATOR_PLAN_BLOCKED' });
  await db.arcadeSession.update({ where: { id: session.id }, data: { opponentPlayerId: f.loser, updatedAt: session.updatedAt } });
  const { plan, pending, backup } = await prepare(f);
  expect(backup.evidence.web.parents.arcade_sessions!.some(row => row.includes(session.id))).toBe(true);
  await expect(link.resolve(f.identity.id, pending.id, 'TWITCH', pending.revision, plan.id)).resolves.toMatchObject({ linked: true });
  expect(await db.arcadeSession.findUniqueOrThrow({ where: { id: session.id } })).toEqual(session);
  expect(await db.arcadeInvitation.findUniqueOrThrow({ where: { id: invitation.id } })).toEqual(invitation);
  expect(await db.arcadeReceipt.findUniqueOrThrow({ where: { id: receipt.id } })).toEqual(receipt);
  expect(await db.arcadeStat.findUniqueOrThrow({ where: { playerId_game_difficulty: { playerId: f.loser, game: 'MEMORY', difficulty: 'EASY' } } })).toEqual(stat);
}, 120_000);

it('blocks only WEB on a standalone legacy pair collision and lets explicit TWITCH preserve the legacy version', async () => {
  const f = await profiles('TWITCH'), now = new Date(), peerTwitchId = String(970099000000 + sequence);
  await db.twitchIdentity.create({ data: { playerId: f.peer.id, twitchUserId: peerTwitchId, login: 'peer', firstSeenAt: now } });
  for (const playerId of [f.twitch.id, f.peer.id]) await db.migrationRun.create({ data: { playerId, snapshotHash: 'a'.repeat(64), summary: {} } });
  const fact = await db.legacyFriendshipFact.create({ data: { ...legacySource(12, 70), leftTwitchUserId: f.twitchUserId, rightTwitchUserId: peerTwitchId, leftProofHash: 'f'.repeat(64), rightProofHash: 'a'.repeat(64), status: 'MATERIALIZED' } });
  const [playerAId, playerBId] = [f.twitch.id, f.peer.id].sort() as [string, string];
  const legacy = await db.friendship.create({ data: { playerAId, playerBId, legacyFactId: fact.id, legacyLeftPlayerId: f.twitch.id, level: 12, totalHearts: 70n, becameFriendsAt: now } });
  const today = businessDateToDatabaseDate(getBusinessDate(now));
  for (const senderPlayerId of [f.web.id, f.peer.id]) await db.friendshipLegacyHeartState.create({ data: { friendshipId: f.friendship.id, senderPlayerId, lastHeartSentDate: today, legacyProvenance: { fixture: 'proven old daily usage' } } });
  await expect(operator.prepare({ ...f.input, choice: 'WEB' }, async () => {})).rejects.toMatchObject({ code: 'TWITCH_OPERATOR_PLAN_BLOCKED' });
  const { plan, pending } = await prepare(f);
  expect(pending.safety.WEB.status).toBe('OPERATOR_REQUIRED'); expect(pending.operatorPlans?.WEB).toBeUndefined();
  expect(pending.operatorPlans?.TWITCH?.id).toBe(plan.id);
  await expect(link.resolve(f.identity.id, pending.id, 'TWITCH', pending.revision, plan.id)).resolves.toMatchObject({ linked: true });
  expect(await db.friendship.findUniqueOrThrow({ where: { id: legacy.id } })).toEqual(legacy);
  expect(await db.friendship.findUniqueOrThrow({ where: { id: f.friendship.id } })).toMatchObject({ state: 'ARCHIVED', level: 3, totalHearts: 99n });
  for (const senderPlayerId of [f.twitch.id, f.peer.id]) expect(await db.friendshipLegacyHeartState.findUniqueOrThrow({ where: { friendshipId_senderPlayerId: { friendshipId: legacy.id, senderPlayerId } } })).toMatchObject({ lastHeartSentDate: today, legacyProvenance: { source: 'R1055_RETIRED_USAGE' } });
}, 120_000);

it('retargets legacy friendship to a significant WEB winner with completed resolution provenance and no economic merge', async () => {
  const f = await profiles('WEB', true), now = new Date(), peerTwitchId = String(970098000000 + sequence);
  await db.twitchIdentity.create({ data: { playerId: f.peer.id, twitchUserId: peerTwitchId, login: 'peer', firstSeenAt: now } });
  for (const playerId of [f.twitch.id, f.peer.id]) await db.migrationRun.create({ data: { playerId, snapshotHash: '1'.repeat(64), summary: {} } });
  const fact = await db.legacyFriendshipFact.create({ data: { ...legacySource(3, 99), leftTwitchUserId: f.twitchUserId, rightTwitchUserId: peerTwitchId, leftProofHash: '6'.repeat(64), rightProofHash: '7'.repeat(64), status: 'MATERIALIZED' } });
  await db.friendship.update({ where: { id: f.friendship.id }, data: { legacyFactId: fact.id, legacyLeftPlayerId: f.twitch.id } });
  const before = await captureTargetedPlayerRows(db, [f.web.id, f.twitch.id, f.peer.id]);
  const { plan, pending } = await prepare(f);
  await expect(link.resolve(f.identity.id, pending.id, 'WEB', pending.revision, plan.id)).resolves.toMatchObject({ linked: true, playerId: f.web.id });
  const versions = await db.friendship.findMany({ where: { legacyFactId: fact.id }, orderBy: { createdAt: 'asc' } });
  expect(versions).toHaveLength(2);
  expect(versions.find(row => row.id === f.friendship.id)).toMatchObject({ state: 'ARCHIVED', supersededAt: expect.any(Date), level: 3, totalHearts: 99n });
  expect(versions.find(row => !row.supersededAt)).toMatchObject({ state: 'ACTIVE', legacyLeftPlayerId: f.web.id, level: 3, totalHearts: 99n });
  const after = await captureTargetedPlayerRows(db, [f.web.id, f.twitch.id, f.peer.id]);
  for (const [table, rows] of Object.entries(before.tables)) if (!['players', 'web_identities', 'twitch_identities'].includes(table)) expect(after.tables[table], table).toEqual(rows);
  expect(await db.playerProgression.findUniqueOrThrow({ where: { playerId: f.web.id } })).toMatchObject({ xp: 777n });
  expect(await db.playerProgression.findUniqueOrThrow({ where: { playerId: f.twitch.id } })).toMatchObject({ xp: 1n });
}, 120_000);
