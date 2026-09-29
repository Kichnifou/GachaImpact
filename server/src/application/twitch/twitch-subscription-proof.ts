import { z } from 'zod';
import type { FavorTier } from '../../domain/favor/favor-calendar.js';

export const twitchSubscriptionProof = z.object({
  broadcasterTwitchId: z.string().regex(/^\d+$/).max(128),
  tier: z.enum(['1000', '2000', '3000']),
  isGift: z.boolean(),
}).strict();

export type TwitchSubscriptionProof = z.infer<typeof twitchSubscriptionProof>;
export const twitchSubscriptionGiftProof = z.object({
  broadcasterTwitchId: twitchSubscriptionProof.shape.broadcasterTwitchId,
  tier: twitchSubscriptionProof.shape.tier,
  total: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  isAnonymous: z.boolean(),
}).strict();
export type TwitchSubscriptionGiftProof = z.infer<typeof twitchSubscriptionGiftProof>;
export const twitchSubscriptionMessageProof = twitchSubscriptionProof.pick({ broadcasterTwitchId: true, tier: true }).strict();
export type TwitchSubscriptionMessageProof = z.infer<typeof twitchSubscriptionMessageProof>;
export const subscriptionFavorTier = (tier: TwitchSubscriptionProof['tier']): FavorTier =>
  ({ '1000': 1, '2000': 2, '3000': 3 } as const)[tier];
