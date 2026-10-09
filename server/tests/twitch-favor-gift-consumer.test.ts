import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { Prisma, type PrismaClient } from '../generated/prisma/client.js';
import type { FavorService } from '../src/application/favor/favor-service.js';
import { TwitchFavorGiftConsumer } from '../src/application/twitch/twitch-favor-gift-consumer.js';

const now = new Date('2026-09-29T12:00:00Z');
function setup(player: unknown) {
  const receipt = { id: randomUUID(), externalEventId: randomUUID(), eventType: 'channel.subscription.gift',
    state: 'RECEIVED', twitchUserId: '123', payloadMinimal: {
      subscriptionGiftProof: { broadcasterTwitchId: '12', tier: '2000', total: 10, isAnonymous: false },
    } };
  const tx = { $queryRaw: vi.fn().mockResolvedValue([{ status: 'ACTIVE', legacy_recovery: null }]),
    twitchEventReceipt: { findUniqueOrThrow: vi.fn().mockResolvedValue(receipt), update: vi.fn().mockImplementation(async ({ data }) => ({ ...receipt, ...data })) },
    twitchIdentity: { findUnique: vi.fn().mockResolvedValue({ playerId: randomUUID() }) },
    player: { findUnique: vi.fn().mockResolvedValue(player), findUniqueOrThrow: vi.fn().mockResolvedValue({ legacyRecovery: null }) },
  };
  const db = { $transaction: vi.fn().mockImplementation(async run => run(tx)) };
  const favor = { recoverGifterBonus: vi.fn().mockResolvedValue(null), creditGifterBonus: vi.fn() };
  const consumer = new TwitchFavorGiftConsumer(db as unknown as PrismaClient, { now: () => now }, favor as unknown as FavorService);
  return { receipt, tx, db, favor, consumer };
}
describe('gift consumer defensive and retry boundaries', () => {
  it.each([
    [null, 'player-missing'], [{ status: 'ACTIVE', elementKey: 'invalid' }, 'element-missing'],
  ] as const)('consumes impossible/stale Player projection %j terminally as %s without payment', async (player, reason) => {
    const value = setup(player);
    expect(await value.consumer.consume(value.receipt.id)).toMatchObject({ state: 'PROCESSED', processedAt: now, externalReference: `favor:gifter:ignored:${reason}` });
    expect(value.favor.creditGifterBonus).not.toHaveBeenCalled();
  });
  it('recognizes completed payment before any identity/player lookup', async () => {
    const value = setup(null), operationId = randomUUID();
    value.favor.recoverGifterBonus.mockResolvedValue({ operationId });
    expect((await value.consumer.consume(value.receipt.id)).externalReference).toBe(`favor:gifter:${operationId}`);
    expect(value.tx.twitchIdentity.findUnique).not.toHaveBeenCalled(); expect(value.tx.player.findUnique).not.toHaveBeenCalled();
    expect(value.favor.creditGifterBonus).not.toHaveBeenCalled();
  });
  it('does not turn a persistence failure into an ignored event', async () => {
    const value = setup(null); value.tx.twitchIdentity.findUnique.mockRejectedValue(new Error('private database unavailable'));
    await expect(value.consumer.consume(value.receipt.id)).rejects.toThrow('private database unavailable');
    expect(value.tx.twitchEventReceipt.update).not.toHaveBeenCalled(); expect(value.db.$transaction).toHaveBeenCalledOnce();
  });
  it('bounds serialization retries to five after the first attempt', async () => {
    const value = setup(null); value.db.$transaction.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('private serialization collision', { code: 'P2034', clientVersion: 'test' }));
    await expect(value.consumer.consume(value.receipt.id)).rejects.toMatchObject({ code: 'P2034' });
    expect(value.db.$transaction).toHaveBeenCalledTimes(6); expect(value.tx.twitchEventReceipt.update).not.toHaveBeenCalled();
  });
  it('rejects inconsistent anonymous proof and wrong receipt type without consuming', async () => {
    const value = setup(null); value.receipt.payloadMinimal.subscriptionGiftProof.isAnonymous = true;
    await expect(value.consumer.consume(value.receipt.id)).rejects.toThrow('Invalid gift identity proof');
    value.receipt.eventType = 'channel.subscribe';
    await expect(value.consumer.consume(value.receipt.id)).rejects.toThrow('Not a gift receipt');
    expect(value.tx.twitchEventReceipt.update).not.toHaveBeenCalled();
  });
});
