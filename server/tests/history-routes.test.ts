import Fastify, { type preHandlerHookHandler } from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { registerAuthenticationContext } from '../src/api/auth/authentication.js';
import { AppError } from '../src/api/errors.js';
import { registerHistoryRoutes } from '../src/api/routes/history.js';
import type { HistoryService } from '../src/application/history/history-service.js';
import type { SocialService } from '../src/application/social/social-service.js';

describe('History owner route', () => {
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
    await app.register(registerHistoryRoutes, { authenticate, service: { banners, events } as unknown as HistoryService, social: { actor } as unknown as SocialService });
    try {
      expect((await app.inject('/api/v1/me/history?category=event')).statusCode).toBe(401);
      expect((await app.inject({ url: '/api/v1/me/history?category=event&playerId=other', headers: { authorization: 'Bearer valid' } })).statusCode).toBe(400);
      const response = await app.inject({ url: '/api/v1/me/history?category=event&page=2', headers: { authorization: 'Bearer valid' } });
      expect(response.statusCode).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(actor).toHaveBeenLastCalledWith({ subject: 'owner-subject' });
      expect(events).toHaveBeenCalledExactlyOnceWith('owner-player', 2);
      expect(banners).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });
});
