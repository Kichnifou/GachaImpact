import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { TwitchEventObserver, TwitchObservationConflict } from '../src/application/twitch/twitch-event-observer.js';

const fixture = isolatedBatchDatabase();
const db = fixture.database;
const observer = new TwitchEventObserver(db);
let knownPlayerId: string;

beforeAll(async () => {
  await fixture.setup();
  const player = await db.player.create({ data: { displayName: 'Private Twitch observer fixture' } });
  knownPlayerId = player.id;
  await db.twitchIdentity.create({ data: { playerId: player.id, twitchUserId: '123456789', login: 'known_viewer' } });
}, 60_000);
afterAll(() => fixture.cleanup(), 60_000);

const event = (id = randomUUID()) => ({ externalEventId: id, eventType: 'channel.chat.message', twitchUserId: '123456789',
  login: 'known_viewer', displayName: 'Known Viewer', sourceTimestamp: '2026-09-27T16:00:00Z', contentHash: 'a'.repeat(64) });

describe('Twitch runtime phase 1 observation only', () => {
  it('creates one receipt, resolves durable Twitch User ID and replays the exact event', async () => {
    const input = event();
    const first = await observer.observeTwitchEvent(input);
    expect(first).toMatchObject({ duplicate: false, playerId: knownPlayerId, identity: 'resolved' });
    expect(first.receipt).toMatchObject({ externalEventId: input.externalEventId, eventType: input.eventType,
      twitchUserId: input.twitchUserId, state: 'RECEIVED', processedAt: null });
    expect(first.receipt.payloadMinimal).toMatchObject({ login: 'known_viewer', sourceTimestamp: '2026-09-27T16:00:00.000Z', contentHash: 'a'.repeat(64) });
    expect(first.receipt.payloadHash).toMatch(/^[0-9a-f]{64}$/);
    const replay = await observer.observeTwitchEvent(input);
    expect(replay).toMatchObject({ duplicate: true, playerId: knownPlayerId, identity: 'resolved' });
    expect(replay.receipt.id).toBe(first.receipt.id);
    expect(await db.twitchEventReceipt.count({ where: { externalEventId: input.externalEventId } })).toBe(1);
  });

  it('rejects a contradictory payload under the same external ID without altering the receipt', async () => {
    const input = event();
    const original = await observer.observeTwitchEvent(input);
    await expect(observer.observeTwitchEvent({ ...input, contentHash: 'b'.repeat(64) })).rejects.toBeInstanceOf(TwitchObservationConflict);
    await expect(observer.observeTwitchEvent({ ...input, twitchUserId: '987654321' })).rejects.toBeInstanceOf(TwitchObservationConflict);
    expect((await db.twitchEventReceipt.findUniqueOrThrow({ where: { externalEventId: input.externalEventId } })).payloadHash).toBe(original.receipt.payloadHash);
  });

  it('keeps unknown Twitch User IDs unresolved without guessing a Player from login', async () => {
    const input = { ...event(), twitchUserId: '987654321', login: 'known_viewer' };
    const playersBefore = await db.player.count();
    const observed = await observer.observeTwitchEvent(input);
    expect(observed).toMatchObject({ duplicate: false, playerId: null, identity: 'unresolved' });
    expect(await db.player.count()).toBe(playersBefore);
    expect(await db.twitchIdentity.count()).toBe(1);
  });

  it('serializes concurrent observations of one event and produces no gameplay, chat or Twitch output', async () => {
    const input = event();
    const [first, second] = await Promise.all([observer.observeTwitchEvent(input), observer.observeTwitchEvent(input)]);
    expect([first.duplicate, second.duplicate].sort()).toEqual([false, true]);
    expect(first.receipt.id).toBe(second.receipt.id);
    expect(await db.twitchEventReceipt.count({ where: { externalEventId: input.externalEventId } })).toBe(1);
    expect(await db.businessOperation.count()).toBe(0);
    expect(await db.resourceMovement.count()).toBe(0);
    expect(await db.playerProgression.count()).toBe(0);
    expect(await db.globalChatMessage.count()).toBe(0);
    expect(await db.directMessage.count()).toBe(0);
    expect(await db.notification.count()).toBe(0);
  });
});
