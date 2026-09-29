import { describe, expect, it, vi } from 'vitest';
import { giftFixture, giftPlayerId, giftReward } from './helpers/twitch-gift-fixture.js';
import { TwitchEventSubApiError } from '../src/infrastructure/twitch/twitch-eventsub-client.js';
const deferred = () => { let release!: () => void; const promise = new Promise<void>(resolve => { release = resolve; }); return { promise, release }; };
describe('Gift reward, EventSub and shared lifecycle', () => {
  it('allows idempotent cleanup after the credential and identity are already absent', async () => {
    const f = giftFixture(); f.row = null; f.mocks.twitchIdentity.findUnique.mockResolvedValueOnce(null as never);
    expect(await f.manager.disable(giftPlayerId)).toEqual({ giftSupremeActive: false, giftSupremePending: false });
    expect(f.request).not.toHaveBeenCalled(); expect(f.mocks.twitchIdentity.findUnique).not.toHaveBeenCalled();
  });
  it('creates the exact app-owned reward, stores its ID and ensures exact enabled EventSub', async () => {
    const f = giftFixture(); expect(await f.manager.ensure(giftPlayerId)).toEqual({ giftSupremeActive: true, giftSupremePending: false });
    expect(f.row!.rewardId).toBe('reward-1'); expect(f.state.manageable).toEqual([giftReward()]);
    expect(f.state.subscriptions[0]).toMatchObject({ type: 'channel.channel_points_custom_reward_redemption.add', version: '1',
      condition: { broadcaster_user_id: '12345', reward_id: 'reward-1' }, transport: { method: 'webhook', callback: f.config.twitchEventSub!.callbackUrl } });
    expect((await f.manager.status(giftPlayerId)).giftSupremeActive).toBe(true);
  });
  it('recovers an app-owned reward after create succeeds but DB storage fails, without duplication', async () => {
    const f = giftFixture(); const original = f.credential.updateMany.getMockImplementation()!;
    f.credential.updateMany.mockImplementation(async args => { if ('rewardId' in args.data) throw Error('simulated DB failure'); return original(args); });
    await expect(f.manager.ensure(giftPlayerId)).rejects.toThrow(); expect(f.state.manageable).toHaveLength(1);
    f.credential.updateMany.mockImplementation(original); await f.manager.ensure(giftPlayerId); expect(f.state.manageable).toHaveLength(1);
    expect(f.network.mock.calls.filter(([, opts]) => opts?.method === 'POST')).toHaveLength(1);
  });
  it('corrects only the authoritative app-owned reward when its contract drifts', async () => {
    const f = giftFixture(); f.row = { ...f.row!, rewardId: 'reward-1' }; f.state.manageable.push({ ...giftReward(), cost: 42, is_enabled: false });
    await f.manager.ensure(giftPlayerId); expect(f.state.manageable[0]).toEqual(giftReward());
  });
  it('refuses multiple exact manageable rewards and an active old manual reward without mutation', async () => {
    const f = giftFixture(); f.state.manageable.push(giftReward(), giftReward('reward-2'));
    await expect(f.manager.ensure(giftPlayerId)).rejects.toMatchObject({ code: 'TWITCH_GIFT_CONFLICT' });
    const g = giftFixture(); g.state.manual.push(giftReward('manual'));
    await expect(g.manager.ensure(giftPlayerId)).rejects.toMatchObject({ code: 'TWITCH_GIFT_MANUAL_REWARD_CONFLICT' });
    expect((await g.manager.status(giftPlayerId)).giftSupremeError).toBe('MANUAL_REWARD_CONFLICT');
    expect(g.network.mock.calls.every(([, opts]) => (opts?.method ?? 'GET') === 'GET')).toBe(true);
  });
  it('does not grant active based on a local credential, pending, reward drift or inactive remote reward', async () => {
    const f = giftFixture(); expect((await f.manager.status(giftPlayerId)).giftSupremeActive).toBe(false);
    await f.manager.ensure(giftPlayerId); f.state.subscriptions[0]!.status = 'webhook_callback_verification_pending';
    expect(await f.manager.status(giftPlayerId)).toMatchObject({ giftSupremeActive: false, giftSupremePending: true });
    f.state.manageable[0]!.is_enabled = false; expect((await f.manager.status(giftPlayerId)).giftSupremeActive).toBe(false);
    f.state.manageable[0]!.cost = 42; expect((await f.manager.status(giftPlayerId)).giftSupremeError).toBe('CONFLICT');
  });
  it.each(['callback', 'duplicate', 'reward', 'version'])('rejects %s EventSub conflicts', async kind => {
    const f = giftFixture(); await f.manager.ensure(giftPlayerId);
    if (kind === 'callback') f.state.subscriptions[0]!.transport.callback = 'https://other.example/hook';
    if (kind === 'duplicate') f.state.subscriptions.push({ ...f.state.subscriptions[0]!, id: 'duplicate' });
    if (kind === 'reward') f.state.subscriptions[0]!.condition['reward_id'] = 'other-reward';
    if (kind === 'version') f.state.subscriptions[0]!.version = '2';
    await expect(f.manager.ensure(giftPlayerId)).rejects.toMatchObject({ code: 'TWITCH_EVENTSUB_SUBSCRIPTION_CONFLICT' });
    await expect(f.manager.disable(giftPlayerId)).rejects.toMatchObject({ code: 'TWITCH_EVENTSUB_SUBSCRIPTION_CONFLICT' }); expect(f.row).not.toBeNull();
  });
  it('recovers POST 409 and DELETE 404 from authoritative inspection', async () => {
    const f = giftFixture(); const create = f.client.createGiftSupremeSubscription.getMockImplementation()!;
    f.client.createGiftSupremeSubscription.mockImplementationOnce(async args => { await create(args); throw new TwitchEventSubApiError(409); });
    await f.manager.ensure(giftPlayerId);
    f.client.deleteSubscription.mockImplementationOnce(async () => { f.state.subscriptions = []; throw new TwitchEventSubApiError(404); });
    await f.manager.disable(giftPlayerId); expect(f.row).toBeNull(); expect(f.state.manageable[0]!.is_enabled).toBe(false);
  });
  it('OFF performs no activation/status network or credential query but preserves cleanup', async () => {
    const f = giftFixture(); await f.manager.ensure(giftPlayerId); f.config.twitchGiftSupreme!.enabled = false;
    f.request.mockClear(); f.credential.findUnique.mockClear(); expect(await f.manager.status(giftPlayerId)).toMatchObject({ giftSupremeAvailable: false, giftSupremeActive: false });
    await expect(f.manager.ensure(giftPlayerId)).rejects.toMatchObject({ code: 'TWITCH_GIFT_UNAVAILABLE' }); expect(f.request).not.toHaveBeenCalled(); expect(f.credential.findUnique).not.toHaveBeenCalled();
    await f.manager.disable(giftPlayerId); expect(f.row).toBeNull(); expect(f.state.manageable[0]!.is_enabled).toBe(false);
  });
  it('runtime ignores the same title on any reward ID other than the stored one', async () => {
    const f = giftFixture(); await f.manager.ensure(giftPlayerId); const action = vi.fn();
    expect(await f.manager.withRuntime('12345', 'other-reward', action)).toEqual({ action: 'IGNORE' }); expect(action).not.toHaveBeenCalled();
  });
  it('ignores a signed Gift when the linked Twitch identity no longer matches the credential', async () => {
    const f = giftFixture(); await f.manager.ensure(giftPlayerId);
    f.mocks.twitchIdentity.findUnique.mockResolvedValueOnce({ ...f.linked, twitchUserId: '67890' });
    const action = vi.fn();
    expect(await f.manager.withRuntime('12345', 'reward-1', action)).toEqual({ action: 'IGNORE' });
    expect(action).not.toHaveBeenCalled();
  });
  it('recreates Gift EventSub after a terminal failure and ignores the terminal entry during cleanup', async () => {
    const f = giftFixture(); await f.manager.ensure(giftPlayerId);
    f.state.subscriptions[0]!.status = 'notification_failures_exceeded';
    expect(await f.subscriptions.inspectGiftSupremeUnlocked(giftPlayerId, 'reward-1')).toBe('INACTIVE');
    await f.subscriptions.assertGiftSupremeAbsentUnlocked(giftPlayerId);
    expect((await f.manager.status(giftPlayerId)).giftSupremeActive).toBe(false);
    expect(await f.manager.ensure(giftPlayerId)).toEqual({ giftSupremeActive: true, giftSupremePending: false });
    expect(f.state.subscriptions).toHaveLength(2);
    expect(f.state.subscriptions[0]!.status).toBe('notification_failures_exceeded');
    await f.manager.disable(giftPlayerId);
    expect(f.state.subscriptions).toHaveLength(1);
    expect(f.state.subscriptions[0]!.status).toBe('notification_failures_exceeded');
    expect(f.row).toBeNull();
  });
  it('accepts a signed Gift from its stored identity without Reward or EventSub live preflight', async () => {
    const f = giftFixture(); await f.manager.ensure(giftPlayerId);
    f.state.manageable[0]!.is_enabled = false; f.state.subscriptions[0]!.status = 'notification_failures_exceeded';
    const action = vi.fn(async () => 'trusted');
    const rewards = vi.spyOn(f.manager.helix!, 'rewards'); f.client.listGiftSupremeSubscriptions.mockClear();
    expect(await f.manager.withRuntime('12345', 'reward-1', action)).toBe('trusted');
    expect(action).toHaveBeenCalledOnce(); expect(rewards).not.toHaveBeenCalled();
    expect(f.client.listGiftSupremeSubscriptions).not.toHaveBeenCalled();
  });
  it.each(['eventsub', 'reward', 'credential'])('retains identity and credential on %s cleanup failure', async kind => {
    const f = giftFixture(); await f.manager.ensure(giftPlayerId);
    if (kind === 'eventsub') f.client.deleteSubscription.mockRejectedValueOnce(Error('eventsub fail'));
    if (kind === 'reward') vi.spyOn(f.manager.helix!, 'updateReward').mockRejectedValueOnce(Error('reward fail'));
    if (kind === 'credential') f.credential.deleteMany.mockRejectedValueOnce(Error('DB fail'));
    await expect(f.manager.unlink(giftPlayerId, async () => { await f.mocks.twitchIdentity.deleteMany(); })).rejects.toThrow();
    expect(f.row).not.toBeNull(); expect(f.mocks.twitchIdentity.deleteMany).not.toHaveBeenCalled();
    await f.manager.disable(giftPlayerId); expect(f.row).toBeNull(); expect(f.state.manageable[0]!.is_enabled).toBe(false); expect(f.state.subscriptions).toHaveLength(0);
  });
  it('cannot delete credential with unidentified Gift reward or EventSub after a crash', async () => {
    const f = giftFixture(); f.state.manageable.push({ ...giftReward(), cost: 42 });
    await expect(f.manager.disable(giftPlayerId)).rejects.toMatchObject({ code: 'TWITCH_GIFT_CONFLICT' }); expect(f.row).not.toBeNull();
    f.state.manageable = []; f.state.subscriptions.push({ id: 'orphan', type: 'channel.channel_points_custom_reward_redemption.add', version: '1', status: 'enabled', condition: { broadcaster_user_id: '12345', reward_id: 'unknown' }, transport: { method: 'webhook', callback: f.config.twitchEventSub!.callbackUrl } });
    await expect(f.manager.disable(giftPlayerId)).rejects.toMatchObject({ code: 'TWITCH_EVENTSUB_SUBSCRIPTION_CONFLICT' }); expect(f.row).not.toBeNull();
  });
  it.each(['disable', 'chat', 'favor', 'unlink'])('serializes Gift ensure before concurrent %s without nesting queues', async kind => {
    const f = giftFixture(), entered = deferred(), gate = deferred(); const create = f.client.createGiftSupremeSubscription.getMockImplementation()!;
    f.client.createGiftSupremeSubscription.mockImplementationOnce(async args => { entered.release(); await gate.promise; return create(args); });
    const ensure = f.manager.ensure(giftPlayerId); await entered.promise;
    const second = kind === 'disable' ? f.manager.disable(giftPlayerId) : kind === 'chat' ? f.subscriptions.ensurePilotChatSubscription(giftPlayerId)
      : kind === 'favor' ? f.subscriptions.ensurePilotFavorSubscription(giftPlayerId)
        : f.manager.unlink(giftPlayerId, async () => { await f.mocks.twitchIdentity.deleteMany(); });
    await new Promise<void>(resolve => setImmediate(resolve));
    expect(f.client.listChatSubscriptions).not.toHaveBeenCalled(); expect(f.client.listFavorSubscriptions).not.toHaveBeenCalled();
    expect(f.client.createChatSubscription).not.toHaveBeenCalled(); expect(f.credential.deleteMany).not.toHaveBeenCalled();
    gate.release(); await Promise.all([ensure, second]);
    if (kind === 'unlink' || kind === 'disable') { expect(f.row).toBeNull(); expect(f.state.subscriptions).toHaveLength(0); expect(f.state.manageable[0]!.is_enabled).toBe(false); }
    else expect(f.state.subscriptions).toHaveLength(kind === 'chat' ? 2 : 4);
  });
  it('callback credential write and ensure complete before unlink removes all integrations', async () => {
    const f = giftFixture(), entered = deferred(), gate = deferred(); const create = f.client.createGiftSupremeSubscription.getMockImplementation()!;
    f.client.createGiftSupremeSubscription.mockImplementationOnce(async args => { entered.release(); await gate.promise; return create(args); });
    const callback = f.manager.authorize({ playerId: giftPlayerId, twitchUserId: '12345', login: 'kichnifou', refreshToken: 'private-refresh', accessToken: 'private-access', scopes: ['openid', 'channel:manage:redemptions', 'user:write:chat'], expiresIn: 3600, linkedAt: f.linked.linkedAt });
    await entered.promise; const unlink = f.manager.unlink(giftPlayerId, async () => { await f.mocks.twitchIdentity.deleteMany(); });
    expect(f.mocks.twitchIdentity.deleteMany).not.toHaveBeenCalled(); gate.release(); await Promise.all([callback, unlink]);
    expect(f.row).toBeNull(); expect(f.state.subscriptions).toHaveLength(0); expect(f.state.manageable[0]!.is_enabled).toBe(false);
    f.mocks.twitchIdentity.findUnique.mockResolvedValueOnce({ ...f.linked, linkedAt: new Date(+f.linked.linkedAt + 1) });
    await expect(f.manager.authorize({ playerId: giftPlayerId, twitchUserId: '12345', login: 'kichnifou', refreshToken: 'r', accessToken: 'a', scopes: [], expiresIn: 3600, linkedAt: f.linked.linkedAt })).rejects.toMatchObject({ code: 'TWITCH_ACCOUNT_MISMATCH' });
  });
});
