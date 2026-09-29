import { z } from 'zod';
import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import type { Clock } from '../../domain/time/business-date.js';
import { isElementKey } from '../../domain/economy/resources.js';
import { isPrismaConcurrencyCollision } from '../../infrastructure/database/prisma-concurrency.js';
import { FavorService } from '../favor/favor-service.js';
import { subscriptionFavorTier, twitchSubscriptionProof } from './twitch-subscription-proof.js';

const proofPayload = z.object({ subscriptionProof: twitchSubscriptionProof });
export const subscriptionFavorKey = (messageId: string) => `eventsub:channel.subscribe:${messageId}`;

/** Consumes only receipts persisted by the authenticated observer; never provisions a beneficiary. */
export class TwitchFavorSubscriptionConsumer {
  constructor(private readonly database: PrismaClient, private readonly clock: Clock,
    private readonly favor = new FavorService(database, clock)) {}

  async consume(receiptId: string) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.database.$transaction(async tx => {
          // Serialize terminal decisions. NO KEY UPDATE also permits the grant FK's KEY SHARE.
          await tx.$queryRaw`SELECT id FROM twitch_event_receipts WHERE id = ${receiptId}::uuid FOR NO KEY UPDATE`;
          const receipt = await tx.twitchEventReceipt.findUniqueOrThrow({ where: { id: receiptId } });
          if (receipt.eventType !== 'channel.subscribe') throw new Error('Not a subscription receipt.');
          if (receipt.state === 'PROCESSED') return receipt;
          if (receipt.state !== 'RECEIVED' || !receipt.twitchUserId) throw new Error('Invalid subscription receipt state.');
          const proof = proofPayload.parse(receipt.payloadMinimal).subscriptionProof;
          const finalize = (externalReference: string) => tx.twitchEventReceipt.update({ where: { id: receipt.id }, data: {
            state: 'PROCESSED', processedAt: this.clock.now(), externalReference, errorMessage: null,
          } });
          // Recover an already committed effect before re-evaluating a potentially changed identity.
          const existing = await tx.favorGrant.findUnique({ where: { twitchEventReceiptId: receipt.id }, select: { id: true } });
          if (existing) return finalize(`favor:grant:${existing.id}`);
          const identity = await tx.twitchIdentity.findUnique({ where: { twitchUserId: receipt.twitchUserId }, select: { playerId: true } });
          if (!identity) return finalize('favor:ignored:identity-unresolved');
          const player = await tx.player.findUnique({ where: { id: identity.playerId }, select: { status: true, elementKey: true } });
          if (!player) return finalize('favor:ignored:player-missing');
          if (player.status !== 'ACTIVE') return finalize('favor:ignored:player-inactive');
          if (!player.elementKey || !isElementKey(player.elementKey)) return finalize('favor:ignored:element-missing');
          const result = await this.favor.grant({ playerId: identity.playerId,
            idempotencyKey: subscriptionFavorKey(receipt.externalEventId), tier: subscriptionFavorTier(proof.tier),
            twitchEventReceiptId: receipt.id }, tx);
          return finalize(`favor:grant:${result.grantId}`);
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000, maxWait: 30_000 });
      } catch (error) {
        if (attempt < 5 && isPrismaConcurrencyCollision(error)) continue;
        // Infrastructure failure rolls back the decision/effect and remains retryable.
        throw error;
      }
    }
  }
}
