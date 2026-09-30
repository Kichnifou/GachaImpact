/** Webhook read consent plus a user-token send scope; no global command transport. */
export const TWITCH_GIVEAWAY_SCOPES = ['openid', 'user:read:chat', 'user:bot', 'channel:bot', 'user:write:chat'] as const;
