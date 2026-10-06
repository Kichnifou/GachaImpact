import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { bootstrapPlayer } from '../src/infrastructure/database/player-bootstrap.js';
import { reconcileQuotisPreparation, QUOTIS_PREPARATION_FAILURE, type QuotisPreparationReconciliation } from '../src/application/twitch/reconcile-quotis-preparation.js';
import { assessTwitchOperationsInFlight } from '../src/application/twitch/twitch-operations-in-flight.js';
import { captureTargetedPlayerRows } from '../src/application/migration/targeted-player-rows.js';
import { STREAMERBOT_PATH_DISABLED } from '../src/application/twitch/twitch-native-authority.js';
import type { Prisma } from '../generated/prisma/client.js';

const fixture = isolatedBatchDatabase(), db = fixture.database;
const config = { host: 'localhost', port: 3001, supabase: {}, twitch: { pilotPlayerIds: [] as string[], pilotLogin: 'kichnifou' } };
let operatorId: string, sequence = 0;
beforeAll(async () => {
  await fixture.setup({ seedPublicCatalog: true });
  const operator = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Private reconciliation operator',
    twitchIdentity: { twitchUserId: '910040000000', login: 'kichnifou', displayName: 'Private operator', firstSeenAt: new Date() } }));
  operatorId = operator.id; config.twitch.pilotPlayerIds = [operatorId];
  await db.playerRoleAssignment.create({ data: { playerId: operatorId, role: 'ADMIN', source: 'private-reconciliation' } });
  await db.twitchNativeAuthority.create({ data: { id: 'twitch-commands', desiredMode: 'OFF', revision: 3, operatorPlayerId: operatorId } });
}, 60_000);
afterAll(() => fixture.cleanup(), 60_000);

async function pair(): Promise<QuotisPreparationReconciliation> {
  const twitchUserId = String(910040000001 + sequence++);
  const player = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Private quotis', twitchIdentity: {
    twitchUserId, login: 'private_quotis', displayName: 'Private quotis', firstSeenAt: new Date() } }));
  await db.twitchNativeTarget.updateMany({ where: { canary: true }, data: { canary: false } });
  await db.twitchNativeTarget.create({ data: { twitchUserId, playerId: player.id, dataAuthority: 'NATIVE', canary: true,
    acknowledgement: STREAMERBOT_PATH_DISABLED, transferredAt: new Date() } });
  await db.twitchNativeAuthority.update({ where: { id: 'twitch-commands' }, data: { desiredMode: 'OFF', revision: 3, acknowledgement: null, acknowledgedAt: null } });
  const receiptIds: [string, string] = [randomUUID(), randomUUID()];
  for (const id of receiptIds) {
    const message = randomUUID(), commandKey = `twitch-command:910040000000:${message}`;
    await db.twitchEventReceipt.create({ data: { id, twitchUserId, eventType: 'channel.chat.message', externalEventId: randomUUID(),
      payloadHash: 'private-source-hash', externalReference: 'command-pilot:' + commandKey, payloadMinimal: {
        contentHash: 'private-command-hash', sourceTimestamp: '2026-10-06T12:00:00Z', messageActivity: { preserved: true },
        commandPilot: { version: 1, playerId: player.id, actorName: 'Private quotis', handler: 'quotis', args: [], stage: 'EXECUTING',
          responses: [], chatterId: twitchUserId, senderId: '910040000000', broadcasterId: '910040000000', replyParentMessageId: message,
          commandKey, businessAt: '2026-10-06T12:00:00Z', extraHistoricalField: 'preserved' },
      } } });
  }
  return { operatorPlayerId: operatorId, twitchUserId, expectedPlayerId: player.id, expectedRevision: 3, receiptIds };
}
async function snapshot(args: QuotisPreparationReconciliation) {
  return { player: await captureTargetedPlayerRows(db, [args.expectedPlayerId]),
    targets: await db.twitchNativeTarget.findMany({ orderBy: { twitchUserId: 'asc' } }), control: await db.twitchNativeAuthority.findMany(),
    receipts: await db.twitchEventReceipt.findMany({ where: { id: { in: args.receiptIds } }, orderBy: { id: 'asc' } }),
    operations: await db.businessOperation.findMany({ orderBy: { id: 'asc' } }), movements: await db.resourceMovement.findMany(),
    audits: await db.twitchNativeAudit.findMany({ orderBy: { id: 'asc' } }) };
}
async function pilotPatch(args: QuotisPreparationReconciliation, patch: Record<string, Prisma.InputJsonValue | null>) {
  const receipt = await db.twitchEventReceipt.findUniqueOrThrow({ where: { id: args.receiptIds[1] } });
  const payload = receipt.payloadMinimal as Prisma.JsonObject;
  await db.twitchEventReceipt.update({ where: { id: receipt.id }, data: { payloadMinimal: {
    ...payload, commandPilot: { ...(payload.commandPilot as Prisma.JsonObject), ...patch },
  } as Prisma.InputJsonValue } });
}
const refused = [
  'missing receipt', 'wrong player', 'wrong identity', 'wrong handler', 'arguments', 'intent', 'null intent', 'responses',
  'linked completed operation', 'pending operation', 'wrong stage', 'terminal receipt', 'external reference', 'command key',
  'pilot armed', 'stale revision', 'duplicate receipt', 'operator not allowed', 'other blocking receipt',
] as const;

describe('strict local read-only quotis PREPARE failure reconciliation in private PostgreSQL', () => {
  it.each(refused)('refuses %s atomically, including when the first receipt was valid', async kind => {
    const args = await pair(), input = structuredClone(args);
    if (kind === 'missing receipt') input.receiptIds[1] = randomUUID();
    if (kind === 'wrong player') input.expectedPlayerId = operatorId;
    if (kind === 'wrong identity') await db.twitchEventReceipt.update({ where: { id: args.receiptIds[1] }, data: { twitchUserId: '910040000000' } });
    if (kind === 'wrong handler') await pilotPatch(args, { handler: 'roue' });
    if (kind === 'arguments') await pilotPatch(args, { args: ['unexpected'] });
    if (kind === 'intent') await pilotPatch(args, { intent: { mutation: { path: 'spinDailyWheelChat.execute' } } });
    if (kind === 'null intent') await pilotPatch(args, { intent: null });
    if (kind === 'responses') await pilotPatch(args, { responses: [{ text: 'private', status: 'SENT' }] });
    if (kind === 'wrong stage') await pilotPatch(args, { stage: 'RESPONSES' });
    if (kind === 'command key') await pilotPatch(args, { commandKey: 'twitch-command:wrong:key' });
    if (kind === 'terminal receipt') await db.twitchEventReceipt.update({ where: { id: args.receiptIds[1] }, data: { state: 'FAILED' } });
    if (kind === 'external reference') await db.twitchEventReceipt.update({ where: { id: args.receiptIds[1] }, data: { externalReference: 'command-pilot:wrong' } });
    if (kind === 'pilot armed') await db.twitchNativeAuthority.update({ where: { id: 'twitch-commands' }, data: { desiredMode: 'CANARY', acknowledgement: STREAMERBOT_PATH_DISABLED, acknowledgedAt: new Date() } });
    if (kind === 'stale revision') input.expectedRevision = 2;
    if (kind === 'duplicate receipt') input.receiptIds[1] = input.receiptIds[0];
    if (kind === 'operator not allowed') input.operatorPlayerId = args.expectedPlayerId;
    if (kind === 'linked completed operation' || kind === 'pending operation') {
      const receipt = await db.twitchEventReceipt.findUniqueOrThrow({ where: { id: args.receiptIds[1] } });
      const key = ((receipt.payloadMinimal as Prisma.JsonObject).commandPilot as Prisma.JsonObject).commandKey as string;
      await db.businessOperation.create({ data: { playerId: args.expectedPlayerId, operationType: 'private-reconciliation-blocker', sourceChannel: 'TWITCH',
        status: kind === 'pending operation' ? 'PENDING' : 'COMPLETED', idempotencyKey: kind === 'pending operation' ? randomUUID() : 'wheel.intent:' + args.expectedPlayerId + ':' + key } });
    }
    if (kind === 'other blocking receipt') await db.twitchEventReceipt.create({ data: { eventType: 'channel.chat.message', twitchUserId: args.twitchUserId,
      externalEventId: randomUUID(), externalReference: 'message-native:private-blocker' } });
    const before = await snapshot(args);
    await expect(reconcileQuotisPreparation(db, config, input)).rejects.toThrow();
    expect(await snapshot(args)).toEqual(before);
  });
  it('terminalizes exactly two receipts with audit, preserved source and no gameplay effects; then refuses replay', async () => {
    const args = await pair(), before = await snapshot(args);
    expect((await assessTwitchOperationsInFlight(db, args.twitchUserId, args.expectedPlayerId)).blocked).toBe(true);
    expect(await reconcileQuotisPreparation(db, config, args)).toEqual({ status: QUOTIS_PREPARATION_FAILURE, reconciled: 2, operationsInFlight: false });
    const after = await snapshot(args);
    expect(after.player).toEqual(before.player); expect(after.operations).toEqual(before.operations); expect(after.movements).toEqual(before.movements);
    expect(after.targets).toEqual(before.targets); expect(after.control).toEqual(before.control);
    expect(after.audits).toHaveLength(before.audits.length + 1);
    for (let i = 0; i < 2; i++) {
      const original = before.receipts[i]!, final = after.receipts[i]!;
      const payload = final.payloadMinimal as Prisma.JsonObject, old = original.payloadMinimal as Prisma.JsonObject;
      expect(final).toMatchObject({ state: 'FAILED', errorMessage: QUOTIS_PREPARATION_FAILURE }); expect(final.processedAt).not.toBeNull();
      expect({ ...final, payloadMinimal: original.payloadMinimal, state: original.state, processedAt: original.processedAt, errorMessage: original.errorMessage }).toEqual(original);
      expect(payload.commandPilot).toEqual({ ...(old.commandPilot as Prisma.JsonObject), stage: 'RESPONSES' });
      expect({ ...payload, commandPilot: old.commandPilot, preparationReconciliation: undefined }).toEqual({ ...old, preparationReconciliation: undefined });
      expect(payload.preparationReconciliation).toMatchObject({ reason: QUOTIS_PREPARATION_FAILURE, previousState: 'RECEIVED', previousStage: 'EXECUTING', resolverExecuted: false, responseSent: false });
    }
    expect(await assessTwitchOperationsInFlight(db, args.twitchUserId, args.expectedPlayerId)).toEqual({ blocked: false, unresolvedOutbound: false });
    await expect(reconcileQuotisPreparation(db, config, args)).rejects.toThrow(); expect(await snapshot(args)).toEqual(after);
  });
});
