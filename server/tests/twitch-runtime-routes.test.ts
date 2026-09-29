import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { AppError } from '../src/api/errors.js';
import type { TwitchPilotService } from '../src/application/twitch/twitch-pilot-service.js';
import type { SnapshotPilotService } from '../src/application/migration/snapshot-pilot-service.js';
import type { TwitchEventSubSubscriptionManager } from '../src/application/twitch/twitch-eventsub-subscription-manager.js';

const state = 'A'.repeat(43);
const runtimeState = `runtime_${state}`;
const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
afterEach(async () => { await Promise.all(apps.splice(0).map(app => app.close())); });
async function setup() {
  const twitch = { status: vi.fn(async () => ({ runtimeAuthorizationAvailable: true, runtimeSubscriptionAvailable: false })),
    start: vi.fn(async () => ({ url: 'https://id.twitch.tv/oauth2/authorize' })),
    startRuntime: vi.fn(async () => ({ url: 'https://id.twitch.tv/oauth2/authorize?scope=openid' })),
    startFavor: vi.fn(async () => ({ url: 'https://id.twitch.tv/oauth2/authorize?scope=openid+channel%3Aread%3Asubscriptions' })),
    disableFavor: vi.fn(async () => ({ favorSubscriptionActive: false, favorSubscriptionPending: false })),
    callback: vi.fn(async () => ({})), unlink: vi.fn(), disableRuntime: vi.fn(async () => ({ runtimeChatActive: false, runtimeChatPending: false })) };
  const subscriptions = { ensurePilotChatSubscription: vi.fn() };
  const app = await buildApp({ host: '127.0.0.1', port: 3001, supabase: {}, frontendOrigin: 'https://game.example' }, {
    authIdentityVerifier: { verify: async () => ({ subject: 'operator' }) }, getOrProvisionCurrentPlayer: {} as never,
    twitchPilot: twitch as unknown as TwitchPilotService, snapshotPilot: {} as SnapshotPilotService,
    twitchSubscriptions: subscriptions as unknown as TwitchEventSubSubscriptionManager,
  });
  apps.push(app); return { app, twitch, subscriptions };
}
describe('Twitch runtime pilot routes with mocked services', () => {
  it('authenticates Faveur start, accepts only an empty body/no query and only returns its URL', async () => {
    const { app, twitch, subscriptions } = await setup(), url = '/api/v1/me/twitch/favor/start';
    expect((await app.inject({ method: 'POST', url })).statusCode).toBe(401);
    const headers = { authorization: 'Bearer test' };
    const response = await app.inject({ method: 'POST', url, headers });
    expect(response.statusCode).toBe(200); expect(response.json()).toEqual({ url: 'https://id.twitch.tv/oauth2/authorize?scope=openid+channel%3Aread%3Asubscriptions' });
    expect(twitch.startFavor).toHaveBeenCalledWith({ subject: 'operator' }); expect(twitch.startRuntime).not.toHaveBeenCalled();
    for (const payload of [{ scopes: ['openid'] }, { broadcaster_user_id: 'other' }, { callback: 'https://evil.example' }, [], 'text'])
      expect((await app.inject({ method: 'POST', url, headers: { ...headers, 'content-type': 'application/json' }, payload: JSON.stringify(payload) })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url, headers: { ...headers, 'content-type': 'application/json' }, payload: 'null' })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: `${url}?playerId=other`, headers })).statusCode).toBe(400);
    expect(twitch.startFavor).toHaveBeenCalledOnce(); expect(subscriptions.ensurePilotChatSubscription).not.toHaveBeenCalled();
  });
  it('redirects Faveur success/pending and errors to distinct fixed frontend outcomes', async () => {
    const { app, twitch } = await setup();
    for (const pending of [false, true]) {
      twitch.callback.mockResolvedValueOnce({ favorRuntimeActivated: true, favorSubscriptionPending: pending } as never);
      const response = await app.inject({ method: 'GET', url: `/api/v1/me/twitch/callback?state=favor_${state}&code=private-code` });
      const target = new URL(response.headers.location!);
      expect(target.origin).toBe('https://game.example'); expect(target.searchParams.get('twitch')).toBe('favor-runtime-activated');
      expect(target.hash).toBe('#configuration'); expect(target.toString()).not.toContain('private-code'); expect(response.headers['cache-control']).toBe('no-store');
    }
    twitch.callback.mockRejectedValueOnce(new AppError('scope missing', 403, 'TWITCH_FAVOR_SCOPES_MISSING'));
    const response = await app.inject({ method: 'GET', url: `/api/v1/me/twitch/callback?state=favor_${state}&code=test` });
    expect(new URL(response.headers.location!).searchParams.get('twitch')).toBe('favor-runtime-error');
  });
  it('authenticates disable and rejects browser-supplied IDs without calling the service', async () => {
    const { app, twitch } = await setup();
    const url = '/api/v1/me/twitch/runtime/subscription';
    expect((await app.inject({ method: 'DELETE', url })).statusCode).toBe(401);
    const headers = { authorization: 'Bearer test' };
    expect((await app.inject({ method: 'DELETE', url: `${url}?id=arbitrary`, headers })).statusCode).toBe(400);
    expect((await app.inject({ method: 'DELETE', url, headers, payload: { subscriptionId: 'arbitrary' } })).statusCode).toBe(400);
    expect(twitch.disableRuntime).not.toHaveBeenCalled();
    expect((await app.inject({ method: 'DELETE', url, headers })).json()).toEqual({ runtimeChatActive: false, runtimeChatPending: false });
    expect(twitch.disableRuntime).toHaveBeenCalledWith({ subject: 'operator' });
  });
  it('authenticates the separate backend start and refuses arbitrary runtime inputs', async () => {
    const { app, twitch, subscriptions } = await setup();
    const url = '/api/v1/me/twitch/runtime/start', headers = { authorization: 'Bearer test' };
    expect((await app.inject({ method: 'POST', url })).statusCode).toBe(401);
    const response = await app.inject({ method: 'POST', url, headers });
    expect(response.statusCode).toBe(200);
    expect(twitch.startRuntime).toHaveBeenCalledWith({ subject: 'operator' });
    expect(twitch.start).not.toHaveBeenCalled();
    for (const payload of [{ scopes: ['user:write:chat'] }, { callback: 'https://evil.example' }, { user_id: 'other' }, { secret: 'injected' }])
      expect((await app.inject({ method: 'POST', url, headers, payload })).statusCode).toBe(400);
    expect(subscriptions.ensurePilotChatSubscription).not.toHaveBeenCalled();
  });
  it.each([[state, 'connected'], [runtimeState, 'runtime-activated']])('redirects purpose %s to its own outcome at the configured frontend', async (oauthState, outcome) => {
    const { app, subscriptions } = await setup();
    const response = await app.inject({ method: 'GET', url: `/api/v1/me/twitch/callback?state=${oauthState}&code=test-code&callback=https://evil.example` });
    expect(response.statusCode).toBe(302);
    const target = new URL(response.headers.location!);
    expect(target.origin).toBe('https://game.example'); expect(target.searchParams.get('twitch')).toBe(outcome); expect(target.hash).toBe('#configuration');
    expect(target.toString()).not.toContain('test-code'); expect(response.headers['cache-control']).toBe('no-store');
    expect(subscriptions.ensurePilotChatSubscription).not.toHaveBeenCalled();
  });
  it('returns runtime-error silently instead of an identity-link error', async () => {
    const { app, twitch, subscriptions } = await setup();
    twitch.callback.mockRejectedValueOnce(new AppError('missing scopes', 403, 'TWITCH_RUNTIME_SCOPES_MISSING'));
    const response = await app.inject({ method: 'GET', url: `/api/v1/me/twitch/callback?state=${runtimeState}&code=test-code` });
    expect(new URL(response.headers.location!).searchParams.get('twitch')).toBe('runtime-error');
    expect(subscriptions.ensurePilotChatSubscription).not.toHaveBeenCalled();
  });
  it('never calls the manager during startup, status or health', async () => {
    const { app, subscriptions } = await setup();
    await app.inject({ method: 'GET', url: '/health' });
    await app.inject({ method: 'GET', url: '/api/v1/me/twitch', headers: { authorization: 'Bearer test' } });
    expect(subscriptions.ensurePilotChatSubscription).not.toHaveBeenCalled();
  });
});

it('authenticates Faveur disable with strict empty body/query and leaves Chat alone', async () => {
  const { app, twitch } = await setup(), url = '/api/v1/me/twitch/favor/subscription', headers = { authorization: 'Bearer test' };
  expect((await app.inject({ method: 'DELETE', url })).statusCode).toBe(401);
  expect((await app.inject({ method: 'DELETE', url, headers })).json()).toEqual({ favorSubscriptionActive: false, favorSubscriptionPending: false });
  for (const payload of [{ subscriptionId: 'other' }, { broadcaster_user_id: 'other' }, null, [], 'bad'])
    expect((await app.inject({ method: 'DELETE', url, headers: { ...headers, 'content-type': 'application/json' }, payload: JSON.stringify(payload) })).statusCode).toBe(400);
  expect((await app.inject({ method: 'DELETE', url: url + '?id=other', headers })).statusCode).toBe(400);
  expect(twitch.disableFavor).toHaveBeenCalledOnce(); expect(twitch.disableRuntime).not.toHaveBeenCalled(); expect(twitch.unlink).not.toHaveBeenCalled();
});
