import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { CurrentPlayerFavorService } from '../src/application/favor/current-player-favor-service.js';
import type { FavorService } from '../src/application/favor/favor-service.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { GetOrProvisionCurrentPlayer } from '../src/application/player/get-or-provision-current-player.js';

const identity = { subject: 'favor-account' }, headers = { authorization: 'Bearer private-token' };
const projection = { businessDate: '2026-09-29', active: true, daysRemaining: 30, maxDays: 180,
  dailyPrimogems: '800', claimedToday: false, claimStatus: 'AVAILABLE' as const };
const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
afterEach(async () => { await Promise.all(apps.splice(0).map(app => app.close())); });
async function setup() {
  const store = { findByIdentity: vi.fn().mockResolvedValue({ id: 'server-player', status: 'ACTIVE', displayName: 'Favor', elementKey: 'pyro' }),
    provision: vi.fn().mockRejectedValue(new Error('No provisioning permitted')) };
  const getCurrent = vi.fn().mockResolvedValue({ ...projection, operationId: 'internal', twitchUserId: 'internal' });
  const claimToday = vi.fn().mockResolvedValue({ status: 'CLAIMED', businessDate: projection.businessDate, creditedPrimogems: '800', operationId: 'private-operation' });
  const service = new CurrentPlayerFavorService(new GetCurrentPlayer(store), { getCurrent, claimToday } as unknown as FavorService);
  const app = await buildApp({ host: '127.0.0.1', port: 3001, supabase: {} }, {
    authIdentityVerifier: { verify: async token => token === 'private-token' ? identity : null },
    getOrProvisionCurrentPlayer: new GetOrProvisionCurrentPlayer(store), currentPlayerFavor: service,
  });
  apps.push(app); return { app, store, getCurrent, claimToday };
}

describe('personal Favor standalone adapter and strict routes', () => {
  it.each(['GET', 'POST'] as const)('requires valid authentication for %s before reaching Favor', async method => {
    const { app, store, getCurrent, claimToday } = await setup();
    const url = method === 'GET' ? '/api/v1/me/favor' : '/api/v1/me/favor/presence';
    for (const authorization of [undefined, 'Bearer invalid']) {
      const result = await app.inject({ method, url, headers: authorization ? { authorization } : {} });
      expect(result.statusCode).toBe(401); expect(result.headers['cache-control']).toBe('no-store');
    }
    expect(store.findByIdentity).not.toHaveBeenCalled(); expect(store.provision).not.toHaveBeenCalled();
    expect(getCurrent).not.toHaveBeenCalled(); expect(claimToday).not.toHaveBeenCalled();
  });
  it('GET resolves only the authenticated Player, returns the exact public projection and never claims', async () => {
    const { app, store, getCurrent, claimToday } = await setup();
    const result = await app.inject({ method: 'GET', url: '/api/v1/me/favor', headers });
    expect(result.statusCode).toBe(200); expect(result.headers['cache-control']).toBe('no-store');
    expect(result.json()).toEqual(projection); expect(store.findByIdentity).toHaveBeenCalledWith('supabase', identity.subject);
    expect(getCurrent).toHaveBeenCalledWith('server-player'); expect(claimToday).not.toHaveBeenCalled(); expect(store.provision).not.toHaveBeenCalled();
  });
  it.each(['CLAIMED', 'ALREADY_CLAIMED', 'INACTIVE'] as const)('presence forwards the core %s result without exposing operation IDs', async status => {
    const { app, claimToday, getCurrent, store } = await setup();
    const creditedPrimogems = status === 'CLAIMED' ? '800' : '0';
    claimToday.mockResolvedValue({ status, businessDate: projection.businessDate, creditedPrimogems, operationId: 'internal' });
    const favor = { ...projection, claimedToday: status !== 'INACTIVE', claimStatus: status === 'INACTIVE' ? 'UNAVAILABLE' : 'CLAIMED', active: status !== 'INACTIVE' };
    getCurrent.mockResolvedValue(favor);
    const result = await app.inject({ method: 'POST', url: '/api/v1/me/favor/presence', headers, payload: {} });
    expect(result.statusCode).toBe(200); expect(result.headers['cache-control']).toBe('no-store');
    expect(result.json()).toEqual({ status, businessDate: projection.businessDate, creditedPrimogems, favor });
    expect(claimToday).toHaveBeenCalledExactlyOnceWith('server-player', 'UI');
    expect(getCurrent).toHaveBeenCalledWith('server-player'); expect(store.provision).not.toHaveBeenCalled();
  });
  it('accepts a bodyless presence and derives payment status from this claim, not the reread projection', async () => {
    const { app, getCurrent } = await setup(); getCurrent.mockResolvedValue(projection);
    const result = await app.inject({ method: 'POST', url: '/api/v1/me/favor/presence', headers });
    expect(result.statusCode).toBe(200); expect(result.json()).toMatchObject({ status: 'CLAIMED', creditedPrimogems: '800', favor: projection });
  });
  it.each([{ playerId: 'other' }, { businessDate: '2000-01-01' }, { sourceChannel: 'TWITCH' }, { idempotencyKey: 'client' },
    { arbitrary: true }, [], 'text', 42, null])('refuses presence body %j before any application call', async payload => {
    const { app, getCurrent, claimToday, store } = await setup();
    const result = await app.inject({ method: 'POST', url: '/api/v1/me/favor/presence', headers: { ...headers, 'content-type': 'application/json' }, payload: JSON.stringify(payload) });
    expect(result.statusCode).toBe(400); expect(claimToday).not.toHaveBeenCalled(); expect(getCurrent).not.toHaveBeenCalled();
    expect(store.findByIdentity).not.toHaveBeenCalled();
  });
  it.each(['playerId=other', 'businessDate=2000-01-01', 'sourceChannel=TWITCH', 'idempotencyKey=client', 'arbitrary=1'])('rejects query %s on both endpoints', async query => {
    const { app, store, claimToday, getCurrent } = await setup();
    for (const method of ['GET', 'POST'] as const) {
      const url = (method === 'GET' ? '/api/v1/me/favor' : '/api/v1/me/favor/presence') + '?' + query;
      expect((await app.inject({ method, url, headers })).statusCode).toBe(400);
    }
    expect(store.findByIdentity).not.toHaveBeenCalled(); expect(claimToday).not.toHaveBeenCalled(); expect(getCurrent).not.toHaveBeenCalled();
  });
  it('does not provision an authenticated account without a Player', async () => {
    const { app, store, getCurrent, claimToday } = await setup(); store.findByIdentity.mockResolvedValue(null);
    for (const method of ['GET', 'POST'] as const) {
      const url = method === 'GET' ? '/api/v1/me/favor' : '/api/v1/me/favor/presence';
      expect((await app.inject({ method, url, headers })).statusCode).toBe(404);
    }
    expect(store.provision).not.toHaveBeenCalled(); expect(getCurrent).not.toHaveBeenCalled(); expect(claimToday).not.toHaveBeenCalled();
  });
  it('propagates a core failure without fabricating a payment response', async () => {
    const { app, claimToday, getCurrent } = await setup(); claimToday.mockRejectedValue(new Error('private payment failure'));
    expect((await app.inject({ method: 'POST', url: '/api/v1/me/favor/presence', headers })).statusCode).toBe(500);
    expect(getCurrent).not.toHaveBeenCalled();
  });
});
