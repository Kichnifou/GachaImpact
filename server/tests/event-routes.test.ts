import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { EventService } from '../src/application/event/event-service.js';
import { buildApp } from '../src/app.js';

describe('Event HTTP contracts', () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
  afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

  async function setup() {
    const snapshot = {
      businessDate: '2026-09-15', refreshAfterMs: 3600000, festival: { key: 'harvest', month: 9, title: 'Festival des Récoltes', emoji: '🌾', currency: { key: 'harvest-tokens', label: 'Jetons de Récolte', emoji: '🌾' }, collection: { key: 'harvest-sheaf', label: 'Gerbe de Récolte' } },
      edition: { id: randomUUID(), year: 2026, startsAt: '2026-08-31T22:00:00.000Z', endsAt: '2026-09-30T22:00:00.000Z' },
      participation: { joined: false, joinedAt: null, points: 0 }, currency: { amount: '0' }, canJoin: true,
      gameA: { available: false, theme: { key: 'recolte', label: 'Récolte' }, completedToday: false, attemptsToday: 0, windows: [], activeWindowIndex: null, canAttempt: false, cooldownRemainingMs: 0 },
    };
    const service = { getCurrent: vi.fn(async () => snapshot), join: vi.fn(async () => ({ ...snapshot, participation: { joined: true, joinedAt: '2026-09-15T12:00:00.000Z', points: 0 }, currency: { amount: '1' }, canJoin: false, operation: { id: randomUUID(), alreadyProcessed: false } })), attemptGameA: vi.fn(async () => ({ ...snapshot, operation: { id: randomUUID(), alreadyProcessed: false }, attempt: { succeeded: false } })) } as unknown as EventService;
    const app = await buildApp({ host: '127.0.0.1', port: 3001, supabase: {} }, { authIdentityVerifier: { verify: async () => ({ subject: 'event-subject' }) }, getOrProvisionCurrentPlayer: { execute: vi.fn() } as never, eventService: service });
    apps.push(app);
    return { app, service };
  }

  it('keeps GET personal and available before participation', async () => {
    const { app } = await setup();
    expect((await app.inject({ url: '/api/v1/me/event' })).statusCode).toBe(401);
    const response = await app.inject({ url: '/api/v1/me/event', headers: { authorization: 'Bearer token' } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ festival: { key: 'harvest' }, participation: { joined: false, points: 0 }, currency: { amount: '0' } });
  });

  it('requires a strict UUID idempotency key for join', async () => {
    const { app, service } = await setup(); const key = randomUUID(); const headers = { authorization: 'Bearer token' };
    expect((await app.inject({ method: 'POST', url: '/api/v1/me/event/join', headers, payload: { idempotencyKey: key } })).statusCode).toBe(200);
    expect(service.join).toHaveBeenCalledWith(expect.objectContaining({ subject: 'event-subject' }), key);
    expect((await app.inject({ method: 'POST', url: '/api/v1/me/event/join', headers, payload: { idempotencyKey: 'bad', extra: true } })).statusCode).toBe(400);
  });

  it('authenticates and validates Game A attempts', async () => {
    const { app, service } = await setup(); const key = randomUUID(); const headers = { authorization: 'Bearer token' };
    expect((await app.inject({ method: 'POST', url: '/api/v1/me/event/game-a/attempt', payload: { idempotencyKey: key } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/v1/me/event/game-a/attempt', headers, payload: { idempotencyKey: key } })).statusCode).toBe(200);
    expect(service.attemptGameA).toHaveBeenCalledWith(expect.objectContaining({ subject: 'event-subject' }), key);
    expect((await app.inject({ method: 'POST', url: '/api/v1/me/event/game-a/attempt', headers, payload: { idempotencyKey: 'bad' } })).statusCode).toBe(400);
  });
});
