import { randomUUID, createHmac, createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PULL_COST } from '../src/domain/gacha/pull.js';
import { SourceChannel } from '../generated/prisma/client.js';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { buildApp } from '../src/app.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { GetCurrentGacha, PerformGachaPull, SetGachaTarget } from '../src/application/gacha/gacha-services.js';
import { GetCurrentPlayerBox } from '../src/application/box/box-services.js';
import { PrismaBoxStore } from '../src/infrastructure/database/prisma-box-store.js';
import { GetCurrentPlayerInventory } from '../src/application/inventory/inventory-services.js';
import { PrismaInventoryStore } from '../src/infrastructure/database/prisma-inventory-store.js';
import { verifiedPlayerActor } from '../src/application/player/player-execution-actor.js';
import { PrismaGachaStore } from '../src/infrastructure/database/prisma-gacha-store.js';
import { SocialService } from '../src/application/social/social-service.js';
import { TwitchEventObserver } from '../src/application/twitch/twitch-event-observer.js';
import { TwitchReceiptRetention } from '../src/application/twitch/twitch-receipt-retention.js';
import { TwitchCommandPilot } from '../src/application/twitch/twitch-command-pilot.js';
import { twitchPlayerCommandExecutor } from '../src/application/twitch/twitch-player-command-executor.js';
import { TwitchCommandSendError, type TwitchCommandChatClient } from '../src/infrastructure/twitch/twitch-command-chat-client.js';
import { findChatCommand } from '../src/application/chat/chat-command-registry.js';
import { harness } from '../tests/helpers/chat-command-harness.js';
import type { ChatCommandServices } from '../src/application/chat/player-command-resolver.js';
import { TwitchFavorChatPresenceConsumer } from '../src/application/twitch/twitch-favor-chat-presence-consumer.js';
import { PermanentMissionService } from '../src/application/missions/permanent-mission-service.js';
import { PrismaEconomyService } from '../src/infrastructure/database/prisma-economy-service.js';
import { TwitchMessageActivity } from '../src/application/twitch/twitch-message-activity.js';
import { ClaimDailyReward } from '../src/application/daily-reward/claim-daily-reward.js';
import { PrismaDailyRewardStore } from '../src/infrastructure/database/prisma-daily-reward-store.js';
import { EventService } from '../src/application/event/event-service.js';

const fixture = isolatedBatchDatabase(), db = fixture.database;
const secret = 'private-command-webhook-secret';
const config = { host: 'localhost', port: 3001, supabase: {}, twitch: { pilotPlayerIds: [] as string[], pilotLogin: 'kichnifou' },
  twitchCommandPilot: { enabled: true }, twitchEventSub: { enabled: true, secret, callbackUrl: 'https://api.example/api/v1/twitch/eventsub' } };
let app: FastifyInstance, playerId: string, pilot: TwitchCommandPilot;
const parser = vi.fn(findChatCommand);
const outbound = { send: vi.fn(async () => randomUUID()) };
const giveaway = { consume: vi.fn(async () => false) };
const specialized = { consume: vi.fn(async () => undefined) };
const business = vi.fn<ReturnType<typeof twitchPlayerCommandExecutor>['execute']>();
let presence: TwitchFavorChatPresenceConsumer;
let core: ReturnType<typeof twitchPlayerCommandExecutor>;
let gacha: GetCurrentGacha, selectTarget: SetGachaTarget;
const subscriptions = { activationAvailable: true, inspectPilotChatTransport: vi.fn(async () => ({ subscriptionId: 'private-subscription', broadcasterId: '123', receiverId: '123', callback: config.twitchEventSub.callbackUrl })) };
beforeAll(async () => {
  await fixture.setup({ seedPublicCatalog: true });
  // A fresh local catalog need not contain an activated rotation. Keep this
  // transport fixture self-contained in its isolated schema.
  if (!await db.bannerRotation.findFirst({ where: { status: 'ACTIVE' } })) {
    const five = await db.character.findMany({ where: { isActive: true, rarity: 5 }, orderBy: { externalKey: 'asc' }, take: 4 });
    const four = await db.character.findMany({ where: { isActive: true, rarity: 4 }, orderBy: { externalKey: 'asc' }, take: 6 });
    await db.bannerRotation.create({ data: { startsAt: new Date('2026-10-04T22:00:00Z'), endsAt: new Date('2026-10-11T22:00:00Z'), status: 'ACTIVE',
      generationVoteSnapshot: { privateFixture: true }, featuredCharacters: { create: [
        ...five.map((character, index) => ({ characterId: character.id, rarity: 5, slot: index + 1, selectionSource: 'RANDOM' as const })),
        ...four.map((character, index) => ({ characterId: character.id, rarity: 4, slot: index + 1, selectionSource: 'RANDOM' as const })),
      ] } } });
  }
  const player = await db.player.create({ data: { displayName: 'Private command fixture', elementKey: 'hydro',
    gachaState: { create: {} }, economyStats: { create: {} }, wheelStats: { create: {} }, dailyRewardState: { create: {} } } }); playerId = player.id;
  const other = await db.player.create({ data: { displayName: 'Other private viewer', elementKey: 'geo' } });
  await db.twitchIdentity.createMany({ data: [{ playerId, twitchUserId: '123', login: 'kichnifou' }, { playerId: other.id, twitchUserId: '456', login: 'other' }] });
  await db.playerProgression.create({ data: { playerId } });
  await db.$transaction(tx => new PermanentMissionService(new PrismaEconomyService()).initializePlayer(tx, playerId, new Date(), true));
  const resources = await db.resourceDefinition.findMany({ where: { isActive: true } });
  await db.playerResourceBalance.createMany({ data: resources.map(row => ({ playerId, resourceKey: row.key, amount: row.key === 'primogems' ? 10000n : 0n })) });
  const store = new PrismaGachaStore(db); const current = await store.getCurrent(playerId);
  if (!current) throw new Error('Private banner unavailable');
  await db.playerGachaState.update({ where: { playerId }, data: { selectedBannerCharacterId: current.banner.featuredFiveStars[0]!.id } });
  await db.playerRoleAssignment.create({ data: { playerId, role: 'ADMIN', source: 'private-authority-fixture' } });
  config.twitch.pilotPlayerIds = [playerId];
  const clock = { now: () => new Date((current.banner.startsAt.getTime() + current.banner.endsAt.getTime()) / 2) };
  const getPlayer = new GetCurrentPlayer({ findByIdentity: async () => { throw new Error('No Supabase identity allowed in Twitch'); }, provision: async () => { throw new Error('No web provisioning allowed'); } });
  gacha = new GetCurrentGacha(getPlayer, store); selectTarget = new SetGachaTarget(getPlayer, store);
  const services = { ...harness().services, getCurrentGacha: gacha, setGachaTarget: selectTarget,
    getCurrentPlayerBox: new GetCurrentPlayerBox(getPlayer, new PrismaBoxStore(db)),
    getCurrentPlayerInventory: new GetCurrentPlayerInventory(getPlayer, new PrismaInventoryStore(db)),
    socialService: new SocialService(getPlayer, db, clock), performGachaPullChat: new PerformGachaPull(getPlayer, store, clock, { nextInt: upper => upper - 1 }, SourceChannel.TWITCH) } as unknown as ChatCommandServices;
  core = twitchPlayerCommandExecutor(db, services, clock); business.mockImplementation((...args) => core.execute(...args));
  pilot = new TwitchCommandPilot(db, config, { execute: business, prepare: core.prepare, capturedAt: core.capturedAt }, outbound, parser, subscriptions);
  await pilot.arm(playerId, 'STREAMERBOT_PATH_DISABLED');
  presence = new TwitchFavorChatPresenceConsumer(db, clock); vi.spyOn(presence, 'consume');
  app = await buildApp(config, { getOrProvisionCurrentPlayer: {} as never, authIdentityVerifier: { verify: async () => ({ subject: 'HTTP-only-fixture' }) },
    twitchEventObserver: new TwitchEventObserver(db, new TwitchReceiptRetention(db, () => 0)), twitchCommandPilot: pilot,
    twitchFavorChatPresence: presence, twitchFavorSubscriptions: specialized as never, twitchFavorGifts: specialized as never,
    twitchFavorResubs: specialized as never, twitchGiveawayConsumer: giveaway as never });
}, 60_000);
afterAll(async () => { await app?.close(); await fixture.cleanup(); }, 60_000);
function event(text = '!pull 1', chatter = '123') { return { subscription: { id: 'private-subscription', type: 'channel.chat.message', version: '1', status: 'enabled',
  condition: { broadcaster_user_id: '123', user_id: '123' }, transport: { method: 'webhook', callback: config.twitchEventSub.callbackUrl } },
  event: { chatter_user_id: chatter, chatter_user_login: 'not-authoritative', chatter_user_name: 'not-authoritative', broadcaster_user_id: '123', message_id: randomUUID() as string, message: { text } } }; }
function signed(body: object, id = randomUUID(), timestamp = new Date().toISOString(), kind = 'notification') {
  const payload = JSON.stringify(body);
  return { payload, headers: { 'content-type': 'application/json', 'twitch-eventsub-message-id': id, 'twitch-eventsub-message-timestamp': timestamp,
    'twitch-eventsub-message-type': kind, 'twitch-eventsub-message-signature': 'sha256=' + createHmac('sha256', secret).update(id).update(timestamp).update(payload).digest('hex') } };
}
const post = (request: ReturnType<typeof signed>) => app.inject({ method: 'POST', url: '/api/v1/twitch/eventsub', ...request });
async function state() {
  const key = { playerId_resourceKey: { playerId, resourceKey: 'primogems' } };
  return { pulls: await db.pullOperation.count(), operations: await db.businessOperation.count(), movements: await db.resourceMovement.count(),
    wallet: (await db.playerResourceBalance.findUniqueOrThrow({ where: key })).amount,
    gacha: await db.playerGachaState.findUniqueOrThrow({ where: { playerId } }) };
}
describe('signed command pilot in private PostgreSQL', () => {
  it('validates HMAC, timestamp and challenge before reaching the generic parser', async () => {
    const before = await state(); const wrong = signed(event()); wrong.headers['twitch-eventsub-message-signature'] = 'sha256=' + '0'.repeat(64);
    expect((await post(wrong)).statusCode).toBe(403);
    expect((await post(signed(event(), randomUUID(), new Date(Date.now() - 11 * 60_000).toISOString()))).statusCode).toBe(400);
    const challenge = await post(signed({ subscription: { type: 'channel.chat.message', version: '1' }, challenge: 'challenge' }, randomUUID(), undefined, 'webhook_callback_verification'));
    expect(challenge.statusCode).toBe(200); expect(challenge.body).toBe('challenge');
    expect(parser).not.toHaveBeenCalled(); expect(business).not.toHaveBeenCalled(); expect(await state()).toEqual(before);
  });
  it('observes OFF/other authors and preserves specialized consumers without native business effects', async () => {
    const before = await state(); await pilot.disarm(playerId);
    expect((await post(signed(event()))).statusCode).toBe(204); await pilot.arm(playerId, 'STREAMERBOT_PATH_DISABLED');
    expect((await post(signed(event('!pull 1', '456')))).statusCode).toBe(204);
    expect((await post(signed(event('ordinary message', '456')))).statusCode).toBe(204);
    expect(presence.consume).toHaveBeenCalledTimes(1); expect(giveaway.consume).toHaveBeenCalledTimes(3);
    giveaway.consume.mockResolvedValueOnce(true); expect((await post(signed(event()))).statusCode).toBe(204);
    expect(parser).not.toHaveBeenCalled(); expect(business).not.toHaveBeenCalled(); expect(await state()).toEqual(before);
    expect(await db.webIdentity.count()).toBe(0); expect(await db.globalChatMessage.count()).toBe(0);
  });
  it('executes one real TWITCH Pull under concurrent deliveries; no Chat mirroring or repeated spend/reward', async () => {
    const before = await state(); const request = signed(event());
    const deliveries = await Promise.all([post(request), post(request)]);
    expect(deliveries.map(row => row.statusCode), deliveries.map(row => row.body).join(' ')).toEqual([204, 204]); expect((await post(request)).statusCode).toBe(204);
    const after = await state(); expect(after.pulls - before.pulls).toBe(1); expect(after.operations - before.operations).toBe(1);
    expect(after.wallet).toBe(before.wallet - 160n); expect(after.gacha.totalPulls).toBe(before.gacha.totalPulls + 1n);
    expect(business).toHaveBeenCalledTimes(1); expect(outbound.send).toHaveBeenCalledTimes(1);
    const operation = await db.businessOperation.findFirstOrThrow({ where: { idempotencyKey: { endsWith: `:twitch-command:123:${JSON.parse(request.payload).event.message_id}` } } });
    expect(operation.sourceChannel).toBe(SourceChannel.TWITCH); expect(operation.playerId).toBe(playerId);
    const receipt = await db.twitchEventReceipt.findUniqueOrThrow({ where: { externalEventId: request.headers['twitch-eventsub-message-id'] } });
    expect(receipt.state).toBe('PROCESSED'); expect(receipt.processedAt).not.toBeNull(); expect(receipt.externalReference).not.toBeNull();
    expect(await db.globalChatMessage.count()).toBe(0); expect(await db.webIdentity.count()).toBe(0);
    expect(await db.pullResult.count({ where: { pullOperation: { businessOperationId: operation.id } } })).toBe(1);
    expect(await db.resourceMovement.count({ where: { operationId: operation.id, resourceKey: 'primogems', delta: -160n } })).toBe(1);
    const completed = await state(); await post(request); expect(await state()).toEqual(completed);
  }, 60_000);
  it('disarms after the real Pull commit, suppresses outbound and resumes only the response after explicit targeted re-arm', async () => {
    const before = await state(), sends = outbound.send.mock.calls.length, executions = business.mock.calls.length;
    business.mockImplementationOnce(async (...args) => {
      const result = await core.execute(...args); pilot.disarm(playerId); return result;
    });
    const request = signed(event()); expect((await post(request)).statusCode).toBe(204);
    const committed = await state(); expect(committed.pulls).toBe(before.pulls + 1);
    expect(committed.operations).toBe(before.operations + 1); expect(committed.wallet).toBe(before.wallet - 160n);
    expect(business).toHaveBeenCalledTimes(executions + 1); expect(outbound.send).toHaveBeenCalledTimes(sends);
    const receipt = await db.twitchEventReceipt.findUniqueOrThrow({ where: { externalEventId: request.headers['twitch-eventsub-message-id'] } });
    expect(receipt.state).toBe('RECEIVED'); expect(receipt.errorMessage).toBeNull();
    expect(receipt.payloadMinimal).toMatchObject({ commandPilot: { stage: 'RESPONSES', responses: [{ status: 'PENDING' }] } });
    await expect(pilot.retryResponses(playerId, receipt.id)).rejects.toMatchObject({ code: 'TWITCH_COMMAND_PILOT_OFF' });
    expect((await post(signed(event()))).statusCode).toBe(204); expect(await state()).toEqual(committed);
    await expect(pilot.arm(playerId, 'STREAMERBOT_PATH_DISABLED')).rejects.toMatchObject({ code: 'TWITCH_NATIVE_CANARY_RESUME_BLOCKED' });
    await pilot.arm(playerId, 'STREAMERBOT_PATH_DISABLED', ['123']); expect(await pilot.retryResponses(playerId, receipt.id)).toEqual({ state: 'PROCESSED' });
    expect(await state()).toEqual(committed); expect(business).toHaveBeenCalledTimes(executions + 1);
    expect(outbound.send).toHaveBeenCalledTimes(sends + 1);
    expect((await post(request)).statusCode).toBe(204); expect(outbound.send).toHaveBeenCalledTimes(sends + 1);
    const operation = await db.businessOperation.findFirstOrThrow({ where: { idempotencyKey: { endsWith: `:twitch-command:123:${JSON.parse(request.payload).event.message_id}` } } });
    expect(operation.sourceChannel).toBe(SourceChannel.TWITCH);
    expect(await db.globalChatMessage.count()).toBe(0); expect(await db.webIdentity.count()).toBe(0);
  }, 60_000);
  it('retries only a certainly rejected response, preserving the already committed Pull', async () => {
    const before = await state(); const calls = business.mock.calls.length; const request = signed(event());
    outbound.send.mockRejectedValueOnce(new TwitchCommandSendError('CERTAIN', 'HTTP_429'));
    expect((await post(request)).statusCode).toBe(204); const committed = await state();
    expect(committed.pulls).toBe(before.pulls + 1); expect(committed.wallet).toBe(before.wallet - 160n);
    const receipt = await db.twitchEventReceipt.findUniqueOrThrow({ where: { externalEventId: request.headers['twitch-eventsub-message-id'] } });
    const parseCount = parser.mock.calls.length;
    expect(await pilot.retryResponses(playerId, receipt.id)).toEqual({ state: 'PROCESSED' });
    expect(await state()).toEqual(committed); expect(business.mock.calls.length).toBe(calls + 1); expect(parser.mock.calls.length).toBe(parseCount);
    expect(await pilot.responseStatus(playerId)).toMatchObject({ receiptId: receipt.id, state: 'PROCESSED' });
  }, 60_000);
  it('recovers the business-commit/receipt window through the same stable engine key', async () => {
    const before = await state(); const normal = business.getMockImplementation()!; const request = signed(event());
    business.mockImplementationOnce(async (...args) => { await normal(...args); throw new Error('Injected private post-commit failure'); });
    expect((await post(request)).statusCode).toBe(500); const committed = await state(); expect(committed.pulls).toBe(before.pulls + 1);
    const receipt = await db.twitchEventReceipt.findUniqueOrThrow({ where: { externalEventId: request.headers['twitch-eventsub-message-id'] } });
    expect(receipt.externalReference).not.toBeNull(); expect(receipt.processedAt).toBeNull();
    expect((await post(request)).statusCode).toBe(204); expect(await state()).toEqual(committed);
    expect(await db.globalChatMessage.count()).toBe(0); expect(await db.webIdentity.count()).toBe(0);
  }, 60_000);
});

describe('real multi-pull idempotence and segmented delivery', () => {
  it('excludes a proven Gift echo by ID but accepts the same text as an independent viewer message', async () => {
    const messageId = randomUUID(), text = '🎁 Annonce Gift privée';
    await db.twitchEventReceipt.create({ data: { externalEventId: 'gift-supreme:' + randomUUID(), twitchUserId: '999',
      eventType: 'channel.channel_points_custom_reward_redemption.add', payloadHash: 'a'.repeat(64), state: 'PROCESSED',
      payloadMinimal: { remote: { broadcasterId: '123', announcementState: 'SENT', messageId, announcementText: text } } } });
    const favors = vi.mocked(presence.consume).mock.calls.length, giveaways = giveaway.consume.mock.calls.length;
    const echo = event(text); echo.event.message_id = messageId;
    expect((await post(signed(echo))).statusCode).toBe(204);
    expect(presence.consume).toHaveBeenCalledTimes(favors); expect(giveaway.consume).toHaveBeenCalledTimes(giveaways);
    expect((await post(signed(event(text)))).statusCode).toBe(204);
    expect(presence.consume).toHaveBeenCalledTimes(favors + 1); expect(giveaway.consume).toHaveBeenCalledTimes(giveaways + 1);
  }, 60_000);
  it('recovers a committed R1042/R1043 key without an intent, and refuses to reinterpret an unstarted legacy receipt', async () => {
    const player = await db.player.findUniqueOrThrow({ where: { id: playerId } });
    const key = 'twitch-command:' + randomUUID(), before = await state();
    const intent = await core.prepare!(player, 'pull', ['1'], '!pull', key);
    const result = await core.execute(player, 'pull', ['1'], '!pull', key, intent);
    expect(await core.execute(player, 'pull', ['1'], '!pull', key)).toEqual(result);
    expect((await state()).pulls).toBe(before.pulls + 1);
    const committed = await state();
    await expect(core.execute(player, 'pull', ['1'], '!pull', 'twitch-command:' + randomUUID())).rejects.toMatchObject({ code: 'TWITCH_COMMAND_LEGACY_INTENT_REQUIRED' });
    expect(await state()).toEqual(committed);
  }, 60_000);
  it('excludes proven native outbound echoes before Giveaway and Favor, without classifying viewers by a prefix', async () => {
    const request = signed(event('!pity')); expect((await post(request)).statusCode).toBe(204);
    const receipt = await db.twitchEventReceipt.findUniqueOrThrow({ where: { externalEventId: request.headers['twitch-eventsub-message-id'] } });
    const response = (receipt.payloadMinimal as { commandPilot: { responses: { text: string; messageId: string }[] } }).commandPilot.responses[0]!;
    const echo = event(response.text); echo.event.message_id = response.messageId;
    const favors = vi.mocked(presence.consume).mock.calls.length, giveaways = giveaway.consume.mock.calls.length, sends = outbound.send.mock.calls.length;
    expect((await post(signed(echo))).statusCode).toBe(204);
    expect(presence.consume).toHaveBeenCalledTimes(favors); expect(giveaway.consume).toHaveBeenCalledTimes(giveaways); expect(outbound.send).toHaveBeenCalledTimes(sends);
    const viewer = event('🎁 Un message ordinaire du joueur'); expect((await post(signed(viewer))).statusCode).toBe(204);
    expect(presence.consume).toHaveBeenCalledTimes(favors + 1); expect(giveaway.consume).toHaveBeenCalledTimes(giveaways + 1);
  }, 60_000);
  it('accepts two identical !pull texts with distinct message IDs, but not a redelivery of either message', async () => {
    const before = await state(), sends = outbound.send.mock.calls.length, executions = business.mock.calls.length;
    const first = event('!pull'), second = event('!pull');
    const requests = [signed(first), signed(second)];
    for (const request of requests) expect((await post(request)).statusCode).toBe(204);
    const after = await state();
    expect(after.pulls).toBe(before.pulls + 2); expect(after.wallet).toBe(before.wallet - 320n);
    expect(business).toHaveBeenCalledTimes(executions + 2); expect(outbound.send).toHaveBeenCalledTimes(sends + 2);
    const receipts = await db.twitchEventReceipt.findMany({ where: { externalEventId: { in: requests.map(row => row.headers['twitch-eventsub-message-id']) } } });
    expect(receipts).toHaveLength(2);
    expect(new Set(receipts.map(row => row.externalReference)).size).toBe(2);
    for (const request of requests) expect((await post(request)).statusCode).toBe(204);
    expect((await post(signed(first))).statusCode).toBe(204); // New transport delivery, same actual chat message.
    const conflict = structuredClone(first); conflict.event.message.text = '!pull 2';
    expect((await post(signed(conflict))).statusCode).toBe(409);
    expect(await state()).toEqual(after); expect(outbound.send).toHaveBeenCalledTimes(sends + 2);
    expect(business).toHaveBeenCalledTimes(executions + 2);
  }, 60_000);
  it.each([false, true])('executes x3 once with certain partial rejection=%s', async partial => {
    const before = await state(), executions = business.mock.calls.length, parses = parser.mock.calls.length, sends = outbound.send.mock.calls.length;
    if (partial) outbound.send.mockResolvedValueOnce(randomUUID()).mockRejectedValueOnce(new TwitchCommandSendError('CERTAIN', 'HTTP_429'));
    const request = signed(event('!pull 3'));
    expect((await post(request)).statusCode).toBe(204);
    const committed = await state();
    expect(committed.pulls).toBe(before.pulls + 1); expect(committed.operations).toBe(before.operations + 1);
    expect(committed.wallet).toBe(before.wallet - PULL_COST[3]); expect(committed.gacha.totalPulls).toBe(before.gacha.totalPulls + 3n);
    expect(business).toHaveBeenCalledTimes(executions + 1); expect(parser).toHaveBeenCalledTimes(parses + 1);
    const key = { idempotencyKey: { endsWith: ':twitch-command:123:' + JSON.parse(request.payload).event.message_id } };
    expect(await db.businessOperation.count({ where: key })).toBe(1);
    const operation = await db.businessOperation.findFirstOrThrow({ where: key });
    expect(operation).toMatchObject({ operationType: 'gacha.pull', sourceChannel: SourceChannel.TWITCH, playerId });
    const pulls = await db.pullOperation.findMany({ where: { businessOperationId: operation.id }, include: { results: true } });
    expect(pulls).toHaveLength(1); expect(pulls[0]).toMatchObject({ pullCount: 3, primogemCost: PULL_COST[3], sourceChannel: SourceChannel.TWITCH });
    expect(pulls[0]!.results).toHaveLength(3);
    expect(await db.resourceMovement.count({ where: { operationId: operation.id, resourceKey: 'primogems', delta: -PULL_COST[3] } })).toBe(1);
    const receipt = await db.twitchEventReceipt.findUniqueOrThrow({ where: { externalEventId: request.headers['twitch-eventsub-message-id'] } });
    const saved = receipt.payloadMinimal as { commandPilot: { responses: { text: string; status: string }[] } };
    expect(saved.commandPilot.responses).toHaveLength(3);
    saved.commandPilot.responses.forEach((row, index) => expect(row.text).toContain('[' + (index + 1) + '/3]'));
    if (partial) {
      expect(saved.commandPilot.responses.map(row => row.status)).toEqual(['SENT', 'FAILED', 'PENDING']);
      expect(outbound.send).toHaveBeenCalledTimes(sends + 2);
      expect(await pilot.retryResponses(playerId, receipt.id)).toEqual({ state: 'PROCESSED' });
    }
    expect(await state()).toEqual(committed); expect(business).toHaveBeenCalledTimes(executions + 1); expect(parser).toHaveBeenCalledTimes(parses + 1);
    const messages = outbound.send.mock.calls.slice(sends).map(call => (call as unknown as [{ message: string }])[0].message);
    const texts = saved.commandPilot.responses.map(row => row.text);
    expect(messages).toEqual(partial ? [texts[0], texts[1], texts[1], texts[2]] : texts);
    expect((await post(request)).statusCode).toBe(204);
    expect(await state()).toEqual(committed); expect(outbound.send).toHaveBeenCalledTimes(sends + (partial ? 4 : 3));
    expect(business).toHaveBeenCalledTimes(executions + 1);
    expect(await db.globalChatMessage.count()).toBe(0); expect(await db.webIdentity.count()).toBe(0);
  }, 60_000);
});

describe('R1063 repeated commands and selection parity', () => {
  it('reads full aliases/pity/Box/quotis/sac for fresh message IDs and never reexecutes a redelivery or changes the economy', async () => {
    const catalog = await db.character.findMany({ where: { isActive: true, rarity: { in: [4, 5] } }, orderBy: { name: 'asc' } });
    await db.playerCharacter.createMany({ data: catalog.map((character, index) => ({ playerId, characterId: character.id, constellation: index % 7, copies: index % 7 + 1, firstObtainedAt: new Date('2026-01-01') })), skipDuplicates: true });
    const possessions = await db.playerCharacter.findMany({ where: { playerId }, include: { character: true } });
    await db.c6CompetitionProgress.createMany({ data: possessions.filter(row => row.character.rarity === 5 && row.constellation === 6).map(row => ({ playerId, characterId: row.characterId,
      unlockedAt: new Date('2026-01-01'), strength: 1, intelligence: 1, beauty: 1, charisma: 1, popularity: 1 })), skipDuplicates: true });
    const before = await state(), executions = business.mock.calls.length;
    const commands = ['!ban', '!ban', '!BAN', '!banniere', '!bannière', '!ban \u034f', '!pity', '!pity', '!box', '!box', '!quotis', '!quotis', '!sac', '!sac'];
    for (const text of commands) {
      const body = event(text), request = signed(body), calls = business.mock.calls.length;
      const response = await post(request); expect(response.statusCode, `${text}: ${response.body}`).toBe(204);
      const receipt = await db.twitchEventReceipt.findUniqueOrThrow({ where: { externalEventId: request.headers['twitch-eventsub-message-id'] } });
      const saved = (receipt.payloadMinimal as { contentHash: string; commandPilot: { args: string[]; responseBodyLimit: number; intent: { responseBodyLimit: number }; responses: { text: string; status: string }[] } });
      expect(receipt.state).toBe('PROCESSED'); expect(saved.contentHash).toBe(createHash('sha256').update(text).digest('hex'));
      expect(saved.commandPilot.args).toEqual([]);
      expect(saved.commandPilot.responseBodyLimit).toBe(450 - Array.from('@not-authoritative ').length);
      expect(saved.commandPilot.intent.responseBodyLimit).toBe(saved.commandPilot.responseBodyLimit);
      expect(saved.commandPilot.responses.every(part => Array.from('@not-authoritative ' + part.text).length <= 450)).toBe(true);
      expect(saved.commandPilot.responses.every(part => part.status === 'SENT' && Array.from(part.text).length <= 450)).toBe(true);
      const output = saved.commandPilot.responses.map(part => part.text);
      expect(output.join('\n')).not.toContain('Syntaxe');
      if (text === '!box') {
        expect(output.length).toBeGreaterThan(3);
        for (const owned of possessions) expect(output.filter(part => part.includes(`${owned.character.name} (C${owned.constellation})`))).toHaveLength(1);
        expect(output.some(part => part.includes('Yoimiya (C'))).toBe(true);
      }
      const sends = outbound.send.mock.calls.length;
      expect((await post(request)).statusCode).toBe(204);
      expect((await post(signed(body))).statusCode).toBe(204); // Different delivery UUID, same immutable chat message ID.
      expect(business).toHaveBeenCalledTimes(calls + 1); expect(outbound.send).toHaveBeenCalledTimes(sends);
    }
    expect(business).toHaveBeenCalledTimes(executions + commands.length);
    expect(await state()).toEqual(before);
    expect(await db.globalChatMessage.count()).toBe(0); expect(await db.webIdentity.count()).toBe(0);
    const invalid = signed(event('!ban visible \u034f'));
    expect((await post(invalid)).statusCode).toBe(204);
    const invalidReceipt = await db.twitchEventReceipt.findUniqueOrThrow({ where: { externalEventId: invalid.headers['twitch-eventsub-message-id'] } });
    expect(invalidReceipt.payloadMinimal).toMatchObject({ commandPilot: { args: ['visible'], responses: [{ text: 'Syntaxe : !banniere.', status: 'SENT' }] } });
    expect(await state()).toEqual(before);
  }, 60_000);
  it('freezes a long thread-author reply budget once for concurrent deliveries and preserves every Box entry', async () => {
    const before = await state(), executions = business.mock.calls.length, sends = outbound.send.mock.calls.length;
    const body = event('!box');
    body.event.chatter_user_name = 'x'; body.event.chatter_user_login = 'x';
    Object.assign(body.event, { reply: { parent_message_id: randomUUID(), parent_user_name: 'Parent', parent_user_login: 'parent',
      thread_user_name: 'T'.repeat(128), thread_user_login: 'thread' } });
    const request = signed(body), replies = await Promise.all([post(request), post(request)]);
    replies.forEach(response => expect(response.statusCode, response.body).toBe(204));
    const receipt = await db.twitchEventReceipt.findUniqueOrThrow({ where: { externalEventId: request.headers['twitch-eventsub-message-id'] } });
    const saved = receipt.payloadMinimal as { commandPilot: { responseBodyLimit: number; intent: { responseBodyLimit: number }; responses: { text: string; status: string; fullText?: string }[] } };
    expect(saved.commandPilot.responseBodyLimit).toBe(320); expect(saved.commandPilot.intent.responseBodyLimit).toBe(320);
    expect(saved.commandPilot.responses.every(row => row.status === 'SENT' && row.fullText === undefined && Array.from('@' + 'T'.repeat(128) + ' ' + row.text).length <= 450)).toBe(true);
    const owned = await db.playerCharacter.findMany({ where: { playerId }, include: { character: true } });
    for (const character of owned) expect(saved.commandPilot.responses.filter(row => row.text.includes(`${character.character.name} (C${character.constellation})`))).toHaveLength(1);
    expect(await state()).toEqual(before); expect(business).toHaveBeenCalledTimes(executions + 1);
    expect(outbound.send).toHaveBeenCalledTimes(sends + saved.commandPilot.responses.length);
    const frozen = structuredClone(receipt.payloadMinimal);
    expect((await post(request)).statusCode).toBe(204);
    expect((await post(signed(body))).statusCode).toBe(204);
    expect((await db.twitchEventReceipt.findUniqueOrThrow({ where: { id: receipt.id } })).payloadMinimal).toEqual(frozen);
    expect(await state()).toEqual(before); expect(business).toHaveBeenCalledTimes(executions + 1);
    expect(outbound.send).toHaveBeenCalledTimes(sends + saved.commandPilot.responses.length);
  }, 60_000);
  it('shares the target with the standalone owner and never lets an old Twitch receipt undo a later choice', async () => {
    const player = await db.player.findUniqueOrThrow({ where: { id: playerId } }), actor = verifiedPlayerActor(player);
    const current = await gacha.execute(actor), previous = current.banner.featuredFiveStars.find(row => row.id === current.playerState.selectedBannerCharacterId)!;
    const next = current.banner.featuredFiveStars.find(row => row.id !== previous.id)!;
    const economic = await state();
    const submit = async (text: string) => { const body = event(text), request = signed(body); const response = await post(request); expect(response.statusCode, response.body).toBe(204); return { body, request,
      receipt: await db.twitchEventReceipt.findUniqueOrThrow({ where: { externalEventId: request.headers['twitch-eventsub-message-id'] } }) }; };
    const already = await submit(`!select ${previous.name}`);
    expect(already.receipt.payloadMinimal).toMatchObject({ commandPilot: { responses: [{ text: `⚠️ ${previous.name} est déjà ciblé.` }] } });
    const changed = await submit(`!select ${next.name}`);
    expect(changed.receipt.payloadMinimal).toMatchObject({ commandPilot: { responses: [{ text: `✅ Cible 5★ sélectionnée : ${next.name}. Utilise !pull pour invoquer.` }] } });
    expect((await gacha.execute(actor)).playerState.selectedBannerCharacterId).toBe(next.id);
    const absent = await submit('!select Personnage absent de la bannière');
    expect(absent.receipt.payloadMinimal).toMatchObject({ commandPilot: { responses: [{ text: expect.stringContaining('introuvable sur la bannière') }] } });
    expect((await gacha.execute(actor)).playerState.selectedBannerCharacterId).toBe(next.id);
    await selectTarget.execute(actor, previous.id, randomUUID(), SourceChannel.UI);
    const ban = await submit('!ban');
    expect(ban.receipt.payloadMinimal).toMatchObject({ commandPilot: { responses: [{ text: expect.stringContaining(`5★ ciblé :`) }] } });
    expect(JSON.stringify(ban.receipt.payloadMinimal)).toContain(previous.name);
    const after = await state(), sends = outbound.send.mock.calls.length, executions = business.mock.calls.length;
    expect((await post(changed.request)).statusCode).toBe(204); expect((await post(signed(changed.body))).statusCode).toBe(204);
    expect(await state()).toEqual(after); expect((await gacha.execute(actor)).playerState.selectedBannerCharacterId).toBe(previous.id);
    expect(business).toHaveBeenCalledTimes(executions); expect(outbound.send).toHaveBeenCalledTimes(sends);
    expect(after.wallet).toBe(economic.wallet); expect(after.pulls).toBe(economic.pulls); expect(after.movements).toBe(economic.movements);
    expect(after.gacha.totalPulls).toBe(economic.gacha.totalPulls);
  }, 60_000);
});

describe('non-broadcaster Player on an independently authorized chat transport', () => {
  let viewerId: string, viewerApp: FastifyInstance, viewerPilot: TwitchCommandPilot, now: Date;
  const send = vi.fn(async (..._args: Parameters<TwitchCommandChatClient['send']>) => randomUUID());
  const receiver = '200', chatter = '300';
  const viewerConfig = { ...config, twitch: { ...config.twitch, pilotPlayerIds: [] as string[] } };
  beforeAll(async () => {
    const player = await db.player.create({ data: { displayName: 'Private non-broadcaster', elementKey: 'hydro',
      gachaState: { create: {} }, progression: { create: {} }, economyStats: { create: {} }, wheelStats: { create: {} }, dailyRewardState: { create: {} } } });
    viewerId = player.id;
    await db.twitchIdentity.create({ data: { playerId: viewerId, twitchUserId: chatter, login: 'viewer_untrusted_name' } });
    const store = new PrismaGachaStore(db), current = await store.getCurrent(viewerId);
    if (!current) throw new Error('Private banner unavailable');
    now = new Date((current.banner.startsAt.getTime() + current.banner.endsAt.getTime()) / 2);
    const clock = { now: () => new Date(now) }, random = { nextInt: (upper: number) => upper - 1 };
    await db.$transaction(tx => new PermanentMissionService().initializePlayer(tx, viewerId, now, true));
    const resources = await db.resourceDefinition.findMany({ where: { isActive: true } });
    await db.playerResourceBalance.createMany({ data: resources.map(row => ({ playerId: viewerId, resourceKey: row.key, amount: row.key === 'primogems' ? 10000n : 0n })) });
    await db.playerGachaState.update({ where: { playerId: viewerId }, data: { selectedBannerCharacterId: current.banner.featuredFiveStars[0]!.id } });
    viewerConfig.twitch.pilotPlayerIds = [playerId, viewerId];
    const getPlayer = new GetCurrentPlayer({ findByIdentity: async () => { throw new Error('No web identity'); }, provision: async () => { throw new Error('No provisioning'); } });
    const services = { ...harness().services, getCurrentGacha: new GetCurrentGacha(getPlayer, store), socialService: new SocialService(getPlayer, db, clock),
      performGachaPullChat: new PerformGachaPull(getPlayer, store, clock, random, 'TWITCH') } as unknown as ChatCommandServices;
    const executor = twitchPlayerCommandExecutor(db, services, clock);
    const activity = new TwitchMessageActivity(db, clock, random, new ClaimDailyReward(getPlayer, new PrismaDailyRewardStore(db), clock), new EventService(getPlayer, db, clock, random));
    // Authorized server contract is deliberately distinct from both the Player and channel.
    const transport = { activationAvailable: true, inspectPilotChatTransport: async () => ({ subscriptionId: 'viewer-subscription', broadcasterId: '123', receiverId: receiver, callback: config.twitchEventSub.callbackUrl }) };
    viewerPilot = new TwitchCommandPilot(db, viewerConfig, executor, { send }, undefined, transport, activity);
    await viewerPilot.arm(playerId, 'STREAMERBOT_PATH_DISABLED', ['123', chatter]);
    viewerApp = await buildApp(viewerConfig, { getOrProvisionCurrentPlayer: {} as never, authIdentityVerifier: { verify: async () => ({ subject: 'HTTP-only-fixture' }) },
      twitchEventObserver: new TwitchEventObserver(db, new TwitchReceiptRetention(db, () => 0)), twitchCommandPilot: viewerPilot,
      twitchFavorChatPresence: presence, twitchFavorSubscriptions: specialized as never, twitchFavorGifts: specialized as never,
      twitchFavorResubs: specialized as never, twitchGiveawayConsumer: giveaway as never });
  }, 60_000);
  afterAll(async () => { await viewerApp?.close(); }, 60_000);
  const body = (text: string, author = chatter) => {
    const value = event(text, author); value.subscription.id = 'viewer-subscription'; value.subscription.condition.user_id = receiver; return value;
  };
  const deliver = (request: ReturnType<typeof signed>) => viewerApp.inject({ method: 'POST', url: '/api/v1/twitch/eventsub', ...request });
  const progression = () => db.playerProgression.findUniqueOrThrow({ where: { playerId: viewerId } });
  const wallet = () => db.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId: viewerId, resourceKey: 'primogems' } } });

  it('reads for the immutable chatter identity and replies using the authorized receiver', async () => {
    const before = await db.pullOperation.count(), sends = send.mock.calls.length;
    expect((await deliver(signed(body('!pity')))).statusCode).toBe(204);
    expect(await db.pullOperation.count()).toBe(before);
    expect(send).toHaveBeenCalledTimes(sends + 1);
    expect(send.mock.calls.at(-1)?.[0]).toMatchObject({ broadcasterId: '123', senderId: receiver });
    expect(await db.webIdentity.count()).toBe(0); expect(await db.globalChatMessage.count()).toBe(0);
  });
  it('commits a real TWITCH mutation once and lets only the operator retry the viewer response', async () => {
    const initial = await wallet(), pulls = await db.pullOperation.count(), text = body('!pull'), request = signed(text);
    send.mockRejectedValueOnce(new TwitchCommandSendError('CERTAIN', 'HTTP_429'));
    expect((await deliver(request)).statusCode).toBe(204);
    const operation = await db.businessOperation.findFirstOrThrow({ where: { playerId: viewerId, operationType: 'gacha.pull', idempotencyKey: { endsWith: ':twitch-command:123:' + text.event.message_id } } });
    expect(operation.sourceChannel).toBe('TWITCH'); expect((await wallet()).amount).toBe(initial.amount - 160n);
    const receipt = await db.twitchEventReceipt.findUniqueOrThrow({ where: { externalEventId: request.headers['twitch-eventsub-message-id'] } });
    expect(receipt.payloadMinimal).toMatchObject({ commandPilot: { playerId: viewerId, chatterId: chatter, senderId: receiver } });
    await expect(viewerPilot.retryResponses(viewerId, receipt.id)).rejects.toMatchObject({ statusCode: 403 });
    expect(await viewerPilot.retryResponses(playerId, receipt.id)).toEqual({ state: 'PROCESSED' });
    expect((await deliver(request)).statusCode).toBe(204); expect((await deliver(signed(text))).statusCode).toBe(204);
    expect(await db.pullOperation.count()).toBe(pulls + 1); expect((await wallet()).amount).toBe(initial.amount - 160n);
    expect(await db.webIdentity.count()).toBe(0); expect(await db.globalChatMessage.count()).toBe(0);
  }, 60_000);
  it('counts ordinary messages, XP/cooldown/daily/Event once per real viewer message ID', async () => {
    const initial = await progression(), text = body('x'.repeat(101)), request = signed(text), sends = send.mock.calls.length;
    expect((await deliver(request)).statusCode).toBe(204);
    const first = await progression(), completeSends = send.mock.calls.length;
    expect(first.totalMessages).toBe(initial.totalMessages + 1n); expect(first.countedMessages).toBe(initial.countedMessages + 1n); expect(first.xp).toBe(initial.xp + 2n);
    expect(completeSends).toBeGreaterThan(sends);
    expect(await db.businessOperation.count({ where: { playerId: viewerId, operationType: 'daily-reward.claim', sourceChannel: 'TWITCH' } })).toBe(1);
    expect(await db.businessOperation.count({ where: { playerId: viewerId, operationType: 'event.presence.delivery', sourceChannel: 'TWITCH' } })).toBe(1);
    expect((await deliver(request)).statusCode).toBe(204); expect((await deliver(signed(text))).statusCode).toBe(204);
    expect(await progression()).toEqual(first); expect(send).toHaveBeenCalledTimes(completeSends);
    now = new Date(now.getTime() + 1000);
    expect((await deliver(signed(body('ordinary during cooldown')))).statusCode).toBe(204);
    expect((await progression()).totalMessages).toBe(first.totalMessages + 1n); expect((await progression()).xp).toBe(first.xp);
    now = new Date(now.getTime() + 1000);
    expect((await deliver(signed(body('x'.repeat(201))))).statusCode).toBe(204);
    expect((await progression()).xp).toBe(first.xp + 3n);
    expect(await db.webIdentity.count()).toBe(0); expect(await db.globalChatMessage.count()).toBe(0);
  }, 60_000);
  it('keeps rejected authors/transports outside commands and ordinary-message effects', async () => {
    const initial = await progression(), pulls = await db.pullOperation.count();
    const wrongChannel = body('!pull'); wrongChannel.event.broadcaster_user_id = wrongChannel.subscription.condition.broadcaster_user_id = '400';
    const wrongReceiver = body('ordinary'); wrongReceiver.subscription.condition.user_id = chatter;
    const shared = body('ordinary'); Object.assign(shared.event, { source_broadcaster_user_id: '400' });
    for (const value of [body('!pull', '456'), body('ordinary', '456'), body('!pull', '999'), body('ordinary', '999'), wrongChannel, wrongReceiver, shared]) {
      expect((await deliver(signed(value))).statusCode).toBe(204);
    }
    await db.player.update({ where: { id: viewerId }, data: { status: 'ARCHIVED' } });
    try { expect((await deliver(signed(body('!pull')))).statusCode).toBe(204); expect((await deliver(signed(body('ordinary')))).statusCode).toBe(204); }
    finally { await db.player.update({ where: { id: viewerId }, data: { status: 'ACTIVE' } }); }
    expect(await progression()).toEqual(initial); expect(await db.pullOperation.count()).toBe(pulls);
  }, 60_000);
  it('accepts two identical viewer !pull texts with distinct IDs and deduplicates redeliveries', async () => {
    const initial = await wallet(), pulls = await db.pullOperation.count(), sends = send.mock.calls.length;
    const messages = [body('!pull'), body('!pull')], requests = messages.map(value => signed(value));
    for (const request of requests) expect((await deliver(request)).statusCode).toBe(204);
    expect(await db.pullOperation.count()).toBe(pulls + 2); expect((await wallet()).amount).toBe(initial.amount - 320n);
    expect(send).toHaveBeenCalledTimes(sends + 2);
    const receipts = await db.twitchEventReceipt.findMany({ where: { externalEventId: { in: requests.map(row => row.headers['twitch-eventsub-message-id']) } } });
    expect(new Set(receipts.map(row => row.externalReference)).size).toBe(2);
    for (const request of requests) expect((await deliver(request)).statusCode).toBe(204);
    expect((await deliver(signed(messages[0]!))).statusCode).toBe(204);
    expect(await db.pullOperation.count()).toBe(pulls + 2); expect(send).toHaveBeenCalledTimes(sends + 2);
  }, 60_000);
  it('excludes replies by the receiver even when the original receipt belongs to another chatter', async () => {
    const request = signed(body('!pity')); expect((await deliver(request)).statusCode).toBe(204);
    const receipt = await db.twitchEventReceipt.findUniqueOrThrow({ where: { externalEventId: request.headers['twitch-eventsub-message-id'] } });
    const state = receipt.payloadMinimal as { commandPilot: { responses: { messageId: string; text: string }[] } };
    const response = state.commandPilot.responses[0]!, echo = body(response.text, receiver); echo.event.message_id = response.messageId;
    const favors = vi.mocked(presence.consume).mock.calls.length, giveaways = giveaway.consume.mock.calls.length, sends = send.mock.calls.length, initial = await progression();
    expect(await viewerPilot.isNativeOutboundMessage(echo)).toBe(true);
    expect((await deliver(signed(echo))).statusCode).toBe(204);
    expect(presence.consume).toHaveBeenCalledTimes(favors); expect(giveaway.consume).toHaveBeenCalledTimes(giveaways);
    expect(send).toHaveBeenCalledTimes(sends); expect(await progression()).toEqual(initial);
    const inFlight = structuredClone(receipt.payloadMinimal) as { commandPilot: { responses: { messageId?: string; status: string }[] } };
    delete inFlight.commandPilot.responses[0]!.messageId; inFlight.commandPilot.responses[0]!.status = 'SENDING';
    await db.twitchEventReceipt.update({ where: { id: receipt.id }, data: { payloadMinimal: inFlight } });
    echo.event.message_id = randomUUID(); Object.assign(echo.event, { reply: { parent_message_id: JSON.parse(request.payload).event.message_id } });
    expect(await viewerPilot.isNativeOutboundMessage(echo)).toBe(true);
    await db.twitchEventReceipt.update({ where: { id: receipt.id }, data: { payloadMinimal: receipt.payloadMinimal! } });
  }, 60_000);
});
