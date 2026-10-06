import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { bootstrapPlayer } from '../src/infrastructure/database/player-bootstrap.js';
import { applyLegacyCanary, planLegacyCanary, type CanaryBackup } from '../src/application/migration/legacy-canary.js';
import { TwitchNativeAuthority, STREAMERBOT_PATH_DISABLED } from '../src/application/twitch/twitch-native-authority.js';
import { canarySnapshot } from '../tests/helpers/legacy-canary-snapshot.js';

const fixture = isolatedBatchDatabase(), db = fixture.database;
const config = { host: 'localhost', port: 3001, supabase: {}, twitchCommandPilot: { enabled: true, globalEnabled: false },
  twitch: { pilotPlayerIds: [] as string[], pilotLogin: 'kichnifou' } };
const owner = new TwitchNativeAuthority(db, config);
let operatorId: string, sequence = 0;
beforeAll(async () => {
  await fixture.setup({ seedPublicCatalog: true });
  const operator = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Private canary operator',
    twitchIdentity: { twitchUserId: '910001000000', login: 'kichnifou', displayName: 'Private operator', firstSeenAt: new Date() } }));
  operatorId = operator.id; config.twitch.pilotPlayerIds.push(operatorId);
  await db.playerRoleAssignment.create({ data: { playerId: operatorId, role: 'ADMIN', source: 'private-canary-cli' } });
}, 60_000);
afterEach(async () => {
  await db.twitchNativeTarget.updateMany({ where: { canary: true }, data: { canary: false } });
  await db.twitchNativeAuthority.deleteMany();
});
afterAll(async () => fixture.cleanup(), 60_000);

async function imported() {
  const { snapshot, report } = canarySnapshot();
  const id = report.users[0]!.twitchUserId = String(910001000001 + sequence++);
  const plan = await planLegacyCanary(db, snapshot, report, id, null, new Date());
  let backup!: CanaryBackup;
  const applied = await applyLegacyCanary(db, config, operatorId, plan, STREAMERBOT_PATH_DISABLED, async value => { backup = value; });
  return { id, playerId: applied.playerId, backup };
}
async function state(id: string) {
  return { target: await db.twitchNativeTarget.findUnique({ where: { twitchUserId: id } }),
    control: await db.twitchNativeAuthority.findUnique({ where: { id: 'twitch-commands' } }),
    audits: await db.twitchNativeAudit.count() };
}

describe('strict imported canary transfer in a private schema', () => {
  it('transfers exactly the confirmed imported Player and leaves another target unchanged', async () => {
    const { id, playerId, backup } = await imported();
    const other = await db.twitchNativeTarget.create({ data: { twitchUserId: '910001999999', dataAuthority: 'LEGACY' } });
    expect(await owner.transferImportedCanary(operatorId, id, playerId, backup.hash, STREAMERBOT_PATH_DISABLED, 0)).toMatchObject({ desiredMode: 'CANARY' });
    expect(await db.twitchNativeTarget.findUniqueOrThrow({ where: { twitchUserId: id } })).toMatchObject({ playerId,
      dataAuthority: 'NATIVE', canary: true, acknowledgement: STREAMERBOT_PATH_DISABLED, transferredAt: expect.any(Date) });
    expect(await db.twitchNativeTarget.findUnique({ where: { twitchUserId: other.twitchUserId } })).toEqual(other);
    expect(await db.twitchNativeTarget.count({ where: { canary: true } })).toBe(1);
    expect(await db.webIdentity.count({ where: { playerId } })).toBe(0);
    expect(await db.twitchNativeAudit.count({ where: { twitchUserId: id, action: 'AUTHORITY_TRANSFERRED' } })).toBe(1);
  }, 180_000);

  it.each(['wrong-player', 'wrong-id', 'wrong-backup', 'missing-import', 'wrong-operator', 'wrong-ack', 'stale-revision', 'pending-operation', 'uncertain-outbound', 'authority-not-off'])
    ('rejects %s atomically before authority changes', async reason => {
      const { id, playerId, backup } = await imported();
      if (reason === 'missing-import') await db.twitchCanaryImport.deleteMany({ where: { twitchUserId: id } });
      if (reason === 'authority-not-off') await db.twitchNativeAuthority.create({ data: { id: 'twitch-commands', desiredMode: 'CANARY',
        operatorPlayerId: operatorId, acknowledgement: STREAMERBOT_PATH_DISABLED, acknowledgedAt: new Date() } });
      if (reason === 'pending-operation') await db.businessOperation.create({ data: { playerId, operationType: 'private-transfer', sourceChannel: 'TWITCH', status: 'PENDING' } });
      if (reason === 'uncertain-outbound') await db.twitchEventReceipt.create({ data: { twitchUserId: id,
        externalEventId: randomUUID(), eventType: 'channel.chat.message', state: 'PROCESSED',
        payloadMinimal: { commandPilot: { stage: 'RESPONSES', responses: [{ status: 'SENDING' }] } } } });
      const before = await state(id);
      await expect(owner.transferImportedCanary(reason === 'wrong-operator' ? randomUUID() : operatorId,
        reason === 'wrong-id' ? '910001888888' : id, reason === 'wrong-player' ? randomUUID() : playerId,
        reason === 'wrong-backup' ? '0'.repeat(64) : backup.hash, reason === 'wrong-ack' ? 'YES' : STREAMERBOT_PATH_DISABLED,
        reason === 'stale-revision' || reason === 'authority-not-off' ? 1 : 0)).rejects.toThrow();
      expect(await state(id)).toEqual(before);
    }, 180_000);

  it('refuses to replace an existing canary even when the owner is OFF', async () => {
    const { id, playerId, backup } = await imported();
    await owner.configure(operatorId, 'CANARY', ['910001777777'], STREAMERBOT_PATH_DISABLED);
    await owner.configure(operatorId, 'OFF', []);
    const revision = (await owner.read()).revision;
    const before = await state(id), otherBefore = await db.twitchNativeTarget.findUnique({ where: { twitchUserId: '910001777777' } });
    await expect(owner.transferImportedCanary(operatorId, id, playerId, backup.hash, STREAMERBOT_PATH_DISABLED, revision))
      .rejects.toMatchObject({ code: 'TWITCH_IMPORTED_CANARY_TRANSFER_BLOCKED' });
    expect(await state(id)).toEqual(before);
    expect(await db.twitchNativeTarget.findUnique({ where: { twitchUserId: '910001777777' } })).toEqual(otherBefore);
  }, 180_000);
  it('keeps the configured command capability as a prerequisite', async () => {
    const { id, playerId, backup } = await imported(), before = await state(id);
    const disabled = new TwitchNativeAuthority(db, { ...config, twitchCommandPilot: { enabled: false, globalEnabled: false } });
    await expect(disabled.transferImportedCanary(operatorId, id, playerId, backup.hash, STREAMERBOT_PATH_DISABLED, 0))
      .rejects.toMatchObject({ code: 'TWITCH_COMMAND_PILOT_OFF' });
    expect(await state(id)).toEqual(before);
  }, 180_000);
});
