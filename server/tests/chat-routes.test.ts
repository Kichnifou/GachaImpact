import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import type { GlobalChatService } from '../src/application/chat/global-chat-service.js';
import type { ChatCommandDispatcher } from '../src/application/chat/chat-command-dispatcher.js';
import type { GetOrProvisionCurrentPlayer } from '../src/application/player/get-or-provision-current-player.js';

const token = { authorization: 'Bearer test-token' };
const messageId = '11111111-1111-4111-8111-111111111111';
const playerId = '22222222-2222-4222-8222-222222222222';
const identity = { subject: 'test-subject' };
const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
const service = {
  list: vi.fn(async () => ({ messages: [{ id: messageId, content: 'bonjour' }], nextCursor: { id: messageId, createdAt: '2026-09-22T10:00:00.000Z' }, generation: 0 })),
  updates: vi.fn(async () => ({ messages: [], changes: [], generation: 0, reset: false })),
  unreadCount: vi.fn(async () => ({ unreadCount: 3, generation: 0 })),
  markRead: vi.fn(async () => ({ lastReadMessageId: messageId, changed: true })),
  deleteOwn: vi.fn(async () => ({ id: messageId, changed: true })),
  searchMentions: vi.fn(async () => ({ players: [{ id: playerId, displayName: 'Éléa', elementKey: 'cryo' }] })),
  report: vi.fn(async () => ({ reported: true, duplicate: false })),
};
const dispatcher = { send: vi.fn(async () => ({ message: { id: messageId, content: 'bonjour' }, result: null, results: [], refreshScopes: [], replayed: false })), clear: vi.fn(async () => ({ cleared: true, generation: 1, replayed: false })) };

async function app(withChat = true) {
  const instance = await buildApp({ host: '127.0.0.1', port: 3001, supabase: {} }, {
    authIdentityVerifier: { verify: async () => identity },
    getOrProvisionCurrentPlayer: {} as GetOrProvisionCurrentPlayer,
    ...(withChat ? { globalChatService: service as unknown as GlobalChatService, chatCommandDispatcher: dispatcher as unknown as ChatCommandDispatcher } : {}),
  });
  apps.push(instance);
  return instance;
}
afterEach(async () => { vi.clearAllMocks(); await Promise.all(apps.splice(0).map(item => item.close())); });

describe('authenticated Chat routes', () => {
  it('registers only with Chat dependencies, requires auth and disables caching', async () => {
    expect((await (await app(false)).inject({ method: 'GET', url: '/api/v1/chat/messages', headers: token })).statusCode).toBe(404);
    const enabled = await app();
    expect((await enabled.inject({ method: 'GET', url: '/api/v1/chat/messages' })).statusCode).toBe(401);
    const response = await enabled.inject({ method: 'GET', url: '/api/v1/chat/messages', headers: token });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json().messages[0].id).toBe(messageId);
    expect(service.list).toHaveBeenCalledWith(identity, 50, undefined);
  });

  it('validates cursor, send payload and server-owned message identity', async () => {
    const enabled = await app();
    const page = await enabled.inject({ method: 'GET', url: `/api/v1/chat/messages?limit=5&cursorId=${messageId}&cursorCreatedAt=2026-09-22T10%3A00%3A00.000Z`, headers: token });
    expect(page.statusCode).toBe(200);
    expect(service.list).toHaveBeenCalledWith(identity, 5, { id: messageId, createdAt: '2026-09-22T10:00:00.000Z' });
    expect((await enabled.inject({ method: 'GET', url: `/api/v1/chat/messages?cursorId=${messageId}`, headers: token })).statusCode).toBe(400);
    const invalid = await enabled.inject({ method: 'POST', url: '/api/v1/chat/messages', headers: token, payload: { content: 'bonjour', idempotencyKey: messageId, messageType: 'GAME_RESULT' } });
    expect(invalid.statusCode).toBe(400);
    expect(dispatcher.send).not.toHaveBeenCalled();
    const sent = await enabled.inject({ method: 'POST', url: '/api/v1/chat/messages', headers: token,
      payload: { content: 'bonjour', idempotencyKey: messageId, replyToMessageId: null, mentions: [{ playerId, displayName: 'Éléa' }] } });
    expect(sent.statusCode).toBe(200);
    expect(dispatcher.send).toHaveBeenCalledWith(identity, 'bonjour', messageId, null, [{ playerId, displayName: 'Éléa' }]);
  });

  it('reads incremental updates with a complete anchor and bounded known messages', async () => {
    const enabled = await app();
    const response = await enabled.inject({ method: 'POST', url: '/api/v1/chat/updates', headers: token, payload: { generation: 0, cursorId: messageId, cursorCreatedAt: '2026-09-22T10:00:00.000Z', knownIds: [messageId] } });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(service.updates).toHaveBeenCalledWith(identity, 0, { id: messageId, createdAt: '2026-09-22T10:00:00.000Z' }, [messageId]);
    expect((await enabled.inject({ method: 'POST', url: '/api/v1/chat/updates', headers: token, payload: { generation: 0, cursorId: messageId } })).statusCode).toBe(400);
    expect((await enabled.inject({ method: 'POST', url: '/api/v1/chat/updates', headers: token, payload: { generation: 0, knownIds: Array.from({ length: 201 }, () => messageId) } })).statusCode).toBe(400);
    expect((await enabled.inject({ method: 'POST', url: '/api/v1/chat/updates', headers: token, payload: { generation: 0 } })).statusCode).toBe(200);
    expect(service.updates).toHaveBeenLastCalledWith(identity, 0, undefined, []);
  });

  it('routes unread, read, delete, mention search and private report without arbitrary reads', async () => {
    const enabled = await app();
    expect((await enabled.inject({ method: 'GET', url: '/api/v1/chat/unread', headers: token })).json()).toEqual({ unreadCount: 3, generation: 0 });
    expect((await enabled.inject({ method: 'POST', url: '/api/v1/chat/read', headers: token, payload: { messageId } })).statusCode).toBe(200);
    expect((await enabled.inject({ method: 'DELETE', url: `/api/v1/chat/messages/${messageId}`, headers: token })).statusCode).toBe(200);
    expect((await enabled.inject({ method: 'GET', url: '/api/v1/chat/mentions?q=elea', headers: token })).json().players[0].id).toBe(playerId);
    expect((await enabled.inject({ method: 'GET', url: '/api/v1/chat/mentions?q=', headers: token })).statusCode).toBe(200);
    expect(service.searchMentions).toHaveBeenLastCalledWith(identity, '');
    expect((await enabled.inject({ method: 'POST', url: `/api/v1/chat/messages/${messageId}/report`, headers: token })).statusCode).toBe(200);
    expect(service.report).toHaveBeenCalledWith(identity, messageId);
    expect((await enabled.inject({ method: 'POST', url: `/api/v1/chat/messages/${messageId}/report`, headers: token, payload: { reason: 'invented' } })).statusCode).toBe(400);
    expect((await enabled.inject({ method: 'GET', url: '/api/v1/chat/reports', headers: token })).statusCode).toBe(404);
  });

  it('dispatches !clear without publishing a normal command result', async () => {
    const enabled = await app();
    const response = await enabled.inject({ method: 'POST', url: '/api/v1/chat/messages', headers: token, payload: { content: '!clear', idempotencyKey: messageId } });
    expect(response.json()).toEqual({ cleared: true, generation: 1, replayed: false });
    expect(dispatcher.clear).toHaveBeenCalledWith(identity, '!clear', messageId, undefined);
    expect(dispatcher.send).not.toHaveBeenCalled();
  });
});
