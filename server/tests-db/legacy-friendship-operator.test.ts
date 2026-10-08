import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, open, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { bootstrapPlayer } from '../src/infrastructure/database/player-bootstrap.js';
import { applyLegacySocialPair, legacySocialBackupSchema, planLegacySocialPair, rollbackLegacySocialPair, type LegacySocialBackup } from '../src/application/migration/legacy-friendship-operator.js';
import { legacyFriendshipSourceFacts, registerLegacyFriendships } from '../src/application/migration/legacy-friendship-reconciliation.js';
import { STREAMERBOT_PATH_DISABLED } from '../src/application/twitch/twitch-native-authority.js';
import { captureTargetedPlayerRows } from '../src/application/migration/targeted-player-rows.js';
import type { Snapshot } from '../src/application/migration/streamerbot-snapshot.js';
import type { VerifiedTwitchReport } from '../src/application/migration/verified-twitch-report.js';

const fixture = isolatedBatchDatabase(), db = fixture.database;
const config = { host: 'localhost', port: 3001, supabase: {}, twitchCommandPilot: { enabled: false, globalEnabled: false },
  twitch: { pilotPlayerIds: [] as string[], pilotLogin: 'kichnifou' } };
const now = new Date('2099-10-08T12:00:00Z');
let actor: string, directory: string, sequence = 0;
let canariesBefore: unknown;
const canaryState = async () => ({ targets: await db.twitchNativeTarget.findMany({ orderBy: { twitchUserId: 'asc' } }), imports: await db.twitchCanaryImport.findMany({ orderBy: { id: 'asc' } }) });
beforeAll(async () => {
  if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(process.env['DATABASE_URL']!).hostname)) throw Error('Local PostgreSQL required');
  await fixture.setup({ prismaMigrations: true });
  const operator = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Private Operator', twitchIdentity: { twitchUserId: '930000000000', login: 'kichnifou', displayName: 'Private Operator', firstSeenAt: now } }));
  actor = operator.id; config.twitch.pilotPlayerIds.push(actor);
  await db.playerRoleAssignment.create({ data: { playerId: actor, role: 'ADMIN', source: 'private-fixture' } });
  await db.twitchNativeAuthority.create({ data: { id: 'twitch-commands', desiredMode: 'OFF', revision: 11, operatorPlayerId: actor } });
  for (let index = 0; index < 3; index++) {
    const twitchUserId = String(940000000000 + index);
    const player = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Private Canary', twitchIdentity: { twitchUserId, login: `private_canary_${index}`, displayName: 'Private Canary', firstSeenAt: now } }));
    await db.twitchNativeTarget.create({ data: { twitchUserId, playerId: player.id, dataAuthority: 'NATIVE', canary: true, acknowledgement: STREAMERBOT_PATH_DISABLED, transferredAt: now } });
    await db.twitchCanaryImport.create({ data: { twitchUserId, playerId: player.id, snapshotHash: '1'.repeat(64), identityReportHash: '2'.repeat(64), backupHash: '3'.repeat(64) } });
  }
  canariesBefore = await canaryState();
  directory = await mkdtemp(path.join(tmpdir(), 'gacha-social-operator-'));
}, 180_000);
afterAll(async () => {
  await fixture.cleanup(); const pool = fixture.poolSnapshot();
  expect(pool).toMatchObject({ total: 0, idle: 0, waiting: 0 }); expect(pool.opened).toBe(pool.closed);
  if (directory) {
    const target = path.resolve(directory);
    if (path.dirname(target) !== path.resolve(tmpdir()) || !path.basename(target).startsWith('gacha-social-operator-')) throw Error('Unsafe cleanup');
    await rm(target, { recursive: true });
  }
}, 60_000);

async function scenario(importBoth = true) {
  const n = ++sequence, names = [`operator_left_${n}`, `operator_right_${n}`], ids = [String(930000000000 + n * 2), String(930000000001 + n * 2)];
  const snapshot: Snapshot = { hash: createHash('sha256').update(`private-operator-${n}`).digest('hex'), files: 17, sources: {
    'viewers_data.json': Object.fromEntries(names.map(name => [name, {}])),
    'friendships_data.json': { friendships: { selected: { users: names, level: 12, sparkleHearts: 70, createdAt: '2026-01-01', lastHeartSent: { [names[0]!]: '2099-10-08' } },
      untouched: { users: [names[0]!, 'private_unproved_peer'], level: 2, sparkleHearts: 3 } } },
  } };
  const reports: VerifiedTwitchReport[] = names.map((name, side) => ({ version: 1, verification: 'TWITCH_HELIX', snapshotHash: snapshot.hash, resolvedAt: now.toISOString(),
    users: [{ legacyLogin: name, twitchUserId: ids[side]!, currentLogin: name, displayName: `Private Side ${side}`, renamed: false }], missing: [], conflicts: [], duplicates: 0 }));
  const players: string[] = [];
  for (const side of [0, 1]) {
    const player = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Private Endpoint', twitchIdentity: { twitchUserId: ids[side]!, login: names[side]!, displayName: 'Private Endpoint', firstSeenAt: now } }));
    players.push(player.id);
    if (side === 0 || importBoth) await db.migrationRun.create({ data: { playerId: player.id, snapshotHash: snapshot.hash, summary: {} } });
  }
  const sourcePairKeyHash = legacyFriendshipSourceFacts(snapshot, names[0]!).find(fact => fact.level === 12)!.sourcePairKeyHash;
  const input = { operatorPlayerId: actor, expectedRevision: 11, snapshot, reports, sourcePairKeyHash, now };
  const relation = () => db.friendship.findFirstOrThrow({ where: { legacyFact: { sourcePairKeyHash }, supersededAt: null } });
  return { input, players, ids, relation };
}
async function prepare(s: Awaited<ReturnType<typeof scenario>>) {
  const plan = await planLegacySocialPair(db, config, s.input);
  const input = { ...s.input, expectedFingerprint: plan.fingerprint, acknowledgement: STREAMERBOT_PATH_DISABLED, operationId: randomUUID() };
  const output = path.join(directory, `${input.operationId}.json`);
  const write = async (backup: LegacySocialBackup) => {
    expect(await db.migrationBatch.count({ where: { id: input.operationId } })).toBe(0);
    const file = await open(output, 'wx', 0o600);
    try { await file.writeFile(JSON.stringify(backup)); await file.sync(); } finally { await file.close(); }
  };
  const read = async () => legacySocialBackupSchema.parse(JSON.parse(await readFile(output, 'utf8')));
  return { input, plan, write, read };
}
const rollback = (backup: LegacySocialBackup) => rollbackLegacySocialPair(db, config, { operatorPlayerId: actor, expectedRevision: 11, backup, expectedBackupHash: backup.hash, acknowledgement: STREAMERBOT_PATH_DISABLED, now });

it('plans READ ONLY with two fresh immutable proofs and complete imported endpoints', async () => {
  const s = await scenario(), before = { facts: await db.legacyFriendshipFact.count(), journals: await db.migrationBatch.count(), audit: await db.twitchNativeAudit.count() };
  const first = await planLegacySocialPair(db, config, s.input);
  expect(first).toMatchObject({ status: 'READY', materialized: 1, playerIds: [...s.players].sort() });
  expect(await planLegacySocialPair(db, config, { ...s.input, reports: [...s.input.reports].reverse() })).toEqual(first);
  expect({ facts: await db.legacyFriendshipFact.count(), journals: await db.migrationBatch.count(), audit: await db.twitchNativeAudit.count() }).toEqual(before);
  const deferred = await scenario(false), f = await prepare(deferred);
  expect(f.plan.status).toBe('DEFERRED');
  await expect(applyLegacySocialPair(db, config, f.input, f.write)).rejects.toThrow('PAIR_NOT_READY');
});

it('rejects malformed CLI invocations before creating a database connection and exposes no input secrets', () => {
  for (const args of [[], ['unknown'], ['plan', '--operator-player', 'private-secret'], ['rollback', '--unexpected', 'private-secret']]) {
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/reconcile-legacy-friendship.mts', ...args], { encoding: 'utf8',
      env: { ...process.env, DATABASE_URL: 'postgresql://private:private-secret@127.0.0.1:1/unreachable' } });
    expect(result.status).toBe(1); expect(result.stdout).toBe('');
    expect(result.stderr).toContain('LEGACY_SOCIAL_ARGUMENTS_INVALID'); expect(result.stderr).not.toContain('private-secret');
  }
});

it('rejects unauthorized operators, non-OFF revision, enabled pilot, stale evidence and missing acknowledgement', async () => {
  const s = await scenario(), f = await prepare(s);
  await expect(planLegacySocialPair(db, config, { ...s.input, operatorPlayerId: s.players[0]! })).rejects.toMatchObject({ statusCode: 403 });
  await expect(planLegacySocialPair(db, config, { ...s.input, expectedRevision: 10 })).rejects.toThrow('OFF_GATE_REQUIRED');
  await expect(planLegacySocialPair(db, { ...config, twitchCommandPilot: { enabled: true, globalEnabled: false } }, s.input)).rejects.toThrow('OFF_GATE_REQUIRED');
  await expect(planLegacySocialPair(db, config, { ...s.input, now: new Date(now.getTime() + 86_400_001) })).rejects.toThrow('TWITCH_REPORT_STALE');
  await expect(applyLegacySocialPair(db, config, { ...f.input, acknowledgement: 'invalid' }, f.write)).rejects.toThrow('CONFIRMATIONS_REQUIRED');
});

it('refuses global pending operations and uncertain outbound even on unrelated accounts', async () => {
  const s = await scenario();
  const operation = await db.businessOperation.create({ data: { playerId: actor, operationType: 'private.pending', sourceChannel: 'SYSTEM', status: 'PENDING' } });
  await expect(planLegacySocialPair(db, config, s.input)).rejects.toThrow('OPERATION_IN_FLIGHT');
  await db.businessOperation.update({ where: { id: operation.id }, data: { status: 'FAILED', completedAt: now } });
  const receipt = await db.twitchEventReceipt.create({ data: { externalEventId: randomUUID(), eventType: 'channel.chat.message', state: 'PROCESSED', processedAt: now,
    payloadMinimal: { commandPilot: { stage: 'RESPONSES', responses: [{ status: 'AMBIGUOUS' }] } } } });
  await expect(planLegacySocialPair(db, config, s.input)).rejects.toThrow('OUTBOUND_IN_FLIGHT');
  await db.twitchEventReceipt.update({ where: { id: receipt.id }, data: { payloadMinimal: { commandPilot: { stage: 'RESPONSES', responses: [{ status: 'SENT' }] } } } });
  expect((await planLegacySocialPair(db, config, s.input)).status).toBe('READY');
});

it('persists the durable scoped preimage before writes and restores it exactly while retaining audit and all third-party graphs', async () => {
  const s = await scenario(), f = await prepare(s);
  const graphs = await captureTargetedPlayerRows(db, s.players);
  const imports = await db.migrationRun.findMany({ where: { playerId: { in: s.players } }, orderBy: { id: 'asc' } });
  const applied = await applyLegacySocialPair(db, config, f.input, f.write), backup = await f.read();
  expect(applied).toMatchObject({ status: 'APPLIED', materialized: 1, backupHash: backup.hash, replayed: false });
  expect(backup.playerIds).toEqual([...s.players, actor].sort());
  expect(backup.preimage.sourcePairKeyHashes).toEqual([s.input.sourcePairKeyHash]);
  expect(backup.preimage.rows.legacy_friendship_facts).toEqual([]);
  expect(await s.relation()).toMatchObject({ level: 12, totalHearts: 70n });
  expect(await db.legacyFriendshipFact.count({ where: { OR: [{ leftTwitchUserId: s.ids[0] }, { rightTwitchUserId: s.ids[0] }] } })).toBe(1);
  expect(await captureTargetedPlayerRows(db, s.players)).toEqual(graphs);
  expect(await rollback(backup)).toEqual({ mode: 'EXACT_PREIMAGE', replayed: false });
  expect(await rollback(backup)).toEqual({ mode: 'EXACT_PREIMAGE', replayed: true });
  expect(await captureTargetedPlayerRows(db, s.players)).toEqual(graphs);
  expect(await db.migrationRun.findMany({ where: { playerId: { in: s.players } }, orderBy: { id: 'asc' } })).toEqual(imports);
  expect(await db.legacyFriendshipFact.count({ where: { sourcePairKeyHash: s.input.sourcePairKeyHash } })).toBe(0);
  expect(await db.migrationBatch.findUniqueOrThrow({ where: { id: f.input.operationId } })).toMatchObject({ summary: { state: 'ROLLED_BACK', backupHash: backup.hash } });
  expect(await db.twitchNativeAudit.count({ where: { action: { endsWith: f.input.operationId } } })).toBe(2);
  expect(await canaryState()).toEqual(canariesBefore);
  expect(await db.twitchNativeAuthority.findUniqueOrThrow({ where: { id: 'twitch-commands' } })).toMatchObject({ desiredMode: 'OFF', revision: 11 });
});

it('replays the same operation without writing another backup or relationship', async () => {
  const s = await scenario(), f = await prepare(s);
  const first = await applyLegacySocialPair(db, config, f.input, f.write), relation = await s.relation();
  const second = await applyLegacySocialPair(db, config, f.input, async () => { throw Error('Unexpected backup replay'); });
  expect(second).toEqual({ ...first, replayed: true }); expect(await s.relation()).toEqual(relation);
  expect(await db.twitchNativeAudit.count({ where: { action: { endsWith: f.input.operationId } } })).toBe(1);
  await expect(applyLegacySocialPair(db, config, { ...f.input, expectedFingerprint: '0'.repeat(64) }, f.write)).rejects.toThrow('JOURNAL_CONFLICT');
});

it('rejects a stale plan after independent source registration and never writes its backup', async () => {
  const s = await scenario(), f = await prepare(s);
  await db.$transaction(tx => registerLegacyFriendships(tx, { snapshot: s.input.snapshot, report: s.input.reports[0]!, ownerTwitchUserId: s.ids[0]!, sourcePairKeyHash: s.input.sourcePairKeyHash, now }));
  let called = false;
  await expect(applyLegacySocialPair(db, config, f.input, async () => { called = true; })).rejects.toThrow('PLAN_CHANGED');
  expect(called).toBe(false); expect(await db.migrationBatch.count({ where: { id: f.input.operationId } })).toBe(0);
});

it('refuses collisions and explicit blocks without replacing a standalone relationship', async () => {
  const s = await scenario(), [playerAId, playerBId] = [...s.players].sort() as [string, string];
  const relation = await db.friendship.create({ data: { playerAId, playerBId, level: 40, totalHearts: 100n } });
  await expect(planLegacySocialPair(db, config, s.input)).rejects.toThrow('EFFECTIVE_RELATION_CONFLICT');
  expect(await db.friendship.findUniqueOrThrow({ where: { id: relation.id } })).toEqual(relation);
  const blocked = await scenario();
  await db.playerBlock.create({ data: { blockerPlayerId: blocked.players[0]!, blockedPlayerId: blocked.players[1]! } });
  await expect(planLegacySocialPair(db, config, blocked.input)).rejects.toThrow('BLOCKED_CONTACT');
});

it('makes durable backup failure atomic and does not create a registry or journal', async () => {
  const s = await scenario(), f = await prepare(s);
  await expect(applyLegacySocialPair(db, config, f.input, async () => { throw Error('PRIVATE_FSYNC_FAILED'); })).rejects.toThrow('PRIVATE_FSYNC_FAILED');
  expect(await db.legacyFriendshipFact.count({ where: { sourcePairKeyHash: s.input.sourcePairKeyHash } })).toBe(0);
  expect(await db.migrationBatch.count({ where: { id: f.input.operationId } })).toBe(0);
});

it('restores a previously deferred fact exactly and rejects a corrupt backup', async () => {
  const s = await scenario();
  await db.$transaction(tx => registerLegacyFriendships(tx, { snapshot: s.input.snapshot, report: s.input.reports[1]!, ownerTwitchUserId: s.ids[1]!, sourcePairKeyHash: s.input.sourcePairKeyHash, now }));
  const original = await db.legacyFriendshipFact.findUniqueOrThrow({ where: { sourcePairKeyHash: s.input.sourcePairKeyHash } }), f = await prepare(s);
  await applyLegacySocialPair(db, config, f.input, f.write); const backup = await f.read();
  await expect(rollback({ ...backup, fingerprint: '0'.repeat(64) })).rejects.toThrow('BACKUP_INVALID');
  await rollback(backup);
  expect(await db.legacyFriendshipFact.findUniqueOrThrow({ where: { id: original.id } })).toEqual(original);
});

it('refuses rollback after later heart use, identity change or unknown third-party reference', async () => {
  for (const mutation of ['HEART', 'IDENTITY', 'REFERENCE']) {
    const s = await scenario(), f = await prepare(s); await applyLegacySocialPair(db, config, f.input, f.write);
    const backup = await f.read(), relation = await s.relation();
    if (mutation === 'HEART') {
      const operation = await db.businessOperation.create({ data: { playerId: s.players[1]!, operationType: 'friendship.heart', sourceChannel: 'UI', status: 'COMPLETED', completedAt: now } });
      await db.friendHeart.create({ data: { friendshipId: relation.id, senderPlayerId: s.players[1]!, recipientPlayerId: s.players[0]!, businessDate: new Date('2099-10-08'), operationId: operation.id } });
    } else if (mutation === 'IDENTITY') await db.twitchIdentity.update({ where: { twitchUserId: s.ids[0]! }, data: { login: 'private_changed' } });
    else {
      await fixture.admin.query(`CREATE TABLE "${fixture.schema}".private_operator_reference(id uuid PRIMARY KEY, friendship_id uuid REFERENCES "${fixture.schema}".friendships(id))`);
      await fixture.admin.query(`INSERT INTO "${fixture.schema}".private_operator_reference VALUES($1,$2)`, [randomUUID(), relation.id]);
    }
    try { await expect(rollback(backup)).rejects.toThrow(mutation === 'REFERENCE' ? 'CANARY_SHARED_REFERENCE_REQUIRES_OPERATOR' : 'POSTIMAGE_CHANGED'); }
    finally { if (mutation === 'REFERENCE') await fixture.admin.query(`DROP TABLE "${fixture.schema}".private_operator_reference`); }
    expect(await s.relation()).toEqual(relation);
    expect(await db.migrationBatch.findUniqueOrThrow({ where: { id: f.input.operationId } })).toMatchObject({ summary: { state: 'APPLIED' } });
  }
});

it('locks the second endpoint absent from the empty registry backup before any write', async () => {
  const s = await scenario(), f = await prepare(s);
  let unlock!: () => void, ready!: () => void, backupWritten = false;
  const locked = new Promise<void>(resolve => { ready = resolve; }), release = new Promise<void>(resolve => { unlock = resolve; });
  const peer = db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM players WHERE id=${s.players[1]}::uuid FOR UPDATE`;
    ready(); await release;
  });
  await locked;
  const applying = applyLegacySocialPair(db, config, f.input, async backup => { backupWritten = true; await f.write(backup); });
  try {
    let blocked = false;
    for (let attempt = 0; attempt < 100 && !blocked; attempt++) {
      const result = await fixture.admin.query<{ blocked: boolean }>(`SELECT EXISTS (SELECT 1 FROM pg_stat_activity a JOIN pg_locks l ON l.pid=a.pid WHERE a.wait_event_type='Lock' AND l.relation=$1::regclass) AS blocked`, [`${fixture.schema}.players`]);
      blocked = result.rows[0]!.blocked;
      if (!blocked) await new Promise(resolve => setTimeout(resolve, 10));
    }
    expect(blocked).toBe(true); expect(backupWritten).toBe(false);
  } finally { unlock(); }
  await peer; expect(await applying).toMatchObject({ status: 'APPLIED', materialized: 1 });
});

it('serializes simultaneous applications without duplicate relationships or journal entries', async () => {
  const s = await scenario(), f = await prepare(s);
  // A waiting SERIALIZABLE transaction may still hold the older snapshot and
  // abort at its first write. Its durable preimage remains private and unused.
  const write = async (backup: LegacySocialBackup) => {
    const file = await open(path.join(directory, `${randomUUID()}.json`), 'wx', 0o600);
    try { await file.writeFile(JSON.stringify(backup)); await file.sync(); } finally { await file.close(); }
  };
  const results = await Promise.allSettled([applyLegacySocialPair(db, config, f.input, write), applyLegacySocialPair(db, config, f.input, write)]);
  expect(results.filter(result => result.status === 'fulfilled').length).toBeGreaterThan(0);
  for (const result of results) if (result.status === 'rejected') expect(result.reason).toMatchObject({ code: 'P2034' });
  expect(await db.friendship.count({ where: { legacyFact: { sourcePairKeyHash: s.input.sourcePairKeyHash } } })).toBe(1);
  expect(await db.migrationBatch.count({ where: { id: f.input.operationId } })).toBe(1);
  expect(await db.twitchNativeAudit.count({ where: { action: { endsWith: f.input.operationId } } })).toBe(1);
  expect(await applyLegacySocialPair(db, config, f.input, async () => { throw Error('Unexpected backup replay'); })).toMatchObject({ replayed: true });
});
