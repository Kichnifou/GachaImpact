import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { bootstrapPlayer } from '../src/infrastructure/database/player-bootstrap.js';
import { TwitchNativeAuthority, STREAMERBOT_PATH_DISABLED } from '../src/application/twitch/twitch-native-authority.js';

const fixture = isolatedBatchDatabase(), db = fixture.database, at = new Date('2026-10-06T12:00:00Z');
const config = { host: 'localhost', port: 3001, supabase: {}, twitchCommandPilot: { enabled: true, globalEnabled: false },
  twitch: { pilotPlayerIds: [] as string[], pilotLogin: 'kichnifou' } };
let operatorId: string, sequence = 0, tables: string[];
beforeAll(async () => {
  await fixture.setup({ seedPublicCatalog: true });
  const operator = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Private operator', twitchIdentity: {
    twitchUserId: '910060000000', login: 'kichnifou', displayName: 'Private operator', firstSeenAt: at } }, at));
  operatorId = operator.id; config.twitch.pilotPlayerIds.push(operatorId);
  await db.playerRoleAssignment.create({ data: { playerId: operatorId, role: 'ADMIN', source: 'private-extension' } });
  tables = (await db.$queryRaw<{ name: string }[]>`SELECT tablename name FROM pg_tables WHERE schemaname = current_schema() ORDER BY tablename`).map(row => row.name);
}, 60_000);
afterAll(() => fixture.cleanup(), 60_000);

// Capture every private table as PostgreSQL JSON text, retaining timestamp/int8 precision.
async function state() {
  expect((await db.$queryRaw<{ schema: string }[]>`SELECT current_schema() schema`)[0]!.schema).toBe(fixture.schema);
  const queries = tables.map(table => {
    if (!/^[a-z_][a-z0-9_]*$/.test(table)) throw new Error('UNSAFE_PRIVATE_TABLE');
    return `SELECT '${table}' name, COALESCE(json_agg(row ORDER BY row), '[]'::json)::text rows FROM (SELECT row_to_json(t)::text row FROM "${fixture.schema}"."${table}" t) r`;
  });
  const rows = await db.$queryRawUnsafe<{ name: string; rows: string }[]>(queries.join(' UNION ALL '));
  return Object.fromEntries(rows.map(row => [row.name, row.rows]));
}
async function target(native: boolean) {
  const twitchUserId = String(910060000001 + sequence++), player = await db.$transaction(tx => bootstrapPlayer(tx, {
    displayName: native ? 'Private prior canary' : 'Private added canary',
    ...(!native ? { webIdentity: { provider: 'supabase', providerSubject: randomUUID() } } : {}), twitchIdentity: {
      twitchUserId, login: 'private_canary', displayName: 'Private canary', firstSeenAt: at } }, at));
  await db.player.update({ where: { id: player.id }, data: { legacyUsername: 'private_' + twitchUserId } });
  await db.twitchNativeTarget.create({ data: { twitchUserId, playerId: player.id, dataAuthority: native ? 'NATIVE' : 'LEGACY', canary: native,
    ...(native ? { acknowledgement: STREAMERBOT_PATH_DISABLED, transferredAt: at } : {}) } });
  const imported = await db.twitchCanaryImport.create({ data: { twitchUserId, playerId: player.id, snapshotHash: 'a'.repeat(64),
    identityReportHash: 'b'.repeat(64), backupHash: 'c'.repeat(64), importedAt: at } });
  if (native) await db.twitchNativeAudit.create({ data: { actorPlayerId: operatorId, action: 'AUTHORITY_TRANSFERRED', twitchUserId, acknowledgement: STREAMERBOT_PATH_DISABLED } });
  return { twitchUserId, playerId: player.id, imported };
}
async function setup() {
  await db.twitchNativeTarget.updateMany({ where: { canary: true }, data: { canary: false } });
  await db.twitchNativeTarget.updateMany({ where: { playerId: operatorId }, data: { playerId: null } });
  await db.twitchNativeAuthority.upsert({ where: { id: 'twitch-commands' }, create: { id: 'twitch-commands', revision: 5 },
    update: { desiredMode: 'OFF', revision: 5, acknowledgement: null, acknowledgedAt: null } });
  return { prior: await target(true), added: await target(false), owner: new TwitchNativeAuthority(db, config) };
}
type Target = Awaited<ReturnType<typeof target>>;
async function receipt(t: Target, status: string) {
  await db.twitchEventReceipt.create({ data: { twitchUserId: t.twitchUserId, externalEventId: randomUUID(), eventType: 'channel.chat.message',
    state: 'PROCESSED', processedAt: at, payloadMinimal: { commandPilot: { stage: status === 'EXECUTING' ? 'EXECUTING' : 'RESPONSES',
      responses: status === 'EXECUTING' ? [] : [{ status }] } } } });
}

describe('local imported canary extension in private PostgreSQL', () => {
  it('extends 1 to 2 with exact preservation of prior targets, imports and every gameplay table', async () => {
    const f = await setup();
    await db.playerResourceBalance.updateMany({ where: { playerId: { in: [f.prior.playerId, f.added.playerId] } }, data: { amount: 777n } });
    await db.playerPreference.create({ data: { playerId: f.added.playerId, preferenceKey: 'private.extension', value: { preserved: true } } });
    await receipt(f.prior, 'SENT'); await receipt(f.added, 'SENT');
    const before = await state(), prior = await db.twitchNativeTarget.findUniqueOrThrow({ where: { twitchUserId: f.prior.twitchUserId } });
    expect(await f.owner.extendImportedCanary(operatorId, f.added.twitchUserId, f.added.playerId, f.added.imported.backupHash, STREAMERBOT_PATH_DISABLED, 5))
      .toMatchObject({ desiredMode: 'CANARY', revision: 6, operatorPlayerId: operatorId });
    const after = await state();
    for (const table of tables.filter(t => !['twitch_native_targets', 'twitch_native_authorities', 'twitch_native_audit'].includes(t))) expect(after[table], table).toEqual(before[table]);
    expect(await db.twitchNativeTarget.findUniqueOrThrow({ where: { twitchUserId: f.prior.twitchUserId } })).toEqual(prior);
    expect(await db.twitchNativeTarget.findUniqueOrThrow({ where: { twitchUserId: f.added.twitchUserId } })).toMatchObject({ playerId: f.added.playerId,
      dataAuthority: 'NATIVE', canary: true, acknowledgement: STREAMERBOT_PATH_DISABLED, transferredAt: expect.any(Date) });
    const oldTargets = JSON.parse(before.twitch_native_targets!) as string[], newTargets = JSON.parse(after.twitch_native_targets!) as string[];
    expect(newTargets.filter(row => JSON.parse(row).twitch_user_id !== f.added.twitchUserId)).toEqual(oldTargets.filter(row => JSON.parse(row).twitch_user_id !== f.added.twitchUserId));
    expect(await db.twitchNativeTarget.count({ where: { canary: true } })).toBe(2);
    const beforeAudits = JSON.parse(before.twitch_native_audit!) as string[], afterAudits = JSON.parse(after.twitch_native_audit!) as string[];
    expect(beforeAudits.every(row => afterAudits.includes(row))).toBe(true);
    const delta = afterAudits.filter(row => !beforeAudits.includes(row)).map(row => JSON.parse(row));
    expect(delta).toHaveLength(2);
    expect(delta).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'AUTHORITY_TRANSFERRED', twitch_user_id: f.added.twitchUserId, actor_player_id: operatorId }),
      expect.objectContaining({ action: 'DESIRED_AUTHORITY_CHANGED', mode: 'CANARY', revision: 6, actor_player_id: operatorId }),
    ]));
    await expect(f.owner.extendImportedCanary(operatorId, f.added.twitchUserId, f.added.playerId, f.added.imported.backupHash, STREAMERBOT_PATH_DISABLED, 5)).rejects.toThrow();
    expect(await state()).toEqual(after);
    await f.owner.configure(operatorId, 'OFF', []);
    const off = await state(), revision = (await f.owner.read()).revision;
    await expect(f.owner.extendImportedCanary(operatorId, f.added.twitchUserId, f.added.playerId, f.added.imported.backupHash, STREAMERBOT_PATH_DISABLED, revision)).rejects.toThrow();
    expect(await state()).toEqual(off);
  });
  it('extends 2 to 3 for the later canary using the same guarded operation', async () => {
    const f = await setup(); await target(true);
    await f.owner.extendImportedCanary(operatorId, f.added.twitchUserId, f.added.playerId, f.added.imported.backupHash, STREAMERBOT_PATH_DISABLED, 5);
    expect(await db.twitchNativeTarget.count({ where: { canary: true } })).toBe(3);
  });
  it.each(['stale', 'revision-zero', 'revision-invalid', 'missing-control', 'CANARY', 'GLOBAL', 'missing-ack', 'wrong-ack', 'wrong-operator', 'capability-off',
    'wrong-id', 'nonnumeric-id', 'wrong-player', 'wrong-backup', 'invalid-backup', 'missing-import', 'rolled-back', 'superseded-import',
    'missing-target', 'MIGRATION_PENDING', 'NATIVE', 'already-canary', 'identity-mismatch', 'target-identity-mismatch', 'inactive-player', 'empty-set',
    'existing-LEGACY', 'existing-MIGRATION_PENDING', 'existing-no-identity', 'existing-no-player', 'existing-inactive', 'existing-wrong-player',
    'existing-missing-import', 'existing-rolled-back'])('rejects %s without changing any private row', async kind => {
    const f = await setup(); let actor = operatorId, id = f.added.twitchUserId, player = f.added.playerId, hash = f.added.imported.backupHash,
      ack = STREAMERBOT_PATH_DISABLED, revision = 5, settings = config;
    if (kind === 'stale') revision = 4;
    if (kind === 'revision-zero') revision = 0;
    if (kind === 'revision-invalid') revision = Number.NaN;
    if (kind === 'missing-control') await db.twitchNativeAuthority.deleteMany();
    if (kind === 'CANARY' || kind === 'GLOBAL') await db.twitchNativeAuthority.update({ where: { id: 'twitch-commands' }, data: { desiredMode: kind, operatorPlayerId: operatorId, acknowledgement: ack, acknowledgedAt: at } });
    if (kind === 'missing-ack') ack = '';
    if (kind === 'wrong-ack') ack = 'YES';
    if (kind === 'wrong-operator') actor = randomUUID();
    if (kind === 'capability-off') settings = { ...config, twitchCommandPilot: { enabled: false, globalEnabled: false } };
    if (kind === 'wrong-id') id = '910069999999';
    if (kind === 'nonnumeric-id') id = 'private_canary';
    if (kind === 'wrong-player') player = operatorId;
    if (kind === 'wrong-backup') hash = 'd'.repeat(64);
    if (kind === 'invalid-backup') hash = 'bad';
    const t = kind.startsWith('existing-') ? f.prior : f.added;
    if (kind === 'missing-import' || kind === 'existing-missing-import') await db.twitchCanaryImport.delete({ where: { id: t.imported.id } });
    if (kind === 'rolled-back' || kind === 'existing-rolled-back') await db.twitchCanaryImport.update({ where: { id: t.imported.id }, data: { status: 'ROLLED_BACK', rolledBackAt: at } });
    if (kind === 'superseded-import') await db.twitchCanaryImport.create({ data: { twitchUserId: id, playerId: player, snapshotHash: 'a'.repeat(64), identityReportHash: 'b'.repeat(64), backupHash: 'd'.repeat(64), importedAt: new Date(at.getTime() + 1) } });
    if (kind === 'missing-target') { await db.twitchCanaryImport.delete({ where: { id: t.imported.id } }); await db.twitchNativeTarget.delete({ where: { twitchUserId: id } }); }
    if (['MIGRATION_PENDING', 'NATIVE', 'existing-LEGACY', 'existing-MIGRATION_PENDING'].includes(kind)) await db.twitchNativeTarget.update({ where: { twitchUserId: t.twitchUserId },
      data: { dataAuthority: kind.replace('existing-', ''), ...(kind === 'NATIVE' ? { acknowledgement: ack, transferredAt: at } : {}) } });
    if (kind === 'already-canary') await db.twitchNativeTarget.update({ where: { twitchUserId: id }, data: { canary: true } });
    if (kind === 'identity-mismatch' || kind === 'existing-no-identity') await db.twitchIdentity.delete({ where: { playerId: t.playerId } });
    if (kind === 'target-identity-mismatch') { player = operatorId; await db.twitchNativeTarget.update({ where: { twitchUserId: id }, data: { playerId: operatorId } }); }
    if (kind === 'inactive-player' || kind === 'existing-inactive') await db.player.update({ where: { id: t.playerId }, data: { status: 'ARCHIVED' } });
    if (kind === 'existing-no-player') await db.twitchNativeTarget.update({ where: { twitchUserId: t.twitchUserId }, data: { playerId: null } });
    if (kind === 'existing-wrong-player') await db.twitchNativeTarget.update({ where: { twitchUserId: t.twitchUserId }, data: { playerId: operatorId } });
    if (kind === 'empty-set') await db.twitchNativeTarget.update({ where: { twitchUserId: f.prior.twitchUserId }, data: { canary: false } });
    const before = await state();
    const code = ['revision-zero', 'revision-invalid', 'nonnumeric-id', 'invalid-backup'].includes(kind) ? 'VALIDATION_ERROR'
      : ['stale', 'missing-control'].includes(kind) ? 'TWITCH_NATIVE_AUTHORITY_CHANGED'
      : ['CANARY', 'GLOBAL'].includes(kind) ? 'TWITCH_NATIVE_CANARY_EXTENSION_OFF_REQUIRED'
      : ['missing-ack', 'wrong-ack'].includes(kind) ? 'TWITCH_NATIVE_ACK_REQUIRED'
      : kind === 'wrong-operator' ? 'TWITCH_COMMAND_PILOT_FORBIDDEN'
      : kind === 'capability-off' ? 'TWITCH_COMMAND_PILOT_OFF' : 'TWITCH_IMPORTED_CANARY_EXTENSION_BLOCKED';
    await expect(new TwitchNativeAuthority(db, settings).extendImportedCanary(actor, id, player, hash, ack, revision)).rejects.toMatchObject({ code });
    expect(await state()).toEqual(before);
  });
  it.each(['prior', 'added'] as const)('refuses every engaged or unsettled operation for %s', async scope => {
    for (const kind of ['PENDING-operation', 'EXECUTING', 'PENDING', 'SENDING', 'AMBIGUOUS']) {
      const f = await setup(), t = scope === 'prior' ? f.prior : f.added;
      if (kind === 'PENDING-operation') await db.businessOperation.create({ data: { playerId: t.playerId, operationType: 'private-extension', sourceChannel: 'TWITCH', status: 'PENDING' } });
      else await receipt(t, kind);
      const before = await state();
      await expect(f.owner.extendImportedCanary(operatorId, f.added.twitchUserId, f.added.playerId, f.added.imported.backupHash, STREAMERBOT_PATH_DISABLED, 5)).rejects.toMatchObject({ code: 'TWITCH_IMPORTED_CANARY_EXTENSION_BLOCKED' });
      expect(await state(), scope + ':' + kind).toEqual(before);
    }
  });
  it('rolls back the target and both audits when the final control audit fails', async () => {
    const f = await setup(), before = await state();
    const failing = db.$extends({ query: { twitchNativeAudit: { async create({ args, query }) {
      if (args.data.action === 'DESIRED_AUTHORITY_CHANGED') throw new Error('PRIVATE_FINAL_AUDIT_FAILURE');
      return query(args);
    } } } });
    await expect(new TwitchNativeAuthority(failing as unknown as typeof db, config).extendImportedCanary(operatorId,
      f.added.twitchUserId, f.added.playerId, f.added.imported.backupHash, STREAMERBOT_PATH_DISABLED, 5)).rejects.toThrow('PRIVATE_FINAL_AUDIT_FAILURE');
    expect(await state()).toEqual(before);
  });
  it('uses a Serializable transaction', async () => {
    const f = await setup(), transaction = vi.spyOn(db, '$transaction');
    try {
      await f.owner.extendImportedCanary(operatorId, f.added.twitchUserId, f.added.playerId, f.added.imported.backupHash, STREAMERBOT_PATH_DISABLED, 5);
      expect(transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ isolationLevel: 'Serializable' }));
    } finally { transaction.mockRestore(); }
  });
  it.each(['authority', 'prior-target', 'added-target', 'prior-player', 'added-player'] as const)('waits for the %s row lock before committing', async kind => {
    const f = await setup();
    await fixture.admin.query('BEGIN');
    let pending: Promise<unknown> | undefined;
    try {
      if (kind === 'authority') await fixture.admin.query('SELECT id FROM twitch_native_authorities WHERE id=$1 FOR UPDATE', ['twitch-commands']);
      else if (kind.endsWith('target')) await fixture.admin.query('SELECT twitch_user_id FROM twitch_native_targets WHERE twitch_user_id=$1 FOR UPDATE', [kind === 'prior-target' ? f.prior.twitchUserId : f.added.twitchUserId]);
      else await fixture.admin.query('SELECT id FROM players WHERE id=$1::uuid FOR UPDATE', [kind === 'prior-player' ? f.prior.playerId : f.added.playerId]);
      // Attach a rejection handler immediately; release the external transaction even if polling fails.
      pending = f.owner.extendImportedCanary(operatorId, f.added.twitchUserId, f.added.playerId, f.added.imported.backupHash, STREAMERBOT_PATH_DISABLED, 5)
        .then(value => ({ value }), error => ({ error }));
      await expect.poll(async () => (await fixture.admin.query('SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE pg_backend_pid() = ANY(pg_blocking_pids(pid))) waiting')).rows[0].waiting,
        { timeout: 5_000, interval: 100 }).toBe(true);
      await fixture.admin.query('COMMIT');
      expect(await pending).toMatchObject({ value: { desiredMode: 'CANARY', revision: 6 } });
    } finally { await fixture.admin.query('ROLLBACK'); if (pending) await pending; }
  });
  it('allows only one competing extension at the same revision with no partial transfer or lost canary', async () => {
    const f = await setup(), second = await target(false), before = await state();
    const results = await Promise.allSettled([f.added, second].map(t => f.owner.extendImportedCanary(operatorId, t.twitchUserId, t.playerId,
      t.imported.backupHash, STREAMERBOT_PATH_DISABLED, 5)));
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(1);
    expect(await db.twitchNativeTarget.count({ where: { canary: true } })).toBe(2);
    const winner = results[0]!.status === 'fulfilled' ? f.added : second, loser = winner === f.added ? second : f.added;
    expect(await db.twitchNativeTarget.findUniqueOrThrow({ where: { twitchUserId: loser.twitchUserId } })).toMatchObject({ dataAuthority: 'LEGACY', canary: false });
    const after = await state();
    for (const table of tables.filter(t => !['twitch_native_targets', 'twitch_native_authorities', 'twitch_native_audit'].includes(t))) expect(after[table], table).toEqual(before[table]);
    expect((JSON.parse(after.twitch_native_audit!) as string[]).length - (JSON.parse(before.twitch_native_audit!) as string[]).length).toBe(2);
  });
});
