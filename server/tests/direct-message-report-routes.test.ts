import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import type { DirectMessageReportService } from '../src/application/direct-messages/direct-message-report-service.js';
import type { GetOrProvisionCurrentPlayer } from '../src/application/player/get-or-provision-current-player.js';

const identity = { subject: 'report-route-subject' };
const conversationId = '11111111-1111-4111-8111-111111111111';
const messageId = '22222222-2222-4222-8222-222222222222';
const reportId = '33333333-3333-4333-8333-333333333333';
const fingerprint = 'a'.repeat(64);
const headers = { authorization: 'Bearer token' };
const preview = { message: { id: messageId }, context: [], snapshotFingerprint: fingerprint, alreadyReported: false };
const service = { preview: vi.fn(async () => preview), report: vi.fn(async () => ({ reported: true, duplicate: false })), list: vi.fn(async () => ({ reports: [], page: 1, pageSize: 20, total: 0, totalPages: 1 })), detail: vi.fn(async () => ({ id: reportId })), delete: vi.fn(async () => ({ deleted: true })) };
const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

async function setup(enabled = true) {
  const app = await buildApp({ host: '127.0.0.1', port: 3001, supabase: {} }, {
    authIdentityVerifier: { verify: async () => identity }, getOrProvisionCurrentPlayer: {} as GetOrProvisionCurrentPlayer,
    ...(enabled ? { directMessageReportService: service as unknown as DirectMessageReportService } : {}),
  });
  apps.push(app); return app;
}
afterEach(async () => { vi.clearAllMocks(); await Promise.all(apps.splice(0).map(app => app.close())); });

describe('direct-message report routes', () => {
  it('is optional, authenticated, private and routes preview/report without actor input', async () => {
    expect((await (await setup(false)).inject({ url: `/api/v1/me/direct-conversations/${conversationId}/messages/${messageId}/report-preview`, headers })).statusCode).toBe(404);
    const app = await setup();
    expect((await app.inject({ url: `/api/v1/me/direct-conversations/${conversationId}/messages/${messageId}/report-preview` })).statusCode).toBe(401);
    const response = await app.inject({ url: `/api/v1/me/direct-conversations/${conversationId}/messages/${messageId}/report-preview`, headers });
    expect(response.statusCode).toBe(200); expect(response.headers['cache-control']).toBe('no-store'); expect(service.preview).toHaveBeenCalledWith(identity, conversationId, messageId);
    const reported = await app.inject({ method: 'POST', url: `/api/v1/me/direct-conversations/${conversationId}/messages/${messageId}/report`, headers, payload: { snapshotFingerprint: fingerprint } });
    expect(reported.statusCode).toBe(200); expect(service.report).toHaveBeenCalledWith(identity, conversationId, messageId, fingerprint);
    expect((await app.inject({ method: 'POST', url: `/api/v1/me/direct-conversations/${conversationId}/messages/${messageId}/report`, headers, payload: { snapshotFingerprint: fingerprint, reporterPlayerId: messageId } })).statusCode).toBe(400);
  });

  it('validates identifiers/fingerprints and exposes only report-id moderation reads', async () => {
    const app = await setup();
    expect((await app.inject({ method: 'POST', url: `/api/v1/me/direct-conversations/${conversationId}/messages/${messageId}/report`, headers, payload: { snapshotFingerprint: 'bad' } })).statusCode).toBe(400);
    expect((await app.inject({ url: '/api/v1/moderation/direct-message-reports?page=2', headers })).statusCode).toBe(200);
    expect(service.list).toHaveBeenCalledWith(identity, 2);
    expect((await app.inject({ url: `/api/v1/moderation/direct-message-reports/${reportId}`, headers })).statusCode).toBe(200);
    expect(service.detail).toHaveBeenCalledWith(identity, reportId);
    expect((await app.inject({ method: 'DELETE', url: `/api/v1/moderation/direct-message-reports/${reportId}`, headers })).statusCode).toBe(200);
    expect(service.delete).toHaveBeenCalledWith(identity, reportId);
    expect((await app.inject({ url: `/api/v1/moderation/direct-message-reports/${reportId}?conversationId=${conversationId}`, headers })).statusCode).toBe(400);
    expect((await app.inject({ method: 'DELETE', url: `/api/v1/moderation/direct-message-reports/${reportId}?conversationId=${conversationId}`, headers })).statusCode).toBe(400);
    expect((await app.inject({ url: '/api/v1/moderation/direct-message-reports?page=0', headers })).statusCode).toBe(400);
  });
});
