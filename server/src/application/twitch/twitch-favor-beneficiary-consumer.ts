import { z } from 'zod';
import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import type { Clock } from '../../domain/time/business-date.js';
import { isElementKey } from '../../domain/economy/resources.js';
import { isPrismaConcurrencyCollision } from '../../infrastructure/database/prisma-concurrency.js';
import { FavorService } from '../favor/favor-service.js';
import { subscriptionFavorTier, twitchSubscriptionProof, twitchSubscriptionMessageProof } from './twitch-subscription-proof.js';
import { lockPlayerMutation } from '../player/player-mutation-guard.js';
import { AppError } from '../../api/errors.js';
import { checkedRecoveryDeferred, deferRecoveryReceipt, recoveryDeferredError } from './twitch-recovery-deferrals.js';

const proofPayload = z.object({ subscriptionProof: twitchSubscriptionProof });
const resubPayload = z.object({ subscriptionMessageProof: twitchSubscriptionMessageProof });
type BeneficiaryEventType = 'channel.subscribe' | 'channel.subscription.message';

/** Consumes only receipts persisted by the authenticated observer; never provisions a beneficiary. */
export class TwitchFavorBeneficiaryConsumer {
  protected constructor(private readonly database: PrismaClient, private readonly clock: Clock, private readonly eventType: BeneficiaryEventType,
    private readonly favor = new FavorService(database, clock)) {}

  async consume(receiptId: string) {
    for (let attempt = 0; ; attempt++) {
      try {
        const outcome = await this.database.$transaction(async tx => {
          // Serialize terminal decisions. NO KEY UPDATE also permits the grant FK's KEY SHARE.
          await tx.$queryRaw`SELECT id FROM twitch_event_receipts WHERE id = ${receiptId}::uuid FOR NO KEY UPDATE`;
          const receipt = await tx.twitchEventReceipt.findUniqueOrThrow({ where: { id: receiptId } });
          if (receipt.eventType !== this.eventType) throw new Error('Not a subscription receipt.');
          if (receipt.state === 'PROCESSED') return receipt;
          if (receipt.state !== 'RECEIVED' || !receipt.twitchUserId) throw new Error('Invalid subscription receipt state.');
          const tier = this.eventType === 'channel.subscribe' ? proofPayload.parse(receipt.payloadMinimal).subscriptionProof.tier
            : resubPayload.parse(receipt.payloadMinimal).subscriptionMessageProof.tier;
          const finalize = (externalReference: string) => tx.twitchEventReceipt.update({ where: { id: receipt.id }, data: {
            state: 'PROCESSED', processedAt: this.clock.now(), externalReference, errorMessage: null,
          } });
          // Recover an already committed effect before re-evaluating a potentially changed identity.
          const existing = await tx.favorGrant.findUnique({ where: { twitchEventReceiptId: receipt.id }, select: { id: true } });
          if (existing) return finalize(`favor:grant:${existing.id}`);
          const deferred = checkedRecoveryDeferred(receipt, 'FAVOR');
          const identity = await tx.twitchIdentity.findUnique({ where: { twitchUserId: receipt.twitchUserId }, select: { playerId: true } });
          if (deferred && identity?.playerId !== deferred.playerId) throw recoveryDeferredError();
          if (!identity) return finalize('favor:ignored:identity-unresolved');
          await tx.$queryRaw`SELECT id FROM players WHERE id = ${identity.playerId}::uuid FOR UPDATE`;
          const player = await tx.player.findUnique({ where: { id: identity.playerId }, select: { status: true, elementKey: true } });
          if (deferred && player?.status !== 'ACTIVE') throw recoveryDeferredError();
          if (!player) return finalize('favor:ignored:player-missing');
          if (player.status !== 'ACTIVE') return finalize('favor:ignored:player-inactive');
          // Commit only the waiting proof; no entitlement is consumed before activation.
          if (await deferRecoveryReceipt(tx, receipt.id, identity.playerId, 'FAVOR')) return { recoveryPending: true } as const;
          await lockPlayerMutation(tx, identity.playerId);
          if (!player.elementKey || !isElementKey(player.elementKey)) return finalize('favor:ignored:element-missing');
          const result = await this.favor.grant({ playerId: identity.playerId,
            idempotencyKey: `eventsub:${this.eventType}:${receipt.externalEventId}`, tier: subscriptionFavorTier(tier),
            twitchEventReceiptId: receipt.id }, tx);
          return finalize(`favor:grant:${result.grantId}`);
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000, maxWait: 30_000 });
        if ('recoveryPending' in outcome) throw recoveryDeferredError();
        return outcome;
      } catch (error) {
        if (attempt < 5 && isPrismaConcurrencyCollision(error)) continue;
        if (error instanceof AppError && error.code === 'PLAYER_RECOVERY_NOT_ACTIVATED') throw new AppError(error.message, 503, error.code);
        // Infrastructure failure rolls back the decision/effect and remains retryable.
        throw error;
      }
    }
  }
}
