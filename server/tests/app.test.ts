import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';

describe('application', () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it('creates a Fastify application', async () => {
    const app = await buildApp({ host: '127.0.0.1', port: 3001, supabase: {} });
    apps.push(app);

    expect(app.server).toBeDefined();
  });

  it('returns a stable health response', async () => {
    const app = await buildApp({ host: '127.0.0.1', port: 3001, supabase: {} });
    apps.push(app);

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
    expect(response.headers['x-request-id']).toBeDefined();
  });

  it('serves both exact HTTPS origins, rejects lookalikes and retains authenticated route guards', async () => {
    const origins = ['https://gachaimpact.pages.dev', 'https://gachaimpact.fr'];
    const app = await buildApp({ host: '127.0.0.1', port: 3001, frontendOrigin: origins[0], frontendOrigins: origins, supabase: {} }, {
      authIdentityVerifier: { verify: async () => { throw new Error('No test token accepted'); } },
      getOrProvisionCurrentPlayer: {} as never,
    }); apps.push(app);
    for (const origin of [...origins, 'https://gachaimpact.fr.evil.example', 'https://untrusted.example', 'http://gachaimpact.fr', 'http://localhost:5173', 'null']) {
      const preflight = await app.inject({ method: 'OPTIONS', url: '/api/v1/me', headers: { origin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization,content-type' } });
      expect(preflight.headers['access-control-allow-origin']).toBe(origins.includes(origin) ? origin : undefined);
      if (origins.includes(origin)) { expect(preflight.statusCode).toBe(204); expect(preflight.headers['access-control-allow-headers']).toContain('authorization'); }
      const guarded = await app.inject({ method: 'GET', url: '/api/v1/me', headers: { origin } });
      expect(guarded.statusCode).toBe(401);
      expect(guarded.headers['access-control-allow-origin']).toBe(origins.includes(origin) ? origin : undefined);
    }
  });

  it.each(['http://localhost:5173', 'https://alpha.example.pages.dev'])('allows only configured origin %s through CORS', async (frontendOrigin) => {
    const app = await buildApp({
      host: '127.0.0.1',
      port: 3001,
      frontendOrigin,
      supabase: {},
    });
    apps.push(app);

    const allowed = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/me',
      headers: {
        origin: frontendOrigin,
        'access-control-request-method': 'GET',
      },
    });
    const rejected = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/me',
      headers: {
        origin: 'https://untrusted.example',
        'access-control-request-method': 'GET',
      },
    });

    expect(allowed.headers['access-control-allow-origin']).toBe(frontendOrigin);
    expect(rejected.headers['access-control-allow-origin']).toBeUndefined();
  });
});
