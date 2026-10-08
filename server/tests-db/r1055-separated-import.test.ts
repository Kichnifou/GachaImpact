import { randomUUID } from 'node:crypto';
import { mkdtemp, open, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { bootstrapPlayer } from '../src/infrastructure/database/player-bootstrap.js';
import { permanentMissionCatalog } from '../src/domain/missions/permanent-mission-catalog.js';
import { canarySnapshot } from '../tests/helpers/legacy-canary-snapshot.js';
import { applyLegacyCanary, planLegacyCanary, rollbackLegacyCanary, type CanaryBackup } from '../src/application/migration/legacy-canary.js';
import { captureTargetedPlayerRows } from '../src/application/migration/targeted-player-rows.js';
import { assessPlayerCanonicalizationSafety } from '../src/application/twitch/player-canonicalization-safety.js';
import { TwitchAccountLink } from '../src/application/twitch/twitch-account-link.js';
import { STREAMERBOT_PATH_DISABLED } from '../src/application/twitch/twitch-native-authority.js';

// Synthetic graphs only. This proves existing gates, not an operator override.
const fixture = isolatedBatchDatabase(), db = fixture.database, link = new TwitchAccountLink(db);
const config = { host: 'localhost', port: 3001, supabase: {}, twitchCommandPilot: { enabled: false, globalEnabled: false },
  twitch: { pilotPlayerIds: [] as string[], pilotLogin: 'kichnifou' } };
let operatorId: string, backupDirectory: string;
beforeAll(async () => {
  const url = new URL(process.env['DATABASE_URL'] ?? '');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw Error('This proof requires local PostgreSQL');
  await fixture.setup({ prismaMigrations: true });
  await db.character.create({ data: { externalKey: 'legacy:1', name: 'Synthetic character', rarity: 5, elementKey: 'cryo' } });
  await db.permanentMissionDefinition.createMany({ data: permanentMissionCatalog.map(entry => ({ ...entry })), skipDuplicates: true });
  const operator = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Private operator',
    twitchIdentity: { twitchUserId: '900000000000', login: 'kichnifou', displayName: 'Private operator', firstSeenAt: new Date() } }));
  operatorId = operator.id; config.twitch.pilotPlayerIds.push(operatorId);
  await db.playerRoleAssignment.create({ data: { playerId: operatorId, role: 'ADMIN', source: 'private-fixture' } });
  await db.twitchNativeAuthority.create({ data: { id: 'twitch-commands', operatorPlayerId: operatorId, desiredMode: 'OFF' } });
  backupDirectory = await mkdtemp(path.join(tmpdir(), 'gacha-r1055-separated-'));
}, 180_000);
afterAll(async () => {
  await fixture.cleanup();
  const pool = fixture.poolSnapshot();
  expect(pool).toMatchObject({ total: 0, idle: 0, waiting: 0 }); expect(pool.opened).toBe(pool.closed);
  if (backupDirectory) {
    const target = path.resolve(backupDirectory);
    if (path.dirname(target) !== path.resolve(tmpdir()) || !path.basename(target).startsWith('gacha-r1055-separated-')) throw Error('Unsafe backup directory');
    await rm(target, { recursive: true });
  }
}, 60_000);

async function webWithSharedState() {
  const web = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Private canary',
    webIdentity: { provider: 'supabase', providerSubject: randomUUID() } }));
  const peer = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Private peer' }));
  await db.playerProgression.update({ where: { playerId: web.id }, data: { xp: 777n } });
  const [playerAId, playerBId] = [web.id, peer.id].sort() as [string, string];
  const friendship = await db.friendship.create({ data: { playerAId, playerBId, becameFriendsAt: new Date() } });
  const conversation = await db.directConversation.create({ data: { playerAId, playerBId,
    participants: { create: [{ playerId: web.id }, { playerId: peer.id }] } } });
  const operation = await db.businessOperation.create({ data: { playerId: web.id, operationType: 'direct-message.send',
    sourceChannel: 'UI', status: 'COMPLETED', completedAt: new Date() } });
  await db.directMessage.create({ data: { conversationId: conversation.id, authorPlayerId: web.id, operationId: operation.id, content: 'Synthetic history' } });
  const identity = await db.webIdentity.findUniqueOrThrow({ where: { playerId: web.id } });
  const shared = async () => ({
    friendship: await db.friendship.findUniqueOrThrow({ where: { id: friendship.id } }),
    conversation: await db.directConversation.findUniqueOrThrow({ where: { id: conversation.id } }),
    participants: await db.directConversationParticipant.findMany({ where: { conversationId: conversation.id }, orderBy: { playerId: 'asc' } }),
    messages: await db.directMessage.findMany({ where: { conversationId: conversation.id }, orderBy: { submissionOrder: 'asc' } }),
  });
  const graph = async () => captureTargetedPlayerRows(db, [web.id, peer.id]);
  const assessment = await db.$transaction(tx => assessPlayerCanonicalizationSafety(tx, web.id), { isolationLevel: 'RepeatableRead', timeout: 30_000 });
  expect(assessment.safety.status).toBe('OPERATOR_REQUIRED');
  return { web, peer, identity, shared, graph };
}
async function importSeparate() {
  const { snapshot, report } = canarySnapshot(), twitchUserId = report.users[0]!.twitchUserId;
  const plan = await planLegacyCanary(db, snapshot, report, twitchUserId, null, new Date());
  expect(plan.blockers).toEqual([]); expect(plan.expectedPlayerId).toBeNull(); expect(plan.player.mappingMode).toBe('TWITCH_ONLY');
  const backupPath = path.join(backupDirectory, `${randomUUID()}.json`);
  const result = await applyLegacyCanary(db, config, operatorId, plan, STREAMERBOT_PATH_DISABLED, async backup => {
    const file = await open(backupPath, 'wx', 0o600);
    try { await file.writeFile(JSON.stringify(backup)); await file.sync(); } finally { await file.close(); }
  });
  const backup = JSON.parse(await readFile(backupPath, 'utf8')) as CanaryBackup;
  expect(result).toMatchObject({ status: 'DATA_IMPORTED', dataAuthority: 'LEGACY', backupHash: backup.hash });
  expect(await db.player.findUniqueOrThrow({ where: { id: result.playerId } })).toMatchObject({ status: 'ACTIVE' });
  expect(await db.twitchNativeTarget.findUniqueOrThrow({ where: { twitchUserId } })).toMatchObject({ playerId: result.playerId, dataAuthority: 'LEGACY', canary: false });
  expect(await db.twitchCanaryImport.findUniqueOrThrow({ where: { id: result.runId } })).toMatchObject({ playerId: result.playerId, status: 'DATA_IMPORTED', backupHash: backup.hash, snapshotHash: snapshot.hash });
  expect(await db.webIdentity.count({ where: { playerId: result.playerId } })).toBe(0);
  expect(await db.twitchIdentity.findUniqueOrThrow({ where: { twitchUserId } })).toMatchObject({ playerId: result.playerId });
  expect((await db.playerProgression.findUniqueOrThrow({ where: { playerId: result.playerId } })).xp).toBe(300n);
  return { result, backup, twitchUserId };
}

it('imports B independently of unsafe A and restores the exact absent preimage without touching A or its peer', async () => {
  const a = await webWithSharedState(), graph = await a.graph(), shared = await a.shared();
  const b = await importSeparate();
  expect(b.result.playerId).not.toBe(a.web.id);
  expect((await a.graph()).hash).toBe(graph.hash); expect(await a.shared()).toEqual(shared);
  await expect(rollbackLegacyCanary(db, config, operatorId, b.backup)).resolves.toMatchObject({ status: 'ROLLED_BACK', preimageHash: b.backup.rows.hash });
  expect((await captureTargetedPlayerRows(db, b.backup.rows.playerIds)).hash).toBe(b.backup.rows.hash);
  expect(await db.player.findUnique({ where: { id: b.result.playerId } })).toBeNull();
  expect(await db.twitchIdentity.findUnique({ where: { twitchUserId: b.twitchUserId } })).toBeNull();
  expect(await db.twitchNativeTarget.findUnique({ where: { twitchUserId: b.twitchUserId } })).toBeNull();
  expect(await db.twitchCanaryImport.count({ where: { twitchUserId: b.twitchUserId } })).toBe(0);
  expect((await a.graph()).hash).toBe(graph.hash); expect(await a.shared()).toEqual(shared);
}, 180_000);

it('keeps TWITCH blocked after independent import, while WEB preserves shared history and both economic graphs', async () => {
  const a = await webWithSharedState(), b = await importSeparate(), before = await a.graph(), shared = await a.shared();
  const bBefore = await captureTargetedPlayerRows(db, [b.result.playerId]);
  await link.verified(a.identity.id, a.web.id, b.twitchUserId, 'fixture_canary', 'Private canary');
  const pending = (await link.pending(a.identity.id))!;
  expect(pending.safety).toMatchObject({ TWITCH: { status: 'OPERATOR_REQUIRED' }, WEB: { status: 'SAFE' } });
  await expect(link.resolve(a.identity.id, pending.id, 'TWITCH', pending.revision)).rejects.toMatchObject({ code: 'TWITCH_PROGRESSION_SHARED_STATE_REQUIRES_OPERATOR' });
  expect((await a.graph()).hash).toBe(before.hash); expect(await a.shared()).toEqual(shared);
  expect((await captureTargetedPlayerRows(db, [b.result.playerId])).hash).toBe(bBefore.hash);
  await expect(link.resolve(a.identity.id, pending.id, 'WEB', pending.revision)).resolves.toMatchObject({ linked: true, playerId: a.web.id });
  expect(await a.shared()).toEqual(shared);
  expect(await db.player.findUniqueOrThrow({ where: { id: b.result.playerId } })).toMatchObject({ status: 'ARCHIVED' });
  expect((await a.graph()).tables.players).toEqual(before.tables.players);
  expect(await db.webIdentity.count({ where: { playerId: b.result.playerId } })).toBe(0);
  expect(await db.twitchIdentity.count({ where: { playerId: b.result.playerId } })).toBe(0);
  expect(await db.webIdentity.findUniqueOrThrow({ where: { id: a.identity.id } })).toEqual(a.identity);
  expect(await db.twitchIdentity.findUniqueOrThrow({ where: { twitchUserId: b.twitchUserId } })).toMatchObject({ playerId: a.web.id });
  expect(await db.twitchNativeTarget.findUniqueOrThrow({ where: { twitchUserId: b.twitchUserId } })).toMatchObject({ playerId: a.web.id, dataAuthority: 'LEGACY', canary: false });
  expect(await db.twitchCanaryImport.findUniqueOrThrow({ where: { id: b.result.runId } })).toMatchObject({ playerId: b.result.playerId, status: 'DATA_IMPORTED', backupHash: b.backup.hash });
  // Only the expected player/identity rows may differ. All captured gameplay and peer rows remain exact.
  for (const [preimage, ids] of [[before, [a.web.id, a.peer.id]], [bBefore, [b.result.playerId]]] as const) {
    const after = await captureTargetedPlayerRows(db, [...ids]);
    for (const [table, rows] of Object.entries(preimage.tables))
      if (!['players', 'twitch_identities'].includes(table)) expect(after.tables[table], table).toEqual(rows);
  }
  await expect(link.resolve(a.identity.id, pending.id, 'WEB', pending.revision)).resolves.toMatchObject({ linked: true, playerId: a.web.id });
  await expect(link.resolve(a.identity.id, pending.id, 'TWITCH', pending.revision)).rejects.toMatchObject({ code: 'TWITCH_PROFILE_CHANGED' });
  // A completed identity choice is outside the canary rollback contract.
  await expect(rollbackLegacyCanary(db, config, operatorId, b.backup)).rejects.toThrow('CANARY_ROLLBACK_LEGACY_REQUIRED');
}, 180_000);
