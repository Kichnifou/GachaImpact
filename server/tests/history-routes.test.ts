import Fastify, { type preHandlerHookHandler } from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { registerAuthenticationContext } from '../src/api/auth/authentication.js';
import { AppError } from '../src/api/errors.js';
import { registerHistoryRoutes } from '../src/api/routes/history.js';
import type { HistoryService } from '../src/application/history/history-service.js';
import type { SocialService } from '../src/application/social/social-service.js';

describe('History owner route', () => {
  it('guards bounded activity statistics and visible names using only the session actor', async () => {
    const app = Fastify({ logger: false }); registerAuthenticationContext(app);
    const authenticate: preHandlerHookHandler = async request => { if (!request.headers.authorization) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED'); request.authenticatedIdentity = { subject: 'self' }; };
    const activityNames = vi.fn(async () => ({ names: [] })), activityStatistics = vi.fn(async () => ({ entries: [] }));
    await app.register(registerHistoryRoutes, { authenticate, service: { activityNames, activityStatistics } as unknown as HistoryService, social: { actor: vi.fn(async () => ({ id: 'actor' })) } as unknown as SocialService });
    try {
      for (const path of ['/api/v1/me/history/activity/statistics', '/api/v1/me/history/activity/players?date=2026-10-13']) expect((await app.inject(path)).statusCode).toBe(401);
      const headers = { authorization: 'valid' };
      for (const query of ['range=bad', 'range=all&playerId=other', 'from=2020-01-01']) expect((await app.inject({ url: `/api/v1/me/history/activity/statistics?${query}`, headers })).statusCode).toBe(400);
      const stats = await app.inject({ url: '/api/v1/me/history/activity/statistics?range=5y', headers });
      expect(stats.statusCode).toBe(200); expect(stats.headers['cache-control']).toBe('no-store'); expect(activityStatistics).toHaveBeenCalledWith('5y');
      for (const query of ['date=2026-02-30', 'date=2026-10-13&playerId=other', 'date=2026-10-13&after=invalid']) expect((await app.inject({ url: `/api/v1/me/history/activity/players?${query}`, headers })).statusCode).toBe(400);
      const names = await app.inject({ url: '/api/v1/me/history/activity/players?date=2026-10-13', headers });
      expect(names.statusCode).toBe(200); expect(names.headers['cache-control']).toBe('no-store'); expect(activityNames).toHaveBeenCalledWith('actor', '2026-10-13', undefined);
    } finally { await app.close(); }
  });
  it('requires authentication, rejects a target player parameter, and reads only the authenticated owner', async () => {
    const app = Fastify({ logger: false });
    registerAuthenticationContext(app);
    const authenticate: preHandlerHookHandler = async request => {
      if (request.headers.authorization !== 'Bearer valid') throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
      request.authenticatedIdentity = { subject: 'owner-subject' };
    };
    const banners = vi.fn(async () => ({ category: 'banners', entries: [] }));
    const events = vi.fn(async () => ({ category: 'event', entries: [] }));
    const actor = vi.fn(async () => ({ id: 'owner-player' }));
    const activity = vi.fn(async () => ({ category: 'activity', entries: [] }));
    await app.register(registerHistoryRoutes, { authenticate, service: { banners, events, activity } as unknown as HistoryService, social: { actor } as unknown as SocialService });
    try {
      expect((await app.inject('/api/v1/me/history?category=event')).statusCode).toBe(401);
      expect((await app.inject({ url: '/api/v1/me/history?category=event&playerId=other', headers: { authorization: 'Bearer valid' } })).statusCode).toBe(400);
      const response = await app.inject({ url: '/api/v1/me/history?category=event&page=2', headers: { authorization: 'Bearer valid' } });
      expect(response.statusCode).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(actor).toHaveBeenLastCalledWith({ subject: 'owner-subject' });
      expect(events).toHaveBeenCalledExactlyOnceWith('owner-player', 2);
      expect(banners).not.toHaveBeenCalled();
      expect((await app.inject('/api/v1/me/history?category=activity')).statusCode).toBe(401);
      const activityResponse = await app.inject({ url: '/api/v1/me/history?category=activity&page=2', headers: { authorization: 'Bearer valid' } });
      expect(activityResponse.statusCode).toBe(200);
      expect(activity).toHaveBeenCalledExactlyOnceWith(2);
      expect(activityResponse.headers['cache-control']).toBe('no-store');
    } finally { await app.close(); }
  });
});
