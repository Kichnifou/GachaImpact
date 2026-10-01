import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { AppError } from '../src/api/errors.js';
import { GetOrProvisionCurrentPlayer } from '../src/application/player/get-or-provision-current-player.js';
import type { ModerationTools } from '../src/application/moderation/moderation-tools.js';
import type { AdministrationServices } from '../src/api/routes/administration.js';

const identity = { subject: 'admin-route-subject' };
const player = { id: crypto.randomUUID(), displayName: 'Route test', elementKey: 'hydro' as const, status: 'ACTIVE' as const };
const headers = { authorization: 'Bearer token' };

function services() {
  return {
    roles: { setRole: vi.fn(async () => ({ operationId: 'role-operation' })) },
    characters: { list: vi.fn(async () => ({ entries: [] })), create: vi.fn(async () => ({})), update: vi.fn(async () => ({})) },
    possessions: { list: vi.fn(async () => ({ entries: [] })), change: vi.fn(async () => ({})) },
    banners: { overview: vi.fn(async () => ({})), correct: vi.fn(async () => ({})), retryGeneration: vi.fn(async () => ({})) },
    events: { list: vi.fn(async () => ({ entries: [] })), update: vi.fn(async () => ({})) },
    chat: { list: vi.fn(async () => ({ entries: [] })), detail: vi.fn(async () => ({})), moderate: vi.fn(async () => ({})), deleteReport: vi.fn(async () => ({})) },
    audit: { list: vi.fn(async () => ({ entries: [], facets: [{ domain: 'roles', action: 'grant-tester' }] })), detail: vi.fn(async () => ({})) },
  };
}

describe('private administration routes', () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
  afterEach(async () => Promise.all(apps.splice(0).map(app => app.close())));
  async function setup() {
    const admin = services();
    const store = { findByIdentity: async () => player, provision: vi.fn() };
    const app = await buildApp({ host: '127.0.0.1', port: 3001, supabase: {} }, {
      authIdentityVerifier: { verify: async () => identity },
      getOrProvisionCurrentPlayer: new GetOrProvisionCurrentPlayer(store),
      moderationTools: {} as ModerationTools,
      administrationServices: admin as unknown as AdministrationServices,
    });
    apps.push(app);
    return { app, admin };
  }

  it('requires authentication on private reads and mutations', async () => {
    const { app } = await setup();
    for (const [method, url] of [
      ['GET', '/api/v1/moderation/characters'], ['GET', '/api/v1/moderation/banners'],
      ['GET', '/api/v1/moderation/events'], ['GET', '/api/v1/moderation/global-chat-reports'],
      ['GET', '/api/v1/moderation/audit'], ['POST', `/api/v1/moderation/players/${player.id}/roles`],
    ] as const) expect((await app.inject({ method, url })).statusCode).toBe(401);
  });

  it('validates role, composition and pagination input before reaching services', async () => {
    const { app, admin } = await setup();
    const key = crypto.randomUUID();
    expect((await app.inject({ method: 'POST', url: `/api/v1/moderation/players/${player.id}/roles`, headers,
      payload: { role: 'ADMIN', enabled: true, idempotencyKey: key, surprise: true } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: `/api/v1/moderation/banners/${crypto.randomUUID()}/correct`, headers,
      payload: { fiveStarIds: [], fourStarIds: [], idempotencyKey: key } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/v1/moderation/banners/retry-generation', headers,
      payload: { idempotencyKey: key } })).statusCode).toBe(400);
    expect((await app.inject({ url: '/api/v1/moderation/audit?page=0', headers })).statusCode).toBe(400);
    expect(admin.roles.setRole).not.toHaveBeenCalled();
    expect(admin.banners.correct).not.toHaveBeenCalled();
    expect(admin.banners.retryGeneration).not.toHaveBeenCalled();
    expect(admin.audit.list).not.toHaveBeenCalled();
  });

  it('returns real facets and forwards exact combined audit filters behind authentication', async () => {
    const { app, admin } = await setup();
    const response = await app.inject({ url: '/api/v1/moderation/audit?page=2&domain=roles&action=grant-tester', headers });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ entries: [], facets: [{ domain: 'roles', action: 'grant-tester' }] });
    expect(admin.audit.list).toHaveBeenCalledWith(identity, { page: 2, domain: 'roles', action: 'grant-tester' });
    admin.audit.list.mockRejectedValueOnce(new AppError('Accès interdit.', 403, 'MODERATION_FORBIDDEN'));
    expect((await app.inject({ url: '/api/v1/moderation/audit', headers })).statusCode).toBe(403);
  });

  it('forwards an authenticated role mutation and lets the service deny access', async () => {
    const { app, admin } = await setup();
    const key = crypto.randomUUID();
    const url = `/api/v1/moderation/players/${player.id}/roles`;
    expect((await app.inject({ method: 'POST', url, headers,
      payload: { role: 'MODERATOR', enabled: true, idempotencyKey: key } })).statusCode).toBe(200);
    expect(admin.roles.setRole).toHaveBeenCalledWith(identity, player.id, 'MODERATOR', true, key);
    admin.roles.setRole.mockRejectedValueOnce(new AppError('Accès interdit.', 403, 'MODERATION_FORBIDDEN'));
    expect((await app.inject({ method: 'POST', url, headers,
      payload: { role: 'MODERATOR', enabled: true, idempotencyKey: crypto.randomUUID() } })).statusCode).toBe(403);
  });
});
