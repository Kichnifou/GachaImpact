import { z } from 'zod';
import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import type { Clock } from '../../domain/time/business-date.js';
import { isElementKey } from '../../domain/economy/resources.js';
import { isPrismaConcurrencyCollision } from '../../infrastructure/database/prisma-concurrency.js';
import { FavorService } from '../favor/favor-service.js';
import { subscriptionFavorTier, twitchSubscriptionGiftProof } from './twitch-subscription-proof.js';

const proofPayload = z.object({ subscriptionGiftProof: twitchSubscriptionGiftProof });

/** Authenticated global gifts pay total × tier, independently of beneficiary receipts. */
export class TwitchFavorGiftConsumer {
  constructor(private readonly database: PrismaClient, private readonly clock: Clock,
    private readonly favor = new FavorService(database, clock)) {}

  async consume(receiptId: string) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.database.$transaction(async tx => {
          await tx.$queryRaw`SELECT id FROM twitch_event_receipts WHERE id = ${receiptId}::uuid FOR NO KEY UPDATE`;
          const receipt = await tx.twitchEventReceipt.findUniqueOrThrow({ where: { id: receiptId } });
          if (receipt.eventType !== 'channel.subscription.gift') throw new Error('Not a gift receipt.');
          if (receipt.state === 'PROCESSED') return receipt;
          if (receipt.state !== 'RECEIVED') throw new Error('Invalid gift receipt state.');
          const proof = proofPayload.parse(receipt.payloadMinimal).subscriptionGiftProof;
          if (proof.isAnonymous ? receipt.twitchUserId != null : !receipt.twitchUserId || !/^\d+$/.test(receipt.twitchUserId))
            throw new Error('Invalid gift identity proof.');
          const finalize = (externalReference: string) => tx.twitchEventReceipt.update({ where: { id: receipt.id }, data: {
            state: 'PROCESSED', processedAt: this.clock.now(), externalReference, errorMessage: null,
          } });
          const input = { tier: subscriptionFavorTier(proof.tier), total: proof.total,
            idempotencyKey: receipt.externalEventId, twitchEventReceiptId: receipt.id };
          const existing = await this.favor.recoverGifterBonus(input, tx);
          if (existing) return finalize(`favor:gifter:${existing.operationId}`);
          if (proof.isAnonymous) return finalize('favor:gifter:ignored:anonymous');
          const identity = await tx.twitchIdentity.findUnique({ where: { twitchUserId: receipt.twitchUserId! }, select: { playerId: true } });
          if (!identity) return finalize('favor:gifter:ignored:identity-unresolved');
          await tx.$queryRaw`SELECT id FROM players WHERE id = ${identity.playerId}::uuid FOR UPDATE`;
          const player = await tx.player.findUnique({ where: { id: identity.playerId }, select: { status: true, elementKey: true } });
          if (!player) return finalize('favor:gifter:ignored:player-missing');
          if (player.status !== 'ACTIVE') return finalize('favor:gifter:ignored:player-inactive');
          if (!player.elementKey || !isElementKey(player.elementKey)) return finalize('favor:gifter:ignored:element-missing');
          const result = await this.favor.creditGifterBonus({ ...input, playerId: identity.playerId }, tx);
          return finalize(`favor:gifter:${result.operationId}`);
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000, maxWait: 30_000 });
      } catch (error) {
        if (attempt < 5 && isPrismaConcurrencyCollision(error)) continue;
        throw error;
      }
    }
  }
}
