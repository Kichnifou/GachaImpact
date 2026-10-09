import { z } from 'zod';
import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import type { Clock } from '../../domain/time/business-date.js';
import { isElementKey } from '../../domain/economy/resources.js';
import { isPrismaConcurrencyCollision } from '../../infrastructure/database/prisma-concurrency.js';
import { FavorService } from '../favor/favor-service.js';
import { subscriptionFavorTier, twitchSubscriptionGiftProof } from './twitch-subscription-proof.js';
import { lockPlayerMutation } from '../player/player-mutation-guard.js';
import { AppError } from '../../api/errors.js';
import { checkedRecoveryDeferred, deferRecoveryReceipt, recoveryDeferredError } from './twitch-recovery-deferrals.js';

const proofPayload = z.object({ subscriptionGiftProof: twitchSubscriptionGiftProof });

/** Authenticated global gifts pay total × tier, independently of beneficiary receipts. */
export class TwitchFavorGiftConsumer {
  constructor(private readonly database: PrismaClient, private readonly clock: Clock,
    private readonly favor = new FavorService(database, clock)) {}

  async consume(receiptId: string) {
    for (let attempt = 0; ; attempt++) {
      try {
        const outcome = await this.database.$transaction(async tx => {
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
          const deferred = checkedRecoveryDeferred(receipt, 'FAVOR');
          if (deferred && proof.isAnonymous) throw recoveryDeferredError();
          if (proof.isAnonymous) return finalize('favor:gifter:ignored:anonymous');
          const identity = await tx.twitchIdentity.findUnique({ where: { twitchUserId: receipt.twitchUserId! }, select: { playerId: true } });
          if (deferred && identity?.playerId !== deferred.playerId) throw recoveryDeferredError();
          if (!identity) return finalize('favor:gifter:ignored:identity-unresolved');
          await tx.$queryRaw`SELECT id FROM players WHERE id = ${identity.playerId}::uuid FOR UPDATE`;
          const player = await tx.player.findUnique({ where: { id: identity.playerId }, select: { status: true, elementKey: true } });
          if (deferred && player?.status !== 'ACTIVE') throw recoveryDeferredError();
          if (!player) return finalize('favor:gifter:ignored:player-missing');
          if (player.status !== 'ACTIVE') return finalize('favor:gifter:ignored:player-inactive');
          if (await deferRecoveryReceipt(tx, receipt.id, identity.playerId, 'FAVOR')) return { recoveryPending: true } as const;
          await lockPlayerMutation(tx, identity.playerId);
          if (!player.elementKey || !isElementKey(player.elementKey)) return finalize('favor:gifter:ignored:element-missing');
          const result = await this.favor.creditGifterBonus({ ...input, playerId: identity.playerId }, tx);
          return finalize(`favor:gifter:${result.operationId}`);
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000, maxWait: 30_000 });
        if ('recoveryPending' in outcome) throw recoveryDeferredError();
        return outcome;
      } catch (error) {
        if (attempt < 5 && isPrismaConcurrencyCollision(error)) continue;
        if (error instanceof AppError && error.code === 'PLAYER_RECOVERY_NOT_ACTIVATED') throw new AppError(error.message, 503, error.code);
        throw error;
      }
    }
  }
}
