import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { FavorService } from '../src/application/favor/favor-service.js';
import { TwitchFavorSubscriptionConsumer } from '../src/application/twitch/twitch-favor-subscription-consumer.js';

function setup() {
  const receipt = { id: 'receipt-id', eventType: 'channel.subscribe', externalEventId: 'message-id', twitchUserId: '34',
    state: 'RECEIVED', payloadMinimal: { subscriptionProof: { broadcasterTwitchId: '12', tier: '1000', isGift: false } } };
  const tx = { $queryRaw: vi.fn().mockResolvedValue([]),
    twitchEventReceipt: { findUniqueOrThrow: vi.fn().mockResolvedValue(receipt), update: vi.fn().mockResolvedValue({ state: 'PROCESSED' }) },
    favorGrant: { findUnique: vi.fn().mockResolvedValue(null) },
    twitchIdentity: { findUnique: vi.fn().mockResolvedValue({ playerId: 'missing-player' }) },
    player: { findUnique: vi.fn().mockResolvedValue(null) },
  };
  const transaction = vi.fn().mockImplementation(run => run(tx)), grant = vi.fn();
  const consumer = new TwitchFavorSubscriptionConsumer({ $transaction: transaction } as unknown as PrismaClient,
    { now: () => new Date('2026-09-29T12:00:00Z') }, { grant } as unknown as FavorService);
  return { consumer, receipt, tx, grant, transaction };
}

describe('subscription consumer defensive boundary', () => {
  it('consumes a missing Player without provisioning or calling the core (FK normally prevents this state)', async () => {
    const { consumer, tx, grant } = setup();
    await consumer.consume('receipt-id');
    expect(tx.twitchEventReceipt.update).toHaveBeenCalledWith({ where: { id: 'receipt-id' }, data: {
      state: 'PROCESSED', processedAt: new Date('2026-09-29T12:00:00Z'), externalReference: 'favor:ignored:player-missing', errorMessage: null,
    } });
    expect(grant).not.toHaveBeenCalled();
  });
  it('returns terminal receipts without resolving a newly linked beneficiary', async () => {
    const { consumer, receipt, tx, grant } = setup(); receipt.state = 'PROCESSED';
    expect(await consumer.consume('receipt-id')).toBe(receipt);
    expect(tx.twitchIdentity.findUnique).not.toHaveBeenCalled(); expect(grant).not.toHaveBeenCalled();
    expect(tx.twitchEventReceipt.update).not.toHaveBeenCalled();
  });
  it.each(['event-type', 'state', 'proof'] as const)('rejects invalid %s without marking it ignored', async invalid => {
    const { consumer, receipt, tx, grant } = setup();
    if (invalid === 'event-type') receipt.eventType = 'channel.chat.message';
    if (invalid === 'state') receipt.state = 'FAILED';
    if (invalid === 'proof') receipt.payloadMinimal.subscriptionProof.tier = '4000';
    await expect(consumer.consume('receipt-id')).rejects.toThrow();
    expect(tx.twitchEventReceipt.update).not.toHaveBeenCalled(); expect(grant).not.toHaveBeenCalled();
  });
  it('bounds serialization retries and leaves infrastructure errors to the caller', async () => {
    const { consumer, transaction } = setup();
    transaction.mockRejectedValue({ kind: 'TransactionWriteConflict' });
    await expect(consumer.consume('receipt-id')).rejects.toMatchObject({ kind: 'TransactionWriteConflict' });
    expect(transaction).toHaveBeenCalledTimes(6);
    transaction.mockClear().mockRejectedValue(new Error('private DB unavailable'));
    await expect(consumer.consume('receipt-id')).rejects.toThrow('private DB unavailable');
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});
