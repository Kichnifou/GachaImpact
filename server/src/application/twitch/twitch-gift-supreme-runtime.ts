import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import type { Clock } from '../../domain/time/business-date.js';
import { AppError } from '../../api/errors.js';
import { isPrismaConcurrencyCollision } from '../../infrastructure/database/prisma-concurrency.js';
import { TwitchGiftHelixError } from '../../infrastructure/twitch/twitch-gift-helix-client.js';
import { GiftSupremeService, GIFT_SUPREME_EVENT_TYPE } from '../gift-supreme/gift-supreme-service.js';
import { TwitchObservationConflict } from './twitch-event-observer.js';
import { twitchGiftSupremeRedemption, TwitchGiftSupremeRedemptionConsumer } from './twitch-gift-supreme-redemption.js';
import type { TwitchGiftSupremeManager } from './twitch-gift-supreme-manager.js';

const object = (value: Prisma.JsonValue | undefined): Prisma.JsonObject => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

/** Invoked exclusively AFTER the route verifies the signed raw delivery and its condition. */
export class TwitchGiftSupremeRuntime {
  constructor(private readonly db: PrismaClient, private readonly clock: Clock, private readonly manager: TwitchGiftSupremeManager) {}
  async consumeAuthenticated(payload: unknown, transport: { messageId: string; payloadHash: string }) {
    const parsed = twitchGiftSupremeRedemption.parse(payload), event = parsed.event;
    if (event.status !== 'unfulfilled') return { action: 'IGNORE' as const };
    return this.manager.withRuntime(event.broadcaster_user_id, event.reward.id, async (row, helix) => {
      const delivery = await this.recordDelivery(transport, event.id, event.reward.id, row.twitchUserId, event.user_id);
      const core = new GiftSupremeService(this.db, this.clock, row.rewardId!);
      const result = await new TwitchGiftSupremeRedemptionConsumer(core, row.twitchUserId).consumeAuthenticated(parsed);
      if (result.action === 'IGNORE') return result;
      const receipt = await this.db.twitchEventReceipt.findUniqueOrThrow({ where: { externalEventId: `gift-supreme:${event.id}` } });
      const desired = result.action === 'FULFILL' ? 'FULFILLED' as const : 'CANCELED' as const;
      const journal = object(receipt.payloadMinimal), remote = object(journal['remote']);
      if (remote['settlementState'] !== desired) {
        await helix.settle(row.playerId, row.twitchUserId, row.rewardId!, event.id, desired);
        await this.journal(receipt.id, value => ({ ...value, settlementState: desired, settledAt: this.clock.now().toISOString(),
          broadcasterId: row.twitchUserId, rewardId: row.rewardId!, announcementState: value['announcementState'] ?? 'NONE' }));
      }
      if (result.action === 'FULFILL') {
        let reserved = false;
        await this.journal(receipt.id, value => {
          if (value['announcementState'] === undefined || value['announcementState'] === 'NONE') {
            reserved = true; return { ...value, announcementState: 'RESERVED', reservedAt: this.clock.now().toISOString() };
          }
          return value;
        });
        if (reserved) {
          const gifter = typeof journal['gifterDisplayName'] === 'string' ? journal['gifterDisplayName'] : event.user_name;
          const element = result.elementKey[0]!.toUpperCase() + result.elementKey.slice(1);
          const message = `🎁 ${gifter} offre un Gift Suprême à ${result.targetDisplayName} ! +1 600 particules ${element}`;
          let messageId: string;
          try { messageId = await helix.announce(row.playerId, row.twitchUserId, message); }
          catch (error) {
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
      await this.db.twitchEventReceipt.update({ where: { id: delivery.id }, data: { state: 'PROCESSED', processedAt: this.clock.now(),
        externalReference: `gift-supreme:receipt:${receipt.id}` } });
      return result;
    });
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
