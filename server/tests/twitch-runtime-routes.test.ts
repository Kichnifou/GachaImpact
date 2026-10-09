import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { AppError } from '../src/api/errors.js';
import type { TwitchPilotService } from '../src/application/twitch/twitch-pilot-service.js';
import type { SnapshotPilotService } from '../src/application/migration/snapshot-pilot-service.js';
import type { TwitchEventSubSubscriptionManager } from '../src/application/twitch/twitch-eventsub-subscription-manager.js';
import type { TwitchCommandPilot } from '../src/application/twitch/twitch-command-pilot.js';

const state = 'A'.repeat(43);
const runtimeState = `runtime_${state}`;
const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
afterEach(async () => { await Promise.all(apps.splice(0).map(app => app.close())); });
async function setup(withCommands = false) {
  let armed = false;
  const commandStatus = () => ({ commandPilotCapabilityEnabled: true, commandPilotArmed: armed, commandPilotEnabled: armed });
  const commandPilot = { responseStatus: vi.fn(async () => ({ receiptId: 'fixture', state: 'FAILED', responses: ['FAILED'], error: 'HTTP_429' })),
    retryResponses: vi.fn(async () => ({ state: 'PROCESSED' })), status: vi.fn(commandStatus),
    arm: vi.fn(async (_playerId: string) => { armed = true; return commandStatus(); }),
    disarm: vi.fn((_playerId: string) => { armed = false; return commandStatus(); }) };
  const twitch = { status: vi.fn(async () => ({ eligible: withCommands, commandPilotAvailable: withCommands, commandPilotEnabled: false, runtimeAuthorizationAvailable: true, runtimeSubscriptionAvailable: false })),
    requirePilot: vi.fn(async () => ({ id: 'verified-player' })),
    linkResolution: vi.fn(async () => ({ resolution:null })), resolveLink: vi.fn(async () => ({linked:true,resolutionRequired:false})),
    startClaim: vi.fn(async () => ({ url: 'https://id.twitch.tv/oauth2/authorize?state=claim_' })),
    start: vi.fn(async () => ({ url: 'https://id.twitch.tv/oauth2/authorize' })),
    startRuntime: vi.fn(async () => ({ url: 'https://id.twitch.tv/oauth2/authorize?scope=openid' })),
    startGiftSupreme: vi.fn(async () => ({ url: 'https://id.twitch.tv/oauth2/authorize' })),
    ensureGiftSupreme: vi.fn(async () => ({ giftSupremeActive: true, giftSupremePending: false })),
    disableGiftSupreme: vi.fn(async () => ({ giftSupremeActive: false, giftSupremePending: false })),
    startFavor: vi.fn(async () => ({ url: 'https://id.twitch.tv/oauth2/authorize?scope=openid+channel%3Aread%3Asubscriptions' })),
    disableFavor: vi.fn(async () => ({ favorSubscriptionActive: false, favorSubscriptionPending: false })),
    callback: vi.fn(async () => ({})), unlink: vi.fn(), disableRuntime: vi.fn(async () => ({ runtimeChatActive: false, runtimeChatPending: false })) };
  const subscriptions = { ensurePilotChatSubscription: vi.fn() };
  const app = await buildApp({ host: '127.0.0.1', port: 3001, supabase: {}, frontendOrigin: 'https://game.example' }, {
    authIdentityVerifier: { verify: async () => ({ subject: 'operator' }) }, getOrProvisionCurrentPlayer: {} as never,
    twitchPilot: twitch as unknown as TwitchPilotService, snapshotPilot: {} as SnapshotPilotService,
    twitchSubscriptions: subscriptions as unknown as TwitchEventSubSubscriptionManager,
    twitchCommandPilot: withCommands ? commandPilot as unknown as TwitchCommandPilot : undefined,
  });
  apps.push(app); return { app, twitch, subscriptions, commandPilot };
}
describe('Twitch runtime pilot routes with mocked services', () => {
  it('requires paired explicit operator consent and rejects missing or invented consent', async () => {
    const { app, twitch } = await setup(), url = '/api/v1/me/twitch/resolution', headers = { authorization: 'Bearer test' };
    const payload = { resolutionId: '22222222-2222-4222-8222-222222222222', choice: 'TWITCH', decisionRevision: '33333333-3333-4333-8333-333333333333', confirmation: 'ONE_PROGRESSION_NO_MERGE' };
    const operatorPlanId = '44444444-4444-4444-8444-444444444444', operatorConfirmation = 'ABANDON_LOSING_PROGRESSION_AND_RELATIONS';
    for (const invalid of [{ ...payload, operatorPlanId }, { ...payload, operatorConfirmation }, { ...payload, operatorPlanId, operatorConfirmation: 'YES' }])
      expect((await app.inject({ method: 'POST', url, headers, payload: invalid })).statusCode).toBe(400);
    expect(twitch.resolveLink).not.toHaveBeenCalled();
    expect((await app.inject({ method: 'POST', url, headers, payload: { ...payload, operatorPlanId, operatorConfirmation } })).statusCode).toBe(200);
    expect(twitch.resolveLink).toHaveBeenCalledExactlyOnceWith({ subject: 'operator' }, payload.resolutionId, 'TWITCH', payload.decisionRevision, operatorPlanId);
  });
  it('authenticates definitive choices and accepts only a server challenge with explicit consent', async () => {
    const { app,twitch } = await setup(); const url='/api/v1/me/twitch/resolution', headers={authorization:'Bearer test'};
    const payload={resolutionId:'22222222-2222-4222-8222-222222222222',choice:'WEB',decisionRevision:'33333333-3333-4333-8333-333333333333',confirmation:'ONE_PROGRESSION_NO_MERGE'};
    for(const method of ['GET','POST'] as const) expect((await app.inject({method,url,...(method==='POST'?{payload}:{})})).statusCode).toBe(401);
    for(const invalid of [{...payload,playerId:'other'},{...payload,choice:'MERGE'},{...payload,confirmation:'YES'},{...payload,resolutionId:'invalid'},{...payload,decisionRevision:'invalid'},{...payload,decisionRevision:undefined},{}])
      expect((await app.inject({method:'POST',url,headers,payload:invalid})).statusCode).toBe(400);
    expect((await app.inject({method:'POST',url:url+'?playerId=other',headers,payload})).statusCode).toBe(400);
    expect(twitch.resolveLink).not.toHaveBeenCalled();
    const pending=await app.inject({method:'GET',url,headers});expect(pending.statusCode).toBe(200);expect(pending.headers['cache-control']).toBe('no-store');
    expect(twitch.linkResolution).toHaveBeenCalledWith({subject:'operator'});
    const result=await app.inject({method:'POST',url,headers,payload});expect(result.statusCode).toBe(200);
    expect(twitch.resolveLink).toHaveBeenCalledWith({subject:'operator'},payload.resolutionId,'WEB',payload.decisionRevision);
  });
  it('authenticates recovery for a non-pilot account, rejects caller identity fields, and redirects success', async () => {
    const { app, twitch } = await setup();
    const url = '/api/v1/me/twitch/recover/start', headers = { authorization: 'Bearer test' };
    expect((await app.inject({ method: 'POST', url })).statusCode).toBe(401);
    for (const payload of [{ playerId: 'other' }, { twitchUserId: '123' }, null, []])
      expect((await app.inject({ method: 'POST', url, headers: { ...headers, 'content-type': 'application/json' }, payload: JSON.stringify(payload) })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: `${url}?playerId=other`, headers })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url, headers })).statusCode).toBe(200);
    expect(twitch.startClaim).toHaveBeenCalledExactlyOnceWith({ subject: 'operator' });
    expect(twitch.requirePilot).not.toHaveBeenCalled();
    twitch.callback.mockResolvedValueOnce({ claimed: true, playerId: 'private-target' });
    const response = await app.inject({ method: 'GET', url: `/api/v1/me/twitch/callback?state=claim_${state}&code=private-code` });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toContain('twitch=profile-recovered');
    expect(response.headers.location).not.toMatch(/private-target|private-code/);
  });
  it.each(['POST', 'DELETE'] as const)('strictly authenticates %s command arm/disarm without changing specialized runtimes', async method => {
    const { app, twitch, subscriptions, commandPilot } = await setup(true);
    const url = '/api/v1/me/twitch/commands/pilot', headers = { authorization: 'Bearer test' };
    expect((await app.inject({ method, url })).statusCode).toBe(401);
    for (const payload of [{ playerId: 'other' }, { twitchUserId: '123' }, { enabled: true }, null, [], 'text'])
      expect((await app.inject({ method, url, headers: { ...headers, 'content-type': 'application/json' }, payload: JSON.stringify(payload) })).statusCode).toBe(400);
    expect((await app.inject({ method, url: `${url}?playerId=other`, headers })).statusCode).toBe(400);
    expect(commandPilot.arm).not.toHaveBeenCalled(); expect(commandPilot.disarm).not.toHaveBeenCalled();
    twitch.requirePilot.mockRejectedValueOnce(new AppError('Forbidden', 403, 'TWITCH_PILOT_FORBIDDEN'));
    expect((await app.inject({ method, url, headers, ...(method === 'POST' ? { payload: { acknowledgement: 'STREAMERBOT_PATH_DISABLED' } } : {}) })).statusCode).toBe(403);
    expect(commandPilot.arm).not.toHaveBeenCalled(); expect(commandPilot.disarm).not.toHaveBeenCalled();
    const result = await app.inject({ method, url, headers, ...(method === 'POST' ? { payload: { acknowledgement: 'STREAMERBOT_PATH_DISABLED' } } : {}) });
    expect(result.statusCode).toBe(200); expect(result.headers['cache-control']).toBe('no-store');
    expect(result.json()).toMatchObject({ commandPilotCapabilityEnabled: true, commandPilotArmed: method === 'POST', commandPilotEnabled: method === 'POST' });
    if (method === 'POST') expect(commandPilot.arm).toHaveBeenCalledExactlyOnceWith('verified-player', 'STREAMERBOT_PATH_DISABLED', undefined, undefined);
    else expect(commandPilot.disarm).toHaveBeenCalledExactlyOnceWith('verified-player');
    expect(twitch.startRuntime).not.toHaveBeenCalled(); expect(twitch.start).not.toHaveBeenCalled();
    expect(twitch.unlink).not.toHaveBeenCalled(); expect(twitch.disableRuntime).not.toHaveBeenCalled();
    expect(twitch.disableFavor).not.toHaveBeenCalled(); expect(twitch.disableGiftSupreme).not.toHaveBeenCalled();
    expect(subscriptions.ensurePilotChatSubscription).not.toHaveBeenCalled(); expect(commandPilot.retryResponses).not.toHaveBeenCalled();
  });
  it('GET projects the same live arm state changed by POST/DELETE rather than startup config', async () => {
    const { app } = await setup(true), headers = { authorization: 'Bearer test' };
    const status = () => app.inject({ method: 'GET', url: '/api/v1/me/twitch', headers });
    expect((await status()).json()).toMatchObject({ commandPilotCapabilityEnabled: true, commandPilotArmed: false, commandPilotEnabled: false });
    await app.inject({ method: 'POST', url: '/api/v1/me/twitch/commands/pilot', headers, payload: { acknowledgement: 'STREAMERBOT_PATH_DISABLED' } });
    expect((await status()).json()).toMatchObject({ commandPilotArmed: true, commandPilotEnabled: true });
    await app.inject({ method: 'DELETE', url: '/api/v1/me/twitch/commands/pilot', headers });
    expect((await status()).json()).toMatchObject({ commandPilotArmed: false, commandPilotEnabled: false });
  });
  it('authenticates response recovery and accepts only the receipt UUID and verified operator', async () => {
    const { app, twitch, commandPilot } = await setup(true);
    const receiptId = '22222222-2222-4222-8222-222222222222';
    const url = `/api/v1/me/twitch/commands/${receiptId}/response/retry`, headers = { authorization: 'Bearer test' };
    expect((await app.inject({ method: 'POST', url })).statusCode).toBe(401);
    for (const payload of [{ playerId: 'other' }, { command: '!pull 1' }, null, []])
      expect((await app.inject({ method: 'POST', url, headers: { ...headers, 'content-type': 'application/json' }, payload: JSON.stringify(payload) })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: `${url}?playerId=other`, headers })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: url.replace(receiptId, 'invalid'), headers })).statusCode).toBe(400);
    expect(commandPilot.retryResponses).not.toHaveBeenCalled();
    twitch.requirePilot.mockRejectedValueOnce(new AppError('Forbidden', 403, 'TWITCH_PILOT_FORBIDDEN'));
    expect((await app.inject({ method: 'POST', url, headers })).statusCode).toBe(403);
    expect(commandPilot.retryResponses).not.toHaveBeenCalled();
    expect((await app.inject({ method: 'POST', url, headers })).json()).toEqual({ state: 'PROCESSED' });
    expect(commandPilot.retryResponses).toHaveBeenCalledExactlyOnceWith('verified-player', receiptId);
    expect(twitch.requirePilot).toHaveBeenCalledWith({ subject: 'operator' });
    expect(twitch.startRuntime).not.toHaveBeenCalled();
  });
  it('exposes only response diagnostics to an eligible authenticated operator without activating the gate', async () => {
    const { app, commandPilot } = await setup(true);
    expect((await app.inject({ method: 'GET', url: '/api/v1/me/twitch' })).statusCode).toBe(401);
    const result = await app.inject({ method: 'GET', url: '/api/v1/me/twitch', headers: { authorization: 'Bearer test' } });
    expect(result.statusCode).toBe(200);
    expect(result.json()).toMatchObject({ commandPilotAvailable: true, commandPilotEnabled: false, commandPilotResponse: { state: 'FAILED', error: 'HTTP_429' } });
    expect(commandPilot.responseStatus).toHaveBeenCalledExactlyOnceWith('verified-player');
    expect(commandPilot.retryResponses).not.toHaveBeenCalled();
  });
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


describe('Gift pilot routes', () => {
  it.each([['POST', '/api/v1/me/twitch/gift-supreme/start'], ['POST', '/api/v1/me/twitch/gift-supreme/ensure'], ['DELETE', '/api/v1/me/twitch/gift-supreme']] as const)('strict authenticated %s %s', async (method, url) => {
    const { app } = await setup(); const headers = { authorization: 'Bearer test', 'content-type': 'application/json' };
    expect((await app.inject({ method, url })).statusCode).toBe(401);
    for (const payload of [{ rewardId: 'arbitrary' }, { access_token: 'bad' }, [], 'text', null])
      expect((await app.inject({ method, url, headers, payload: JSON.stringify(payload) })).statusCode).toBe(400);
    expect((await app.inject({ method, url: url + '?reward_id=bad', headers: { authorization: 'Bearer test' } })).statusCode).toBe(400);
    expect((await app.inject({ method, url, headers: { authorization: 'Bearer test' } })).statusCode).toBe(200);
  });
  it('redirects Gift activation and errors to fixed outcomes without OAuth secrets', async () => {
    const { app, twitch } = await setup(); const url = '/api/v1/me/twitch/callback?state=gift_' + state + '&code=private-code';
    const good = await app.inject({ method: 'GET', url }); expect(new URL(good.headers.location!).searchParams.get('twitch')).toBe('gift-supreme-activated');
    twitch.callback.mockRejectedValueOnce(Error('private-access')); const bad = await app.inject({ method: 'GET', url });
    expect(new URL(bad.headers.location!).searchParams.get('twitch')).toBe('gift-supreme-error'); expect(bad.headers.location).not.toMatch(/private-access|private-code/);
  });
});
