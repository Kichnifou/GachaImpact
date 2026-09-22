import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import type { DirectMessageService } from '../src/application/direct-messages/direct-message-service.js';
import type { GetOrProvisionCurrentPlayer } from '../src/application/player/get-or-provision-current-player.js';

const token = { authorization: 'Bearer test-token' };
const conversationId = '11111111-1111-4111-8111-111111111111';
const targetId = '22222222-2222-4222-8222-222222222222';
const requestId = '33333333-3333-4333-8333-333333333333';
const messageId = '44444444-4444-4444-8444-444444444444';
const key = '55555555-5555-4555-8555-555555555555';
const identity = { subject: 'direct-route-subject' };
const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
const service = {
  list: vi.fn(async () => ({ conversations: [] })), unread: vi.fn(async () => ({ unreadCount: 0, conversations: [] })),
  initiate: vi.fn(async () => ({ conversationId, messageId, requestId, state: 'PENDING' })),
  messages: vi.fn(async () => ({ messages: [], nextCursor: null, windowSize: 0 })), send: vi.fn(async () => ({ conversationId, messageId })),
  resolve: vi.fn(async () => ({ conversationId, requestId, state: 'ACCEPTED' })), block: vi.fn(async () => ({ conversationId, blocked: true })),
  markRead: vi.fn(async () => ({ lastReadMessageId: messageId, changed: true })), setReadReceipts: vi.fn(async () => ({ conversationId, readReceiptsEnabled: false, changed: true })),
  archive: vi.fn(async () => ({ conversationId, archived: true, changed: true })),
};

async function app(enabled = true) {
  const instance = await buildApp({ host: '127.0.0.1', port: 3001, supabase: {} }, {
    authIdentityVerifier: { verify: async () => identity }, getOrProvisionCurrentPlayer: {} as GetOrProvisionCurrentPlayer,
    ...(enabled ? { directMessageService: service as unknown as DirectMessageService } : {}),
  });
  apps.push(instance); return instance;
}
afterEach(async () => { vi.clearAllMocks(); await Promise.all(apps.splice(0).map(item => item.close())); });

describe('authenticated direct-message routes', () => {
  it('registers only with the service, requires auth and keeps responses private', async () => {
    expect((await (await app(false)).inject({ method: 'GET', url: '/api/v1/me/direct-conversations', headers: token })).statusCode).toBe(404);
    const enabled = await app();
    expect((await enabled.inject({ method: 'GET', url: '/api/v1/me/direct-conversations' })).statusCode).toBe(401);
    const response = await enabled.inject({ method: 'GET', url: '/api/v1/me/direct-conversations?archived=true', headers: token });
    expect(response.statusCode).toBe(200); expect(response.headers['cache-control']).toBe('no-store');
    expect(service.list).toHaveBeenCalledWith(identity, true);
  });

  it('routes the complete foundation without accepting an arbitrary actor', async () => {
    const enabled = await app();
    expect((await enabled.inject({ method: 'POST', url: '/api/v1/me/direct-conversations', headers: token, payload: { targetPlayerId: targetId, content: 'Bonjour', idempotencyKey: key } })).statusCode).toBe(200);
    expect(service.initiate).toHaveBeenCalledWith(identity, targetId, 'Bonjour', key);
    expect((await enabled.inject({ method: 'POST', url: `/api/v1/me/direct-conversations/${conversationId}/messages`, headers: token, payload: { content: 'Suite', idempotencyKey: key } })).statusCode).toBe(200);
    expect((await enabled.inject({ method: 'POST', url: `/api/v1/me/direct-conversations/${conversationId}/accept`, headers: token, payload: { requestId, idempotencyKey: key } })).statusCode).toBe(200);
    expect((await enabled.inject({ method: 'POST', url: `/api/v1/me/direct-conversations/${conversationId}/ignore`, headers: token, payload: { requestId, idempotencyKey: key } })).statusCode).toBe(200);
    expect((await enabled.inject({ method: 'POST', url: `/api/v1/me/direct-conversations/${conversationId}/block`, headers: token, payload: { idempotencyKey: key } })).statusCode).toBe(200);
    expect((await enabled.inject({ method: 'POST', url: `/api/v1/me/direct-conversations/${conversationId}/read`, headers: token, payload: { messageId } })).statusCode).toBe(200);
    expect((await enabled.inject({ method: 'PATCH', url: `/api/v1/me/direct-conversations/${conversationId}/read-receipts`, headers: token, payload: { enabled: false } })).statusCode).toBe(200);
    expect((await enabled.inject({ method: 'PATCH', url: `/api/v1/me/direct-conversations/${conversationId}/archive`, headers: token, payload: { archived: true } })).statusCode).toBe(200);
    expect((await enabled.inject({ method: 'GET', url: '/api/v1/me/direct-conversations/unread', headers: token })).statusCode).toBe(200);
    expect((await enabled.inject({ method: 'GET', url: `/api/v1/me/direct-conversations/${conversationId}/messages?cursorId=${messageId}`, headers: token })).statusCode).toBe(400);
    expect((await enabled.inject({ method: 'POST', url: '/api/v1/me/direct-conversations', headers: token, payload: { targetPlayerId: targetId, content: 'Bonjour', idempotencyKey: key, authorPlayerId: targetId } })).statusCode).toBe(400);
  });
});
