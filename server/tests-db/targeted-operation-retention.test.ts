import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { bootstrapPlayer } from '../src/infrastructure/database/player-bootstrap.js';
import { canarySnapshot } from '../tests/helpers/legacy-canary-snapshot.js';
import { applyLegacyCanary, canaryBackupHash, planLegacyCanary, rollbackLegacyCanary, type CanaryBackup } from '../src/application/migration/legacy-canary.js';
import { assertTargetedDeletionSafe, captureTargetedPlayerRows, deleteTargetedRows, personalReplacementTables, planTargetedRetention, restoreTargetedRows, targetedRowMetadata } from '../src/application/migration/targeted-player-rows.js';
import { classifyOperationForeignKeys, operationReferenceContract } from '../src/application/migration/operation-retention-contract.js';
import { STREAMERBOT_PATH_DISABLED } from '../src/application/twitch/twitch-native-authority.js';
import { compareLegacyPersonalState } from '../src/application/migration/legacy-personal-compare.js';
import { canaryBackupSchema } from '../src/application/migration/canary-cli-contract.js';
import { GlobalChatService } from '../src/application/chat/global-chat-service.js';
import { GiftCodeService } from '../src/application/gift-code/gift-code-service.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { PrismaCurrentPlayerStore } from '../src/infrastructure/database/prisma-current-player-store.js';
import { SnapshotPilotService } from '../src/application/migration/snapshot-pilot-service.js';
import { ChatCommandDispatcher, type ChatCommandServices } from '../src/application/chat/chat-command-dispatcher.js';
import { GetCurrentPlayerBank, TransferPlayerBank } from '../src/application/banking/banking-services.js';
import { PrismaBankingStore } from '../src/infrastructure/database/prisma-banking-store.js';

const fixture = isolatedBatchDatabase(), db = fixture.database;
const replacing = new Set<string>(personalReplacementTables);
const config = { host: 'localhost', port: 3001, supabase: {}, twitchCommandPilot: { enabled: true, globalEnabled: false },
  twitch: { pilotPlayerIds: [] as string[], pilotLogin: 'kichnifou' } };
let operatorId: string, sequence = 10;
beforeAll(async () => {
  await fixture.setup({ seedPublicCatalog: true });
  const operator = await db.player.create({ data: { displayName: 'Synthetic operator',
    twitchIdentity: { create: { twitchUserId: '900000000000', login: 'kichnifou', displayName: 'Synthetic operator', firstSeenAt: new Date() } } } });
  operatorId = operator.id; config.twitch.pilotPlayerIds.push(operatorId);
  await db.playerRoleAssignment.create({ data: { playerId: operatorId, role: 'ADMIN', source: 'private-fixture' } });
}, 60_000);
afterAll(() => fixture.cleanup(), 60_000);
async function target() {
  const { snapshot, report } = canarySnapshot();
  report.users[0]!.twitchUserId = String(900000000000 + sequence++);
  const subject = randomUUID();
  const player = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Synthetic retention target',
    webIdentity: { provider: 'supabase', providerSubject: subject },
    twitchIdentity: { twitchUserId: report.users[0]!.twitchUserId, login: 'fixture_canary', displayName: 'Fixture', firstSeenAt: new Date() } }));
  await db.playerProgression.update({ where: { playerId: player.id }, data: { xp: 777n } });
  await db.playerResourceBalance.updateMany({ where: { playerId: player.id }, data: { amount: 999n } });
  await db.playerBankAccount.create({ data: { playerId: player.id, balance: 888n, lastInterestDate: new Date('2026-10-05') } });
  await db.player.update({ where: { id: player.id }, data: { elementKey: 'pyro' } });
  await db.playerGachaState.update({ where: { playerId: player.id }, data: { pity5: 27 } });
  await db.playerRoleAssignment.create({ data: { playerId: player.id, role: 'TESTER', source: 'preserved' } });
  await db.playerPreference.create({ data: { playerId: player.id, preferenceKey: 'menu.defaultTab', value: 'inventory' } });
  await db.privacySetting.update({ where: { playerId_categoryKey: { playerId: player.id, categoryKey: 'PRIVATE_MESSAGES' } }, data: { level: 'FRIENDS' } });
  return { playerId: player.id, subject, snapshot, report, twitchUserId: report.users[0]!.twitchUserId };
}
type Target = Awaited<ReturnType<typeof target>>;
const plan = (t: Target) => planLegacyCanary(db, t.snapshot, t.report, t.twitchUserId, t.playerId, new Date());
const graph = (t: Target) => captureTargetedPlayerRows(db, [t.playerId]);
async function operation(t: Target, status: 'COMPLETED' | 'FAILED' | 'PENDING' = 'COMPLETED') {
  const op = await db.businessOperation.create({ data: { playerId: t.playerId, operationType: 'chat.send', sourceChannel: 'INTERNAL_CHAT',
    idempotencyKey: randomUUID(), status, resultSummary: { historical: true }, completedAt: status === 'PENDING' ? null : new Date() } });
  await fixture.admin.query('UPDATE business_operations SET started_at=$1::timestamptz,completed_at=$2::timestamptz WHERE id=$3',
    ['2026-10-01T10:00:00.123456Z', status === 'PENDING' ? null : '2026-10-01T10:00:01.654321Z', op.id]);
  return op;
}
async function history(t: Target, opId: string) {
  return db.globalChatMessage.create({ data: { authorPlayerId: t.playerId, operationId: opId, sourceChannel: 'INTERNAL_CHAT', messageType: 'PLAYER', content: 'Synthetic history' } });
}
async function movement(t: Target, opId: string) {
  return db.resourceMovement.create({ data: { playerId: t.playerId, resourceKey: 'moras', delta: 10n, balanceBefore: 0n,
    balanceAfter: 10n, causeKey: 'synthetic', domainKey: 'fixture', sourceChannel: 'INTERNAL_CHAT', operationId: opId } });
}
async function imported(t: Target) {
  const p = await plan(t); expect(p.blockers).toEqual([]);
  let backup!: CanaryBackup;
  await applyLegacyCanary(db, config, operatorId, p, STREAMERBOT_PATH_DISABLED, async b => { backup = b; });
  return { p, backup };
}
async function replace(t: Target) {
  await db.$transaction(async tx => {
    const rows = await captureTargetedPlayerRows(tx, [t.playerId]);
    await deleteTargetedRows(tx, rows, replacing, await planTargetedRetention(tx, rows));
  }, { timeout: 120_000 });
}

describe('targeted replacement retention contract on private PostgreSQL', () => {
  it('classifies ALL 30 actual foreign keys exactly once, including the complete conserved category', async () => {
    const { fks } = await targetedRowMetadata(db);
    expect(classifyOperationForeignKeys(fks, replacing)).toHaveLength(30);
    expect(new Set(operationReferenceContract.map(([t, c]) => `${t}.${c}`)).size).toBe(30);
    expect(operationReferenceContract.filter(([, , c]) => c === 'CONSERVED')).toHaveLength(18);
  });
  it('deletes an unreferenced operation', async () => {
    const t = await target(), op = await operation(t); await replace(t);
    expect(await db.businessOperation.findUnique({ where: { id: op.id } })).toBeNull();
  });
  it.each(['COMPLETED', 'FAILED'] as const)('retains a %s parent byte-for-byte, including microsecond timestamps', async status => {
    const t = await target(), op = await operation(t, status); await history(t, op.id);
    const before = await graph(t); await replace(t);
    expect((await graph(t)).tables.business_operations).toEqual(before.tables.business_operations);
  });
  it('blocks a referenced PENDING parent before a backup or business write', async () => {
    const t = await target(), op = await operation(t, 'PENDING'); await history(t, op.id);
    const before = await graph(t), p = await plan(t), backup = vi.fn();
    expect(p.blockers).toContain('CANARY_SHARED_REFERENCE_REQUIRES_OPERATOR');
    await expect(applyLegacyCanary(db, config, operatorId, p, STREAMERBOT_PATH_DISABLED, backup)).rejects.toThrow('CANARY_PREFLIGHT_BLOCKED');
    expect(backup).not.toHaveBeenCalled(); expect((await graph(t)).hash).toBe(before.hash);
  });
  it('deletes a replaceable child and its parent', async () => {
    const t = await target(), op = await operation(t), child = await movement(t, op.id); await replace(t);
    expect(await db.resourceMovement.findUnique({ where: { id: child.id } })).toBeNull();
    expect(await db.businessOperation.findUnique({ where: { id: op.id } })).toBeNull();
  });
  it('retains the explicitly classified historical child without deleting it', async () => {
    const t = await target(), op = await operation(t), child = await history(t, op.id); await replace(t);
    expect(await db.globalChatMessage.findUniqueOrThrow({ where: { id: child.id } })).toEqual(child);
  });
  it('keeps the original general FK guard strict when no explicit retention is supplied', async () => {
    const t = await target(), op = await operation(t); await history(t, op.id);
    await expect(assertTargetedDeletionSafe(db, await graph(t), replacing)).rejects.toThrow('CANARY_SHARED_REFERENCE_REQUIRES_OPERATOR');
  });
  it('fails closed for a new actual FK even with no rows and removes the private test DDL', async () => {
    const t = await target();
    await fixture.admin.query('CREATE TABLE retention_unknown (id uuid PRIMARY KEY,operation_id uuid REFERENCES business_operations(id))');
    try { await expect(planTargetedRetention(db, await graph(t))).rejects.toThrow('CANARY_OPERATION_FK_UNCLASSIFIED'); }
    finally { await fixture.admin.query('DROP TABLE retention_unknown'); }
  });
  it('fails closed for an unclassified column on a known table', async () => {
    const t = await target();
    await fixture.admin.query('ALTER TABLE global_chat_messages ADD COLUMN retention_unknown uuid REFERENCES business_operations(id)');
    try { await expect(planTargetedRetention(db, await graph(t))).rejects.toThrow('CANARY_OPERATION_FK_UNCLASSIFIED'); }
    finally { await fixture.admin.query('ALTER TABLE global_chat_messages DROP COLUMN retention_unknown'); }
  });
  it('deduplicates one parent referenced by multiple conserved children', async () => {
    const t = await target(), op = await operation(t); await history(t, op.id);
    const code = await db.giftCode.create({ data: { token: randomUUID().replaceAll('-', '').toUpperCase(), title: 'Synthetic', description: '', type: 'ONE_OFF', status: 'DISABLED',
      legacyProvenance: { source: 'fixture' }, editions: { create: { editionKey: 'fixture', startsAt: new Date('2026-10-01'), endsAt: new Date('2026-11-01') } } }, include: { editions: true } });
    await db.giftCodeClaim.create({ data: { giftCodeEditionId: code.editions[0]!.id, playerId: t.playerId, sourceChannel: 'UI', operationId: op.id } });
    const retention = await planTargetedRetention(db, await graph(t));
    expect(retention.operations).toHaveLength(1); expect(retention.references).toHaveLength(2);
  });
  it('refuses another Player personal child even when downward capture encounters it', async () => {
    const t = await target(), peer = await target(), op = await operation(t); await movement(peer, op.id);
    await expect(planTargetedRetention(db, await graph(t))).rejects.toThrow('CANARY_SHARED_REFERENCE_REQUIRES_OPERATOR');
  });
  it('leaves another Player personal child exact when a conserved fact already requires its parent', async () => {
    const t = await target(), peer = await target(), op = await operation(t); await history(t, op.id);
    const child = await movement(peer, op.id), peerBefore = await graph(peer);
    expect((await graph(t)).tables.resource_movements).toEqual([]);
    const { backup } = await imported(t);
    expect(await db.resourceMovement.findUniqueOrThrow({ where: { id: child.id } })).toEqual(child);
    expect((await graph(peer)).hash).toBe(peerBefore.hash);
    await rollbackLegacyCanary(db, config, operatorId, backup);
    expect((await graph(peer)).hash).toBe(peerBefore.hash);
  }, 120_000);
  it('refuses an incompletely captured targeted child even when a conserved fact retains its parent', async () => {
    const t = await target(), op = await operation(t); await history(t, op.id); await movement(t, op.id);
    const rows = await graph(t); rows.tables.resource_movements = [];
    await expect(planTargetedRetention(db, rows)).rejects.toThrow('CANARY_SHARED_REFERENCE_REQUIRES_OPERATOR');
  });
  it('refuses any other out-of-graph reference without broadening the guard', async () => {
    const t = await target(), team = await db.team.create({ data: { playerId: t.playerId, name: 'Synthetic team', displayPosition: 1 } });
    await fixture.admin.query('CREATE TABLE retention_team_ref (team_id uuid REFERENCES teams(id))');
    try {
      await fixture.admin.query('INSERT INTO retention_team_ref VALUES ($1)', [team.id]);
      const rows = await graph(t), retention = await planTargetedRetention(db, rows);
      await expect(assertTargetedDeletionSafe(db, rows, replacing, retention)).rejects.toThrow('CANARY_SHARED_REFERENCE_REQUIRES_OPERATOR');
    } finally { await fixture.admin.query('DROP TABLE retention_team_ref'); }
  });
  it('applies a mixed retained/deleted replacement and records the complete version 2 preimage', async () => {
    const t = await target(), kept = await operation(t), removed = await operation(t); await history(t, kept.id); await movement(t, kept.id);
    const before = await graph(t), { backup } = await imported(t);
    expect(backup.version).toBe(2); expect(backup.rows.hash).toBe(before.hash);
    expect(canaryBackupSchema.safeParse(JSON.parse(JSON.stringify(backup))).success).toBe(true);
    expect((await graph(t)).tables.business_operations).toEqual(before.tables.business_operations!.filter(row => JSON.parse(row).id === kept.id));
    expect(await db.businessOperation.findUnique({ where: { id: removed.id } })).toBeNull();
    expect(await db.resourceMovement.count({ where: { playerId: t.playerId } })).toBe(0);
    await rollbackLegacyCanary(db, config, operatorId, backup); expect((await graph(t)).hash).toBe(before.hash);
  }, 120_000);
  it('rolls back the transaction after a genuine partial deletion', async () => {
    const t = await target(), op = await operation(t); await history(t, op.id); const before = await graph(t);
    await expect(db.$transaction(async tx => {
      const rows = await captureTargetedPlayerRows(tx, [t.playerId]);
      await deleteTargetedRows(tx, rows, new Set(['player_resource_balances']), await planTargetedRetention(tx, rows));
      expect(await tx.playerResourceBalance.count({ where: { playerId: t.playerId } })).toBe(0);
      throw new Error('SYNTHETIC_FAILURE_AFTER_DELETE');
    }, { timeout: 120_000 })).rejects.toThrow('SYNTHETIC_FAILURE_AFTER_DELETE');
    expect((await graph(t)).hash).toBe(before.hash);
  }, 120_000);
  it('rolls back the actual canary apply when mapping fails after deletion, despite the saved backup', async () => {
    const t = await target(), op = await operation(t); await history(t, op.id); const before = await graph(t), p = await plan(t), backup = vi.fn();
    const failure = vi.spyOn(SnapshotPilotService.prototype, 'globalPlayerPlan').mockRejectedValueOnce(new Error('SYNTHETIC_APPLY_FAILURE_AFTER_DELETE'));
    try {
      await expect(applyLegacyCanary(db, config, operatorId, p, STREAMERBOT_PATH_DISABLED, backup)).rejects.toThrow('SYNTHETIC_APPLY_FAILURE_AFTER_DELETE');
      expect(backup).toHaveBeenCalledOnce(); expect((await graph(t)).hash).toBe(before.hash);
      expect(await db.twitchNativeTarget.count({ where: { twitchUserId: t.twitchUserId } })).toBe(0);
      expect(await db.twitchCanaryImport.count({ where: { twitchUserId: t.twitchUserId } })).toBe(0);
    } finally { failure.mockRestore(); }
  }, 120_000);
  it('restores the exact preimage after explicit apply/rollback with retained operations', async () => {
    const t = await target(), op = await operation(t); await history(t, op.id); const before = await graph(t), { backup } = await imported(t);
    expect((await rollbackLegacyCanary(db, config, operatorId, backup)).preimageHash).toBe(before.hash);
    expect((await graph(t)).hash).toBe(before.hash);
  }, 120_000);
  it.each(['modified', 'missing'] as const)('refuses rollback when a retained operation is %s without silent repair', async kind => {
    const t = await target(), op = await operation(t); await history(t, op.id); const { backup } = await imported(t);
    if (kind === 'modified') await db.businessOperation.update({ where: { id: op.id }, data: { resultSummary: { tampered: true } } });
    else await db.businessOperation.delete({ where: { id: op.id } }); // Existing SET NULL FK; no manual detachment.
    const before = await graph(t), journals = await db.twitchCanaryImport.findMany({ where: { playerId: t.playerId } });
    await expect(rollbackLegacyCanary(db, config, operatorId, backup)).rejects.toThrow('CANARY_RETAINED_OPERATION_CHANGED');
    expect((await graph(t)).hash).toBe(before.hash);
    expect(await db.twitchCanaryImport.findMany({ where: { playerId: t.playerId } })).toEqual(journals);
  }, 120_000);
  it('replaces resources, XP, gacha, bank, box, teams, missions and daily state without additive history effects', async () => {
    const t = await target(), op = await operation(t); await history(t, op.id); await movement(t, op.id);
    const { p, backup } = await imported(t);
    await compareLegacyPersonalState(db, p.player, p.mapping, t.snapshot.hash, p.cutoverAt);
    expect(await db.playerProgression.findUniqueOrThrow({ where: { playerId: t.playerId } })).toMatchObject({ xp: 300n, totalMessages: 10n });
    expect((await db.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId: t.playerId, resourceKey: 'moras' } } })).amount).toBe(80n);
    expect((await db.playerBankAccount.findUniqueOrThrow({ where: { playerId: t.playerId } })).balance).toBe(40n);
    expect((await db.playerGachaState.findUniqueOrThrow({ where: { playerId: t.playerId } })).pity5).toBe(3);
    expect(await db.resourceMovement.count({ where: { playerId: t.playerId } })).toBe(0);
    await rollbackLegacyCanary(db, config, operatorId, backup);
  }, 120_000);
  it('preserves access identity IDs, Auth subject, roles, privacy and non-game preferences', async () => {
    const t = await target(), op = await operation(t); await history(t, op.id); const before = await graph(t), { backup } = await imported(t), after = await graph(t);
    for (const table of ['web_identities', 'player_role_assignments', 'privacy_settings']) expect(after.tables[table]).toEqual(before.tables[table]);
    expect(after.tables.player_preferences!.filter(row => JSON.parse(row).preference_key === 'menu.defaultTab')).toEqual(before.tables.player_preferences);
    const a = JSON.parse(after.tables.twitch_identities![0]!), b = JSON.parse(before.tables.twitch_identities![0]!);
    expect([a.id, a.player_id, a.twitch_user_id]).toEqual([b.id, b.player_id, b.twitch_user_id]);
    expect(JSON.parse(after.tables.players![0]!).id).toBe(t.playerId);
    await rollbackLegacyCanary(db, config, operatorId, backup);
  }, 120_000);
  it('keeps historical relations exact and introduces no duplicated operation or changed idempotency key', async () => {
    const t = await target(), op = await operation(t); await history(t, op.id); const rows = await graph(t), original = await planTargetedRetention(db, rows);
    const { backup } = await imported(t), current = await planTargetedRetention(db, await graph(t));
    expect(current).toEqual(original); expect(current.operations).toHaveLength(1);
    expect((await db.businessOperation.findUniqueOrThrow({ where: { id: op.id } })).idempotencyKey).toBe(op.idempotencyKey);
    await rollbackLegacyCanary(db, config, operatorId, backup);
  }, 120_000);
  it('refuses a stale plan before the backup callback and before any writes', async () => {
    const t = await target(), op = await operation(t); await history(t, op.id); const p = await plan(t), backup = vi.fn();
    await db.businessOperation.update({ where: { id: op.id }, data: { resultSummary: { changed: true } } });
    const before = await graph(t);
    await expect(applyLegacyCanary(db, config, operatorId, p, STREAMERBOT_PATH_DISABLED, backup)).rejects.toThrow('CANARY_RETENTION_CHANGED');
    expect(backup).not.toHaveBeenCalled(); expect((await graph(t)).hash).toBe(before.hash);
  }, 120_000);
  it('restores a serialized version 1 backup with its original strict deletion semantics', async () => {
    const t = await target(), op = await operation(t); await movement(t, op.id); const original = await graph(t), { backup } = await imported(t);
    const { version: _version, hash: _hash, ...common } = backup;
    const { retention: _retention, ...preimage } = { ...common, retention: backup.version === 2 ? backup.retention : undefined };
    const old = { ...preimage, version: 1 as const };
    const v1 = canaryBackupSchema.parse(JSON.parse(JSON.stringify({ ...old, hash: canaryBackupHash(old) }))) as CanaryBackup;
    await db.twitchCanaryImport.updateMany({ where: { playerId: t.playerId }, data: { backupHash: v1.hash } });
    await rollbackLegacyCanary(db, config, operatorId, v1); expect((await graph(t)).hash).toBe(original.hash);
  }, 120_000);
  it('refuses retained history through the old unversioned restore path', async () => {
    const t = await target(), op = await operation(t); await history(t, op.id); const before = await graph(t);
    await expect(db.$transaction(tx => restoreTargetedRows(tx, before), { timeout: 120_000 })).rejects.toThrow('CANARY_SHARED_REFERENCE_REQUIRES_OPERATOR');
  }, 120_000);
});

describe('real runtime idempotency after personal replacement', () => {
  const getPlayer = new GetCurrentPlayer(new PrismaCurrentPlayerStore(db));
  it.each([false, true])('protects a historical bank command replay with published response %s and accepts a new command key', async published => {
    const t = await target();
    let now = new Date();
    const clock = { now: () => now }, auth = { subject: t.subject }, key = randomUUID();
    const chat = new GlobalChatService(db, getPlayer, clock, { nextInt: () => 0 });
    const store = new PrismaBankingStore(db);
    const services = {
      socialService: { actor: () => getPlayer.execute(auth) },
      getCurrentPlayerBank: new GetCurrentPlayerBank(getPlayer, store, clock),
      depositPlayerBankChat: new TransferPlayerBank('deposit', getPlayer, store, clock, 'CHAT'),
    } as unknown as ChatCommandServices;
    const dispatcher = new ChatCommandDispatcher(chat, services);
    const response = vi.spyOn(chat, 'publishGameResult');
    if (!published) response.mockRejectedValueOnce(new Error('SYNTHETIC_RESPONSE_INTERRUPTED'));
    const content = '!banque deposer 10';
    let original: Awaited<ReturnType<typeof dispatcher.send>> | undefined;
    if (published) original = await dispatcher.send(auth, content, key);
    else await expect(dispatcher.send(auth, content, key)).rejects.toThrow('SYNTHETIC_RESPONSE_INTERRUPTED');
    expect(await db.bankTransaction.count({ where: { playerId: t.playerId, transactionType: 'DEPOSIT' } })).toBe(1);
    await imported(t);
    const before = await graph(t);
    if (published) expect((await dispatcher.send(auth, content, key)).result).toEqual(original!.result);
    else for (let retry = 0; retry < 2; retry++) await expect(dispatcher.send(auth, content, key)).rejects.toMatchObject({ code: 'CHAT_HISTORICAL_REPLAY_REQUIRES_NEW_KEY' });
    expect((await graph(t)).hash).toBe(before.hash);
    now = new Date(now.getTime() + 60_000);
    const freshKey = randomUUID();
    expect((await dispatcher.send(auth, content, freshKey)).replayed).toBe(false);
    const freshState = await graph(t);
    expect((await dispatcher.send(auth, content, freshKey)).replayed).toBe(true);
    expect((await graph(t)).hash).toBe(freshState.hash);
    expect(await db.bankTransaction.count({ where: { playerId: t.playerId, transactionType: 'DEPOSIT' } })).toBe(1);
    expect((await db.playerBankAccount.findUniqueOrThrow({ where: { playerId: t.playerId } })).balance).toBe(50n);
    expect((await db.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId: t.playerId, resourceKey: 'moras' } } })).amount).toBe(70n);
    response.mockRestore();
  }, 120_000);
  it.each(['pyro', 'cryo'] as const)('replays a genuine historical Chat action with original element %s without a second mutation, and accepts a new key', async element => {
    const t = await target();
    await db.player.update({ where: { id: t.playerId }, data: { elementKey: element } });
    let now = new Date();
    const chat = new GlobalChatService(db, getPlayer, { now: () => now }, { nextInt: () => 0 });
    const key = randomUUID(), auth = { subject: t.subject };
    const sent = await chat.send(auth, 'Synthetic historical chat', key);
    expect(sent.replayed).toBe(false);
    const { backup } = await imported(t), before = await graph(t);
    expect((await chat.send(auth, 'Synthetic historical chat', key)).replayed).toBe(true);
    expect((await graph(t)).hash).toBe(before.hash);
    now = new Date(now.getTime() + 60_000);
    const fresh = await chat.send(auth, '!pity', randomUUID());
    expect(fresh.replayed).toBe(false); expect(fresh.message.id).not.toBe(sent.message.id);
    now = new Date(now.getTime() + 60_000);
    const newPlayerKey = randomUUID();
    const newPlayerMessage = await chat.send(auth, 'Synthetic fresh chat after import', newPlayerKey);
    expect(newPlayerMessage.replayed).toBe(false);
    expect(await db.businessOperation.count({ where: { playerId: t.playerId, operationType: 'daily-reward.claim' } })).toBe(1);
    const freshState = await graph(t);
    expect((await chat.send(auth, 'Synthetic fresh chat after import', newPlayerKey)).replayed).toBe(true);
    expect((await graph(t)).hash).toBe(freshState.hash);
    expect(await db.businessOperation.count({ where: { playerId: t.playerId, idempotencyKey: key } })).toBe(1);
    // A new shared action makes the old preimage ineligible for exact rollback.
    await expect(rollbackLegacyCanary(db, config, operatorId, backup)).rejects.toThrow('CANARY_RETENTION_CHANGED');
  }, 120_000);
  it('replays a genuine gift claim without crediting legacy resources, even with a different retry key', async () => {
    const t = await target(), now = new Date();
    const gifts = new GiftCodeService(getPlayer, db, { now: () => now }, { annualCodeIds: [], activePlayerIds: [t.playerId] });
    const code = await db.giftCode.create({ data: { token: randomUUID().replaceAll('-', '').toUpperCase(), title: 'Synthetic historical claim', description: '', type: 'ONE_OFF', status: 'PUBLISHED',
      startsAt: new Date(now.getTime() - 60_000), endsAt: new Date(now.getTime() + 3600_000),
      rewards: { create: { resourceKey: 'moras', amount: 50n } }, editions: { create: { editionKey: 'fixture', startsAt: new Date(now.getTime() - 60_000), endsAt: new Date(now.getTime() + 3600_000) } } }, include: { editions: true } });
    const auth = { subject: t.subject }, key = randomUUID(), edition = code.editions[0]!.id;
    expect((await gifts.claim(auth, edition, key)).operation.alreadyProcessed).toBe(false);
    const { backup } = await imported(t), before = await graph(t);
    expect((await gifts.claim(auth, edition, key)).operation.alreadyProcessed).toBe(true);
    expect((await gifts.claim(auth, edition, randomUUID())).operation.alreadyProcessed).toBe(true);
    expect((await graph(t)).hash).toBe(before.hash);
    expect(await db.giftCodeClaim.count({ where: { playerId: t.playerId } })).toBe(1);
    await rollbackLegacyCanary(db, config, operatorId, backup);
  }, 120_000);
});
