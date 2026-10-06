/// <reference types="vite/client" />
import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { bootstrapPlayer } from '../src/infrastructure/database/player-bootstrap.js';
import { TwitchNativeAuthority, STREAMERBOT_PATH_DISABLED } from '../src/application/twitch/twitch-native-authority.js';
import { TwitchCommandPilot } from '../src/application/twitch/twitch-command-pilot.js';
import { registerTwitchPilotRoutes } from '../src/api/routes/twitch-pilot.js';
import { createAuthenticationHook, registerAuthenticationContext } from '../src/api/auth/authentication.js';
import { registerErrorHandler } from '../src/api/error-handler.js';
import type { TwitchPilotService } from '../src/application/twitch/twitch-pilot-service.js';
import type { SnapshotPilotService } from '../src/application/migration/snapshot-pilot-service.js';
import { captureTargetedPlayerRows } from '../src/application/migration/targeted-player-rows.js';
import { createGameApiClient } from '../../src/api/game-api.js';

const fixture = isolatedBatchDatabase(), db = fixture.database;
const at = new Date('2026-10-06T19:00:00Z');
let operatorId: string, sequence = 0;
const config = () => ({ host: 'localhost', port: 3001, supabase: {}, twitchCommandPilot: { enabled: true, globalEnabled: false },
  twitch: { pilotPlayerIds: [operatorId], pilotLogin: 'kichnifou' } });
beforeAll(async () => {
  await fixture.setup({ seedPublicCatalog: true });
  const player = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Private operator', twitchIdentity: {
    twitchUserId: '910050000000', login: 'kichnifou', displayName: 'Private operator', firstSeenAt: at } }, at));
  operatorId = player.id;
  await db.player.update({ where: { id: operatorId }, data: { legacyUsername: 'Private operator legacy' } });
  await db.playerRoleAssignment.create({ data: { playerId: operatorId, role: 'ADMIN', source: 'private-canary-resume' } });
  await db.twitchNativeAuthority.create({ data: { id: 'twitch-commands', desiredMode: 'OFF', revision: 3, operatorPlayerId: operatorId } });
}, 60_000);
afterAll(() => fixture.cleanup(), 60_000);

async function nativeCanary() {
  const twitchUserId = String(910050000001 + sequence++);
  const player = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Private existing canary', twitchIdentity: {
    twitchUserId, login: 'private_canary', displayName: 'Private canary', firstSeenAt: at } }, at));
  await db.player.update({ where: { id: player.id }, data: { legacyUsername: 'Private canary ' + twitchUserId } });
  await db.twitchNativeTarget.create({ data: { twitchUserId, playerId: player.id, canary: true, dataAuthority: 'NATIVE',
    acknowledgement: STREAMERBOT_PATH_DISABLED, transferredAt: at } });
  await db.twitchCanaryImport.create({ data: { twitchUserId, playerId: player.id, snapshotHash: 'a'.repeat(64),
    identityReportHash: 'b'.repeat(64), backupHash: 'c'.repeat(64), status: 'DATA_IMPORTED', importedAt: at } });
  await db.twitchNativeAudit.create({ data: { actorPlayerId: operatorId, action: 'AUTHORITY_TRANSFERRED', twitchUserId, acknowledgement: STREAMERBOT_PATH_DISABLED } });
  return { twitchUserId, playerId: player.id };
}
async function setup() {
  await db.twitchNativeTarget.updateMany({ where: { canary: true }, data: { canary: false } });
  await db.twitchNativeAuthority.update({ where: { id: 'twitch-commands' }, data: { desiredMode: 'OFF', revision: 3, acknowledgement: null, acknowledgedAt: null } });
  const target = await nativeCanary(), settings = config();
  const subscriptions = { activationAvailable: true, inspectPilotChatTransport: vi.fn(async () => ({ broadcasterId: '910050000000',
    receiverId: '910050000000', subscriptionId: 'private-canary-subscription', callback: 'https://private.example/api/v1/twitch/eventsub' })) };
  const executor = { execute: vi.fn(async () => { throw new Error('NO_GAMEPLAY_DURING_RESUME'); }) }, outbound = { send: vi.fn(async () => { throw new Error('NO_OUTBOUND_DURING_RESUME'); }) };
  const authority = new TwitchNativeAuthority(db, settings), pilot = new TwitchCommandPilot(db, settings, executor, outbound, undefined, subscriptions);
  return { target, settings, authority, pilot, subscriptions, executor, outbound };
}
async function state() {
  return { targets: await db.twitchNativeTarget.findMany({ orderBy: { twitchUserId: 'asc' } }), control: await db.twitchNativeAuthority.findMany(),
    players: await db.player.findMany({ orderBy: { id: 'asc' } }), identities: await db.twitchIdentity.findMany({ orderBy: { twitchUserId: 'asc' } }),
    imports: await db.twitchCanaryImport.findMany({ orderBy: { id: 'asc' } }), operations: await db.businessOperation.findMany({ orderBy: { id: 'asc' } }),
    receipts: await db.twitchEventReceipt.findMany({ orderBy: { id: 'asc' } }), audits: await db.twitchNativeAudit.findMany({ orderBy: { id: 'asc' } }) };
}

describe('resume existing native canaries without another data transfer in private PostgreSQL', () => {
  it('rearms through the real browser API client and route with ACK only, retaining the distinct imported canary', async () => {
    const f = await setup(), before = await state(), gameplay = await captureTargetedPlayerRows(db, [operatorId, f.target.playerId]);
    expect(await db.twitchCanaryImport.count({ where: { playerId: operatorId } })).toBe(0);
    const app = Fastify({ logger: false }); registerAuthenticationContext(app); registerErrorHandler(app);
    await registerTwitchPilotRoutes(app, { config: f.settings, commandPilot: f.pilot,
      authenticate: createAuthenticationHook({ verify: async () => ({ subject: 'private-operator' }) }),
      twitch: { requirePilot: async () => ({ id: operatorId }) } as unknown as TwitchPilotService, snapshot: {} as SnapshotPilotService });
    const bodies: unknown[] = [];
    const client = createGameApiClient({ baseUrl: 'https://private.example', getAccessToken: async () => 'private-token',
      fetchImplementation: async (_url, init) => {
        bodies.push(JSON.parse(init!.body as string));
        const reply = await app.inject({ method: 'POST', url: '/api/v1/me/twitch/commands/pilot', headers: { authorization: 'Bearer private-token', 'content-type': 'application/json' }, payload: init!.body as string });
        return new Response(reply.body, { status: reply.statusCode, headers: { 'content-type': 'application/json' } });
      } });
    try {
      expect(await client.armTwitchCommandPilot(STREAMERBOT_PATH_DISABLED)).toMatchObject({ desiredAuthority: 'CANARY', effectiveAuthority: 'CANARY', commandPilotArmed: true, commandPilotEnabled: true, transportValid: true });
      expect(bodies).toEqual([{ acknowledgement: STREAMERBOT_PATH_DISABLED }]);
      const after = await state(); expect(after.targets).toEqual(before.targets); expect(after.players).toEqual(before.players);
      expect(after.identities).toEqual(before.identities); expect(after.imports).toEqual(before.imports); expect(after.operations).toEqual(before.operations); expect(after.receipts).toEqual(before.receipts);
      expect(after.control[0]).toMatchObject({ desiredMode: 'CANARY', revision: 4, operatorPlayerId: operatorId });
      expect(after.audits.filter(row => row.action === 'AUTHORITY_TRANSFERRED')).toEqual(before.audits.filter(row => row.action === 'AUTHORITY_TRANSFERRED'));
      expect(after.audits).toHaveLength(before.audits.length + 1); expect(after.audits.find(row => !before.audits.some(old => old.id === row.id)))
        .toMatchObject({ action: 'DESIRED_AUTHORITY_CHANGED', mode: 'CANARY', revision: 4, actorPlayerId: operatorId });
      expect(await captureTargetedPlayerRows(db, [operatorId, f.target.playerId])).toEqual(gameplay);
      expect(await db.twitchNativeTarget.count({ where: { canary: true } })).toBe(1);
      expect(f.executor.execute).not.toHaveBeenCalled(); expect(f.outbound.send).not.toHaveBeenCalled(); expect(f.subscriptions.inspectPilotChatTransport).toHaveBeenCalled();
    } finally { await app.close(); }
  });
  it('resumes exactly multiple persisted canaries, including an unprovisioned native target', async () => {
    const f = await setup(), second = await nativeCanary(), unprovisioned = String(910050000001 + sequence++);
    await db.twitchNativeTarget.create({ data: { twitchUserId: unprovisioned, dataAuthority: 'NATIVE', canary: true, acknowledgement: STREAMERBOT_PATH_DISABLED, transferredAt: at } });
    const before = await state();
    await f.pilot.arm(operatorId, STREAMERBOT_PATH_DISABLED);
    const after = await state(); expect(after.targets).toEqual(before.targets); expect(after.imports).toEqual(before.imports); expect(after.players).toEqual(before.players);
    expect(after.targets.filter(row => row.canary).map(row => row.twitchUserId).sort()).toEqual([f.target.twitchUserId, second.twitchUserId, unprovisioned].sort());
    expect(after.audits).toHaveLength(before.audits.length + 1); expect(after.audits.filter(row => row.action === 'AUTHORITY_TRANSFERRED')).toEqual(before.audits.filter(row => row.action === 'AUTHORITY_TRANSFERRED'));
  });
  it('preserves explicit targeted arm and the DATA_IMPORTED gate for the operator', async () => {
    const f = await setup(), before = await state();
    await expect(f.pilot.arm(operatorId, STREAMERBOT_PATH_DISABLED, ['910050000000'])).rejects.toMatchObject({ code: 'TWITCH_NATIVE_DATA_IMPORT_REQUIRED' });
    expect(await state()).toEqual(before);
    const second = await nativeCanary();
    await f.pilot.arm(operatorId, STREAMERBOT_PATH_DISABLED, [second.twitchUserId]);
    expect((await db.twitchNativeTarget.findMany({ where: { canary: true } })).map(row => row.twitchUserId)).toEqual([second.twitchUserId]);
    expect(await db.twitchNativeAudit.count({ where: { action: 'AUTHORITY_TRANSFERRED' } })).toBe(before.audits.filter(row => row.action === 'AUTHORITY_TRANSFERRED').length + 2);
  });
  it('keeps the historical no-canary fallback guarded, then allows an eligible native operator', async () => {
    const f = await setup(); await db.twitchNativeTarget.update({ where: { twitchUserId: f.target.twitchUserId }, data: { canary: false } });
    const before = await state(); expect(await f.authority.hasPersistedCanary()).toBe(false);
    await expect(f.pilot.arm(operatorId, STREAMERBOT_PATH_DISABLED)).rejects.toMatchObject({ code: 'TWITCH_NATIVE_DATA_IMPORT_REQUIRED' });
    expect(await state()).toEqual(before);
    await db.player.update({ where: { id: operatorId }, data: { legacyUsername: null } });
    try {
      expect(await f.pilot.arm(operatorId, STREAMERBOT_PATH_DISABLED)).toMatchObject({ desiredAuthority: 'CANARY', commandPilotEnabled: true });
      expect((await db.twitchNativeTarget.findMany({ where: { canary: true } })).map(row => row.twitchUserId)).toEqual(['910050000000']);
    } finally { await db.player.update({ where: { id: operatorId }, data: { legacyUsername: 'Private operator legacy' } }); }
  });
  it.each(['stale revision', 'invalid revision', 'already armed', 'LEGACY', 'MIGRATION_PENDING', 'wrong Player', 'missing identity',
    'identity without target Player', 'inactive Player', 'pending operation', 'EXECUTING receipt', 'uncertain outbound', 'empty set',
    'capability OFF', 'missing ACK', 'wrong operator', 'invalid transport'])('refuses %s atomically', async kind => {
    const f = await setup(); let revision = 3, actor = operatorId, acknowledgement: string | undefined = STREAMERBOT_PATH_DISABLED;
    if (kind === 'stale revision') revision = 2;
    if (kind === 'invalid revision') revision = Number.NaN;
    if (kind === 'already armed') await db.twitchNativeAuthority.update({ where: { id: 'twitch-commands' }, data: { desiredMode: 'CANARY', acknowledgement: STREAMERBOT_PATH_DISABLED, acknowledgedAt: at } });
    if (kind === 'LEGACY' || kind === 'MIGRATION_PENDING') await db.twitchNativeTarget.update({ where: { twitchUserId: f.target.twitchUserId }, data: { dataAuthority: kind } });
    if (kind === 'wrong Player') {
      await db.twitchNativeTarget.updateMany({ where: { playerId: operatorId }, data: { playerId: null } });
      await db.twitchNativeTarget.update({ where: { twitchUserId: f.target.twitchUserId }, data: { playerId: operatorId } });
    }
    if (kind === 'missing identity') await db.twitchIdentity.delete({ where: { playerId: f.target.playerId } });
    if (kind === 'identity without target Player') await db.twitchNativeTarget.update({ where: { twitchUserId: f.target.twitchUserId }, data: { playerId: null } });
    if (kind === 'inactive Player') await db.player.update({ where: { id: f.target.playerId }, data: { status: 'SUSPENDED' } });
    if (kind === 'pending operation') await db.businessOperation.create({ data: { playerId: f.target.playerId, operationType: 'private-pending', sourceChannel: 'TWITCH' } });
    if (kind === 'EXECUTING receipt' || kind === 'uncertain outbound') await db.twitchEventReceipt.create({ data: { externalEventId: randomUUID(),
      eventType: 'channel.chat.message', twitchUserId: f.target.twitchUserId, state: kind === 'uncertain outbound' ? 'FAILED' : 'RECEIVED',
      payloadMinimal: { commandPilot: { stage: kind === 'uncertain outbound' ? 'RESPONSES' : 'EXECUTING', responses: kind === 'uncertain outbound' ? [{ status: 'AMBIGUOUS' }] : [] } } } });
    if (kind === 'empty set') await db.twitchNativeTarget.update({ where: { twitchUserId: f.target.twitchUserId }, data: { canary: false } });
    if (kind === 'capability OFF') f.settings.twitchCommandPilot.enabled = false;
    if (kind === 'missing ACK') acknowledgement = undefined;
    if (kind === 'wrong operator') actor = f.target.playerId;
    if (kind === 'invalid transport') f.subscriptions.inspectPilotChatTransport.mockRejectedValue(new Error('private transport error'));
    const before = await state();
    if (kind === 'invalid transport') await expect(f.pilot.arm(actor, acknowledgement)).rejects.toMatchObject({ code: 'TWITCH_COMMAND_SUBSCRIPTION_INACTIVE' });
    else await expect(f.authority.resumePersistedCanary(actor, acknowledgement, revision)).rejects.toThrow();
    expect(await state()).toEqual(before); expect(f.executor.execute).not.toHaveBeenCalled(); expect(f.outbound.send).not.toHaveBeenCalled();
  });
  it('refuses an invalid member of a mixed persisted set instead of falling back or resuming only its valid member', async () => {
    const f = await setup(), second = await nativeCanary();
    await db.twitchNativeTarget.update({ where: { twitchUserId: second.twitchUserId }, data: { dataAuthority: 'LEGACY' } });
    const before = await state();
    await expect(f.pilot.arm(operatorId, STREAMERBOT_PATH_DISABLED)).rejects.toMatchObject({ code: 'TWITCH_NATIVE_CANARY_RESUME_BLOCKED' });
    expect(await state()).toEqual(before);
  });
});
