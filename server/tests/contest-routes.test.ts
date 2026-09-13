import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ContestService } from '../src/application/contest/contest-service.js';
import { buildApp } from '../src/app.js';

const characterId = randomUUID();
const view = { businessDate: '2098-09-01', theme: { key: 'STRENGTH', label: 'Force', title: 'Titan' }, dailyUsed: false, permissions: { canOpen: true, canJoin: false, canSpectate: false, canLeave: false, canReady: false, canStart: false, canCancel: false, canPlay: false, canSupport: false }, active: null, lastResult: null, legends: [] };

describe('Contest HTTP contracts', () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
  afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

  async function setup() {
    const service = {
      getCurrent: vi.fn(async () => view), getHistory: vi.fn(async () => ({ page: 1, pageSize: 10, total: 0, pageCount: 1, contests: [] })), getHistoryDetail: vi.fn(async (contestId: string) => ({ id: contestId, status: 'FINISHED' })),
      createLobby: vi.fn(async () => view), joinAsParticipant: vi.fn(async () => view), selectLegend: vi.fn(async () => view), setReady: vi.fn(async () => view), start: vi.fn(async () => view), joinAsSpectator: vi.fn(async () => view), leave: vi.fn(async () => view), cancel: vi.fn(async () => view), play: vi.fn(async () => view), support: vi.fn(async () => view), removeFromLobby: vi.fn(async () => view), adminRemove: vi.fn(async () => view),
    } as unknown as ContestService;
    const app = await buildApp({ host: '127.0.0.1', port: 3001, supabase: {} }, { authIdentityVerifier: { verify: async () => ({ subject: 'subject' }) }, getOrProvisionCurrentPlayer: { execute: vi.fn() } as never, contestService: service });
    apps.push(app); return { app, service };
  }

  it('protects the player view and validates every sensitive mutation payload', async () => {
    const { app, service } = await setup(); const headers = { authorization: 'Bearer token' }; const idempotencyKey = randomUUID();
    expect((await app.inject({ url: '/api/v1/contest' })).statusCode).toBe(401);
    expect((await app.inject({ url: '/api/v1/contest', headers })).json()).toMatchObject({ theme: { key: 'STRENGTH' }, dailyUsed: false });
    expect((await app.inject({ method: 'POST', url: '/api/v1/contest/open', headers, payload: { characterId, idempotencyKey } })).statusCode).toBe(200);
    expect(service.createLobby).toHaveBeenCalledWith(expect.objectContaining({ subject: 'subject' }), characterId, idempotencyKey);
    expect((await app.inject({ method: 'POST', url: '/api/v1/contest/action', headers, payload: { action: 'CHEAT', idempotencyKey } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/v1/contest/support', headers, payload: { targetSlot: 5, idempotencyKey } })).statusCode).toBe(400);
  });

  it('exposes only finished history through the public history contract', async () => {
    const { app, service } = await setup();
    const response = await app.inject({ url: '/api/v1/contest/history?page=1' });
    expect(response.statusCode).toBe(200); expect(response.json()).toMatchObject({ page: 1, pageSize: 10, contests: [] });
    expect(service.getHistory).toHaveBeenCalledWith(1);
    expect((await app.inject({ url: '/api/v1/contest/history?page=0' })).statusCode).toBe(400);
    const contestId = randomUUID();
    expect((await app.inject({ url: `/api/v1/contest/history/${contestId}` })).json()).toMatchObject({ id: contestId, status: 'FINISHED' });
    expect(service.getHistoryDetail).toHaveBeenCalledWith(contestId);
  });
});
