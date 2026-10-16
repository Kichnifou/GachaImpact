import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';

describe('account deletion disabled fallback', () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
  afterEach(async () => { await Promise.all(apps.splice(0).map(app => app.close())); });

  async function setup() {
    const provision = vi.fn(() => { throw new Error('Deletion must never provision a Player'); });
    const app = await buildApp({ host: '127.0.0.1', port: 3001, supabase: {} }, {
      authIdentityVerifier: { verify: async token => token === 'valid' ? { subject: 'synthetic-subject' } : null },
      getOrProvisionCurrentPlayer: { execute: provision } as never,
    });
    apps.push(app);
    return { app, provision };
  }

  it.each([undefined, 'Bearer expired', 'Bearer invalid'])('rejects unauthenticated requests (%s)', async authorization => {
    const { app, provision } = await setup();
    const response = await app.inject({ method: 'POST', url: '/api/v1/me/account/deletion', headers: authorization ? { authorization } : {} });
    expect(response.statusCode).toBe(401);
    expect(provision).not.toHaveBeenCalled();
  });

  it('refuses every request, including arbitrary targets, confirmation and concurrent retries', async () => {
    const { app, provision } = await setup();
    const responses = await Promise.all([{}, { confirmation: 'SUPPRIMER' }, { playerId: 'someone-else', password: 'synthetic-only' }, {}].map(payload =>
      app.inject({ method: 'POST', url: '/api/v1/me/account/deletion', headers: { authorization: 'Bearer valid' }, payload })));
    for (const response of responses) {
      expect(response.statusCode).toBe(503);
      expect(response.json().error.code).toBe('ACCOUNT_DELETION_UNAVAILABLE');
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.body).not.toContain('synthetic-only');
      expect(response.body).not.toContain('someone-else');
    }
    expect(provision).not.toHaveBeenCalled();
  });
});
