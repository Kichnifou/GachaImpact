import Fastify from 'fastify';
import { afterEach, expect, it, vi } from 'vitest';
import { registerAuthenticationContext, createAuthenticationHook } from '../src/api/auth/authentication.js';
import { registerSharedInvocationRoutes } from '../src/api/routes/shared-invocations.js';
import { registerErrorHandler } from '../src/api/error-handler.js';
import type { SharedInvocations } from '../src/application/gacha/shared-invocations.js';
const apps: ReturnType<typeof Fastify>[] = [];
afterEach(async () => {
    await Promise.all(apps.splice(0).map(app => app.close()));
});
async function setup() {
    const app = Fastify({ logger: false });
    apps.push(app);
    registerAuthenticationContext(app);
    registerErrorHandler(app);
    const service = { list: vi.fn(async () => ({ sessions: [] })), state: vi.fn(async () => ({ broadcasting: null, watching: null })), start: vi.fn(async () => ({ broadcasting: null, watching: null })), watch: vi.fn(async () => ({ broadcasting: null, watching: null })), control: vi.fn(async () => ({ broadcasting: null, watching: null })), react: vi.fn(async () => ({ broadcasting: null, watching: null })) };
    await registerSharedInvocationRoutes(app, { authenticate: createAuthenticationHook({ verify: async (token) => token === 'valid' ? { subject: 'verified-player' } : null }), shared: service as unknown as SharedInvocations });
    return { app, service };
}
const tabId = '00000000-0000-4000-8000-000000000074', headers = { authorization: 'Bearer valid' };
it('rejects anonymous and invalid sessions on all shared endpoints', async () => {
    const { app, service } = await setup();
    for (const route of ['', '/state'])
        expect((await app.inject({ url: '/api/v1/shared-invocations' + route })).statusCode).toBe(401);
    for (const route of ['start', 'watch', 'control', 'reaction'])
        expect((await app.inject({ method: 'POST', url: '/api/v1/shared-invocations/' + route, payload: { tabId } })).statusCode).toBe(401);
    expect(service.start).not.toHaveBeenCalled();
    expect((await app.inject({ headers: { authorization: 'Bearer invalid' }, url: '/api/v1/shared-invocations' })).statusCode).toBe(401);
});
it('requires explicit consent, bounded cursor and closed emoji/control payloads', async () => {
    const { app, service } = await setup();
    for (const payload of [{ tabId }, { tabId, consent: false }, { tabId, consent: true, ownerId: tabId }])
        expect((await app.inject({ method: 'POST', headers, url: '/api/v1/shared-invocations/start', payload })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', headers, url: '/api/v1/shared-invocations/reaction', payload: { tabId, emoji: 'arbitrary-message' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', headers, url: '/api/v1/shared-invocations/control', payload: { tabId, action: 'pull', screen: 'invocation' } })).statusCode).toBe(400);
    expect((await app.inject({ headers, url: '/api/v1/shared-invocations/state?' + new URLSearchParams({ tabId, cursor: 'x'.repeat(251) }) })).statusCode).toBe(400);
    expect(service.start).not.toHaveBeenCalled();
    expect(service.react).not.toHaveBeenCalled();
});
it('passes only verified identity and explicit consent to the service', async () => {
    const { app, service } = await setup();
    await app.inject({ method: 'POST', headers, url: '/api/v1/shared-invocations/start', payload: { tabId, consent: true } });
    expect(service.start).toHaveBeenCalledExactlyOnceWith({ subject: 'verified-player' }, tabId);
    await app.inject({ headers, url: '/api/v1/shared-invocations/state?' + new URLSearchParams({ tabId, cursor: 'idle' }) });
    expect(service.state).toHaveBeenCalledExactlyOnceWith({ subject: 'verified-player' }, tabId, 'idle');
});
