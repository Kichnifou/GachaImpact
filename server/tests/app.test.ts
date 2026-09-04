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

  it('allows only the configured frontend origin through CORS', async () => {
    const app = await buildApp({
      host: '127.0.0.1',
      port: 3001,
      frontendOrigin: 'http://localhost:5173',
      supabase: {},
    });
    apps.push(app);

    const allowed = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/me',
      headers: {
        origin: 'http://localhost:5173',
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

    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(rejected.headers['access-control-allow-origin']).toBeUndefined();
  });
});
