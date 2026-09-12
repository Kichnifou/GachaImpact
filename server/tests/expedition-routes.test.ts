import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ExpeditionService, ExpeditionView } from '../src/application/expedition/expedition-service.js';
import type { NotificationService } from '../src/application/notification/notification-service.js';
import { buildApp } from '../src/app.js';

const characterId = randomUUID(); const playerId = randomUUID();
const view: ExpeditionView = { businessDate: '2026-09-12', operationalStatus: 'RUNNING', departureUsedToday: true, canStartToday: false, activeCharacter: { id: characterId, externalKey: 'fixture', name: 'Fixture', rarity: 5, elementKey: 'hydro', weaponType: null, region: null, iconPath: null, splashPath: null, wishPath: null, fullbodyPath: null }, departedAt: new Date('2026-09-12T10:00:00Z'), readyAt: new Date('2026-09-13T06:00:00Z'), remainingSeconds: 72_000, startedOnCurrentBusinessDate: true, totalCompleted: 0n };
const balances = { primogems: 1600n, moras: 0n, particles_pyro: 0n, particles_hydro: 0n, particles_cryo: 0n, particles_electro: 0n, particles_anemo: 0n, particles_geo: 0n, particles_dendro: 0n };

describe('Expedition and notification HTTP contracts', () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = []; afterEach(async () => Promise.all(apps.splice(0).map(app => app.close())));
  async function setup() {
    const expedition = { getState: vi.fn(async () => view), start: vi.fn(async () => ({ operation: { id: randomUUID(), alreadyProcessed: false }, view })), claim: vi.fn(async () => ({ operation: { id: randomUUID(), alreadyProcessed: false }, reward: { roll: 1, kind: 'primogems' as const, resourceKey: 'primogems' as const, amount: 1600n }, view: { ...view, operationalStatus: 'IDLE' as const }, resources: balances, missionEvent: { type: 'expedition.completed' as const, playerId, characterId, completedAt: new Date() } })) } as unknown as ExpeditionService;
    const notificationResult = { unreadCount: 1, notifications: [{ id: randomUUID(), playerId, domainKey: 'expedition', typeKey: 'ready', payload: { characterName: 'Fixture' }, state: 'UNREAD' as const, actionKey: 'open-expedition-character', actionTargetId: characterId, deduplicationKey: 'key', createdAt: new Date(), readAt: null, resolvedAt: null, archivedAt: null }] };
    const notification = { list: vi.fn(async () => notificationResult), readOne: vi.fn(async () => notificationResult), readAll: vi.fn(async () => notificationResult), archiveRead: vi.fn(async () => notificationResult) } as unknown as NotificationService;
    const app = await buildApp({ host: '127.0.0.1', port: 3001, supabase: {} }, { authIdentityVerifier: { verify: async () => ({ subject: 'subject' }) }, getOrProvisionCurrentPlayer: { execute: vi.fn() } as never, expeditionService: expedition, notificationService: notification }); apps.push(app); return { app, expedition, notification };
  }
  it('protects, validates and serializes the private Expedition routes', async () => {
    const { app, expedition } = await setup(); const headers = { authorization: 'Bearer token' }; const key = randomUUID();
    expect((await app.inject({ url: '/api/v1/me/expedition' })).statusCode).toBe(401);
    expect((await app.inject({ url: '/api/v1/me/expedition', headers })).json()).toMatchObject({ operationalStatus: 'RUNNING', totalCompleted: '0', activeCharacter: { id: characterId } });
    expect((await app.inject({ method: 'POST', url: '/api/v1/me/expedition/start', headers, payload: { characterId, idempotencyKey: key } })).statusCode).toBe(200);
    expect(expedition.start).toHaveBeenCalledWith(expect.objectContaining({ subject: 'subject' }), characterId, key);
    expect((await app.inject({ method: 'POST', url: '/api/v1/me/expedition/start', headers, payload: { characterId, idempotencyKey: key, duration: 1 } })).statusCode).toBe(400);
  });
  it('returns and mutates only physical actionable notifications', async () => {
    const { app, notification } = await setup(); const headers = { authorization: 'Bearer token' };
    const response = await app.inject({ url: '/api/v1/me/notifications', headers }); expect(response.statusCode).toBe(200); expect(response.json()).toMatchObject({ unreadCount: 1, notifications: [{ domainKey: 'expedition', actionKey: 'open-expedition-character', actionTargetId: characterId }] });
    const notificationId = randomUUID();
    expect((await app.inject({ method: 'POST', url: `/api/v1/me/notifications/${notificationId}/read`, headers })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/api/v1/me/notifications/read-all', headers })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/api/v1/me/notifications/archive-read', headers })).statusCode).toBe(200);
    expect(notification.readOne).toHaveBeenCalledWith(expect.objectContaining({ subject: 'subject' }), notificationId); expect(notification.readAll).toHaveBeenCalled(); expect(notification.archiveRead).toHaveBeenCalled();
  });
});
