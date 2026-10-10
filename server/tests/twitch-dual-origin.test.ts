import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import type { TwitchEventSubSubscriptionManager } from '../src/application/twitch/twitch-eventsub-subscription-manager.js';
import type { TwitchGiftSupremeManager } from '../src/application/twitch/twitch-gift-supreme-manager.js';
import type { TwitchGiveawayManager } from '../src/application/twitch/twitch-giveaway-manager.js';
import { TwitchPilotService, twitchOAuthPurpose } from '../src/application/twitch/twitch-pilot-service.js';
import { bindOAuthReturn, oauthStateEnvelope } from '../src/application/twitch/twitch-oauth-return.js';
const origins = ['https://gachaimpact.pages.dev', 'https://gachaimpact.fr'];
const config = { host: '127.0.0.1', port: 3001, supabase: {}, frontendOrigin: origins[0], frontendOrigins: origins,
  twitch: { clientId: 'test-client', clientSecret: 'test-secret', redirectUri: 'https://backend.example/api/v1/me/twitch/callback', pilotPlayerIds: ['fixture-player'], pilotLogin: 'kichnifou' } };
const identity = { subject: 'fixture-subject' };
const methods = ['start', 'startClaim', 'startRuntime', 'startFavor', 'startGiftSupreme', 'startGiveaway'] as const;
function setup() {
  const states = new Map<string, { player_id: string; nonce_hash: string; web_identity_id: string }>();
  const db = { twitchLinkState: { create: vi.fn(async ({ data }: { data: { stateHash: string; nonceHash: string } }) => { states.set(data.stateHash, { player_id: 'fixture-player', nonce_hash: data.nonceHash, web_identity_id: 'fixture-web' }); }) },
    webIdentity: { findUnique: vi.fn(async () => ({ id: 'fixture-web', playerId: 'fixture-player' })) },
    twitchIdentity: { findUnique: vi.fn(async () => ({ id: 'fixture-twitch' })) },
    playerRoleAssignment: { findFirst: vi.fn(async () => ({ id: 'fixture-admin' })) },
    $queryRaw: vi.fn(async (_sql: TemplateStringsArray, digest: string) => { const row = states.get(digest); states.delete(digest); return row ? [row] : []; }) };
  const getPlayer = { execute: vi.fn(async () => ({ id: 'fixture-player' })) };
  const service = new TwitchPilotService(db as unknown as PrismaClient, getPlayer as unknown as GetCurrentPlayer, config, undefined,
    { activationAvailable: true } as TwitchEventSubSubscriptionManager, { available: true } as TwitchGiftSupremeManager, undefined, { available: true } as TwitchGiveawayManager);
  return { service, db, states, getPlayer };
}
afterEach(() => vi.restoreAllMocks());
describe('server-bound OAuth return origins', () => {
  for (const method of methods) it.each(origins)(`${method} binds %s and returns genuine cancellation there exactly once`, async origin => {
    const f = setup(), network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(Error('Network forbidden in unit test'));
    const url = new URL((await f.service[method](identity, origin)).url), state = url.searchParams.get('state')!;
    expect(url.searchParams.get('redirect_uri')).toBe(config.twitch.redirectUri);
    expect(oauthStateEnvelope(state).origin).toBe(origin); expect(twitchOAuthPurpose(state)).toBeDefined();
    expect(f.states.has(createHash('sha256').update(state).digest('hex'))).toBe(true);
    const returned = vi.fn(); await expect(f.service.callback({ state, error: 'access_denied' }, undefined, returned)).rejects.toMatchObject({ code: 'TWITCH_AUTH_DENIED' });
    expect(returned).toHaveBeenCalledExactlyOnceWith(origin); returned.mockClear();
    await expect(f.service.callback({ state, error: 'access_denied' }, undefined, returned)).rejects.toMatchObject({ code: 'TWITCH_STATE_INVALID' });
    expect(returned).not.toHaveBeenCalled(); expect(network).not.toHaveBeenCalled();
  });
  it('rejects origin and purpose substitution without consuming the original intent', async () => {
    const f = setup(), original = new URL((await f.service.startClaim(identity, origins[1])).url).searchParams.get('state')!;
    const parsed = oauthStateEnvelope(original), returned = vi.fn();
    const substitutions = [bindOAuthReturn(parsed.legacyState, origins[0], config), original.replace('claim_', 'favor_'), `v2.${Buffer.from('https://evil.example').toString('base64url')}.${parsed.legacyState}`];
    for (const state of substitutions) await expect(f.service.callback({ state, error: 'access_denied' }, undefined, returned)).rejects.toMatchObject({ code: 'TWITCH_STATE_INVALID' });
    expect(returned).not.toHaveBeenCalled(); expect(f.states.size).toBe(1);
    await expect(f.service.callback({ state: original, error: 'access_denied' }, undefined, returned)).rejects.toMatchObject({ code: 'TWITCH_AUTH_DENIED' });
    expect(returned).toHaveBeenCalledExactlyOnceWith(origins[1]);
  });
  it('retains legacy states and refuses an unknown initiating origin before creating an intent', async () => {
    const f = setup(), legacy = new URL((await f.service.startClaim(identity)).url).searchParams.get('state')!, returned = vi.fn();
    expect(legacy).toMatch(/^claim_[A-Za-z0-9_-]{43}$/);
    await expect(f.service.callback({ state: legacy, error: 'access_denied' }, undefined, returned)).rejects.toMatchObject({ code: 'TWITCH_AUTH_DENIED' });
    expect(returned).toHaveBeenCalledExactlyOnceWith(origins[0]);
    f.db.twitchLinkState.create.mockClear(); f.getPlayer.execute.mockClear();
    await expect(f.service.startClaim(identity, 'https://evil.example')).rejects.toMatchObject({ code: 'TWITCH_ORIGIN_INVALID' });
    expect(f.db.twitchLinkState.create).not.toHaveBeenCalled(); expect(f.getPlayer.execute).not.toHaveBeenCalled();
  });
});
