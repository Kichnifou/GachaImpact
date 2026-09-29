import { z } from 'zod';
import { GIFT_SUPREME_EVENT_TYPE, type GiftSupremeService } from '../gift-supreme/gift-supreme-service.js';

const id = z.string().trim().min(1).max(128), userId = z.string().regex(/^\d+$/);
/** Official v1 wire contract. This parser does not authenticate an EventSub delivery. */
export const twitchGiftSupremeRedemption = z.object({
  subscription: z.object({ type: z.literal(GIFT_SUPREME_EVENT_TYPE), version: z.literal('1') }),
  event: z.object({ id, broadcaster_user_id: userId, user_id: userId, user_login: z.string().min(1).max(100),
    user_name: z.string().min(1).max(100), user_input: z.string().max(500),
    status: z.enum(['unknown', 'unfulfilled', 'fulfilled', 'canceled']),
    reward: z.object({ id, title: z.string(), cost: z.number().int().nonnegative() }), redeemed_at: z.iso.datetime({ offset: true }) }),
});

/** Future authenticated transport calls this only AFTER its HMAC/envelope gate. Lot 11 has no runtime wiring. */
export class TwitchGiftSupremeRedemptionConsumer {
  constructor(private readonly gift: GiftSupremeService, private readonly broadcasterUserId: string) { userId.parse(broadcasterUserId); }
  async consumeAuthenticated(payload: unknown) {
    const { event } = twitchGiftSupremeRedemption.parse(payload);
    if (event.broadcaster_user_id !== this.broadcasterUserId) return { action: 'IGNORE' as const, reason: 'OTHER_BROADCASTER' as const };
    if (event.status !== 'unfulfilled') return { action: 'IGNORE' as const, reason: 'NOT_UNFULFILLED' as const };
    return this.gift.process({ redemptionId: event.id, rewardId: event.reward.id, gifterTwitchUserId: event.user_id,
      gifterLogin: event.user_login, gifterDisplayName: event.user_name, userInput: event.user_input, redeemedAt: event.redeemed_at });
  }
}
