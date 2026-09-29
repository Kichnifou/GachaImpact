import { z } from 'zod';
import type { FavorTier } from '../../domain/favor/favor-calendar.js';

export const twitchSubscriptionProof = z.object({
  broadcasterTwitchId: z.string().regex(/^\d+$/).max(128),
  tier: z.enum(['1000', '2000', '3000']),
  isGift: z.boolean(),
}).strict();

export type TwitchSubscriptionProof = z.infer<typeof twitchSubscriptionProof>;
export const subscriptionFavorTier = (tier: TwitchSubscriptionProof['tier']): FavorTier =>
  ({ '1000': 1, '2000': 2, '3000': 3 } as const)[tier];
