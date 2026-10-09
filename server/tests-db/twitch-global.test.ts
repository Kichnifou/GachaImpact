import { createHash, createHmac, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { bootstrapPlayer } from '../src/infrastructure/database/player-bootstrap.js';
import { PrismaTwitchPlayerStore } from '../src/infrastructure/database/prisma-twitch-player-store.js';
import { TwitchNativeAuthority, STREAMERBOT_PATH_DISABLED as ACK } from '../src/application/twitch/twitch-native-authority.js';
import { TwitchAccountLink } from '../src/application/twitch/twitch-account-link.js';
import { TwitchCommandPilot } from '../src/application/twitch/twitch-command-pilot.js';
import { TwitchMessageActivity } from '../src/application/twitch/twitch-message-activity.js';
import { TwitchEventObserver } from '../src/application/twitch/twitch-event-observer.js';
import { TwitchReceiptRetention } from '../src/application/twitch/twitch-receipt-retention.js';
import { twitchPlayerCommandExecutor } from '../src/application/twitch/twitch-player-command-executor.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { GetCurrentGacha, PerformGachaPull, SetGachaTarget } from '../src/application/gacha/gacha-services.js';
import { SourceChannel } from '../generated/prisma/client.js';
import { PULL_COST } from '../src/domain/gacha/pull.js';
import { GetCurrentPlayerBox } from '../src/application/box/box-services.js';
import { PrismaBoxStore } from '../src/infrastructure/database/prisma-box-store.js';
import { PrismaGachaStore } from '../src/infrastructure/database/prisma-gacha-store.js';
import { GetCurrentPlayerInventory } from '../src/application/inventory/inventory-services.js';
import { PrismaInventoryStore } from '../src/infrastructure/database/prisma-inventory-store.js';
import { ChoosePlayerElement } from '../src/application/player/choose-player-element.js';
import { PrismaPlayerElementStore } from '../src/infrastructure/database/prisma-player-element-store.js';
import { ClaimDailyReward } from '../src/application/daily-reward/claim-daily-reward.js';
import { PrismaDailyRewardStore } from '../src/infrastructure/database/prisma-daily-reward-store.js';
import { EventService } from '../src/application/event/event-service.js';
import { MonthlyBossService } from '../src/application/combat/monthly-boss-service.js';
import { SocialService } from '../src/application/social/social-service.js';
import { verifiedPlayerActor } from '../src/application/player/player-execution-actor.js';
import { buildApp } from '../src/app.js';
import { TwitchCommandSendError } from '../src/infrastructure/twitch/twitch-command-chat-client.js';
import { harness } from '../tests/helpers/chat-command-harness.js';
import type { ChatCommandServices } from '../src/application/chat/player-command-resolver.js';

const fixture = isolatedBatchDatabase(), db = fixture.database;
const secret = 'r1064-private-eventsub-secret';
const config = { host: 'localhost', port: 3001, supabase: {}, twitch: { pilotPlayerIds: [] as string[], pilotLogin: 'kichnifou' },
  twitchCommandPilot: { enabled: true, globalEnabled: true }, twitchEventSub: { enabled: true, secret, callbackUrl: 'https://private.example/api/v1/twitch/eventsub' } };
const authority = new TwitchNativeAuthority(db, config), players = new PrismaTwitchPlayerStore(db, authority), link = new TwitchAccountLink(db, config);
const subscriptions = { activationAvailable: true, inspectPilotChatTransport: vi.fn(async () => ({ subscriptionId: 'global-private', broadcasterId: '810000', receiverId: '810001', callback: config.twitchEventSub.callbackUrl })) };
const outbound = { send: vi.fn(async () => randomUUID()) };
const canaries = Array.from({ length: 44 }, (_, i) => String(810000 + i * 10));
let operatorId: string, app: FastifyInstance, pilot: TwitchCommandPilot, core: ReturnType<typeof twitchPlayerCommandExecutor>;
let at = new Date('2026-10-05T12:00:00Z');
const clock = { now: () => new Date(at) }, random = { nextInt: (upper: number) => upper - 1 };
const current = new GetCurrentPlayer({ findByIdentity: async () => { throw Error('No unverified web identity'); }, provision: async () => { throw Error('No web bootstrap from chat'); } });
const daily = new ClaimDailyReward(current, new PrismaDailyRewardStore(db), clock), events = new EventService(current, db, clock, random);
const activity = new TwitchMessageActivity(db, clock, random, daily, events);
const specialized = { consume: vi.fn(async () => undefined) }, presence = { consume: vi.fn(async () => undefined) }, giveaway = { consume: vi.fn(async () => false) };
const provision = (id: string, login = 'excluded_old_name') => players.resolve({ twitchUserId: id, login, displayName: login, observedAt: at });
const httpMetrics: { ms: number; status: number }[] = [], provisionMetrics: { id: string; ms: number }[] = [];
const global = async () => authority.configure(operatorId, 'GLOBAL', [], ACK, (await authority.read()).revision);
const webPlayer = async (significant = false) => {
  const player = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Private Web', webIdentity: { provider: 'supabase', providerSubject: randomUUID() } }));
  if (significant) await db.playerResourceBalance.update({ where: { playerId_resourceKey: { playerId: player.id, resourceKey: 'primogems' } }, data: { amount: 991n } });
  return { player, web: await db.webIdentity.findUniqueOrThrow({ where: { playerId: player.id } }) };
};
const immutable44 = async () => ({
  players: await db.player.findMany({ where: { twitchIdentity: { twitchUserId: { in: canaries } } }, orderBy: { id: 'asc' } }),
  identities: await db.twitchIdentity.findMany({ where: { twitchUserId: { in: canaries } }, orderBy: { twitchUserId: 'asc' } }),
  targets: await db.twitchNativeTarget.findMany({ where: { twitchUserId: { in: canaries } }, orderBy: { twitchUserId: 'asc' } }),
  balances: await db.playerResourceBalance.findMany({ where: { player: { twitchIdentity: { twitchUserId: { in: canaries } } } }, orderBy: [{ playerId: 'asc' }, { resourceKey: 'asc' }] }),
  progression: await db.playerProgression.findMany({ where: { player: { twitchIdentity: { twitchUserId: { in: canaries } } } }, orderBy: { playerId: 'asc' } }),
});
function message(id: string, text: string) { return { subscription: { id: 'global-private', type: 'channel.chat.message', version: '1', status: 'enabled', condition: { broadcaster_user_id: '810000', user_id: '810001' }, transport: { method: 'webhook', callback: config.twitchEventSub.callbackUrl } },
  event: { broadcaster_user_id: '810000', chatter_user_id: id, chatter_user_login: 'fresh_viewer', chatter_user_name: 'FreshViewer', message_id: randomUUID(), message_type: 'text', message: { text } } }; }
async function post(body: ReturnType<typeof message>, externalId = randomUUID()) {
  const start = performance.now();
  const payload = JSON.stringify(body), timestamp = new Date().toISOString();
  const response = await app.inject({ method: 'POST', url: '/api/v1/twitch/eventsub', payload, headers: { 'content-type': 'application/json', 'twitch-eventsub-message-id': externalId, 'twitch-eventsub-message-timestamp': timestamp, 'twitch-eventsub-message-type': 'notification',
    'twitch-eventsub-message-signature': 'sha256=' + createHmac('sha256', secret).update(externalId).update(timestamp).update(payload).digest('hex') } });
  httpMetrics.push({ ms: performance.now() - start, status: response.statusCode }); return response;
}
beforeAll(async () => {
  await fixture.setup({ prismaMigrations: true, seedPublicCatalog: true });
  for (const [index, twitchUserId] of canaries.entries()) {
    const player = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: `Acquired ${index}`, twitchIdentity: { twitchUserId, login: index ? `old_${index}` : 'kichnifou', displayName: `Acquired ${index}`, firstSeenAt: at } }));
    if (!index) { operatorId = player.id; config.twitch.pilotPlayerIds.push(player.id); await db.playerRoleAssignment.create({ data: { playerId: player.id, role: 'ADMIN', source: 'private' } }); }
    await db.playerProgression.update({ where: { playerId: player.id }, data: { xp: BigInt(1000 + index), totalMessages: BigInt(200 + index) } });
    await db.playerResourceBalance.update({ where: { playerId_resourceKey: { playerId: player.id, resourceKey: 'primogems' } }, data: { amount: BigInt(10000 + index) } });
  }
  await authority.configure(operatorId, 'CANARY', canaries, ACK);
  if (!await db.bannerRotation.findFirst({ where: { status: 'ACTIVE' } })) {
    const five = await db.character.findMany({ where: { isActive: true, rarity: 5 }, orderBy: { externalKey: 'asc' }, take: 4 });
    const four = await db.character.findMany({ where: { isActive: true, rarity: 4 }, orderBy: { externalKey: 'asc' }, take: 6 });
    await db.bannerRotation.create({ data: { startsAt: new Date('2026-10-04T22:00:00Z'), endsAt: new Date('2026-10-11T22:00:00Z'), status: 'ACTIVE', generationVoteSnapshot: { privateFixture: true },
      featuredCharacters: { create: [...five.map((character, index) => ({ characterId: character.id, rarity: 5, slot: index + 1, selectionSource: 'RANDOM' as const })),
        ...four.map((character, index) => ({ characterId: character.id, rarity: 4, slot: index + 1, selectionSource: 'RANDOM' as const }))] } } });
  }
  const gacha = new PrismaGachaStore(db), banner = await gacha.getCurrent(operatorId);
  if (!banner) throw Error('Private catalog banner required');
  at = new Date((banner.banner.startsAt.getTime() + banner.banner.endsAt.getTime()) / 2);
  core = twitchPlayerCommandExecutor(db, { ...harness().services, getCurrentGacha: new GetCurrentGacha(current, gacha),
    setGachaTarget: new SetGachaTarget(current, gacha), performGachaPullChat: new PerformGachaPull(current, gacha, clock, random, SourceChannel.TWITCH),
    getCurrentPlayerBox: new GetCurrentPlayerBox(current, new PrismaBoxStore(db)), getCurrentPlayerInventory: new GetCurrentPlayerInventory(current, new PrismaInventoryStore(db)),
    choosePlayerElement: new ChoosePlayerElement(current, new PrismaPlayerElementStore(db)), socialService: new SocialService(current, db, clock), eventService: events,
    monthlyBossService: new MonthlyBossService(current, db, clock, random),
  } as unknown as ChatCommandServices, clock);
  const resolve = players.resolve.bind(players);
  vi.spyOn(players, 'resolve').mockImplementation(async input => { const start = performance.now(); const result = await resolve(input); provisionMetrics.push({ id: input.twitchUserId, ms: performance.now() - start }); return result; });
  pilot = new TwitchCommandPilot(db, config, core, outbound, undefined, subscriptions, activity, authority, players);
  app = await buildApp(config, { getOrProvisionCurrentPlayer: {} as never, authIdentityVerifier: { verify: async () => ({ subject: 'private-http' }) }, twitchEventObserver: new TwitchEventObserver(db, new TwitchReceiptRetention(db, () => 0)),
    twitchCommandPilot: pilot, twitchFavorChatPresence: presence as never, twitchFavorSubscriptions: specialized as never, twitchFavorGifts: specialized as never, twitchFavorResubs: specialized as never, twitchGiveawayConsumer: giveaway as never });
  app.addHook('onError', async (_request, _reply, error) => { console.error('R1064_PRIVATE_HTTP_ERROR', error); });
}, 180_000);
afterAll(async () => { await app?.close(); await fixture.cleanup(); expect(fixture.poolSnapshot()).toMatchObject({ total: 0, idle: 0, waiting: 0 }); }, 60_000);

it('opens GLOBAL at an explicit revision, preserves 44 acquired Players, and admits a zero normal null-element profile', async () => {
  expect(fixture.migrationStatus).toContain('67 migrations');
  const before = await immutable44();
  expect(await provision('920001')).toBeNull();
  await expect(authority.configure(operatorId, 'GLOBAL', [], ACK)).rejects.toMatchObject({ code: 'TWITCH_NATIVE_REVISION_REQUIRED' });
  await expect(authority.configure(operatorId, 'GLOBAL', [], ACK, 999)).rejects.toMatchObject({ code: 'TWITCH_NATIVE_AUTHORITY_CHANGED' });
  await global(); const fresh = (await provision('920001'))!;
  expect(fresh.player).toMatchObject({ status: 'ACTIVE', elementKey: null, legacyUsername: null, legacyRecovery: null });
  expect(await db.playerResourceBalance.count({ where: { playerId: fresh.playerId, amount: 0n } })).toBe(9);
  expect(await db.playerCharacter.count({ where: { playerId: fresh.playerId } })).toBe(0);
  expect(await db.playerProgression.findUniqueOrThrow({ where: { playerId: fresh.playerId } })).toMatchObject({ xp: 0n, totalMessages: 0n });
  expect(await db.twitchNativeTarget.findUniqueOrThrow({ where: { twitchUserId: '920001' } })).toMatchObject({ playerId: fresh.playerId, canary: false, dataAuthority: 'NATIVE' });
  expect(await immutable44()).toEqual(before);
});
it('executes and persists a fresh Player first real invocation once through a signed redelivery', async () => {
  await global();
  const id = '920004'; expect((await post(message(id, '!pity'))).statusCode).toBe(204);
  const identity = await db.twitchIdentity.findUniqueOrThrow({ where: { twitchUserId: id } });
  expect((await post(message(id, '!element pyro'))).statusCode).toBe(204);
  const banner = await new PrismaGachaStore(db).getCurrent(identity.playerId);
  expect((await post(message(id, '!select ' + banner!.banner.featuredFiveStars[0]!.name))).statusCode).toBe(204);
  // Private funding only: this is neither a welcome grant nor a public code.
  await db.playerResourceBalance.update({ where: { playerId_resourceKey: { playerId: identity.playerId, resourceKey: 'primogems' } }, data: { amount: PULL_COST[1] } });
  const request = message(id, '!pull'); expect((await post(request)).statusCode).toBe(204);
  const operations = await db.pullOperation.findMany({ where: { playerId: identity.playerId } }); expect(operations).toHaveLength(1);
  const results = await db.pullResult.findMany({ where: { pullOperationId: operations[0]!.id } }); expect(results).toHaveLength(1);
  expect(await db.playerCharacter.count({ where: { playerId: identity.playerId } })).toBe(results[0]!.characterId ? 1 : 0);
  const snapshot = { balances: await db.playerResourceBalance.findMany({ where: { playerId: identity.playerId }, orderBy: { resourceKey: 'asc' } }),
    gacha: await db.playerGachaState.findUniqueOrThrow({ where: { playerId: identity.playerId } }),
    movements: await db.resourceMovement.count({ where: { playerId: identity.playerId } }), sends: outbound.send.mock.calls.length };
  expect((await post(request)).statusCode).toBe(204);
  expect(await db.pullOperation.findMany({ where: { playerId: identity.playerId } })).toEqual(operations);
  expect(await db.pullResult.findMany({ where: { pullOperationId: operations[0]!.id } })).toEqual(results);
  expect(await db.playerResourceBalance.findMany({ where: { playerId: identity.playerId }, orderBy: { resourceKey: 'asc' } })).toEqual(snapshot.balances);
  expect(await db.playerGachaState.findUniqueOrThrow({ where: { playerId: identity.playerId } })).toEqual(snapshot.gacha);
  expect(await db.resourceMovement.count({ where: { playerId: identity.playerId } })).toBe(snapshot.movements); expect(outbound.send).toHaveBeenCalledTimes(snapshot.sends);
});
it('makes a verified Web-first link immediately covered, idempotent and economically identical', async () => {
  await global();
  const { player, web } = await webPlayer(true), before = await db.playerResourceBalance.findMany({ where: { playerId: player.id }, orderBy: { resourceKey: 'asc' } });
  const count = await db.player.count();
  await link.verified(web.id, player.id, '920002', 'renamed', 'Renamed');
  expect(await authority.covers('920002')).toBe(true);
  expect((await provision('920002'))?.playerId).toBe(player.id);
  await link.verified(web.id, player.id, '920002', 'again', 'Again');
  expect(await db.player.count()).toBe(count);
  expect(await db.playerResourceBalance.findMany({ where: { playerId: player.id }, orderBy: { resourceKey: 'asc' } })).toEqual(before);
  expect(await db.twitchNativeAudit.count({ where: { twitchUserId: '920002', action: 'VERIFIED_NATIVE_ADMISSION' } })).toBe(1);
});
it('joins a disposable Web account to the same Twitch progression without copy or second reward', async () => {
  const twitch = (await provision('920003'))!, { player, web } = await webPlayer();
  await db.playerProgression.update({ where: { playerId: twitch.playerId }, data: { xp: 59n, totalMessages: 10n } });
  const before = await db.playerResourceBalance.findMany({ where: { playerId: twitch.playerId }, orderBy: { resourceKey: 'asc' } });
  expect(await link.verified(web.id, player.id, '920003', 'new_name', 'New Name')).toMatchObject({ playerId: twitch.playerId, linked: true });
  expect(await db.webIdentity.findUniqueOrThrow({ where: { id: web.id } })).toMatchObject({ playerId: twitch.playerId });
  expect(await db.player.findUnique({ where: { id: player.id } })).toBeNull();
  expect((await provision('920003'))?.playerId).toBe(twitch.playerId);
  expect(await db.playerResourceBalance.findMany({ where: { playerId: twitch.playerId }, orderBy: { resourceKey: 'asc' } })).toEqual(before);
  expect(await db.playerProgression.findUniqueOrThrow({ where: { playerId: twitch.playerId } })).toMatchObject({ xp: 59n, totalMessages: 10n });
});
it.each(['LEGACY', 'MIGRATION_PENDING'] as const)('never promotes a %s reservation by chat or OAuth', async dataAuthority => {
  const id = dataAuthority === 'LEGACY' ? '920010' : '920011', { player, web } = await webPlayer();
  await db.twitchNativeTarget.create({ data: { twitchUserId: id, dataAuthority } });
  expect(await provision(id)).toBeNull();
  await expect(link.verified(web.id, player.id, id, 'same_pseudo', 'Same pseudo')).rejects.toMatchObject({ code: 'TWITCH_PROFILE_WEB_CONFLICT' });
  expect(await db.twitchIdentity.findUnique({ where: { twitchUserId: id } })).toBeNull();
  expect(await db.twitchNativeTarget.findUniqueOrThrow({ where: { twitchUserId: id } })).toMatchObject({ dataAuthority, playerId: null });
});
it.each(['ARCHIVED', 'SUSPENDED'] as const)('refuses %s without mutation or alternate Player', async status => {
  const id = status === 'ARCHIVED' ? '920012' : '920013', target = (await provision(id))!;
  await db.player.update({ where: { id: target.playerId }, data: { status } });
  expect(await authority.covers(id)).toBe(false); expect(await provision(id)).toBeNull();
  expect(await db.twitchIdentity.count({ where: { twitchUserId: id } })).toBe(1);
});
it('keeps human R1055 choice and the active-NATIVE operator guard, then retargets after OFF without merging', async () => {
  const twitch = (await provision('920020'))!, { player, web } = await webPlayer(true);
  await db.playerResourceBalance.update({ where: { playerId_resourceKey: { playerId: twitch.playerId, resourceKey: 'primogems' } }, data: { amount: 777n } });
  const before = await db.playerResourceBalance.findMany({ where: { playerId: { in: [player.id, twitch.playerId] } }, orderBy: [{ playerId: 'asc' }, { resourceKey: 'asc' }] });
  expect(await link.verified(web.id, player.id, '920020', 'both', 'Both')).toMatchObject({ resolutionRequired: true, linked: false });
  expect(await authority.covers('920020')).toBe(false);
  let pending = (await link.pending(web.id))!;
  expect(pending.safety.WEB.status).toBe('OPERATOR_REQUIRED');
  await expect(link.resolve(web.id, pending.id, 'WEB', pending.revision)).rejects.toMatchObject({ code: 'TWITCH_PROGRESSION_NATIVE_AUTHORITY_REQUIRES_OPERATOR' });
  await pilot.disarm(operatorId); pending = (await link.pending(web.id))!;
  expect(await link.resolve(web.id, pending.id, 'WEB', pending.revision)).toMatchObject({ playerId: player.id, linked: true });
  expect(await link.resolve(web.id, pending.id, 'WEB', pending.revision)).toMatchObject({ playerId: player.id });
  expect(await db.player.findUniqueOrThrow({ where: { id: twitch.playerId } })).toMatchObject({ status: 'ARCHIVED' });
  expect(await db.playerResourceBalance.findMany({ where: { playerId: { in: [player.id, twitch.playerId] } }, orderBy: [{ playerId: 'asc' }, { resourceKey: 'asc' }] })).toEqual(before);
  await global(); expect(await authority.covers('920020')).toBe(true);
});
it('resumes GLOBAL explicitly after OFF/restart, fails closed without capability, and can return to persisted CANARY', async () => {
  const before = await immutable44(); await pilot.disarm(operatorId);
  expect(await pilot.status()).toMatchObject({ desiredAuthority: 'OFF', resumeAuthority: 'GLOBAL' });
  await expect(pilot.arm(operatorId, ACK)).rejects.toMatchObject({ code: 'TWITCH_NATIVE_RESUME_MODE_REQUIRED' });
  const limited = new TwitchCommandPilot(db, { ...config, twitchCommandPilot: { enabled: true, globalEnabled: false } }, core, outbound, undefined, subscriptions, activity);
  await expect(limited.arm(operatorId, ACK, undefined, 'GLOBAL')).rejects.toMatchObject({ code: 'TWITCH_NATIVE_GLOBAL_UNAVAILABLE' });
  const restarted = new TwitchCommandPilot(db, config, core, outbound, undefined, subscriptions, activity);
  expect(await restarted.arm(operatorId, ACK, undefined, 'GLOBAL')).toMatchObject({ desiredAuthority: 'GLOBAL', effectiveAuthority: 'GLOBAL' });
  subscriptions.activationAvailable = false;
  expect(await restarted.status()).toMatchObject({ effectiveAuthority: 'OFF', commandPilotArmed: true });
  expect(await restarted.disarm(operatorId)).toMatchObject({ desiredAuthority: 'OFF', commandPilotArmed: false });
  subscriptions.activationAvailable = true;
  expect(await restarted.arm(operatorId, ACK, undefined, 'CANARY')).toMatchObject({ effectiveAuthority: 'CANARY' });
  expect(await authority.covers('920001')).toBe(false); expect(await immutable44()).toEqual(before);
  await global();
});
it('blocks GLOBAL atomically on pending economy or uncertain/PENDING deliveries', async () => {
  await pilot.disarm(operatorId); const revision = (await authority.read()).revision;
  for (const status of ['PENDING', 'SENDING', 'AMBIGUOUS']) {
    const receipt = await db.twitchEventReceipt.create({ data: { externalEventId: randomUUID(), eventType: 'channel.chat.message', twitchUserId: '920001', state: 'PROCESSED', payloadMinimal: { commandPilot: { stage: 'RESPONSES', responses: [{ status, text: 'frozen' }] } } } });
    await expect(global()).rejects.toMatchObject({ code: 'TWITCH_NATIVE_GLOBAL_BLOCKED' });
    expect((await authority.read()).revision).toBe(revision);
    await db.twitchEventReceipt.delete({ where: { id: receipt.id } });
  }
  for (const state of ['RESERVED', 'AMBIGUOUS']) {
    const announcement = await db.giveawayAnnouncement.create({ data: { kind: 'COMMAND', text: 'Synthetic uncertain announcement', state } });
    await expect(global()).rejects.toMatchObject({ code: 'TWITCH_NATIVE_GLOBAL_BLOCKED' });
    expect(await authority.read()).toMatchObject({ revision, desiredMode: 'OFF' });
    await db.giveawayAnnouncement.delete({ where: { id: announcement.id } });
  }
  const operation = await db.businessOperation.create({ data: { playerId: operatorId, operationType: 'private.pending', idempotencyKey: randomUUID(), sourceChannel: 'TWITCH', status: 'PENDING' } });
  await expect(global()).rejects.toMatchObject({ code: 'TWITCH_NATIVE_GLOBAL_BLOCKED' });
  await db.businessOperation.delete({ where: { id: operation.id } }); await global();
});
it('waits for a real receipt reservation and checks a fresh snapshot before accepting GLOBAL', async () => {
  await pilot.disarm(operatorId); await pilot.arm(operatorId, ACK, undefined, 'CANARY');
  const receipt = await db.twitchEventReceipt.create({ data: { externalEventId: randomUUID(), eventType: 'channel.chat.message', twitchUserId: canaries[0], state: 'RECEIVED' } });
  let entered!: () => void, release!: () => void;
  const gateEntered = new Promise<void>(resolve => { entered = resolve; }), gateRelease = new Promise<void>(resolve => { release = resolve; });
  const native = pilot as unknown as { locked<T>(id: string, action: (tx: typeof db) => Promise<T>): Promise<T> };
  const reservation = native.locked(receipt.id, async tx => {
    await tx.twitchEventReceipt.update({ where: { id: receipt.id }, data: { externalReference: 'command-pilot:private-race', payloadMinimal: { commandPilot: { stage: 'EXECUTING', responses: [] } } } });
    entered(); await gateRelease;
  });
  await gateEntered; let settled = false;
  const transition = global().finally(() => { settled = true; });
  // The separate admin connection can observe the waiter without using the
  // deliberately small Prisma pool or a timing assumption.
  await vi.waitFor(async () => {
    const locks = await fixture.admin.query("SELECT count(*)::int n FROM pg_locks WHERE NOT granted AND locktype='transactionid'");
    expect(locks.rows[0].n).toBeGreaterThan(0);
  });
  expect(settled).toBe(false); release(); await reservation;
  await expect(transition).rejects.toMatchObject({ code: 'TWITCH_NATIVE_GLOBAL_BLOCKED' });
  expect((await authority.read()).desiredMode).toBe('CANARY');
  await db.twitchEventReceipt.delete({ where: { id: receipt.id } }); await global();
});
it('serializes OAuth/first message/OFF without duplicate Players, orphan targets or pool deadlock', async () => {
  const { player, web } = await webPlayer();
  let entered!: () => void, release!: () => void;
  const gateEntered = new Promise<void>(resolve => { entered = resolve; }), gateRelease = new Promise<void>(resolve => { release = resolve; });
  const covers = authority.covers.bind(authority);
  const barrier = vi.spyOn(authority, 'covers').mockImplementationOnce(async (id, tx) => {
    const result = await covers(id, tx); entered(); await gateRelease; return result;
  });
  const first = provision('920030'); await gateEntered;
  // Provision owns authority SHARE; OFF waits for UPDATE, OAuth waits for the
  // same immutable identity. Release is independent of the saturated DB pool.
  const off = pilot.disarm(operatorId), oauth = link.verified(web.id, player.id, '920030', 'same', 'Same'); release();
  const outcomes = await Promise.allSettled([oauth, first, off]); barrier.mockRestore();
  expect(outcomes.every(row => row.status === 'fulfilled')).toBe(true);
  const identity = await db.twitchIdentity.findUniqueOrThrow({ where: { twitchUserId: '920030' } });
  expect(await db.twitchIdentity.count({ where: { twitchUserId: '920030' } })).toBe(1);
  expect(await db.twitchNativeTarget.findUniqueOrThrow({ where: { twitchUserId: '920030' } })).toMatchObject({ playerId: identity.playerId, dataAuthority: 'NATIVE', canary: false });
  expect(await db.webIdentity.findUniqueOrThrow({ where: { id: web.id } })).toMatchObject({ playerId: identity.playerId });
  await global();
}, 60_000);
it('admits fresh identities despite 171 discarded and two quarantined historical names, with no recovery or historical grant', async () => {
  // Deliberately reuse acquired logins and rich source-looking fields. None is
  // an immutable authority: no source record enters the bootstrap contract.
  const sources = Array.from({ length: 173 }, (_, index) => ({ kind: index < 171 ? 'OWNER_DISCARDED' : 'QUARANTINED',
    username: index % 2 ? 'old_1' : 'excluded_old_name', legacyXp: 999999, legacyPrimogems: 888888, legacyFriends: ['old_2'] }));
  const before = await immutable44(), ids = sources.map((_, index) => String(950000 + index));
  for (let offset = 0; offset < sources.length; offset += 8) await Promise.all(sources.slice(offset, offset + 8).map(async (source, index) => {
    const identity = (await provision(ids[offset + index]!, source.username))!;
    expect(identity.player).toMatchObject({ status: 'ACTIVE', legacyUsername: null, legacyRecovery: null, elementKey: null });
    expect(await db.playerResourceBalance.count({ where: { playerId: identity.playerId, amount: 0n } })).toBe(9);
    expect(await db.playerProgression.findUniqueOrThrow({ where: { playerId: identity.playerId } })).toMatchObject({ xp: 0n, totalMessages: 0n });
    expect(await db.twitchCanaryImport.count({ where: { playerId: identity.playerId } })).toBe(0);
  }));
  expect(await db.twitchIdentity.count({ where: { twitchUserId: { in: ids } } })).toBe(173);
  expect(await immutable44()).toEqual(before);
}, 60_000);
it('measures signed HTTP load with 44 preserved canaries, 48 fresh chatters, reduced pool, new IDs and redelivery', async () => {
  await global();
  const before = await immutable44(), ids = Array.from({ length: 48 }, (_, i) => String(930000 + i)), metricStart = httpMetrics.length;
  const originals = ids.map(id => message(id, '!pity'));
  outbound.send.mockRejectedValueOnce(new TwitchCommandSendError('CERTAIN', 'HTTP_429'));
  // Bounded arrival waves still run eight clients against a pool of three.
  for (let offset = 0; offset < ids.length; offset += 8) await Promise.all(originals.slice(offset, offset + 8).map(async value => {
    const response = await post(value);
    expect(response.statusCode, response.body).toBe(204);
  }));
  const limited = await db.twitchEventReceipt.findMany({ where: { twitchUserId: { in: ids }, externalReference: { startsWith: 'command-pilot:' }, state: 'FAILED' }, select: { id: true } });
  expect(limited).toHaveLength(1);
  for (const row of limited) await pilot.retryResponses(operatorId, row.id);
  for (let offset = 0; offset < ids.length; offset += 8) await Promise.all(ids.slice(offset, offset + 8).map(async (id, index) => {
    expect((await post(message(id, '!element pyro'))).statusCode).toBe(204);
    const ordinary = message(id, `nouveau message ${index}`), response = await post(ordinary); expect(response.statusCode, response.body).toBe(204);
    expect((await post(ordinary)).statusCode).toBe(204); // New EventSub delivery, same Twitch message ID.
    expect((await post(originals[offset + index]!)).statusCode).toBe(204);
    expect((await post(message(id, '!box'))).statusCode).toBe(204);
  }));
  const fresh = await db.twitchIdentity.findMany({ where: { twitchUserId: { in: ids } }, include: { player: true } });
  expect(fresh).toHaveLength(48); expect(new Set(fresh.map(row => row.playerId)).size).toBe(48);
  expect(await db.businessOperation.count({ where: { playerId: { in: fresh.map(row => row.playerId) }, operationType: 'daily-reward.claim' } })).toBe(48);
  expect(await db.twitchNativeTarget.count({ where: { twitchUserId: { in: ids }, dataAuthority: 'NATIVE', canary: false } })).toBe(48);
  for (const identity of fresh) {
    expect(identity.player.legacyUsername).toBeNull(); expect(identity.player.legacyRecovery).toBeNull();
    expect(await db.playerProgression.findUniqueOrThrow({ where: { playerId: identity.playerId } })).toMatchObject({ countedMessages: 1n, totalMessages: 4n });
  }
  const boxOwner = fresh[0]!, collection = await db.character.findMany({ where: { isActive: true }, orderBy: { displayOrder: 'asc' } });
  await db.playerCharacter.createMany({ data: collection.map(character => ({ playerId: boxOwner.playerId, characterId: character.id, constellation: 0, copies: 1, firstObtainedAt: at })) });
  const boxMessage = message(boxOwner.twitchUserId, '!box'), boxDelivery = randomUUID(); expect((await post(boxMessage, boxDelivery)).statusCode).toBe(204);
  const boxReceipt = await db.twitchEventReceipt.findUniqueOrThrow({ where: { externalEventId: boxDelivery } });
  const boxParts = (boxReceipt.payloadMinimal as unknown as { commandPilot: { responses: { text: string }[] } }).commandPilot.responses.map(row => row.text);
  expect(boxParts.length).toBeGreaterThan(1);
  for (const character of collection) expect(boxParts.filter(part => part.includes(`${character.name} (C0)`))).toHaveLength(1);
  expect(boxParts.join(' ')).toContain('Yoimiya (C0)');
  expect(await immutable44()).toEqual(before);
  const receipts = await db.twitchEventReceipt.findMany({ where: { twitchUserId: { in: ids }, externalReference: { startsWith: 'command-pilot:' } }, select: { payloadMinimal: true } });
  const responses = receipts.flatMap(row => (row.payloadMinimal as unknown as { commandPilot: { responses: { status: string; text: string; messageId?: string }[] } }).commandPilot.responses);
  expect(responses.length).toBeGreaterThanOrEqual(144); expect(responses.every(row => row.status === 'SENT' && row.messageId && Array.from(row.text).length + 12 <= 450)).toBe(true);
  expect(new Set(responses.map(row => row.messageId)).size).toBe(responses.length);
  const percentile = (values: number[], fraction: number) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1]!;
  const requests = httpMetrics.slice(metricStart), times = requests.map(row => row.ms), provisions = provisionMetrics.filter(row => ids.includes(row.id)).map(row => row.ms);
  expect(requests.every(row => row.status === 204)).toBe(true);
  const locks = await db.$queryRaw<{ waiting: bigint }[]>`SELECT count(*)::bigint AS waiting FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND pid<>pg_backend_pid()`;
  expect(locks[0]!.waiting).toBe(0n);
  process.stdout.write('R1064_PRIVATE_LOAD ' + JSON.stringify({ migrations: 67, canaries: 44, fresh: 48, concurrentClients: 8, pool: fixture.poolSnapshot(), errors: 0,
    requests: requests.length, responseAvgMs: times.reduce((a, b) => a + b, 0) / times.length, responseP95Ms: percentile(times, .95), firstProvisionP95Ms: percentile(provisions, .95), rateLimitedDeliveriesRecovered: limited.length,
    responses: responses.length, duplicates: 0, lost: 0, waitingLocks: Number(locks[0]!.waiting), preserved44Hash: createHash('sha256').update(JSON.stringify(before, (_key, value: unknown) => typeof value === 'bigint' ? value.toString() : value)).digest('hex') }) + '\n');
}, 180_000);
it('keeps new-player Event/Boss prerequisites explicit and has no invented welcome resources', async () => {
  const fresh = (await provision('940001'))!, actor = verifiedPlayerActor(fresh.player);
  const boss = new MonthlyBossService(current, db, clock, random);
  await expect(boss.getCurrentForChat(actor)).rejects.toMatchObject({ code: 'PLAYER_ELEMENT_REQUIRED' });
  await expect(boss.attackWithActiveTeam(actor, randomUUID(), 'TWITCH')).rejects.toThrow();
  expect(await db.playerResourceBalance.count({ where: { playerId: fresh.playerId, amount: { not: 0n } } })).toBe(0);
  expect(await db.eventParticipant.count({ where: { playerId: fresh.playerId } })).toBe(0);
  expect(await db.twitchCanaryImport.count({ where: { playerId: fresh.playerId } })).toBe(0);
});
it('freezes four real Twitch Boss members and victory gains through redelivery, team changes and receiver restart', async () => {
  const fresh = (await provision('940010'))!, actor = verifiedPlayerActor({ ...fresh.player, elementKey: 'pyro' });
  const characters = await db.character.findMany({ where: { isActive: true }, orderBy: { displayOrder: 'asc' }, take: 4 });
  await db.player.update({ where: { id: fresh.playerId }, data: { elementKey: 'pyro' } });
  await db.playerCharacter.createMany({ data: characters.map((character, index) => ({ playerId: fresh.playerId, characterId: character.id, constellation: index, copies: index + 1, firstObtainedAt: at })) });
  await db.team.create({ data: { playerId: fresh.playerId, displayPosition: 1, isActive: true, isBaseSlot: true, members: { create: characters.map((character, index) => ({ characterId: character.id, position: index + 1 })) } } });
  const boss = await new MonthlyBossService(current, db, clock, random).getCurrentForChat(actor);
  await db.monthlyBoss.update({ where: { id: boss.boss.id }, data: { currentHp: 1n } });
  const body = message('940010', '!combat boss go'), externalId = randomUUID(), sends = outbound.send.mock.calls.length;
  expect((await post(body, externalId)).statusCode).toBe(204);
  const receipt = await db.twitchEventReceipt.findUniqueOrThrow({ where: { externalEventId: externalId } });
  const saved = receipt.payloadMinimal as unknown as { commandPilot: { responses: { text: string; status: string }[] } };
  const parts = saved.commandPilot.responses.map(row => row.text), output = parts.join(' ');
  expect(output).toContain('DMG'); expect(output).toContain('grâce à sa team ['); expect(output).toContain('👑 Boss vaincu !');
  characters.forEach((character, index) => expect(parts.filter(part => part.includes(`${character.name} (C${index})`))).toHaveLength(1));
  expect(parts.every(part => Array.from(`@FreshViewer ${part}`).length <= 450)).toBe(true);
  expect(saved.commandPilot.responses.every(row => row.status === 'SENT')).toBe(true);
  const operations = await db.businessOperation.findMany({ where: { playerId: fresh.playerId }, orderBy: { id: 'asc' } });
  const movements = await db.resourceMovement.findMany({ where: { playerId: fresh.playerId }, orderBy: { id: 'asc' } });
  expect(operations.filter(row => row.operationType === 'monthly-boss.attack')).toHaveLength(1);
  expect(operations.filter(row => row.operationType === 'monthly-boss.reward')).toHaveLength(1);
  await db.teamMember.deleteMany({ where: { team: { playerId: fresh.playerId } } });
  await db.playerCharacter.updateMany({ where: { playerId: fresh.playerId }, data: { constellation: 6, copies: 7 } });
  expect((await post(body)).statusCode).toBe(204);
  const restarted = new TwitchCommandPilot(db, config, core, outbound, undefined, subscriptions, activity);
  expect(await restarted.retryResponses(operatorId, receipt.id)).toMatchObject({ state: 'PROCESSED' });
  expect(await db.businessOperation.findMany({ where: { playerId: fresh.playerId }, orderBy: { id: 'asc' } })).toEqual(operations);
  expect(await db.resourceMovement.findMany({ where: { playerId: fresh.playerId }, orderBy: { id: 'asc' } })).toEqual(movements);
  expect((await db.twitchEventReceipt.findUniqueOrThrow({ where: { id: receipt.id } })).payloadMinimal).toEqual(receipt.payloadMinimal);
  expect(outbound.send).toHaveBeenCalledTimes(sends + parts.length);
});
