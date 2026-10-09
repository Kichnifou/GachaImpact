import { Prisma, type PrismaClient, type TwitchGiftSupremeCredential } from '../../../generated/prisma/client.js';
import type { Clock } from '../../domain/time/business-date.js';
import { AppError } from '../../api/errors.js';
import { isPrismaConcurrencyCollision } from '../../infrastructure/database/prisma-concurrency.js';
import { TwitchGiftHelixError, type TwitchGiftHelixClient } from '../../infrastructure/twitch/twitch-gift-helix-client.js';
import { GiftSupremeService, GIFT_SUPREME_EVENT_TYPE, type GiftSupremeInput } from '../gift-supreme/gift-supreme-service.js';
import { TwitchObservationConflict } from './twitch-event-observer.js';
import { twitchGiftSupremeRedemption } from './twitch-gift-supreme-redemption.js';
import type { TwitchGiftSupremeManager } from './twitch-gift-supreme-manager.js';
import { matchesRecoveryGiftDelivery, recoveryDeferredError } from './twitch-recovery-deferrals.js';
import { twitchResponseEntries } from './twitch-response-format.js';

const object = (value: Prisma.JsonValue | undefined): Prisma.JsonObject => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

/** Invoked exclusively AFTER the route verifies the signed raw delivery and its condition. */
export class TwitchGiftSupremeRuntime {
  constructor(private readonly db: PrismaClient, private readonly clock: Clock, private readonly manager: TwitchGiftSupremeManager) {}
  async consumeAuthenticated(payload: unknown, transport: { messageId: string; payloadHash: string }) {
    const parsed = twitchGiftSupremeRedemption.parse(payload), event = parsed.event;
    if (event.status !== 'unfulfilled') return { action: 'IGNORE' as const };
    let stage = 'identity';
    try {
      return await this.manager.withRuntime(event.broadcaster_user_id, event.reward.id, (row, helix) => {
        stage = 'delivery';
        return this.processTrustedGiftRedemption(row, helix, {
          redemptionId: event.id, rewardId: event.reward.id, gifterTwitchUserId: event.user_id,
          gifterLogin: event.user_login, gifterDisplayName: event.user_name, userInput: event.user_input, redeemedAt: event.redeemed_at,
        }, value => { stage = value; }, transport);
      });
    } catch (error) {
      this.logFailure(stage, error, event.broadcaster_user_id, event.reward.id, event.id, transport.messageId);
      if (error instanceof AppError && error.code === 'PLAYER_RECOVERY_NOT_ACTIVATED') throw new AppError(error.message, 503, error.code);
      throw error;
    }
  }
  async recoverUnfulfilled(playerId: string, options: { expectedRedemptionIds?: readonly string[] } = {}) {
    const scopeChanged = () => new AppError('Les cadeaux en attente ont changé. Vérifiez le périmètre avant de reprendre.', 409, 'TWITCH_GIFT_RECOVERY_SCOPE_CHANGED');
    const ids = options.expectedRedemptionIds;
    if (ids !== undefined && (!Array.isArray(ids) || ids.length === 0 || ids.length > 500
      || ids.some(id => typeof id !== 'string' || !id.length || id.length > 128 || id.trim() !== id)
      || new Set(ids).size !== ids.length)) throw scopeChanged();
    const expected = ids === undefined ? null : new Set(ids);
    return this.manager.withRecovery(playerId, async (row, helix) => {
      let redemptions;
      try { redemptions = await helix.listUnfulfilledRedemptions(row.playerId, row.twitchUserId, row.rewardId!); }
      catch (error) { this.logFailure('recovery-list', error, row.twitchUserId, row.rewardId!); throw error; }
      // Check the owner's own canonical list before creating a receipt or paying any target.
      if (expected && (redemptions.length !== expected.size || new Set(redemptions.map(row => row.id)).size !== expected.size
        || redemptions.some(row => !expected.has(row.id)))) throw scopeChanged();
      for (const redemption of redemptions) {
        let stage = 'recovery-token';
        try {
          await this.processTrustedGiftRedemption(row, helix, {
            redemptionId: redemption.id, rewardId: redemption.reward.id, gifterTwitchUserId: redemption.user_id,
            gifterLogin: redemption.user_login, gifterDisplayName: redemption.user_name, userInput: redemption.user_input,
            redeemedAt: redemption.redeemed_at,
          }, value => { stage = value; });
        } catch (error) {
          this.logFailure(stage, error, row.twitchUserId, row.rewardId!, redemption.id);
          throw error;
        }
      }
      return { recovered: redemptions.length };
    });
  }
  private async processTrustedGiftRedemption(row: TwitchGiftSupremeCredential, helix: TwitchGiftHelixClient,
    input: GiftSupremeInput, stage: (value: string) => void, transport?: { messageId: string; payloadHash: string }) {
      // Only a real signed EventSub notification has a transport receipt.
      if (transport) await this.recordDelivery(transport, input.redemptionId, input.rewardId, row.twitchUserId,
        input.gifterTwitchUserId);
      stage('token');
      await this.manager.tokens!.getToken(row.playerId);
      stage('core');
      const result = await new GiftSupremeService(this.db, this.clock, row.rewardId!).process(input);
      if (result.action === 'IGNORE') return result;
      if (result.action === 'DEFERRED') throw recoveryDeferredError();
      const receipt = await this.db.twitchEventReceipt.findUniqueOrThrow({ where: { externalEventId: `gift-supreme:${input.redemptionId}` } });
      const desired = result.action === 'FULFILL' ? 'FULFILLED' as const : 'CANCELED' as const;
      const journal = object(receipt.payloadMinimal), remote = object(journal['remote']);
      if (remote['settlementState'] !== desired) {
        stage('settlement');
        await helix.settle(row.playerId, row.twitchUserId, row.rewardId!, input.redemptionId, desired);
        await this.journal(receipt.id, value => ({ ...value, settlementState: desired, settledAt: this.clock.now().toISOString(),
          broadcasterId: row.twitchUserId, rewardId: row.rewardId!, announcementState: value['announcementState'] ?? 'NONE' }));
      }
      if (result.action === 'FULFILL') {
        stage('announcement');
        const gifter = typeof journal['gifterDisplayName'] === 'string' ? journal['gifterDisplayName'] : input.gifterDisplayName;
        const element = result.elementKey[0]!.toUpperCase() + result.elementKey.slice(1);
        const sourceText = `🎁 ${gifter} offre un Gift Suprême à ${result.targetDisplayName} ! +1600 particules ${element} (${result.balanceAfterParticles})`;
        const presentation = twitchResponseEntries(sourceText)[0]!;
        let message = presentation.text;
        let reserved = false;
        await this.journal(receipt.id, value => {
          if (value['announcementState'] === undefined || value['announcementState'] === 'NONE') {
            // A preexisting NONE retry may already carry the original payload.
            message = typeof value['announcementText'] === 'string' ? value['announcementText'] : presentation.text;
            reserved = true; return { ...value, announcementState: 'RESERVED', announcementText: message,
              ...(typeof value['announcementText'] !== 'string' && presentation.fullText !== undefined ? { announcementFullText: presentation.fullText } : {}), reservedAt: this.clock.now().toISOString() };
          }
          return value;
        });
        if (reserved) {
          let messageId: string;
          try { messageId = await helix.announce(row.playerId, row.twitchUserId, message); }
          catch (error) {
            this.logFailure('announcement', error, row.twitchUserId, row.rewardId!, input.redemptionId, transport?.messageId);
            const state = error instanceof TwitchGiftHelixError ? error.uncertain ? 'AMBIGUOUS' : error.upstreamStatus === 0 ? 'NONE' : 'FAILED' : 'NONE';
            await this.journal(receipt.id, value => ({ ...value, announcementState: state, announcementError: state === 'AMBIGUOUS' ? 'DISPATCH_UNCERTAIN' : 'SEND_FAILED' }));
            if (state === 'NONE') throw new AppError('Annonce Gift Suprême temporairement indisponible.', 503, 'TWITCH_GIFT_UNAVAILABLE');
            // A rejected/ambiguous announcement never invalidates the already-paid Gift.
            messageId = '';
          }
          // If this write fails after Twitch accepted, RESERVED remains durable: never auto-send again.
          if (messageId) await this.journal(receipt.id, value => ({ ...value, announcementState: 'SENT', messageId, announcedAt: this.clock.now().toISOString() }));
        }
      }
      // Recovery from canonical Helix closes every prior signed delivery as well.
      stage('delivery-complete');
      await this.db.$transaction(async tx => {
        const deliveries = await tx.twitchEventReceipt.findMany({ where: { eventType: GIFT_SUPREME_EVENT_TYPE, state: 'RECEIVED',
          payloadMinimal: { path: ['redemptionId'], equals: input.redemptionId } }, orderBy: { id: 'asc' } });
        for (const delivery of deliveries) {
          if (!matchesRecoveryGiftDelivery(delivery, { ...input, broadcasterId: row.twitchUserId }, receipt)) throw new TwitchObservationConflict();
          await tx.twitchEventReceipt.update({ where: { id: delivery.id }, data: { state: 'PROCESSED', processedAt: this.clock.now(),
            externalReference: `gift-supreme:receipt:${receipt.id}` } });
        }
      });
      return result;
  }
  private logFailure(stage: string, error: unknown, broadcasterId: string, rewardId: string, redemptionId?: string, messageId?: string) {
    const code = error instanceof AppError ? error.code : error instanceof TwitchObservationConflict ? 'TWITCH_TRANSPORT_CONFLICT'
      : error instanceof Error && 'code' in error && typeof error.code === 'string' ? error.code : 'GIFT_PROCESSING_FAILED';
    process.stderr.write(JSON.stringify({ domain: 'gift-supreme', stage, code, broadcasterId, rewardId, redemptionId, messageId }) + '\n');
  }
  private async recordDelivery(transport: { messageId: string; payloadHash: string }, redemptionId: string, rewardId: string, broadcasterId: string, gifterId: string) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.db.$transaction(async tx => {
          const existing = await tx.twitchEventReceipt.findUnique({ where: { externalEventId: transport.messageId } });
          if (existing && (existing.eventType !== GIFT_SUPREME_EVENT_TYPE || existing.payloadHash !== transport.payloadHash)) throw new TwitchObservationConflict();
          return existing ?? tx.twitchEventReceipt.create({ data: { externalEventId: transport.messageId, eventType: GIFT_SUPREME_EVENT_TYPE,
            payloadHash: transport.payloadHash, twitchUserId: gifterId, payloadMinimal: { redemptionId, rewardId, broadcasterId } } });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 5000 });
      } catch (error) { if (attempt < 3 && isPrismaConcurrencyCollision(error)) continue; throw error; }
    }
  }
  private async journal(receiptId: string, change: (remote: Prisma.JsonObject) => Prisma.JsonObject) {
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM twitch_event_receipts WHERE id = ${receiptId}::uuid FOR NO KEY UPDATE`;
      const receipt = await tx.twitchEventReceipt.findUniqueOrThrow({ where: { id: receiptId } });
      const payload = object(receipt.payloadMinimal);
      await tx.twitchEventReceipt.update({ where: { id: receiptId }, data: { payloadMinimal: { ...payload, remote: change(object(payload['remote'])) } } });
    }, { timeout: 5000 });
  }
}
