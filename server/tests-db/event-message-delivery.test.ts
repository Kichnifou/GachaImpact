import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Prisma } from '../generated/prisma/client.js';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { EventService } from '../src/application/event/event-service.js';
import { EventChatPresence } from '../src/application/event/event-chat-presence.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { PrismaCurrentPlayerStore } from '../src/infrastructure/database/prisma-current-player-store.js';
import { verifiedPlayerActor } from '../src/application/player/player-execution-actor.js';
import { lockPlayerMutation } from '../src/application/player/player-mutation-guard.js';
import { reconcileEventMessageAggregate } from '../src/application/notification/event-message-notifications.js';
import { bindEventMessageResponses, confirmEventMessageDeliveries, reconcileConfirmedEventMessages } from '../src/application/event/event-message-delivery.js';
import { getBusinessDate, businessDateToDatabaseDate } from '../src/domain/time/business-date.js';
import { twitchResponseEntries } from '../src/application/twitch/twitch-response-format.js';
import { isPrismaConcurrencyCollision } from '../src/infrastructure/database/prisma-concurrency.js';

const fixture = isolatedBatchDatabase(), db = fixture.database;
beforeAll(() => fixture.setup({ seedPublicCatalog: true }), 120_000);
afterAll(() => fixture.cleanup(), 60_000);
let year = 2190;
async function setup() {
  let now = new Date(`${year++}-10-10T12:00:00Z`);
  const events = new EventService(new GetCurrentPlayer(new PrismaCurrentPlayerStore(db)), db, { now: () => now }, { nextInt: () => 0 });
  const context = await events.resolveCurrentEdition(db, now);
  const sender = await db.player.create({ data: { displayName: 'Private sender', elementKey: 'hydro' } });
  const recipient = await db.player.create({ data: { displayName: 'Private recipient', elementKey: 'hydro' } });
  const actor = verifiedPlayerActor(recipient), senderActor = verifiedPlayerActor(sender);
  async function receive(content = 'Message privé de test') {
    return retry(async tx => {
      await lockPlayerMutation(tx, recipient.id);
      const message = await tx.eventSocialMessage.create({ data: { eventEditionId: context.edition.id, senderPlayerId: sender.id, recipientPlayerId: recipient.id, content, businessDate: businessDateToDatabaseDate(getBusinessDate(now)), createdAt: now } });
      await reconcileEventMessageAggregate(tx, recipient.id, context.edition.id, getBusinessDate(now), now, true);
      return message;
    });
  }
  const pending = () => db.eventSocialMessage.count({ where: { recipientPlayerId: recipient.id, viewedAt: null } });
  const notice = () => db.notification.findUniqueOrThrow({ where: { deduplicationKey: `event-messages:${recipient.id}:${context.edition.id}:${getBusinessDate(now)}` } });
  return { events, context, sender, recipient, actor, senderActor, receive, pending, notice, now: () => now, setNow: (value: Date) => { now = value; } };
}
async function retry<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let n = 0; ; n++) {
    try { return await db.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
    catch (error) { if (n < 4 && isPrismaConcurrencyCollision(error)) continue; throw error; }
  }
}
const sent = () => ({ status: 'SENT', messageId: randomUUID() });

describe('Event message consultation and durable Twitch confirmations in private PostgreSQL', () => {
  it('counts received messages only, clears precisely covered IDs, preserves history and reactivates a new message', async () => {
    const f = await setup(), a = await f.receive();
    expect((await f.events.getCurrent(f.actor)).gameC.unviewedCount).toBe(1);
    const b = await f.receive(); expect((await f.events.getCurrent(f.actor)).gameC.unviewedCount).toBe(2);
    expect((await f.events.getCurrent(f.senderActor)).gameC.unviewedCount).toBe(0);
    const bindings = [{ messageId: a.id, responseIndexes: [0] }, { messageId: b.id, responseIndexes: [1, 2] }];
    await retry(tx => confirmEventMessageDeliveries(tx, f.recipient.id, bindings, [sent(), sent(), { status: 'PENDING' }], f.now()));
    expect(await f.pending()).toBe(1); expect((await f.notice()).payload).toMatchObject({ count: 1 });
    await retry(tx => confirmEventMessageDeliveries(tx, f.recipient.id, bindings, [sent(), sent(), sent()], f.now()));
    expect(await f.pending()).toBe(0); expect((await f.notice()).state).toBe('RESOLVED');
    expect(await retry(tx => confirmEventMessageDeliveries(tx, f.recipient.id, bindings, [sent(), sent(), sent()], f.now()))).toBe(0);
    await f.receive('Nouveau'); expect(await f.pending()).toBe(1); expect((await f.notice()).state).toBe('UNREAD');
    expect(await db.eventSocialMessage.count({ where: { recipientPlayerId: f.recipient.id } })).toBe(3);
    expect(await db.eventSocialMessage.count({ where: { recipientPlayerId: f.sender.id } })).toBe(0);
  });
  it.each(['PENDING', 'SENDING', 'FAILED', 'AMBIGUOUS'])('preserves unread state for %s and for a different recipient', async status => {
    const f = await setup(), message = await f.receive(), binding = [{ messageId: message.id, responseIndexes: [0] }];
    expect(await retry(tx => confirmEventMessageDeliveries(tx, f.recipient.id, binding, [{ status }], f.now()))).toBe(0);
    expect(await retry(tx => confirmEventMessageDeliveries(tx, f.sender.id, binding, [sent()], f.now()))).toBe(0);
    expect(await f.pending()).toBe(1); expect((await f.notice()).state).toBe('UNREAD');
  });
  it('refuses fallback-only or unidentified SENT and maps complete-output indices through blank atoms', async () => {
    const f = await setup(), message = await f.receive(), key = randomUUID(), binding = [{ messageId: message.id, responseIndexes: [1, 2] }];
    const output = ['', 'Partie 1', 'Partie 2'];
    await db.businessOperation.create({ data: { playerId: f.recipient.id, sourceChannel: 'TWITCH', operationType: 'twitch.message.complete', idempotencyKey: `message-complete:${key}`, status: 'COMPLETED', resultSummary: { responses: output, eventMessageBindings: binding } } });
    expect(await retry(tx => bindEventMessageResponses(tx, f.recipient.id, key, output))).toEqual([{ messageId: message.id, responseIndexes: [0, 1] }]);
    expect(await retry(tx => bindEventMessageResponses(tx, f.sender.id, key, output))).toEqual([]);
    expect(await retry(tx => bindEventMessageResponses(tx, f.recipient.id, key, ['wrong']))).toEqual([]);
    await retry(tx => confirmEventMessageDeliveries(tx, f.recipient.id, [{ messageId: message.id, responseIndexes: [0] }], [{ ...sent(), fullText: 'Fallback' }], f.now()));
    await retry(tx => confirmEventMessageDeliveries(tx, f.recipient.id, [{ messageId: message.id, responseIndexes: [0] }], [{ status: 'SENT' }], f.now()));
    expect(await f.pending()).toBe(1);
  });
  it('a prepared delivery does not read a message, and an old receipt cannot block standalone consultation', async () => {
    const f = await setup(), message = await f.receive(), presence = new EventChatPresence(db, f.events);
    const intent = await presence.prepare(f.recipient, f.now()); expect(intent?.messageIds).toContain(message.id);
    const responses = await presence.deliver(f.recipient, intent!, 'prepared-only', f.now());
    expect(responses.some(text => text.includes('Message privé de test'))).toBe(true); expect(await f.pending()).toBe(1);
    expect((await presence.prepare(f.recipient, f.now()))?.messageIds).toEqual([]);
    expect((await f.events.consultGameCMessages(f.actor)).gameC.unviewedCount).toBe(0);
    expect((await f.notice()).state).toBe('RESOLVED'); expect(await db.eventSocialMessage.findUnique({ where: { id: message.id } })).not.toBeNull();
    expect(await db.businessOperation.findFirst({ where: { idempotencyKey: `event-message-delivery:${message.id}` } })).not.toBeNull();
  });
  it('serializes acknowledgement, standalone consultation and new reception without losing a message', async () => {
    const f = await setup(), old = await f.receive();
    const results = await Promise.all([
      retry(tx => confirmEventMessageDeliveries(tx, f.recipient.id, [{ messageId: old.id, responseIndexes: [0] }], [sent()], f.now())),
      f.events.consultGameCMessages(f.actor), f.receive('Concurrent nouveau'),
    ]);
    const newMessage = results[2];
    expect((await db.eventSocialMessage.findUniqueOrThrow({ where: { id: old.id } })).viewedAt).not.toBeNull();
    const pending = await f.pending(); expect(pending).toBeLessThanOrEqual(1);
    expect((await db.eventSocialMessage.findUniqueOrThrow({ where: { id: newMessage.id } })).viewedAt === null).toBe(pending === 1);
    expect((await f.events.getCurrent(f.actor)).gameC.unviewedCount).toBe(pending);
    await f.receive('Après concurrence'); expect(await f.pending()).toBe(pending + 1);
  });
  it('does not reactivate yesterday’s aggregate after Paris midnight', async () => {
    const f = await setup(), message = await f.receive(), yesterday = await f.notice();
    f.setNow(new Date(f.now().getTime() + 86_400_000));
    await f.receive('Aujourd’hui');
    await retry(tx => confirmEventMessageDeliveries(tx, f.recipient.id, [{ messageId: message.id, responseIndexes: [0] }], [sent()], f.now()));
    expect((await db.notification.findUniqueOrThrow({ where: { id: yesterday.id } })).state).toBe('RESOLVED');
    expect((await f.notice()).state).toBe('UNREAD'); expect((await f.events.getCurrent(f.actor)).gameC.unviewedCount).toBe(1);
  });
  it.each(['SENT', 'FAILED', 'AMBIGUOUS', 'SENDING', 'MISSING_IDS', 'WRONG_DELIVERY_ID', 'UNUSED_PREPARATION', 'FALLBACK', 'MISMATCH'])('reconciles historical same-day receipts only with complete precise SENT proof: %s', async condition => {
    const f = await setup(), message = await f.receive(), untouched = await f.receive('Sans preuve'), key = randomUUID();
    const responses = ['🎁 Private recipient, message de Private sender : Message privé de test'];
    for (const [operationType, idempotencyKey, resultSummary] of [
      ['event.message.delivery', `event-message-delivery:${condition === 'WRONG_DELIVERY_ID' ? untouched.id : message.id}`, { messageId: message.id, receiptKey: key }],
      ['event.presence.delivery', `event-presence:${key}`, { responses: condition === 'UNUSED_PREPARATION' ? ['Sortie préparée mais jamais envoyée'] : responses }],
      ['twitch.message.complete', `message-complete:${key}`, { responses, length: 100, normal: true }],
    ] as const) await db.businessOperation.create({ data: { playerId: f.recipient.id, sourceChannel: 'TWITCH', status: 'COMPLETED', operationType, idempotencyKey, resultSummary } });
    const entries = twitchResponseEntries(responses).map(entry => ({ ...entry, ...sent(), status: ['FAILED', 'AMBIGUOUS', 'SENDING'].includes(condition) ? condition : 'SENT', ...(condition === 'FALLBACK' ? { fullText: responses[0]! } : {}), ...(condition === 'MISMATCH' ? { text: 'Autre sortie' } : {}) }));
    const receipt = await db.twitchEventReceipt.create({ data: { externalEventId: randomUUID(), eventType: 'channel.chat.message', state: 'PROCESSED', externalReference: `command-pilot:${key}`, payloadMinimal: { messageActivity: { plan: { event: { messageIds: condition === 'MISSING_IDS' ? [] : [message.id] } } }, commandPilot: { playerId: f.recipient.id, handler: 'message', commandKey: key, stage: 'RESPONSES', responses: entries } } } });
    const before = await db.businessOperation.findMany({ where: { playerId: f.recipient.id } });
    expect(await reconcileConfirmedEventMessages(db, f.recipient.id, f.now())).toBe(condition === 'SENT' ? 1 : 0);
    expect(await f.pending()).toBe(condition === 'SENT' ? 1 : 2);
    expect((await db.eventSocialMessage.findUniqueOrThrow({ where: { id: untouched.id } })).viewedAt).toBeNull();
    expect(await db.businessOperation.findMany({ where: { playerId: f.recipient.id } })).toEqual(before);
    expect(await db.twitchEventReceipt.findUniqueOrThrow({ where: { id: receipt.id } })).toEqual(receipt);
  });
});
