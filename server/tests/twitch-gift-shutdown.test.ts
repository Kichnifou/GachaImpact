import { describe, expect, it, vi } from 'vitest';
import { giftFixture, giftPlayerId } from './helpers/twitch-gift-fixture.js';

const deferred = () => { let release!: () => void; const promise = new Promise<void>(resolve => { release = resolve; }); return { promise, release }; };
describe('Gift two-phase shutdown on the existing Player coordinator', () => {
  it('stops the reward first, inspects pending remotely, confirms EventSub absence, then deletes authorization', async () => {
    const f = giftFixture(); await f.manager.ensure(giftPlayerId); const order: string[] = [];
    const update = f.manager.helix!.updateReward.bind(f.manager.helix), pending = f.manager.helix!.hasUnfulfilledRedemptions.bind(f.manager.helix);
    vi.spyOn(f.manager.helix!, 'updateReward').mockImplementation(async (...args) => { order.push('reward-off'); return update(...args); });
    vi.spyOn(f.manager.helix!, 'hasUnfulfilledRedemptions').mockImplementation(async (...args) => { order.push('pending'); return pending(...args); });
    const remove = f.client.deleteSubscription.getMockImplementation()!, credential = f.credential.deleteMany.getMockImplementation()!;
    f.client.deleteSubscription.mockImplementation(async id => { expect(f.state.manageable[0]!.is_enabled).toBe(false); order.push('eventsub-delete'); return remove(id); });
    const list = f.client.listGiftSupremeSubscriptions.getMockImplementation()!;
    f.client.listGiftSupremeSubscriptions.mockImplementation(async () => { if (!f.state.subscriptions.length) order.push('absence'); return list(); });
    f.credential.deleteMany.mockImplementation(async () => { order.push('credential-delete'); return credential(); });
    await f.manager.disable(giftPlayerId);
    expect(order).toEqual(['reward-off', 'pending', 'eventsub-delete', 'absence', 'credential-delete']); expect(f.row).toBeNull();
  });
  it('blocks cleanup on a remote pending redemption even without a local proof, and status remains read-only', async () => {
    const f = giftFixture(); await f.manager.ensure(giftPlayerId); f.state.unfulfilledIds.push('remote-only');
    await expect(f.manager.disable(giftPlayerId)).rejects.toMatchObject({ code: 'TWITCH_GIFT_PENDING_REDEMPTIONS', statusCode: 503 });
    expect(f.row).not.toBeNull(); expect(f.state.subscriptions).toHaveLength(1); expect(f.state.manageable[0]!.is_enabled).toBe(false);
    const count = f.network.mock.calls.length;
    expect(await f.manager.status(giftPlayerId)).toMatchObject({ giftSupremeAuthorized: true, giftSupremeActive: false, giftSupremeDisabling: true });
    expect(f.network.mock.calls.slice(count).every(([, options]) => options?.method === 'GET')).toBe(true);
    f.state.unfulfilledIds = []; await f.manager.disable(giftPlayerId); expect(f.row).toBeNull();
  });
  it('blocks cleanup on the local settlement guard even when Twitch returns no pending redemption', async () => {
    const f = giftFixture(); await f.manager.ensure(giftPlayerId); f.mocks.$queryRaw.mockResolvedValueOnce([{ id: 'local-proof' }]);
    await expect(f.manager.disable(giftPlayerId)).rejects.toMatchObject({ code: 'TWITCH_GIFT_PENDING_REDEMPTIONS' });
    expect(f.client.deleteSubscription).not.toHaveBeenCalled(); expect(f.credential.deleteMany).not.toHaveBeenCalled();
  });
  it.each(['ensure', 'callback'])('drains queued jobs but refuses %s reactivation during quiesce', async kind => {
    const f = giftFixture(); await f.manager.ensure(giftPlayerId); const entered = deferred(), gate = deferred();
    const update = f.manager.helix!.updateReward.bind(f.manager.helix);
    vi.spyOn(f.manager.helix!, 'updateReward').mockImplementationOnce(async (...args) => { const disabled = await update(...args); entered.release(); await gate.promise; return disabled; });
    const stop = f.manager.disable(giftPlayerId); await entered.promise;
    const activate = kind === 'ensure' ? f.manager.ensure(giftPlayerId) : f.manager.authorize({ playerId: giftPlayerId, twitchUserId: '12345', login: 'kichnifou',
      refreshToken: 'r', accessToken: 'a', scopes: ['openid', 'channel:manage:redemptions', 'user:write:chat'], expiresIn: 3600, linkedAt: f.linked.linkedAt });
    const rejected = expect(activate).rejects.toMatchObject({ code: 'TWITCH_GIFT_SHUTDOWN_IN_PROGRESS' });
    const drain = f.manager.withRuntime('12345', 'reward-1', async () => { expect(f.row).not.toBeNull(); expect(f.state.manageable[0]!.is_enabled).toBe(false); return 'settled'; });
    const lifecycle = vi.spyOn(f.subscriptions.lifecycle, 'run');
    // withRuntime performs its credential lookup before enqueueing.
    await vi.waitFor(() => expect(lifecycle).toHaveBeenCalledOnce());
    gate.release(); expect(await drain).toBe('settled'); await rejected; await stop;
    expect(f.row).toBeNull(); expect(f.state.manageable[0]!.is_enabled).toBe(false); expect(f.credential.upsert).not.toHaveBeenCalled();
  });
  it('allows a later explicit activation after partial disable', async () => {
    const f = giftFixture(); await f.manager.ensure(giftPlayerId); f.state.unfulfilledIds.push('pending');
    await expect(f.manager.disable(giftPlayerId)).rejects.toMatchObject({ code: 'TWITCH_GIFT_PENDING_REDEMPTIONS' });
    await f.manager.ensure(giftPlayerId); expect(f.state.manageable[0]!.is_enabled).toBe(true); expect(f.state.subscriptions).toHaveLength(1);
  });
  it('rejects missing or reenabled rewards at final confirmation and preserves credentials', async () => {
    const f = giftFixture(); await f.manager.ensure(giftPlayerId);
    const remove = f.client.deleteSubscription.getMockImplementation()!;
    f.client.deleteSubscription.mockImplementationOnce(async id => { await remove(id); f.state.manageable[0]!.is_enabled = true; });
    await expect(f.manager.disable(giftPlayerId)).rejects.toMatchObject({ code: 'TWITCH_GIFT_CONFLICT' }); expect(f.row).not.toBeNull();
    f.state.manageable = []; await expect(f.manager.disable(giftPlayerId)).rejects.toMatchObject({ code: 'TWITCH_GIFT_CONFLICT' }); expect(f.row).not.toBeNull();
  });
  it('does not delete authorization when EventSub deletion was acknowledged but the subscription remains', async () => {
    const f = giftFixture(); await f.manager.ensure(giftPlayerId); f.client.deleteSubscription.mockResolvedValueOnce(undefined);
    await expect(f.manager.disable(giftPlayerId)).rejects.toMatchObject({ code: 'TWITCH_EVENTSUB_SUBSCRIPTION_CONFLICT' });
    expect(f.row).not.toBeNull(); expect(f.state.manageable[0]!.is_enabled).toBe(false);
  });
  it('keeps identity and cached authorization if conditional credential deletion did not complete', async () => {
    const f = giftFixture(); await f.manager.ensure(giftPlayerId); f.credential.deleteMany.mockResolvedValueOnce({ count: 0 });
    const invalidate = vi.spyOn(f.manager.tokens!, 'invalidate');
    await expect(f.manager.unlink(giftPlayerId, async () => { await f.mocks.twitchIdentity.deleteMany(); })).rejects.toMatchObject({ code: 'TWITCH_GIFT_CONFLICT' });
    expect(f.row).not.toBeNull(); expect(f.mocks.twitchIdentity.deleteMany).not.toHaveBeenCalled(); expect(invalidate).not.toHaveBeenCalled();
  });
  it('preserves the authoritative Reward OFF projection when EventSub inspection fails', async () => {
    const f = giftFixture(); await f.manager.ensure(giftPlayerId); f.state.unfulfilledIds.push('pending');
    await expect(f.manager.disable(giftPlayerId)).rejects.toMatchObject({ code: 'TWITCH_GIFT_PENDING_REDEMPTIONS' });
    f.client.listGiftSupremeSubscriptions.mockRejectedValueOnce(Error('subscription inspection unavailable'));
    expect(await f.manager.status(giftPlayerId)).toMatchObject({ giftSupremeActive: false, giftSupremeDisabling: true, giftSupremeError: 'UNAVAILABLE' });
    expect(f.state.manageable[0]!.is_enabled).toBe(false);
  });
});
