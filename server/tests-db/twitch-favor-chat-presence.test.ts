import { createHmac, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { buildApp } from '../src/app.js';
import { FavorService } from '../src/application/favor/favor-service.js';
import { CurrentPlayerFavorService } from '../src/application/favor/current-player-favor-service.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { PrismaCurrentPlayerStore } from '../src/infrastructure/database/prisma-current-player-store.js';
import { TwitchEventObserver } from '../src/application/twitch/twitch-event-observer.js';
import { TwitchReceiptRetention } from '../src/application/twitch/twitch-receipt-retention.js';
import { TwitchFavorChatPresenceConsumer } from '../src/application/twitch/twitch-favor-chat-presence-consumer.js';
import { TwitchFavorSubscriptionConsumer } from '../src/application/twitch/twitch-favor-subscription-consumer.js';
import { TwitchFavorGiftConsumer } from '../src/application/twitch/twitch-favor-gift-consumer.js';
import { TwitchFavorResubConsumer } from '../src/application/twitch/twitch-favor-resub-consumer.js';
import { resourceKeys } from '../src/domain/economy/resources.js';

const fixture = isolatedBatchDatabase(), db = fixture.database;
let now = new Date('2099-09-10T12:00:00Z');
const clock = { now: () => now }, secret = 'private-favor-chat-secret';
const consumer = new TwitchFavorChatPresenceConsumer(db, clock);
const favor = new FavorService(db, clock);
const standalone = new CurrentPlayerFavorService(new GetCurrentPlayer(new PrismaCurrentPlayerStore(db)), favor);
let app: FastifyInstance, sequence = 500_000;
beforeAll(async () => {
  await fixture.setup({ seedPublicCatalog: true });
  // Retention is exercised explicitly below, without background fixture maintenance.
  const observer = new TwitchEventObserver(db, { maybeCleanup() {} } as TwitchReceiptRetention);
  app = await buildApp({ host: '127.0.0.1', port: 3001, supabase: {}, twitchEventSub: { enabled: true, secret } }, {
    authIdentityVerifier: { verify: async () => ({ subject: 'fixture' }) }, getOrProvisionCurrentPlayer: {} as never,
    twitchEventObserver: observer, twitchFavorChatPresence: consumer,
    twitchFavorSubscriptions: new TwitchFavorSubscriptionConsumer(db, clock), twitchFavorGifts: new TwitchFavorGiftConsumer(db, clock), twitchFavorResubs: new TwitchFavorResubConsumer(db, clock),
  });
}, 60_000);
afterAll(async () => { await app?.close(); await fixture.cleanup(); }, 60_000);

async function player(options: { linked?: boolean; active?: boolean; favorActive?: boolean; element?: boolean } = {}) {
  const id = randomUUID(), twitchUserId = String(sequence++);
  await db.player.create({ data: { id, displayName: `Favor chat ${twitchUserId}`, status: options.active === false ? 'ARCHIVED' : 'ACTIVE', elementKey: options.element === false ? null : 'pyro',
    webIdentity: { create: { provider: 'supabase', providerSubject: id } }, progression: { create: { xp: 0n } }, economyStats: { create: {} },
    resourceBalances: { create: resourceKeys.map(resourceKey => ({ resourceKey, amount: 0n })) },
    favorState: { create: options.favorActive === false ? {} : { activeFromDate: new Date('2099-09-10'), activeUntilDate: new Date('2099-10-09') } },
  } });
  await db.playerPermanentMissionState.create({ data: { playerId: id, initializedAt: clock.now(), standaloneCatchupCompletedAt: clock.now() } });
  if (options.linked !== false) await db.twitchIdentity.create({ data: { playerId: id, twitchUserId, login: 'private_fixture', linkedAt: new Date('2020-01-01') } });
  return { id, twitchUserId };
}
function delivery(twitchUserId: string, text = 'bonjour', id = randomUUID()) {
  const payload = JSON.stringify({ subscription: { type: 'channel.chat.message', version: '1' }, event: { chatter_user_id: twitchUserId, message: { text } } });
  const timestamp = new Date().toISOString();
  const signature = createHmac('sha256', secret).update(id).update(timestamp).update(payload).digest('hex');
  return { id, request: { method: 'POST' as const, url: '/api/v1/twitch/eventsub', payload, headers: { 'content-type': 'application/json', 'twitch-eventsub-message-id': id, 'twitch-eventsub-message-timestamp': timestamp, 'twitch-eventsub-message-signature': `sha256=${signature}`, 'twitch-eventsub-message-type': 'notification' } } };
}
async function economics(id: string) {
  return { claims: await db.favorDailyClaim.count({ where: { playerId: id } }), operations: await db.businessOperation.count({ where: { playerId: id } }),
    movements: await db.resourceMovement.count({ where: { playerId: id } }),
    wallet: (await db.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId: id, resourceKey: 'primogems' } } })).amount };
}
async function volatileReceipt(externalEventId: string) {
  const receipt = await db.twitchEventReceipt.findUniqueOrThrow({ where: { externalEventId } });
  expect(receipt).toMatchObject({ state: 'RECEIVED', processedAt: null, externalReference: null });
  expect(await db.favorGrant.count({ where: { twitchEventReceiptId: receipt.id } })).toBe(0);
  return receipt;
}

describe('signed Twitch Favor daily presence', () => {
  it('pays TWITCH once across second message and exact Message ID retry without storing text', async () => {
    const p = await player(), first = delivery(p.twitchUserId, 'un texte privé qui ne doit pas être stocké');
    expect((await app.inject(first.request)).statusCode).toBe(204);
    expect((await app.inject(first.request)).statusCode).toBe(204);
    expect((await app.inject(delivery(p.twitchUserId).request)).statusCode).toBe(204);
    expect(await economics(p.id)).toEqual({ claims: 1, operations: 1, movements: 1, wallet: 800n });
    expect(await db.favorDailyClaim.findFirst({ where: { playerId: p.id } })).toMatchObject({ sourceChannel: 'TWITCH', origin: 'NATIVE' });
    expect(await db.businessOperation.findFirst({ where: { playerId: p.id } })).toMatchObject({ operationType: 'favor.daily-claim', sourceChannel: 'TWITCH', status: 'COMPLETED' });
    expect(await db.resourceMovement.findFirst({ where: { playerId: p.id } })).toMatchObject({ sourceChannel: 'TWITCH', resourceKey: 'primogems', delta: 800n });
    expect(await db.playerProgression.findUniqueOrThrow({ where: { playerId: p.id } })).toMatchObject({ xp: 0n, totalMessages: 0n, countedMessages: 0n, lastXpMessageAt: null });
    expect(await db.playerEconomyStats.findUniqueOrThrow({ where: { playerId: p.id } })).toMatchObject({ totalPrimosEarned: 800n });
    const receipt = await volatileReceipt(first.id);
    expect(JSON.stringify(receipt.payloadMinimal)).not.toContain('un texte privé');
    expect(receipt.payloadMinimal).toHaveProperty('contentHash');
    expect(await db.globalChatMessage.count()).toBe(0);
    expect(await db.playerActivityState.count()).toBe(0);
    expect(await db.businessOperation.count({ where: { operationType: { contains: 'mission' } } })).toBe(0);
  });
  it('serializes two concurrent Twitch messages to exactly one daily credit', async () => {
    const p = await player();
    const responses = await Promise.all([app.inject(delivery(p.twitchUserId).request), app.inject(delivery(p.twitchUserId, 'second').request)]);
    expect(responses.map(r => r.statusCode)).toEqual([204, 204]);
    expect(await economics(p.id)).toEqual({ claims: 1, operations: 1, movements: 1, wallet: 800n });
  });
  it.each(['unknown', 'inactive', 'favor-inactive', 'command', 'indented-command', 'empty'] as const)('observes %s without provisioning or payment', async mode => {
    const p = await player({ linked: mode !== 'unknown', active: mode !== 'inactive', favorActive: mode !== 'favor-inactive' });
    const before = { players: await db.player.count(), identities: await db.twitchIdentity.count() };
    const text = mode === 'command' ? '!faveur' : mode === 'indented-command' ? '   !pull 1' : mode === 'empty' ? ' \t ' : 'bonjour';
    const sent = delivery(p.twitchUserId, text);
    expect((await app.inject(sent.request)).statusCode).toBe(204);
    expect(await economics(p.id)).toEqual({ claims: 0, operations: 0, movements: 0, wallet: 0n });
    expect({ players: await db.player.count(), identities: await db.twitchIdentity.count() }).toEqual(before);
    await volatileReceipt(sent.id);
  });
  it.each(['link', 'relink'] as const)('ignores an old unresolved receipt after a later %s', async mode => {
    const p = await player({ linked: mode === 'relink' }), sent = delivery(p.twitchUserId);
    if (mode === 'relink') await db.twitchIdentity.delete({ where: { playerId: p.id } });
    expect((await app.inject(sent.request)).statusCode).toBe(204);
    const receipt = await volatileReceipt(sent.id);
    await db.twitchIdentity.create({ data: { playerId: p.id, twitchUserId: p.twitchUserId, login: 'private_fixture', linkedAt: new Date(+receipt.receivedAt + 1) } });
    expect((await app.inject(sent.request)).statusCode).toBe(204);
    expect(await economics(p.id)).toEqual({ claims: 0, operations: 0, movements: 0, wallet: 0n });
  });
  it('shares UI-first, Twitch-first and concurrent UI/Twitch claims with no second standalone animation', async () => {
    const ui = await player(), twitch = await player(), concurrent = await player();
    expect((await standalone.presence({ subject: ui.id })).status).toBe('CLAIMED');
    expect((await app.inject(delivery(ui.twitchUserId).request)).statusCode).toBe(204);
    expect((await app.inject(delivery(twitch.twitchUserId).request)).statusCode).toBe(204);
    const presence = await standalone.presence({ subject: twitch.id });
    expect(presence).toMatchObject({ status: 'ALREADY_CLAIMED', creditedPrimogems: '0', favor: { claimedToday: true, claimStatus: 'CLAIMED' } });
    await Promise.all([standalone.presence({ subject: concurrent.id }), app.inject(delivery(concurrent.twitchUserId).request)]);
    for (const p of [ui, twitch, concurrent]) expect(await economics(p.id)).toEqual({ claims: 1, operations: 1, movements: 1, wallet: 800n });
  });
  it('claims the next server business date without requiring an element again', async () => {
    const p = await player({ element: false });
    try {
      expect((await app.inject(delivery(p.twitchUserId).request)).statusCode).toBe(204);
      now = new Date('2099-09-11T12:00:00Z');
      expect((await app.inject(delivery(p.twitchUserId).request)).statusCode).toBe(204);
      expect(await economics(p.id)).toEqual({ claims: 2, operations: 2, movements: 2, wallet: 1600n });
    } finally { now = new Date('2099-09-10T12:00:00Z'); }
  });
  it.each([false, true])('recovers infrastructure failure after observation (payment already committed = %s)', async paid => {
    const p = await player(), sent = delivery(p.twitchUserId), original = consumer.consume.bind(consumer);
    const failure = vi.spyOn(consumer, 'consume').mockImplementationOnce(async receiptId => { if (paid) await original(receiptId); throw new Error('private infrastructure failure'); });
    try {
      expect((await app.inject(sent.request)).statusCode).toBe(500);
      await volatileReceipt(sent.id);
      expect((await app.inject(sent.request)).statusCode).toBe(204);
      expect(await economics(p.id)).toEqual({ claims: 1, operations: 1, movements: 1, wallet: 800n });
    } finally { failure.mockRestore(); }
  });
  it('purges an older than 24h Chat receipt while preserving the durable daily payment', async () => {
    const p = await player(), sent = delivery(p.twitchUserId);
    expect((await app.inject(sent.request)).statusCode).toBe(204);
    const receipt = await volatileReceipt(sent.id), before = await economics(p.id);
    await db.twitchEventReceipt.update({ where: { id: receipt.id }, data: { receivedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) } });
    const retention = new TwitchReceiptRetention(db);
    retention.maybeCleanup();
    for (let attempt = 0; attempt < 100 && await db.twitchEventReceipt.count({ where: { id: receipt.id } }); attempt++) await new Promise(resolve => setTimeout(resolve, 20));
    expect(await db.twitchEventReceipt.count({ where: { id: receipt.id } })).toBe(0);
    expect(await economics(p.id)).toEqual(before);
  });
});
