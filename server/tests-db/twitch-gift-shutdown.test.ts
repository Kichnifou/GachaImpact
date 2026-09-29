import { createHmac, randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { giftFixture, giftReward } from '../tests/helpers/twitch-gift-fixture.js';
import { TwitchGiftSupremeRuntime } from '../src/application/twitch/twitch-gift-supreme-runtime.js';
import { TwitchPilotService } from '../src/application/twitch/twitch-pilot-service.js';
import { registerTwitchEventSubRoutes } from '../src/api/routes/twitch-eventsub.js';
import { resourceKeys } from '../src/domain/economy/resources.js';

const fixture = isolatedBatchDatabase(), db = fixture.database, secret = 'private-shutdown-secret';
const apps: FastifyInstance[] = [];
let nextBroadcaster = 800000;
beforeAll(async () => { await fixture.setup({ seedPublicCatalog: true }); }, 90_000);
afterAll(async () => { for (const app of apps) await app.close(); await fixture.cleanup(); }, 60_000);
const deferred = () => { let release!: () => void; const promise = new Promise<void>(resolve => { release = resolve; }); return { promise, release }; };
async function scenario() {
  const broadcasterId = String(++nextBroadcaster), rewardId = 'reward-' + broadcasterId;
  const pilot = await db.player.create({ data: { displayName: 'Shutdown Pilot ' + broadcasterId } });
  await db.twitchIdentity.create({ data: { playerId: pilot.id, twitchUserId: broadcasterId, login: 'kichnifou' } });
  const f = giftFixture(db, pilot.id, broadcasterId); f.state.manageable.push(giftReward(rewardId, broadcasterId));
  await db.twitchGiftSupremeCredential.create({ data: { playerId: pilot.id, twitchUserId: broadcasterId,
    encryptedRefreshToken: f.row!.encryptedRefreshToken, scopes: f.row!.scopes! } });
  await f.manager.ensure(pilot.id);
  const target = await db.player.create({ data: { displayName: 'Settlement Target ' + broadcasterId, elementKey: 'pyro', progression: { create: { xp: 0n } },
    economyStats: { create: {} }, resourceBalances: { create: resourceKeys.map(resourceKey => ({ resourceKey, amount: 100n })) } } });
  const runtime = new TwitchGiftSupremeRuntime(db, { now: () => new Date('2099-09-29T12:00:00Z') }, f.manager);
  const app = Fastify({ logger: false });
  await app.register(async scoped => registerTwitchEventSubRoutes(scoped, { secret, observer: {} as never, favorSubscriptions: {} as never,
    favorGifts: {} as never, favorResubs: {} as never, favorChatPresence: {} as never, giftSupreme: runtime }));
  await app.ready(); apps.push(app);
  const service = new TwitchPilotService(db, { execute: async () => pilot } as never, f.config, undefined, f.subscriptions, f.manager);
  const body = (invalid = false) => ({ subscription: { type: 'channel.channel_points_custom_reward_redemption.add', version: '1', status: 'enabled', condition: { broadcaster_user_id: broadcasterId, reward_id: rewardId } },
    event: { id: randomUUID(), broadcaster_user_id: broadcasterId, user_id: '999999', user_login: 'outside_gifter', user_name: 'Outside Gifter',
      user_input: invalid ? 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz' : target.displayName, status: 'unfulfilled',
      reward: { id: rewardId, title: 'Gift Suprême', cost: 10000 }, redeemed_at: '2026-09-29T12:00:00Z' } });
  const post = async (value: ReturnType<typeof body>) => {
    const raw = JSON.stringify(value), messageId = randomUUID(), timestamp = new Date().toISOString();
    return app.inject({ method: 'POST', url: '/api/v1/twitch/eventsub', payload: raw, headers: { 'content-type': 'application/json',
      'twitch-eventsub-message-id': messageId, 'twitch-eventsub-message-timestamp': timestamp, 'twitch-eventsub-message-type': 'notification',
      'twitch-eventsub-message-signature': 'sha256=' + createHmac('sha256', secret).update(messageId).update(timestamp).update(raw).digest('hex') } });
  };
  const proof = (id: string) => db.twitchEventReceipt.findUniqueOrThrow({ where: { externalEventId: 'gift-supreme:' + id } });
  const retained = async () => {
    expect(f.state.manageable[0]!.is_enabled).toBe(false); expect(f.state.subscriptions.some(item => item.condition.reward_id === rewardId)).toBe(true);
    expect(await db.twitchGiftSupremeCredential.count({ where: { playerId: pilot.id } })).toBe(1);
    expect(await db.twitchIdentity.count({ where: { playerId: pilot.id } })).toBe(1);
  };
  const cleaned = async (unlinked = false) => {
    expect(f.state.manageable[0]!.is_enabled).toBe(false); expect(f.state.subscriptions.some(item => item.condition.reward_id === rewardId)).toBe(false);
    expect(await db.twitchGiftSupremeCredential.count({ where: { playerId: pilot.id } })).toBe(0);
    expect(await db.twitchIdentity.count({ where: { playerId: pilot.id } })).toBe(unlinked ? 0 : 1);
  };
  return { ...f, pilot, target, broadcasterId, rewardId, service, body, post, proof, retained, cleaned };
}
describe('Gift shutdown cannot strand local credit or cancellation, signed webhooks and private DB only', () => {
  it.each([false, true])('preserves failed %s settlement across disable, allows retry while OFF, then completes cleanup', async invalid => {
    const f = await scenario(), event = f.body(invalid); f.state.failPatch = true; f.state.unfulfilledIds.push(event.event.id);
    expect((await f.post(event)).statusCode).toBe(503);
    expect((await f.proof(event.event.id)).payloadMinimal).toMatchObject({ localOutcome: invalid ? 'INVALID' : 'SUCCESS', result: { action: invalid ? 'CANCEL' : 'FULFILL' } });
    await expect(f.manager.disable(f.pilot.id)).rejects.toMatchObject({ code: 'TWITCH_GIFT_PENDING_REDEMPTIONS' }); await f.retained();
    f.state.failPatch = false; expect((await f.post(event)).statusCode).toBe(204);
    expect((await f.proof(event.event.id)).payloadMinimal).toMatchObject({ remote: { settlementState: invalid ? 'CANCELED' : 'FULFILLED' } });
    await f.manager.disable(f.pilot.id); await f.cleaned();
    expect((await db.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId: f.target.id, resourceKey: 'particles_pyro' } } })).amount).toBe(invalid ? 100n : 1700n);
    expect(await db.businessOperation.count({ where: { playerId: f.target.id } })).toBe(invalid ? 0 : 1);
  });
  it.each([false, true])('local %s guard blocks when remote list is empty, including after reward recreation', async invalid => {
    const f = await scenario(), event = f.body(invalid); f.state.failPatch = true;
    expect((await f.post(event)).statusCode).toBe(503); // Deliberately no pending entry in the mock remote list.
    await expect(f.manager.disable(f.pilot.id)).rejects.toMatchObject({ code: 'TWITCH_GIFT_PENDING_REDEMPTIONS' }); await f.retained();
    // An older core proof still belongs to this broadcaster through its signed delivery receipt.
    const core = await f.proof(event.event.id);
    await db.twitchEventReceipt.update({ where: { id: core.id }, data: { payloadMinimal: { ...(core.payloadMinimal as object), proof: { redemptionId: event.event.id, rewardId: 'older-reward' } } } });
    await expect(f.manager.disable(f.pilot.id)).rejects.toMatchObject({ code: 'TWITCH_GIFT_PENDING_REDEMPTIONS' }); await f.retained();
    await db.twitchEventReceipt.update({ where: { id: core.id }, data: { payloadMinimal: { ...(core.payloadMinimal as object), remote: { settlementState: invalid ? 'CANCELED' : 'FULFILLED', announcementState: 'RESERVED' } } } });
    await f.manager.disable(f.pilot.id); await f.cleaned();
  });
  it('remote UNFULFILLED without a local proof preserves the delivery path', async () => {
    const f = await scenario(); f.state.unfulfilledIds.push('remote-only');
    await expect(f.manager.disable(f.pilot.id)).rejects.toMatchObject({ code: 'TWITCH_GIFT_PENDING_REDEMPTIONS' }); await f.retained();
    expect(await db.twitchEventReceipt.count({ where: { externalEventId: 'gift-supreme:remote-only' } })).toBe(0);
    f.state.unfulfilledIds = []; await f.manager.disable(f.pilot.id); await f.cleaned();
  });
  it('a signed webhook queued during quiesce finishes before phase B removes EventSub and credentials', async () => {
    const f = await scenario(), event = f.body(), entered = deferred(), gate = deferred(); f.state.unfulfilledIds.push(event.event.id);
    const update = f.manager.helix!.updateReward.bind(f.manager.helix);
    vi.spyOn(f.manager.helix!, 'updateReward').mockImplementationOnce(async (...args) => { const reward = await update(...args); entered.release(); await gate.promise; return reward; });
    const lifecycle = vi.spyOn(f.subscriptions.lifecycle, 'run');
    const stop = f.manager.disable(f.pilot.id); await entered.promise; const delivery = f.post(event);
    await vi.waitFor(() => expect(lifecycle).toHaveBeenCalledTimes(2));
    const remove = f.client.deleteSubscription.getMockImplementation()!;
    f.client.deleteSubscription.mockImplementation(async id => { expect((await f.proof(event.event.id)).payloadMinimal).toMatchObject({ remote: { settlementState: 'FULFILLED' } }); return remove(id); });
    gate.release(); expect((await delivery).statusCode).toBe(204); await stop; await f.cleaned();
  });
  it('unlink preserves all integrations while pending, then stops Gift before Chat/Favor and deletes identity', async () => {
    const f = await scenario(), event = f.body(); await f.subscriptions.ensurePilotChatSubscription(f.pilot.id); await f.subscriptions.ensurePilotFavorSubscription(f.pilot.id);
    f.state.failPatch = true; f.state.unfulfilledIds.push(event.event.id); expect((await f.post(event)).statusCode).toBe(503);
    await expect(f.service.unlink({ subject: 'private-web-subject' })).rejects.toMatchObject({ code: 'TWITCH_GIFT_PENDING_REDEMPTIONS' }); await f.retained();
    expect(f.state.subscriptions).toHaveLength(5); expect(f.client.deleteSubscription).not.toHaveBeenCalled();
    f.state.failPatch = false; expect((await f.post(event)).statusCode).toBe(204);
    const types: string[] = [], remove = f.client.deleteSubscription.getMockImplementation()!;
    f.client.deleteSubscription.mockImplementation(async id => { expect(f.state.manageable[0]!.is_enabled).toBe(false); types.push(f.state.subscriptions.find(item => item.id === id)!.type); return remove(id); });
    expect(await f.service.unlink({ subject: 'private-web-subject' })).toEqual({ linked: false }); await f.cleaned(true);
    expect(types[0]).toBe('channel.channel_points_custom_reward_redemption.add'); expect(f.state.subscriptions).toHaveLength(0);
  });
  it('reward disable failure preserves every subscription, credential and identity', async () => {
    const f = await scenario(); vi.spyOn(f.manager.helix!, 'updateReward').mockRejectedValueOnce(Error('reward stop failed'));
    await expect(f.service.unlink({ subject: 'private-web-subject' })).rejects.toThrow('reward stop failed');
    expect(f.state.manageable[0]!.is_enabled).toBe(true); expect(f.client.deleteSubscription).not.toHaveBeenCalled();
    expect(await db.twitchGiftSupremeCredential.count({ where: { playerId: f.pilot.id } })).toBe(1); expect(await db.twitchIdentity.count({ where: { playerId: f.pilot.id } })).toBe(1);
    await f.manager.disable(f.pilot.id); await f.cleaned();
  });
  it('EventSub delete failure after Reward OFF retains authorization and identity, retry succeeds', async () => {
    const f = await scenario(); f.client.deleteSubscription.mockRejectedValueOnce(Error('subscription stop failed'));
    await expect(f.service.unlink({ subject: 'private-web-subject' })).rejects.toThrow('subscription stop failed'); await f.retained();
    await f.service.unlink({ subject: 'private-web-subject' }); await f.cleaned(true);
  });
  it.each(['ambiguous', 'failed', 'success', 'reserved'])('settled Gift with %s announcement permits cleanup without redispatch', async announcement => {
    const f = await scenario(), event = f.body(); f.state.chatMode = announcement === 'reserved' ? 'success' : announcement;
    expect((await f.post(event)).statusCode).toBe(204);
    const core = await f.proof(event.event.id);
    if (announcement === 'reserved') await db.twitchEventReceipt.update({ where: { id: core.id }, data: { payloadMinimal: { ...(core.payloadMinimal as object), remote: { settlementState: 'FULFILLED', announcementState: 'RESERVED' } } } });
    const calls = f.network.mock.calls.filter(([url]) => String(url).endsWith('/chat/messages')).length;
    await f.manager.disable(f.pilot.id); await f.cleaned(); expect(f.network.mock.calls.filter(([url]) => String(url).endsWith('/chat/messages'))).toHaveLength(calls);
  });
});
