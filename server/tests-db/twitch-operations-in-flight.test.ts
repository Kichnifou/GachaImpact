import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { bootstrapPlayer } from '../src/infrastructure/database/player-bootstrap.js';
import { planLegacyCanary, applyLegacyCanary, rollbackLegacyCanary, type CanaryBackup } from '../src/application/migration/legacy-canary.js';
import { TwitchNativeAuthority, STREAMERBOT_PATH_DISABLED } from '../src/application/twitch/twitch-native-authority.js';
import { canarySnapshot } from '../tests/helpers/legacy-canary-snapshot.js';
import { captureTargetedPlayerRows } from '../src/application/migration/targeted-player-rows.js';
import type { Prisma } from '../generated/prisma/client.js';

const fixture = isolatedBatchDatabase(), db = fixture.database;
const config = { host: 'localhost', port: 3001, supabase: {}, twitchCommandPilot: { enabled: true, globalEnabled: false },
  twitch: { pilotPlayerIds: [] as string[], pilotLogin: 'kichnifou' } };
let operatorId: string, sequence = 0;
beforeAll(async () => {
  await fixture.setup({ seedPublicCatalog: true });
  const operator = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Private receipt operator',
    twitchIdentity: { twitchUserId: '910000000000', login: 'kichnifou', displayName: 'Private operator', firstSeenAt: new Date() } }));
  operatorId = operator.id; config.twitch.pilotPlayerIds.push(operatorId);
  await db.playerRoleAssignment.create({ data: { playerId: operatorId, role: 'ADMIN', source: 'private-receipt-test' } });
}, 60_000);
afterAll(async () => fixture.cleanup(), 60_000);

function source() {
  const result = canarySnapshot(); result.report.users[0]!.twitchUserId = String(910000000001 + sequence++); return result;
}
function rawReceipt(twitchUserId: string): Prisma.TwitchEventReceiptCreateManyInput {
  return { twitchUserId, externalEventId: randomUUID(), eventType: 'channel.chat.message', state: 'RECEIVED',
    processedAt: null, externalReference: null, payloadMinimal: { contentHash: 'private-observer' } };
}
const blocking = [
  { name: 'command EXECUTING', payloadMinimal: { commandPilot: { stage: 'EXECUTING', responses: [] } } },
  { name: 'command RESPONSES / PENDING', payloadMinimal: { commandPilot: { stage: 'RESPONSES', responses: [{ status: 'PENDING' }] } } },
  { name: 'reserved message-native', externalReference: 'message-native:private:reserved' },
  { name: 'outbound SENDING even on PROCESSED', state: 'PROCESSED', payloadMinimal: { commandPilot: { stage: 'RESPONSES', responses: [{ status: 'SENDING' }] } } },
  { name: 'outbound AMBIGUOUS even on FAILED', state: 'FAILED', payloadMinimal: { commandPilot: { stage: 'RESPONSES', responses: [{ status: 'AMBIGUOUS' }] } } },
  { name: 'EXECUTING even on FAILED', state: 'FAILED', payloadMinimal: { commandPilot: { stage: 'EXECUTING', responses: [] } } },
  { name: 'non-chat RECEIVED', eventType: 'channel.channel_points_custom_reward_redemption.add' },
] satisfies (Partial<Prisma.TwitchEventReceiptCreateManyInput> & { name: string })[];

describe('shared canary and rollback receipt safety in a private schema', () => {
  it('allows 71 passive observers through plan, import and Native authority rollback without changing their receipts', async () => {
    const { snapshot, report } = source(), id = report.users[0]!.twitchUserId;
    await db.twitchEventReceipt.createMany({ data: Array.from({ length: 71 }, () => rawReceipt(id)) });
    const receiptsBefore = await db.twitchEventReceipt.findMany({ where: { twitchUserId: id }, orderBy: { id: 'asc' } });
    const plan = await planLegacyCanary(db, snapshot, report, id, null, new Date());
    expect(plan.blockers).toEqual([]);
    let backup!: CanaryBackup;
    await applyLegacyCanary(db, config, operatorId, plan, STREAMERBOT_PATH_DISABLED, async value => { backup = value; });
    const authority = new TwitchNativeAuthority(db, config);
    await authority.configure(operatorId, 'CANARY', [id], STREAMERBOT_PATH_DISABLED);
    await authority.configure(operatorId, 'OFF', []);
    await authority.relinquishForRollback(operatorId, id, backup.hash);
    expect(await db.twitchNativeTarget.findUniqueOrThrow({ where: { twitchUserId: id } })).toMatchObject({ dataAuthority: 'LEGACY', canary: false });
    await rollbackLegacyCanary(db, config, operatorId, backup);
    expect((await captureTargetedPlayerRows(db, backup.rows.playerIds)).hash).toBe(backup.rows.hash);
    expect(await db.twitchEventReceipt.findMany({ where: { twitchUserId: id }, orderBy: { id: 'asc' } })).toEqual(receiptsBefore);
  }, 180_000);

  it.each(blocking)('blocks plan and rechecks a stale apply plan for $name', async ({ name: _name, ...data }) => {
    const { snapshot, report } = source(), id = report.users[0]!.twitchUserId;
    const stale = await planLegacyCanary(db, snapshot, report, id, null, new Date());
    expect(stale.blockers).toEqual([]);
    await db.twitchEventReceipt.createMany({ data: [{ ...rawReceipt(id), ...data }] });
    expect((await planLegacyCanary(db, snapshot, report, id, null, new Date())).blockers).toContain('CANARY_OPERATIONS_IN_FLIGHT');
    const saveBackup = vi.fn();
    await expect(applyLegacyCanary(db, config, operatorId, stale, STREAMERBOT_PATH_DISABLED, saveBackup)).rejects.toThrow(/CANARY_(OPERATIONS_IN_FLIGHT|OUTBOUND_UNRESOLVED)/);
    expect(saveBackup).not.toHaveBeenCalled();
    expect(await db.twitchIdentity.count({ where: { twitchUserId: id } })).toBe(0);
    expect(await db.twitchNativeTarget.count({ where: { twitchUserId: id } })).toBe(0);
  }, 180_000);

  it.each(['PROCESSED', 'FAILED'])('keeps healthy terminal %s receipts non-blocking', async state => {
    const { snapshot, report } = source(), id = report.users[0]!.twitchUserId;
    await db.twitchEventReceipt.createMany({ data: [{ ...rawReceipt(id), state, externalReference: 'message-native:private:terminal',
      payloadMinimal: { commandPilot: { stage: 'RESPONSES', responses: [{ status: 'SENT' }] } } }] });
    expect((await planLegacyCanary(db, snapshot, report, id, null, new Date())).blockers).toEqual([]);
  }, 180_000);

  it('keeps engaged receipts, pending business operations and import provenance guards during authority rollback', async () => {
    const { snapshot, report } = source(), id = report.users[0]!.twitchUserId;
    const plan = await planLegacyCanary(db, snapshot, report, id, null, new Date());
    let backup!: CanaryBackup;
    const applied = await applyLegacyCanary(db, config, operatorId, plan, STREAMERBOT_PATH_DISABLED, async value => { backup = value; });
    const authority = new TwitchNativeAuthority(db, config);
    await authority.configure(operatorId, 'CANARY', [id], STREAMERBOT_PATH_DISABLED);
    await expect(authority.relinquishForRollback(operatorId, id, backup.hash)).rejects.toMatchObject({ code: 'TWITCH_NATIVE_ROLLBACK_OFF_REQUIRED' });
    await authority.configure(operatorId, 'OFF', []);
    for (const { name: _name, ...data } of blocking) {
      const receipt = await db.twitchEventReceipt.create({ data: { ...rawReceipt(id), ...data } });
      await expect(authority.relinquishForRollback(operatorId, id, backup.hash)).rejects.toMatchObject({ code: 'TWITCH_NATIVE_ROLLBACK_BLOCKED' });
      expect((await db.twitchNativeTarget.findUniqueOrThrow({ where: { twitchUserId: id } })).dataAuthority).toBe('NATIVE');
      await db.twitchEventReceipt.delete({ where: { id: receipt.id } });
    }
    const operation = await db.businessOperation.create({ data: { playerId: applied.playerId, operationType: 'private-receipt-safety', sourceChannel: 'TWITCH', status: 'PENDING' } });
    expect((await planLegacyCanary(db, snapshot, report, id, applied.playerId, new Date())).blockers).toContain('CANARY_OPERATIONS_IN_FLIGHT');
    await expect(authority.relinquishForRollback(operatorId, id, backup.hash)).rejects.toMatchObject({ code: 'TWITCH_NATIVE_ROLLBACK_BLOCKED' });
    await db.businessOperation.delete({ where: { id: operation.id } });
    await expect(authority.relinquishForRollback(operatorId, id, '0'.repeat(64))).rejects.toMatchObject({ code: 'TWITCH_NATIVE_ROLLBACK_BLOCKED' });
    await authority.relinquishForRollback(operatorId, id, backup.hash);
    await rollbackLegacyCanary(db, config, operatorId, backup);
    expect((await captureTargetedPlayerRows(db, backup.rows.playerIds)).hash).toBe(backup.rows.hash);
  }, 180_000);
});
