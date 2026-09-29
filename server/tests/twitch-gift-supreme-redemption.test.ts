import { describe, expect, it, vi } from 'vitest';
import { type GiftSupremeService, GIFT_SUPREME_EVENT_TYPE } from '../src/application/gift-supreme/gift-supreme-service.js';
import { twitchGiftSupremeRedemption, TwitchGiftSupremeRedemptionConsumer } from '../src/application/twitch/twitch-gift-supreme-redemption.js';

const payload = () => ({ subscription: { type: GIFT_SUPREME_EVENT_TYPE, version: '1' }, event: {
  id: 'redemption', broadcaster_user_id: '123', user_id: '456', user_login: 'gifter', user_name: 'Gifter', user_input: '@Bob',
  status: 'unfulfilled', reward: { id: 'test-reward', title: 'Gift Suprême', cost: 10_000 }, redeemed_at: '2026-09-29T12:00:00.1234567Z',
} });
describe('inert Gift Suprême authenticated-adapter boundary', () => {
  it('parses the official v1 fields and forwards server input only', async () => {
    const process = vi.fn().mockResolvedValue({ action: 'CANCEL', reason: 'TARGET_NOT_FOUND' });
    const consumer = new TwitchGiftSupremeRedemptionConsumer({ process } as unknown as GiftSupremeService, '123');
    expect(await consumer.consumeAuthenticated(payload())).toEqual({ action: 'CANCEL', reason: 'TARGET_NOT_FOUND' });
    expect(process).toHaveBeenCalledExactlyOnceWith({ redemptionId: 'redemption', rewardId: 'test-reward', gifterTwitchUserId: '456',
      gifterLogin: 'gifter', gifterDisplayName: 'Gifter', userInput: '@Bob', redeemedAt: '2026-09-29T12:00:00.1234567Z' });
  });
  it.each(['id', 'broadcaster_user_id', 'user_id', 'user_login', 'user_name', 'user_input', 'status', 'reward', 'redeemed_at'])('requires event field %s', key => {
    const wire = payload(); delete (wire.event as Record<string, unknown>)[key]; expect(twitchGiftSupremeRedemption.safeParse(wire).success).toBe(false);
  });
  it.each(['type', 'version', 'cost', 'date', 'status'])('rejects invalid %s', mode => {
    const wire = payload(); if (mode === 'type') wire.subscription.type = 'channel.chat.message';
    if (mode === 'version') wire.subscription.version = '2'; if (mode === 'cost') wire.event.reward.cost = -1;
    if (mode === 'date') wire.event.redeemed_at = 'invalid'; if (mode === 'status') wire.event.status = 'whatever';
    expect(twitchGiftSupremeRedemption.safeParse(wire).success).toBe(false);
  });
  it.each(['other-broadcaster', 'fulfilled', 'canceled', 'unknown'])('has no business effect for %s', async mode => {
    const wire = payload(), process = vi.fn();
    if (mode === 'other-broadcaster') wire.event.broadcaster_user_id = '999'; else wire.event.status = mode;
    expect((await new TwitchGiftSupremeRedemptionConsumer({ process } as unknown as GiftSupremeService, '123').consumeAuthenticated(wire)).action).toBe('IGNORE');
    expect(process).not.toHaveBeenCalled();
  });
});
