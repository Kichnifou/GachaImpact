import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { AppError } from '../src/api/errors.js';
import { GetOrProvisionCurrentPlayer } from '../src/application/player/get-or-provision-current-player.js';
import type { ArcadeService } from '../src/application/arcade/arcade-service.js';
import type { ArcadeRecords } from '../src/application/arcade/arcade-records.js';

describe('Arcade strict authenticated protocol', () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
  afterEach(async () => { await Promise.all(apps.splice(0).map(app => app.close())); });
  async function setup() {
    const identity = { subject: 'arcade-route-user' }, player = { id: crypto.randomUUID(), displayName: 'Route player', elementKey: 'hydro' as const, status: 'ACTIVE' as const };
    const service = { actor: vi.fn(async () => player), overview: vi.fn(async () => ({ sessions: [] })), session: vi.fn(async () => ({})), start: vi.fn(async () => ({})), act: vi.fn(async () => ({})) };
    const records = { list: vi.fn(async () => ({ entries: [] })) };
    const app = await buildApp({ host: '127.0.0.1', port: 3001, supabase: {} }, {
      authIdentityVerifier: { verify: async () => identity },
      getOrProvisionCurrentPlayer: new GetOrProvisionCurrentPlayer({ findByIdentity: async () => player, provision: vi.fn() }),
      arcadeService: service as unknown as ArcadeService, arcadeRecords: records as unknown as ArcadeRecords,
    });
    apps.push(app); return { app, service, records, identity };
  }
  const headers = { authorization: 'Bearer test-token' };
  it('authenticates all reads/mutations and GET never starts or advances a game', async () => {
    const { app, service } = await setup(), id = crypto.randomUUID();
    for (const url of ['/api/v1/arcade', '/api/v1/arcade/sessions/' + id, '/api/v1/arcade/records?kind=SCORE&game=TOTAL']) expect((await app.inject({ url })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/v1/arcade/sessions', payload: {} })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/v1/arcade/sessions/' + id + '/actions', payload: {} })).statusCode).toBe(401);
    expect((await app.inject({ url: '/api/v1/arcade', headers })).statusCode).toBe(200);
    expect(service.start).not.toHaveBeenCalled(); expect(service.act).not.toHaveBeenCalled();
  });
  it('rejects forged score, XP, result, board, difficulty, bot decisions and versions', async () => {
    const { app, service } = await setup();
    const url = '/api/v1/arcade/sessions/' + crypto.randomUUID() + '/actions';
    const body = { kind: 'MOVE', position: 3, expectedVersion: 0, idempotencyKey: crypto.randomUUID() };
    for (const [key, value] of Object.entries({ score: 10, xp: 10, result: 'WIN', board: [], difficulty: 'EASY', aiPosition: 2, playerId: crypto.randomUUID() })) {
      expect((await app.inject({ method: 'POST', url, headers, payload: { ...body, [key]: value } })).statusCode).toBe(400);
    }
    for (const payload of [{ ...body, position: 99 }, { ...body, expectedVersion: -1 }, { ...body, idempotencyKey: 'bad' }, { ...body, expectedVersion: undefined }]) {
      expect((await app.inject({ method: 'POST', url, headers, payload })).statusCode).toBe(400);
    }
    expect(service.act).not.toHaveBeenCalled();
  });
  it('forwards only validated intentions and preserves explicit ownership/version conflicts', async () => {
    const { app, service, identity } = await setup(), id = crypto.randomUUID();
    const start = { game: 'MEMORY', difficulty: 'MEDIUM', expectedVersion: 0, previousSessionId: null, idempotencyKey: crypto.randomUUID() };
    expect((await app.inject({ method: 'POST', url: '/api/v1/arcade/sessions', headers, payload: start })).statusCode).toBe(200);
    expect(service.start).toHaveBeenCalledWith(identity, start);
    service.act.mockRejectedValueOnce(new AppError('Partie introuvable.', 404, 'ARCADE_NOT_FOUND'));
    const result = await app.inject({ method: 'POST', url: '/api/v1/arcade/sessions/' + id + '/actions', headers,
      payload: { kind: 'ADVANCE', expectedVersion: 3, idempotencyKey: crypto.randomUUID() } });
    expect(result.statusCode).toBe(404); expect(result.body).not.toMatch(/privateState|cards|seed|randomState/);
    expect((await app.inject({ url: '/api/v1/arcade/records?kind=GLOBAL&game=TOTAL', headers })).statusCode).toBe(400);
  });
  it('accepts only an authenticated, versioned QUIT without client results or position', async () => {
    const { app, service, identity } = await setup(), id = crypto.randomUUID();
    const url = `/api/v1/arcade/sessions/${id}/actions`, payload = { kind: 'QUIT', expectedVersion: 2, idempotencyKey: crypto.randomUUID() };
    expect((await app.inject({ method: 'POST', url, payload })).statusCode).toBe(401);
    for (const extra of [{ position: 1 }, { xp: 10 }, { result: 'LOSS' }]) expect((await app.inject({ method: 'POST', url, headers, payload: { ...payload, ...extra } })).statusCode).toBe(400);
    expect(service.act).not.toHaveBeenCalled();
    expect((await app.inject({ method: 'POST', url, headers, payload })).statusCode).toBe(200);
    expect(service.act).toHaveBeenCalledWith(identity, id, payload);
  });
});
