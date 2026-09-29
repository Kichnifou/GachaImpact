export const TWITCH_GIFT_SUPREME_SCOPES = ['openid', 'channel:manage:redemptions', 'user:write:chat'] as const;
export const GIFT_SUPREME_REWARD = {
  title: 'Gift Suprême', cost: 10_000,
  prompt: 'Saisis le nom du joueur à qui tu veux offrir le Gift Suprême.',
  is_user_input_required: true, should_redemptions_skip_request_queue: false,
} as const;
export type GiftSupremeStatusError = 'CONFLICT' | 'UNAVAILABLE' | 'MANUAL_REWARD_CONFLICT' | 'CREDENTIAL_INVALID';
