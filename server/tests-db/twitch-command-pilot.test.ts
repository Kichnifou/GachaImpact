import { randomUUID, createHmac } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { SourceChannel } from '../generated/prisma/client.js';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { buildApp } from '../src/app.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { GetCurrentGacha, PerformGachaPull } from '../src/application/gacha/gacha-services.js';
import { PrismaGachaStore } from '../src/infrastructure/database/prisma-gacha-store.js';
import { SocialService } from '../src/application/social/social-service.js';
import { TwitchEventObserver } from '../src/application/twitch/twitch-event-observer.js';
import { TwitchReceiptRetention } from '../src/application/twitch/twitch-receipt-retention.js';
import { TwitchCommandPilot } from '../src/application/twitch/twitch-command-pilot.js';
import { twitchPlayerCommandExecutor } from '../src/application/twitch/twitch-player-command-executor.js';
import { TwitchCommandSendError } from '../src/infrastructure/twitch/twitch-command-chat-client.js';
import { findChatCommand } from '../src/application/chat/chat-command-registry.js';
import { harness } from '../tests/helpers/chat-command-harness.js';
import type { PlayerCommandServices } from '../src/application/chat/player-command-core.js';
import { TwitchFavorChatPresenceConsumer } from '../src/application/twitch/twitch-favor-chat-presence-consumer.js';
import { PermanentMissionService } from '../src/application/missions/permanent-mission-service.js';
import { PrismaEconomyService } from '../src/infrastructure/database/prisma-economy-service.js';

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
beforeAll(async () => {
  await fixture.setup({ seedPublicCatalog: true });
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
  config.twitch.pilotPlayerIds = [playerId];
  const clock = { now: () => new Date((current.banner.startsAt.getTime() + current.banner.endsAt.getTime()) / 2) };
  const getPlayer = new GetCurrentPlayer({ findByIdentity: async () => { throw new Error('No Supabase identity allowed in Twitch'); }, provision: async () => { throw new Error('No web provisioning allowed'); } });
  const services = { ...harness().services, getCurrentGacha: new GetCurrentGacha(getPlayer, store),
    socialService: new SocialService(getPlayer, db, clock), performGachaPullChat: new PerformGachaPull(getPlayer, store, clock, { nextInt: upper => upper - 1 }, SourceChannel.TWITCH) } as unknown as PlayerCommandServices;
  const core = twitchPlayerCommandExecutor(db, services); business.mockImplementation((...args) => core.execute(...args));
  pilot = new TwitchCommandPilot(db, config, { execute: business }, outbound, parser);
  presence = new TwitchFavorChatPresenceConsumer(db, clock); vi.spyOn(presence, 'consume');
  app = await buildApp(config, { getOrProvisionCurrentPlayer: {} as never, authIdentityVerifier: { verify: async () => ({ subject: 'HTTP-only-fixture' }) },
    twitchEventObserver: new TwitchEventObserver(db, new TwitchReceiptRetention(db, () => 0)), twitchCommandPilot: pilot,
    twitchFavorChatPresence: presence, twitchFavorSubscriptions: specialized as never, twitchFavorGifts: specialized as never,
    twitchFavorResubs: specialized as never, twitchGiveawayConsumer: giveaway as never });
}, 60_000);
afterAll(async () => { await app?.close(); await fixture.cleanup(); }, 60_000);
function event(text = '!pull 1', chatter = '123') { return { subscription: { id: 'private-subscription', type: 'channel.chat.message', version: '1', status: 'enabled',
  condition: { broadcaster_user_id: '123', user_id: '123' }, transport: { method: 'webhook', callback: config.twitchEventSub.callbackUrl } },
  event: { chatter_user_id: chatter, chatter_user_login: 'not-authoritative', chatter_user_name: 'not-authoritative', broadcaster_user_id: '123', message_id: randomUUID(), message: { text } } }; }
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
    const before = await state(); config.twitchCommandPilot.enabled = false;
    expect((await post(signed(event()))).statusCode).toBe(204); config.twitchCommandPilot.enabled = true;
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
    expect(deliveries.map(row => row.statusCode)).toEqual([204, 204]); expect((await post(request)).statusCode).toBe(204);
    const after = await state(); expect(after.pulls - before.pulls).toBe(1); expect(after.operations - before.operations).toBe(1);
    expect(after.wallet).toBe(before.wallet - 160n); expect(after.gacha.totalPulls).toBe(before.gacha.totalPulls + 1n);
    expect(business).toHaveBeenCalledTimes(1); expect(outbound.send).toHaveBeenCalledTimes(1);
    const operation = await db.businessOperation.findFirstOrThrow({ where: { idempotencyKey: { endsWith: `:twitch-command:${request.headers['twitch-eventsub-message-id']}` } } });
    expect(operation.sourceChannel).toBe(SourceChannel.TWITCH); expect(operation.playerId).toBe(playerId);
    const receipt = await db.twitchEventReceipt.findUniqueOrThrow({ where: { externalEventId: request.headers['twitch-eventsub-message-id'] } });
    expect(receipt.state).toBe('PROCESSED'); expect(receipt.processedAt).not.toBeNull(); expect(receipt.externalReference).not.toBeNull();
    expect(await db.globalChatMessage.count()).toBe(0); expect(await db.webIdentity.count()).toBe(0);
    expect(await db.pullResult.count({ where: { pullOperation: { businessOperationId: operation.id } } })).toBe(1);
    expect(await db.resourceMovement.count({ where: { operationId: operation.id, resourceKey: 'primogems', delta: -160n } })).toBe(1);
    const completed = await state(); await post(request); expect(await state()).toEqual(completed);
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
