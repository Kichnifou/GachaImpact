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
      gameB: { available: false, theme: { key: 'harvest', label: 'Grenier' }, solvedToday: false, discoveredBy: null, attemptsUsed: 0, attemptsRemaining: 0, testedCodes: [], remainingCodes: Array.from({ length: 32 }, (_, index) => index.toString(2).padStart(5, '0')), canAttempt: false },
    };
    const service = { getCurrent: vi.fn(async () => snapshot), join: vi.fn(async () => ({ ...snapshot, participation: { joined: true, joinedAt: '2026-09-15T12:00:00.000Z', points: 0 }, currency: { amount: '1' }, canJoin: false, operation: { id: randomUUID(), alreadyProcessed: false } })), attemptGameA: vi.fn(async () => ({ ...snapshot, operation: { id: randomUUID(), alreadyProcessed: false }, attempt: { succeeded: false } })), attemptGameB: vi.fn(async () => ({ ...snapshot, operation: { id: randomUUID(), alreadyProcessed: false }, attempt: { kind: 'INCORRECT' } })), searchGameCRecipients: vi.fn(async () => ({ page: 1, hasMore: false, recipients: [] })), sendGameC: vi.fn(async () => ({ ...snapshot, operation: { id: randomUUID(), alreadyProcessed: false } })), consultGameCMessages: vi.fn(async () => snapshot) } as unknown as EventService;
    const app = await buildApp({ host: '127.0.0.1', port: 3001, supabase: {} }, { authIdentityVerifier: { verify: async () => ({ subject: 'event-subject' }) }, getOrProvisionCurrentPlayer: { execute: vi.fn() } as never, eventService: service });
    apps.push(app);
    return { app, service };
  }

  it('keeps GET personal and available before participation', async () => {
    const { app } = await setup();
    expect((await app.inject({ url: '/api/v1/me/event' })).statusCode).toBe(401);
    const response = await app.inject({ url: '/api/v1/me/event', headers: { authorization: 'Bearer token' } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ festival: { key: 'harvest' }, participation: { joined: false, points: 0 }, currency: { amount: '0' }, gameB: { solvedToday: false, testedCodes: [], attemptsRemaining: 0 } });
    expect(response.json().gameB.remainingCodes).toHaveLength(32);
    expect(JSON.stringify(response.json())).not.toContain('solutionCode');
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

  it('authenticates and strictly validates Game B codes and payloads', async () => {
    const { app, service } = await setup(); const key = randomUUID(); const headers = { authorization: 'Bearer token' };
    expect((await app.inject({ method: 'POST', url: '/api/v1/me/event/game-b/attempt', payload: { code: '01011', idempotencyKey: key } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/v1/me/event/game-b/attempt', headers, payload: { code: '01011', idempotencyKey: key } })).statusCode).toBe(200);
    expect(service.attemptGameB).toHaveBeenCalledWith(expect.objectContaining({ subject: 'event-subject' }), '01011', key);
    for (const code of ['101', '010111', '01012', '01 11', 'abcde']) expect((await app.inject({ method: 'POST', url: '/api/v1/me/event/game-b/attempt', headers, payload: { code, idempotencyKey: key } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/v1/me/event/game-b/attempt', headers, payload: { code: '01011', idempotencyKey: key, extra: true } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/v1/me/event/game-b/attempt', headers, payload: { code: '01011', idempotencyKey: 'bad' } })).statusCode).toBe(400);
  });

  it('authenticates and strictly validates Game C recipient search, send and private consultation', async () => {
    const { app, service } = await setup(); const key = randomUUID(); const recipientPlayerId = randomUUID(); const headers = { authorization: 'Bearer token' };
    expect((await app.inject({ url: '/api/v1/me/event/game-c/recipients?q=Al' })).statusCode).toBe(401);
    expect((await app.inject({ url: '/api/v1/me/event/game-c/recipients?q=Al&page=1', headers })).statusCode).toBe(200);
    expect(service.searchGameCRecipients).toHaveBeenCalledWith(expect.objectContaining({ subject: 'event-subject' }), { q: 'Al', sort: 'name', direction: 'asc', page: 1 });
    expect((await app.inject({ url: '/api/v1/me/event/game-c/recipients?q=A', headers })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/api/v1/me/event/game-c/send', payload: { recipientPlayerId, message: 'Bonjour', idempotencyKey: key } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/v1/me/event/game-c/send', headers, payload: { recipientPlayerId, message: ' Bonjour ', idempotencyKey: key } })).statusCode).toBe(200);
    expect(service.sendGameC).toHaveBeenCalledWith(expect.objectContaining({ subject: 'event-subject' }), recipientPlayerId, 'Bonjour', key);
    for (const payload of [
      { recipientPlayerId: 'bad', message: 'Bonjour', idempotencyKey: key },
      { recipientPlayerId, message: '   ', idempotencyKey: key },
      { recipientPlayerId, message: 'x'.repeat(501), idempotencyKey: key },
      { recipientPlayerId, message: 'Bonjour', idempotencyKey: 'bad' },
      { recipientPlayerId, message: 'Bonjour', idempotencyKey: key, extra: true },
    ]) expect((await app.inject({ method: 'POST', url: '/api/v1/me/event/game-c/send', headers, payload })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/v1/me/event/game-c/messages/consult' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/v1/me/event/game-c/messages/consult', headers, payload: {} })).statusCode).toBe(200);
    expect(service.consultGameCMessages).toHaveBeenCalledWith(expect.objectContaining({ subject: 'event-subject' }));
    expect((await app.inject({ method: 'POST', url: '/api/v1/me/event/game-c/messages/consult', headers, payload: { playerId: recipientPlayerId } })).statusCode).toBe(400);
  });
});
