import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { bootstrapPlayer } from '../src/infrastructure/database/player-bootstrap.js';
import { PrismaCurrentPlayerStore } from '../src/infrastructure/database/prisma-current-player-store.js';
import { PrismaTwitchPlayerStore } from '../src/infrastructure/database/prisma-twitch-player-store.js';
import { TwitchNativeAuthority, STREAMERBOT_PATH_DISABLED } from '../src/application/twitch/twitch-native-authority.js';
import { TwitchCommandPilot } from '../src/application/twitch/twitch-command-pilot.js';
import { TwitchMessageActivity } from '../src/application/twitch/twitch-message-activity.js';
import { TwitchProfileClaim, isDisposableWebPlayer } from '../src/application/twitch/twitch-profile-claim.js';
import { findChatCommand } from '../src/application/chat/chat-command-registry.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { ChoosePlayerElement } from '../src/application/player/choose-player-element.js';
import { PrismaPlayerElementStore } from '../src/infrastructure/database/prisma-player-element-store.js';
import { twitchPlayerCommandExecutor } from '../src/application/twitch/twitch-player-command-executor.js';
import { harness } from '../tests/helpers/chat-command-harness.js';
import type { ChatCommandServices } from '../src/application/chat/player-command-resolver.js';
import { SpinDailyWheel } from '../src/application/wheel/spin-daily-wheel.js';
import { PrismaWheelStore } from '../src/infrastructure/database/prisma-wheel-store.js';
import { captureTargetedPlayerRows } from '../src/application/migration/targeted-player-rows.js';

const fixture = isolatedBatchDatabase(), db = fixture.database;
const config = { host: 'localhost', port: 3001, supabase: {}, twitchCommandPilot: { enabled: true, globalEnabled: false },
  twitch: { pilotPlayerIds: [] as string[], pilotLogin: 'kichnifou' }, twitchEventSub: { enabled: true, callbackUrl: 'https://api.example/api/v1/twitch/eventsub' } };
const authority = new TwitchNativeAuthority(db, config), players = new PrismaTwitchPlayerStore(db, authority);
const subscriptions = { activationAvailable: true, inspectPilotChatTransport: vi.fn(async () => ({ subscriptionId: 'native-private', broadcasterId: '80001',
  receiverId: '80002', callback: config.twitchEventSub.callbackUrl })) };
const parser = vi.fn(findChatCommand), outbound = { send: vi.fn(async () => randomUUID()) };
const executor = { execute: vi.fn(async () => ['Private response']) };
let operatorId: string;
const at = new Date('2026-10-06T09:00:00Z');
const activity = new TwitchMessageActivity(db, { now: () => at }, { nextInt: () => 0 });
const newPilot = () => new TwitchCommandPilot(db, config, executor, outbound, parser, subscriptions, activity);
const provision = (id: string) => players.resolve({ twitchUserId: id, login: 'same_name', displayName: 'Same name', observedAt: at });
async function delivery(pilot: TwitchCommandPilot, twitchUserId: string, text = 'bonjour', messageId = randomUUID()) {
  const receipt = await db.twitchEventReceipt.create({ data: { externalEventId: randomUUID(), eventType: 'channel.chat.message', twitchUserId, payloadMinimal: {} } });
  await pilot.consumeAuthenticated({ subscription: { id: 'native-private', type: 'channel.chat.message', version: '1', status: 'enabled',
    condition: { broadcaster_user_id: '80001', user_id: '80002' }, transport: { method: 'webhook', callback: config.twitchEventSub.callbackUrl } },
    event: { broadcaster_user_id: '80001', chatter_user_id: twitchUserId, chatter_user_login: 'same_name', chatter_user_name: 'Same name', message_id: messageId, message: { text } } }, receipt.id);
  return receipt.id;
}
beforeAll(async () => {
  await fixture.setup({ seedPublicCatalog: true });
  const operator = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Private operator',
    twitchIdentity: { twitchUserId: '80001', login: 'kichnifou', displayName: 'Private operator', firstSeenAt: at } }));
  operatorId = operator.id; config.twitch.pilotPlayerIds.push(operatorId);
  await db.playerRoleAssignment.create({ data: { playerId: operatorId, role: 'ADMIN', source: 'private-fixture' } });
}, 60_000);
afterAll(async () => fixture.cleanup(), 60_000);

describe('PostgreSQL Native authority and Twitch-only bootstrap', () => {
  it('requires explicit operator acknowledgement, ADMIN and the separate GLOBAL capability', async () => {
    await expect(authority.configure(operatorId, 'CANARY', ['81001'])).rejects.toMatchObject({ code: 'TWITCH_NATIVE_ACK_REQUIRED' });
    await expect(authority.configure(operatorId, 'GLOBAL', [], STREAMERBOT_PATH_DISABLED)).rejects.toMatchObject({ code: 'TWITCH_NATIVE_GLOBAL_UNAVAILABLE' });
    const other = await db.player.create({ data: { displayName: 'No permission' } });
    await expect(authority.configure(other.id, 'OFF', [])).rejects.toMatchObject({ statusCode: 403 });
    await db.playerRoleAssignment.updateMany({ where: { playerId: operatorId }, data: { revokedAt: new Date() } });
    await expect(authority.configure(operatorId, 'OFF', [])).rejects.toMatchObject({ statusCode: 403 });
    await db.playerRoleAssignment.updateMany({ where: { playerId: operatorId }, data: { revokedAt: null } });
  });
  it('assigns an immutable ID before Player existence, rejects OFF/uncovered IDs and deployment hard-off', async () => {
    await authority.configure(operatorId, 'OFF', []);
    expect(await provision('81001')).toBeNull();
    await authority.configure(operatorId, 'CANARY', ['81001'], STREAMERBOT_PATH_DISABLED);
    expect((await db.twitchNativeTarget.findUniqueOrThrow({ where: { twitchUserId: '81001' } })).playerId).toBeNull();
    expect(await provision('81002')).toBeNull();
    expect(await new TwitchNativeAuthority(db, { ...config, twitchCommandPilot: { enabled: false } }).covers('81001')).toBe(false);
  });
  it('processes the provisioning message and redelivery once, with the full shared defaults and no web identity', async () => {
    const pilot = newPilot(), messageId = randomUUID();
    await delivery(pilot, '81001', 'premier message', messageId);
    const linked = await db.twitchIdentity.findUniqueOrThrow({ where: { twitchUserId: '81001' } });
    expect(await db.webIdentity.count({ where: { playerId: linked.playerId } })).toBe(0);
    expect(await db.playerResourceBalance.count({ where: { playerId: linked.playerId, amount: 0n } })).toBe(9);
    expect(await db.playerEconomyStats.findUnique({ where: { playerId: linked.playerId } })).toBeTruthy();
    expect(await db.playerWheelStats.findUnique({ where: { playerId: linked.playerId } })).toBeTruthy();
    expect(await db.playerDailyRewardState.findUnique({ where: { playerId: linked.playerId } })).toBeTruthy();
    expect(await db.playerGachaState.findUnique({ where: { playerId: linked.playerId } })).toBeTruthy();
    expect(await db.playerPermanentMissionProgress.count({ where: { playerId: linked.playerId } })).toBe(await db.permanentMissionDefinition.count({ where: { isActive: true } }));
    expect(await db.playerProgression.findUniqueOrThrow({ where: { playerId: linked.playerId } })).toMatchObject({ xp: 1n, totalMessages: 1n, countedMessages: 1n });
    await delivery(pilot, '81001', 'premier message', messageId);
    expect(await db.playerProgression.findUniqueOrThrow({ where: { playerId: linked.playerId } })).toMatchObject({ xp: 1n, totalMessages: 1n });
  });
  it('serializes two provisions and two messages for the same ID without duplicate initialization', async () => {
    await authority.configure(operatorId, 'CANARY', ['81003'], STREAMERBOT_PATH_DISABLED);
    const [a, b] = await Promise.all([provision('81003'), provision('81003')]);
    expect(a!.playerId).toBe(b!.playerId);
    await Promise.all([delivery(newPilot(), '81003'), delivery(newPilot(), '81003')]);
    expect(await db.twitchIdentity.count({ where: { twitchUserId: '81003' } })).toBe(1);
    expect(await db.playerProgression.findUniqueOrThrow({ where: { playerId: a!.playerId } })).toMatchObject({ totalMessages: 2n, countedMessages: 1n, xp: 1n });
  }, 60_000);
  it('persists desired authority across reconstruction and fails closed until transport is ACTIVE', async () => {
    const restarted = newPilot();
    subscriptions.inspectPilotChatTransport.mockResolvedValueOnce(null as never);
    expect(await restarted.status()).toMatchObject({ desiredAuthority: 'CANARY', effectiveAuthority: 'OFF', transportValid: false });
    expect(await restarted.status()).toMatchObject({ desiredAuthority: 'CANARY', effectiveAuthority: 'CANARY', transportValid: true });
    const instanceB = newPilot(); await instanceB.status();
    await newPilot().disarm(operatorId);
    parser.mockClear(); outbound.send.mockClear(); executor.execute.mockClear();
    const before = await db.player.count();
    await delivery(instanceB, '81099', '!pull');
    expect(parser).not.toHaveBeenCalled(); expect(executor.execute).not.toHaveBeenCalled(); expect(outbound.send).not.toHaveBeenCalled();
    expect(await db.player.count()).toBe(before);
    expect(await instanceB.status()).toMatchObject({ desiredAuthority: 'OFF', effectiveAuthority: 'OFF' });
    expect(await db.twitchNativeAudit.count({ where: { action: 'KILL_SWITCH' } })).toBeGreaterThan(0);
  });
  it('removes canary assignment while retaining Native data ownership', async () => {
    await authority.configure(operatorId, 'CANARY', ['81003'], STREAMERBOT_PATH_DISABLED);
    await authority.configure(operatorId, 'CANARY', ['81004'], STREAMERBOT_PATH_DISABLED);
    expect(await authority.covers('81003')).toBe(false);
    expect(await db.twitchNativeTarget.findUniqueOrThrow({ where: { twitchUserId: '81003' } })).toMatchObject({ canary: false, dataAuthority: 'NATIVE' });
    const different = await provision('81004');
    expect(different!.playerId).not.toBe((await db.twitchIdentity.findUniqueOrThrow({ where: { twitchUserId: '81003' } })).playerId);
  });
  it('simulates gated GLOBAL without silently taking over an existing untransferred identity', async () => {
    const globalConfig = { ...config, twitchCommandPilot: { enabled: true, globalEnabled: true } };
    const globalAuthority = new TwitchNativeAuthority(db, globalConfig);
    await globalAuthority.configure(operatorId, 'GLOBAL', [], STREAMERBOT_PATH_DISABLED);
    const globalPlayers = new PrismaTwitchPlayerStore(db, globalAuthority);
    expect(await globalPlayers.resolve({ twitchUserId: '81005', login: 'same_name', displayName: 'Same name', observedAt: at })).toBeTruthy();
    expect(await globalAuthority.covers('80001')).toBe(false);
    await globalAuthority.configure(operatorId, 'OFF', []);
  });
  it('caps pre-element XP at level 2 and persists one compact element reminder on the threshold message', async () => {
    const identity = await db.twitchIdentity.findUniqueOrThrow({ where: { twitchUserId: '81004' }, include: { player: true } });
    await db.playerProgression.update({ where: { playerId: identity.playerId }, data: { xp: 59n, lastXpMessageAt: null } });
    const message = randomUUID();
    const first = await activity.consume(identity.player, message, '80001', 250, true, at);
    expect(first.filter(row => row.includes('!element'))).toHaveLength(1);
    expect(await activity.consume(identity.player, message, '80001', 250, true, at)).toEqual(first);
    expect(await activity.consume(identity.player, randomUUID(), '80001', 250, true, new Date(at.getTime() + 3000))).toEqual([]);
    expect(await db.playerProgression.findUniqueOrThrow({ where: { playerId: identity.playerId } })).toMatchObject({ xp: 60n });
  });
  it('routes a first !element through the shared owner after creating the Twitch-only Player', async () => {
    await authority.configure(operatorId, 'CANARY', ['81006'], STREAMERBOT_PATH_DISABLED);
    const getPlayer = new GetCurrentPlayer(new PrismaCurrentPlayerStore(db));
    const core = twitchPlayerCommandExecutor(db, { ...harness().services,
      choosePlayerElement: new ChoosePlayerElement(getPlayer, new PrismaPlayerElementStore(db)) } as unknown as ChatCommandServices, { now: () => at });
    const pilot = new TwitchCommandPilot(db, config, core, outbound, parser, subscriptions, activity);
    await delivery(pilot, '81006', '!element pyro');
    expect((await db.twitchIdentity.findUniqueOrThrow({ where: { twitchUserId: '81006' }, include: { player: true } })).player.elementKey).toBe('pyro');
  });
  it('rejects an element-required command through its real shared owner without a Wheel mutation', async () => {
    await authority.configure(operatorId, 'CANARY', ['81007'], STREAMERBOT_PATH_DISABLED);
    const getPlayer = new GetCurrentPlayer(new PrismaCurrentPlayerStore(db));
    const wheel = new SpinDailyWheel(getPlayer, new PrismaWheelStore(db), { now: () => at }, { nextInt: () => 99 }, 'TWITCH');
    const execute = vi.spyOn(wheel, 'execute');
    const core = twitchPlayerCommandExecutor(db, { ...harness().services, spinDailyWheelChat: wheel } as unknown as ChatCommandServices, { now: () => at });
    outbound.send.mockClear();
    await delivery(new TwitchCommandPilot(db, config, core, outbound, parser, subscriptions, activity), '81007', '!roue');
    const identity = await db.twitchIdentity.findUniqueOrThrow({ where: { twitchUserId: '81007' } });
    expect(await db.playerWheelDailyState.count({ where: { playerId: identity.playerId } })).toBe(0);
    expect(execute).toHaveBeenCalledOnce();
    await expect(execute.mock.results[0]!.value).rejects.toMatchObject({ code: 'PLAYER_ELEMENT_REQUIRED' });
    expect(outbound.send.mock.calls.map(call => JSON.stringify(call))).toEqual(expect.arrayContaining([expect.stringContaining('Action impossible')]));
  });
});

describe('R1046 conservative claim in private PostgreSQL', () => {
  const claim = new TwitchProfileClaim(db);
  async function web() {
    const subject = randomUUID();
    const player = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Same name', webIdentity: { provider: 'supabase', providerSubject: subject } }));
    const identity = await db.webIdentity.findUniqueOrThrow({ where: { playerId: player.id } });
    return { player, identity, subject };
  }
  it('moves the same Supabase identity, preserves all target gameplay and ID, deletes only the temporary Player, and is idempotent', async () => {
    const temp = await web(), target = await db.twitchIdentity.findUniqueOrThrow({ where: { twitchUserId: '81003' } });
    const before = await db.playerProgression.findUniqueOrThrow({ where: { playerId: target.playerId } });
    const preimage = await captureTargetedPlayerRows(db, [target.playerId]);
    expect(await db.$transaction(tx => isDisposableWebPlayer(tx, temp.player.id), { timeout: 30_000 })).toBe(true);
    expect(await claim.execute(temp.identity.id, temp.player.id, target.twitchUserId)).toEqual({ claimed: true, playerId: target.playerId });
    expect(await db.player.findUnique({ where: { id: temp.player.id } })).toBeNull();
    expect(await db.webIdentity.findUniqueOrThrow({ where: { id: temp.identity.id } })).toMatchObject({ playerId: target.playerId, providerSubject: temp.subject });
    expect(await db.playerProgression.findUniqueOrThrow({ where: { playerId: target.playerId } })).toEqual(before);
    expect(await db.twitchIdentity.findUniqueOrThrow({ where: { twitchUserId: target.twitchUserId } })).toEqual(target);
    const restored = await captureTargetedPlayerRows(db, [target.playerId]);
    for (const [table, rows] of Object.entries(preimage.tables)) if (table !== 'web_identities') expect(restored.tables[table], table).toEqual(rows);
    expect(await claim.execute(temp.identity.id, temp.player.id, target.twitchUserId)).toEqual({ claimed: true, playerId: target.playerId });
    expect((await new PrismaCurrentPlayerStore(db).findByIdentity('supabase', temp.subject))!.id).toBe(target.playerId);
  }, 60_000);
  it.each(['balance', 'xp', 'element', 'role', 'identity', 'unknown preference', 'bank', 'cosmetic', 'mission', 'operation'])('blocks significant or ambiguous %s without merging', async kind => {
    const temp = await web(), playerId = temp.player.id;
    if (kind === 'balance') await db.playerResourceBalance.update({ where: { playerId_resourceKey: { playerId, resourceKey: 'moras' } }, data: { amount: 1n } });
    if (kind === 'xp') await db.playerProgression.update({ where: { playerId }, data: { xp: 1n } });
    if (kind === 'element') await db.player.update({ where: { id: playerId }, data: { elementKey: 'pyro' } });
    if (kind === 'role') await db.playerRoleAssignment.create({ data: { playerId, role: 'TESTER', source: 'private-significant' } });
    if (kind === 'identity') await db.twitchIdentity.create({ data: { playerId, twitchUserId: String(82000 + await db.twitchIdentity.count()), login: 'same_name' } });
    if (kind === 'unknown preference') await db.playerPreference.create({ data: { playerId, preferenceKey: 'unknown', value: {} } });
    if (kind === 'bank') await db.playerBankAccount.create({ data: { playerId, balance: 1n, lastInterestDate: at } });
    if (kind === 'cosmetic') {
      const cosmetic = await db.cosmeticDefinition.create({ data: { externalKey: randomUUID(), displayName: 'Private cosmetic', type: 'TITLE' } });
      await db.playerCosmetic.create({ data: { playerId, cosmeticId: cosmetic.id, unlockSource: 'private-significant' } });
    }
    if (kind === 'mission') await db.playerPermanentMissionProgress.updateMany({ where: { playerId, status: 'ACTIVE' }, data: { progress: 1n } });
    if (kind === 'operation') await db.businessOperation.create({ data: { playerId, sourceChannel: 'UI', operationType: 'private-significant', status: 'COMPLETED' } });
    await expect(claim.execute(temp.identity.id, playerId, '81004')).rejects.toMatchObject({ code: 'TWITCH_PROFILE_NOT_DISPOSABLE' });
    expect((await db.webIdentity.findUniqueOrThrow({ where: { id: temp.identity.id } })).playerId).toBe(playerId);
    expect(await db.player.findUnique({ where: { id: playerId } })).toBeTruthy();
  });
  it('blocks an already claimed target and never resolves by equal display names', async () => {
    const temp = await web();
    await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Same name',
      webIdentity: { provider: 'supabase', providerSubject: randomUUID() },
      twitchIdentity: { twitchUserId: '81999', login: 'claimed_fixture', displayName: 'Same name', firstSeenAt: new Date() } }));
    await expect(claim.execute(temp.identity.id, temp.player.id, '81999')).rejects.toMatchObject({ code: 'TWITCH_PROFILE_WEB_CONFLICT' });
    await expect(claim.execute(temp.identity.id, temp.player.id, '999999999')).rejects.toMatchObject({ code: 'TWITCH_PROFILE_NOT_FOUND' });
  });
  it('inspects new physical FK domains instead of assuming an incomplete model list is safe', async () => {
    const temp = await web();
    await fixture.admin.query(`CREATE TABLE "${fixture.schema}".unknown_claim_domain (player_id uuid REFERENCES "${fixture.schema}".players(id))`);
    try {
      await fixture.admin.query(`INSERT INTO "${fixture.schema}".unknown_claim_domain VALUES ($1)`, [temp.player.id]);
      expect(await db.$transaction(tx => isDisposableWebPlayer(tx, temp.player.id), { timeout: 30_000 })).toBe(false);
    } finally { await fixture.admin.query(`DROP TABLE "${fixture.schema}".unknown_claim_domain`); }
  });
});
