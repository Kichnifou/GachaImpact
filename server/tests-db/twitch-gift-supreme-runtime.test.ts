import { createHmac, randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { giftFixture } from '../tests/helpers/twitch-gift-fixture.js';
import { TwitchGiftSupremeRuntime } from '../src/application/twitch/twitch-gift-supreme-runtime.js';
import { TwitchGiftSupremeManager } from '../src/application/twitch/twitch-gift-supreme-manager.js';
import { TwitchEventSubSubscriptionManager } from '../src/application/twitch/twitch-eventsub-subscription-manager.js';
import { TwitchGiftHelixError } from '../src/infrastructure/twitch/twitch-gift-helix-client.js';
import type { TwitchEventSubClient } from '../src/infrastructure/twitch/twitch-eventsub-client.js';
import { registerTwitchEventSubRoutes } from '../src/api/routes/twitch-eventsub.js';
import { resourceKeys } from '../src/domain/economy/resources.js';

const fixture = isolatedBatchDatabase(), db = fixture.database, clock = { now: () => new Date('2099-09-29T12:00:00Z') }, secret = 'private-gift-eventsub-secret';
let f: ReturnType<typeof giftFixture>, runtime: TwitchGiftSupremeRuntime, app: FastifyInstance;
const apps: FastifyInstance[] = [];
async function makeApp(consumer?: TwitchGiftSupremeRuntime) {
  const value = Fastify({ logger: false });
  await value.register(async scoped => registerTwitchEventSubRoutes(scoped, { secret, observer: {} as never, favorSubscriptions: {} as never, favorGifts: {} as never,
    favorResubs: {} as never, favorChatPresence: {} as never, giftSupreme: consumer }));
  await value.ready(); apps.push(value); return value;
}
beforeAll(async () => {
  await fixture.setup({ seedPublicCatalog: true });
  await fixture.admin.query('DROP TABLE twitch_gift_supreme_credentials');
  await fixture.installMigrationOnlySql(new URL('../prisma/migrations/20260929151500_055_add_twitch_gift_supreme_credential/migration.sql', import.meta.url));
  const pilot = await db.player.create({ data: { displayName: 'Gift Runtime Pilot' } });
  await db.twitchIdentity.create({ data: { playerId: pilot.id, twitchUserId: '12345', login: 'kichnifou' } });
  f = giftFixture(db, pilot.id); await db.twitchGiftSupremeCredential.create({ data: { playerId: pilot.id, twitchUserId: '12345', encryptedRefreshToken: f.row!.encryptedRefreshToken, scopes: f.row!.scopes! } });
  await f.manager.ensure(pilot.id); runtime = new TwitchGiftSupremeRuntime(db, clock, f.manager); app = await makeApp(runtime);
}, 90_000);
afterAll(async () => { for (const value of apps) await value.close(); await fixture.cleanup(); }, 60_000);
async function target(name: string, elementKey: string | null = 'pyro') {
  return db.player.create({ data: { displayName: name, elementKey, progression: { create: { xp: 0n } }, economyStats: { create: {} },
    resourceBalances: { create: resourceKeys.map(resourceKey => ({ resourceKey, amount: 100n })) } } });
}
const payload = (name: string, redemptionId = randomUUID()) => ({ subscription: { type: 'channel.channel_points_custom_reward_redemption.add', version: '1', status: 'enabled', condition: { broadcaster_user_id: '12345', reward_id: 'reward-1' } },
  event: { id: redemptionId, broadcaster_user_id: '12345', user_id: '999999', user_login: 'outside_gifter', user_name: 'Outside Gifter', user_input: name, status: 'unfulfilled', reward: { id: 'reward-1', title: 'irrelevant wire title', cost: 10000 }, redeemed_at: '2026-09-29T12:00:00Z' } });
const signed = (body: object, messageId = randomUUID(), timestamp = new Date().toISOString()) => {
  const raw = JSON.stringify(body); return { payload: raw, headers: { 'content-type': 'application/json', 'twitch-eventsub-message-id': messageId, 'twitch-eventsub-message-timestamp': timestamp,
    'twitch-eventsub-message-signature': 'sha256=' + createHmac('sha256', secret).update(messageId).update(timestamp).update(raw).digest('hex'), 'twitch-eventsub-message-type': 'notification' } };
};
const post = (body: ReturnType<typeof signed>, instance = app) => instance.inject({ method: 'POST', url: '/api/v1/twitch/eventsub', ...body });
const receipt = (id: string) => db.twitchEventReceipt.findUniqueOrThrow({ where: { externalEventId: 'gift-supreme:' + id } });
const announcementCalls = () => f.network.mock.calls.filter(([url]) => String(url).endsWith('/chat/messages')).length;
const effects = async (playerId: string) => ({ balance: (await db.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId, resourceKey: 'particles_pyro' } } })).amount,
  stats: (await db.playerEconomyStats.findUniqueOrThrow({ where: { playerId } })).totalMainElementParticlesEarned, notifications: await db.notification.count({ where: { playerId } }),
  operations: await db.businessOperation.count({ where: { playerId } }), movements: await db.resourceMovement.count({ where: { playerId } }) });
describe('Gift signed webhook to economy, settlement and at-most-once announcement, private DB only', () => {
  it('credits exactly 1600, stats and notification, confirms settlement before one exact announcement and safely replays', async () => {
    const p = await target('Runtime Success Target'), body = payload(p.displayName), delivery = signed(body), before = announcementCalls();
    expect((await post(delivery)).statusCode).toBe(204); expect(await effects(p.id)).toEqual({ balance: 1700n, stats: 1600n, notifications: 1, operations: 1, movements: 1 });
    expect(f.state.message).toBe('🎁 Outside Gifter offre un Gift Suprême à Runtime Success Target ! +1 600 particules Pyro');
    expect((await receipt(body.event.id)).payloadMinimal).toMatchObject({ proof: { redemptionId: body.event.id }, result: { action: 'FULFILL' }, remote: { settlementState: 'FULFILLED', announcementState: 'SENT' } });
    const persisted = await db.twitchEventReceipt.findMany({ where: { OR: [{ externalEventId: delivery.headers['twitch-eventsub-message-id'] }, { externalEventId: 'gift-supreme:' + body.event.id }] } });
    expect(JSON.stringify(persisted)).not.toContain('user_input'); expect(JSON.stringify(persisted)).not.toMatch(/private-access|private-refresh/);
    expect((await post(delivery)).statusCode).toBe(204); expect((await post(signed(body))).statusCode).toBe(204);
    expect(announcementCalls() - before).toBe(1); expect((await effects(p.id)).balance).toBe(1700n);
  });
  it.each(['absent', 'no-element', 'ambiguous'])('durably CANCELED %s with zero credit or success message', async kind => {
    let name = 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz'; if (kind === 'no-element') { name = 'Runtime No Element'; await target(name, null); }
    if (kind === 'ambiguous') { name = 'runtime equal bop'; await target('runtime equal bob'); await target('runtime equal bot'); }
    const body = payload(name), before = [await db.resourceMovement.count(), await db.notification.count(), announcementCalls()];
    expect((await post(signed(body))).statusCode).toBe(204); expect((await receipt(body.event.id)).payloadMinimal).toMatchObject({ result: { action: 'CANCEL' }, remote: { settlementState: 'CANCELED', announcementState: 'NONE' } });
    expect([await db.resourceMovement.count(), await db.notification.count(), announcementCalls()]).toEqual(before);
  });
  it('rejects tampered bytes, stale signatures and condition mismatch; ignores other authoritative reward IDs; OFF has no Gift handler', async () => {
    const body = payload('Unsigned Target'), bad = signed(body); bad.payload += ' ';
    expect((await post(bad)).statusCode).toBe(403); expect((await post(signed(body, randomUUID(), new Date(Date.now() - 700_000).toISOString()))).statusCode).toBe(400);
    const mismatched = payload('Unsigned Target'); mismatched.subscription.condition.reward_id = 'other'; expect((await post(signed(mismatched))).statusCode).toBe(400);
    const other = payload('Unsigned Target'); other.subscription.condition.reward_id = other.event.reward.id = 'other'; const count = await db.twitchEventReceipt.count();
    expect((await post(signed(other))).statusCode).toBe(204); expect(await db.twitchEventReceipt.count()).toBe(count);
    expect((await post(signed(body), await makeApp())).statusCode).toBe(422);
  });
  it('keeps the local Gift after settlement 500, retries remote without duplicate economy and never announces before confirmation', async () => {
    const p = await target('Runtime Retry Settlement'), body = payload(p.displayName), before = announcementCalls(); f.state.failPatch = true; f.state.redemptionStatus = 'UNFULFILLED';
    expect((await post(signed(body))).statusCode).toBe(503); expect(await effects(p.id)).toMatchObject({ balance: 1700n, notifications: 1 }); expect(announcementCalls()).toBe(before);
    f.state.failPatch = false; expect((await post(signed(body))).statusCode).toBe(204); expect(await effects(p.id)).toMatchObject({ balance: 1700n, notifications: 1, operations: 1 }); expect(announcementCalls()).toBe(before + 1);
  });
  it('two independent workers reserve one announcement and one economic Gift', async () => {
    const p = await target('Runtime Concurrent Workers'), body = payload(p.displayName), before = announcementCalls();
    const subscriptions = new TwitchEventSubSubscriptionManager(db, f.config, f.client as unknown as TwitchEventSubClient);
    const second = new TwitchGiftSupremeManager(db, f.config, subscriptions, f.request);
    const credential = await db.twitchGiftSupremeCredential.findUniqueOrThrow({ where: { playerId: f.linked.playerId } }); second.tokens!.prime(credential, 'private-access', 3600);
    const otherApp = await makeApp(new TwitchGiftSupremeRuntime(db, clock, second));
    const responses = await Promise.all([post(signed(body)), post(signed(body), otherApp)]); expect(responses.map(r => r.statusCode)).toEqual([204, 204]);
    expect(await effects(p.id)).toMatchObject({ balance: 1700n, stats: 1600n, notifications: 1, operations: 1 }); expect(announcementCalls()).toBe(before + 1);
  });
  it.each(['ambiguous', 'failed'])('marks %s announcement and never automatically resends, keeping the credited Gift', async kind => {
    const p = await target(`Runtime Announcement ${kind}`), body = payload(p.displayName), before = announcementCalls(); f.state.chatMode = kind;
    expect((await post(signed(body))).statusCode).toBe(204); f.state.chatMode = 'success'; expect((await post(signed(body))).statusCode).toBe(204);
    expect((await receipt(body.event.id)).payloadMinimal).toMatchObject({ remote: { announcementState: kind === 'ambiguous' ? 'AMBIGUOUS' : 'FAILED' } });
    expect(announcementCalls()).toBe(before + 1); expect((await effects(p.id)).balance).toBe(1700n);
  });
  it('releases reservation only for a certain local failure before dispatch and then permits retry', async () => {
    const p = await target('Runtime Pre Dispatch'), body = payload(p.displayName), before = announcementCalls();
    const spy = vi.spyOn(f.manager.helix!, 'announce').mockRejectedValueOnce(new TwitchGiftHelixError(0));
    expect((await post(signed(body))).statusCode).toBe(503); expect(announcementCalls()).toBe(before); expect((await receipt(body.event.id)).payloadMinimal).toMatchObject({ remote: { announcementState: 'NONE' } });
    spy.mockRestore(); expect((await post(signed(body))).statusCode).toBe(204); expect(announcementCalls()).toBe(before + 1); expect((await effects(p.id)).balance).toBe(1700n);
  });
  it('durable RESERVED after a crash is not auto-dispatched on replay', async () => {
    const p = await target('Runtime Reserved Crash'), body = payload(p.displayName); f.state.failPatch = true; f.state.redemptionStatus = 'UNFULFILLED';
    expect((await post(signed(body))).statusCode).toBe(503); f.state.failPatch = false;
    const row = await receipt(body.event.id); await db.twitchEventReceipt.update({ where: { id: row.id }, data: { payloadMinimal: { ...(row.payloadMinimal as object), remote: { settlementState: 'FULFILLED', announcementState: 'RESERVED' } } } });
    const before = announcementCalls(); expect((await post(signed(body))).statusCode).toBe(204); expect(announcementCalls()).toBe(before);
    expect((await effects(p.id)).balance).toBe(1700n);
  });
  it('rejects transport replay with altered content while preserving the first Gift', async () => {
    const p = await target('Runtime Transport Proof'), body = payload(p.displayName), id = randomUUID(); expect((await post(signed(body, id))).statusCode).toBe(204);
    body.event.user_input = 'different target'; expect((await post(signed(body, id))).statusCode).toBe(409); expect((await effects(p.id)).balance).toBe(1700n);
  });
});
