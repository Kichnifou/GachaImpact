import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { AppConfig } from '../src/config/environment.js';
import { TwitchEventSubSubscriptionManager } from '../src/application/twitch/twitch-eventsub-subscription-manager.js';
import { TwitchGiveawayManager } from '../src/application/twitch/twitch-giveaway-manager.js';
import { TwitchGiveawayConsumer } from '../src/application/twitch/twitch-giveaway-consumer.js';
import type { GiveawayService } from '../src/application/giveaway/giveaway-service.js';
import type { TwitchEventSubClient, TwitchEventSubSubscription } from '../src/infrastructure/twitch/twitch-eventsub-client.js';

const playerId = '11111111-1111-4111-8111-111111111111';
const callback = 'https://backend.example/api/v1/twitch/eventsub';
const exact: TwitchEventSubSubscription = { id: 'chat-sub', type: 'channel.chat.message', version: '1', status: 'enabled',
  condition: { broadcaster_user_id: '12345', user_id: '12345' }, transport: { method: 'webhook', callback } };
const config: AppConfig = { host: '127.0.0.1', port: 3001, supabase: {}, twitch: { clientId: 'client', clientSecret: 'secret', redirectUri: 'https://backend.example/callback',
  pilotPlayerIds: [playerId], pilotLogin: 'kichnifou' }, twitchEventSub: { enabled: true, secret: 'webhook-secret', callbackUrl: callback },
  twitchGiftSupreme: { enabled: false, credentialKey: Buffer.alloc(32, 1).toString('base64') } };

function setup(initial: TwitchEventSubSubscription | null = exact) {
  let remote = initial;
  let enabled = true;
  let open = false;
  let credential = true;
  const events: string[] = [];
  const db = {
    twitchIdentity: { findUnique: vi.fn().mockResolvedValue({ playerId, twitchUserId: '12345', login: 'kichnifou' }) },
    giveawaySession: { findFirst: vi.fn(async () => open ? { id: 'open-session' } : null) },
    twitchGiveawayCredential: {
      findMany: vi.fn(async () => credential ? [{ playerId, twitchUserId: '12345', enabled }] : []),
      findUnique: vi.fn(async () => credential ? { playerId, enabled } : null),
      updateMany: vi.fn(async () => { events.push('credential'); enabled = false; return { count: 1 }; }),
    },
  };
  const client = {
    listChatSubscriptions: vi.fn(async () => { events.push('inspect'); return remote ? [remote] : []; }),
    deleteSubscription: vi.fn(async () => { events.push('delete'); remote = null; }),
  };
  const subscriptions = new TwitchEventSubSubscriptionManager(db as unknown as PrismaClient, config, client as unknown as TwitchEventSubClient);
  const manager = new TwitchGiveawayManager(db as unknown as PrismaClient, config, subscriptions);
  vi.spyOn(manager.tokens!, 'getToken').mockResolvedValue('token');
  return { manager, subscriptions, db, client, events, get enabled() { return enabled; }, get remote() { return remote; },
    setRemote(value: TwitchEventSubSubscription | null) { remote = value; }, setOpen(value: boolean) { open = value; },
    setCredential(value: boolean) { credential = value; } };
}

describe('Giveaway Twitch shutdown lifecycle', () => {
  it('stops and confirms the exact remote Chat subscription before disabling its credential', async () => {
    const h = setup();
    expect(await h.manager.disable(playerId)).toMatchObject({ enabled: false, active: false });
    expect(h.events).toEqual(['inspect', 'delete', 'inspect', 'credential']);
    expect(h.client.deleteSubscription).toHaveBeenCalledWith('chat-sub');
    expect(await h.subscriptions.inspectPilotChatSubscription(playerId)).toBe('INACTIVE');
    expect(h.enabled).toBe(false);
  });

  it('is idempotent when Chat is already absent, including concurrent shutdowns', async () => {
    const h = setup(null);
    const states = await Promise.all([h.manager.disable(playerId), h.manager.disable(playerId)]);
    expect(states.map(state => state.enabled)).toEqual([false, false]);
    expect(h.client.deleteSubscription).not.toHaveBeenCalled();
    expect(h.events).toEqual(['inspect', 'inspect', 'credential', 'inspect', 'inspect', 'credential']);
  });

  it('rejects an OPEN native session before any remote or credential mutation', async () => {
    const h = setup(); h.setOpen(true);
    await expect(h.manager.disable(playerId)).rejects.toMatchObject({ code: 'GIVEAWAY_SESSION_OPEN' });
    expect(h.client.listChatSubscriptions).not.toHaveBeenCalled();
    expect(h.db.twitchGiveawayCredential.updateMany).not.toHaveBeenCalled();
    expect(h.enabled).toBe(true);
  });

  it('never stops a shared Chat subscription without a Giveaway credential', async () => {
    const h = setup(); h.setCredential(false);
    await expect(h.manager.disable(playerId)).rejects.toMatchObject({ code: 'TWITCH_GIVEAWAY_AUTH_REQUIRED' });
    expect(h.client.listChatSubscriptions).not.toHaveBeenCalled();
    expect(h.client.deleteSubscription).not.toHaveBeenCalled();
    expect(h.remote).toEqual(exact);
  });

  it('preserves the enabled credential on DELETE failure and succeeds on retry', async () => {
    const h = setup();
    h.client.deleteSubscription.mockRejectedValueOnce(new Error('upstream unavailable'));
    await expect(h.manager.disable(playerId)).rejects.toThrow('upstream unavailable');
    expect(h.enabled).toBe(true);
    expect(h.remote).toEqual(exact);
    expect((await h.manager.status()).active).toBe(true);
    expect((await h.manager.disable(playerId)).enabled).toBe(false);
    expect(h.client.deleteSubscription).toHaveBeenCalledTimes(2);
  });

  it('preserves the credential when the initial remote inspection fails', async () => {
    const h = setup();
    h.client.listChatSubscriptions.mockRejectedValueOnce(new Error('inspection unavailable'));
    await expect(h.manager.disable(playerId)).rejects.toThrow('inspection unavailable');
    expect(h.client.deleteSubscription).not.toHaveBeenCalled();
    expect(h.enabled).toBe(true);
    expect((await h.manager.disable(playerId)).enabled).toBe(false);
  });

  it('preserves the credential when a successful DELETE has not made remote Chat inactive', async () => {
    const h = setup();
    h.client.deleteSubscription.mockImplementationOnce(async () => { h.events.push('delete'); });
    await expect(h.manager.disable(playerId)).rejects.toMatchObject({ code: 'TWITCH_EVENTSUB_SUBSCRIPTION_CONFLICT' });
    expect(h.enabled).toBe(true);
    expect(h.db.twitchGiveawayCredential.updateMany).not.toHaveBeenCalled();
    expect((await h.manager.status()).active).toBe(true);
    expect((await h.manager.disable(playerId)).enabled).toBe(false);
  });

  it('does not delete or hide an incompatible shared Chat subscription', async () => {
    const h = setup({ ...exact, transport: { method: 'webhook', callback: 'https://another.example/eventsub' } });
    await expect(h.manager.disable(playerId)).rejects.toMatchObject({ code: 'TWITCH_EVENTSUB_SUBSCRIPTION_CONFLICT' });
    expect(h.client.deleteSubscription).not.toHaveBeenCalled();
    expect(h.enabled).toBe(true);
  });

  it('keeps the retry path after a local credential write fails following remote removal', async () => {
    const h = setup();
    h.db.twitchGiveawayCredential.updateMany.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(h.manager.disable(playerId)).rejects.toThrow('database unavailable');
    expect(h.remote).toBeNull();
    expect(h.enabled).toBe(true);
    expect(await h.manager.status()).toMatchObject({ authorized: true, enabled: true, active: false });
    expect((await h.manager.disable(playerId)).enabled).toBe(false);
    expect(h.client.deleteSubscription).toHaveBeenCalledTimes(1);
  });

  it('keeps Twitch open/close on the common core while active and stops Giveaway consumption after shutdown', async () => {
    const h = setup();
    const core = { open: vi.fn().mockResolvedValue({ sessionId: 'session' }), close: vi.fn().mockResolvedValue({ sessionId: 'session' }),
      countMessage: vi.fn().mockResolvedValue(true), isOutboundMessage: vi.fn().mockResolvedValue(false) };
    vi.spyOn(h.manager, 'sendSessionMilestones').mockResolvedValue();
    const consumer = new TwitchGiveawayConsumer(h.db as unknown as PrismaClient, core as unknown as GiveawayService, h.manager);
    const event = { broadcasterUserId: '12345', chatterUserId: '12345', messageId: 'one', text: '!giveaway open',
      messageType: 'text', observedAt: new Date() };
    await consumer.consume(event);
    await consumer.consume({ ...event, messageId: 'two', text: '!giveaway close' });
    expect(core.open).toHaveBeenCalledWith(playerId, 'TWITCH', 'twitch:one');
    expect(core.close).toHaveBeenCalledWith(playerId, 'TWITCH', undefined, 'twitch:two');
    await h.manager.disable(playerId);
    expect(h.remote).toBeNull();
    await consumer.consume({ ...event, messageId: 'three', text: '!giveaway open' });
    await consumer.consume({ ...event, messageId: 'four', text: 'bonjour' });
    expect(core.open).toHaveBeenCalledTimes(1);
    expect(core.countMessage).not.toHaveBeenCalled();
  });
});
