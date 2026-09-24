import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';
import type { DirectMessageService } from '../../application/direct-messages/direct-message-service.js';
import { requireAuthenticatedIdentity } from '../auth/authentication.js';
import { AppError } from '../errors.js';

type Options = { authenticate: preHandlerHookHandler; service: DirectMessageService };
const uuid = z.uuid();
const conversationParams = z.object({ conversationId: uuid }).strict();
const messageParams = z.object({ conversationId: uuid, messageId: uuid }).strict();
const listQuery = z.object({ archived: z.enum(['true', 'false']).default('false') }).strict();
const messagesQuery = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50), cursorCreatedAt: z.iso.datetime().optional(), cursorId: uuid.optional() }).strict();
const historyOrder = z.string().regex(/^[1-9]\d*$/u);
const historyQuery = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50), beforeOrder: historyOrder.optional(), afterOrder: historyOrder.optional(), aroundOrder: historyOrder.optional() }).strict();
const historySearchQuery = z.object({ q: z.string().trim().min(1).max(100), limit: z.coerce.number().int().min(1).max(100).default(50), cursor: historyOrder.optional() }).strict();
const historyDateQuery = z.object({ at: z.iso.datetime({ offset: true }) }).strict();
const playerSearchQuery = z.object({ q: z.string().trim().min(1).max(100) }).strict();
const initiateBody = z.object({ targetPlayerId: uuid, content: z.string().min(1).max(2000), idempotencyKey: uuid }).strict();
const sendBody = z.object({ content: z.string().min(1).max(2000), idempotencyKey: uuid }).strict();
const editBody = z.object({ content: z.string().min(1).max(2000), idempotencyKey: uuid }).strict();
const resolveBody = z.object({ requestId: uuid, idempotencyKey: uuid }).strict();
const keyBody = z.object({ idempotencyKey: uuid }).strict();
const readBody = z.object({ messageId: uuid }).strict();
const receiptBody = z.object({ enabled: z.boolean() }).strict();
const archiveBody = z.object({ archived: z.boolean() }).strict();
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError('Paramètres de messagerie privée invalides.', 400, 'VALIDATION_ERROR');
  return result.data;
}

export async function registerDirectMessageRoutes(app: FastifyInstance, options: Options) {
  const config = { preHandler: options.authenticate };
  app.addHook('onSend', (_request, reply, _payload, done) => { reply.header('Cache-Control', 'no-store'); done(); });
  app.get('/api/v1/me/direct-conversations/unread', config, request => options.service.unread(requireAuthenticatedIdentity(request)));
  app.get('/api/v1/me/direct-conversations/players', config, request => options.service.searchPlayers(requireAuthenticatedIdentity(request), parse(playerSearchQuery, request.query).q));
  app.get('/api/v1/me/direct-conversations', config, request => options.service.list(requireAuthenticatedIdentity(request), parse(listQuery, request.query).archived === 'true'));
  app.post('/api/v1/me/direct-conversations', config, request => { const body = parse(initiateBody, request.body); return options.service.initiate(requireAuthenticatedIdentity(request), body.targetPlayerId, body.content, body.idempotencyKey); });
  app.get('/api/v1/me/direct-conversations/:conversationId/history', config, request => {
    const params = parse(conversationParams, request.params), query = parse(historyQuery, request.query);
    if ([query.beforeOrder, query.afterOrder, query.aroundOrder].filter(Boolean).length > 1) throw new AppError('Curseurs historiques incompatibles.', 400, 'VALIDATION_ERROR');
    return options.service.history(requireAuthenticatedIdentity(request), params.conversationId, query.limit, query);
  });
  app.get('/api/v1/me/direct-conversations/:conversationId/history/search', config, request => {
    const params = parse(conversationParams, request.params), query = parse(historySearchQuery, request.query);
    return options.service.searchHistory(requireAuthenticatedIdentity(request), params.conversationId, query.q, query.limit, query.cursor);
  });
  app.get('/api/v1/me/direct-conversations/:conversationId/history/date', config, request => {
    const params = parse(conversationParams, request.params), query = parse(historyDateQuery, request.query);
    return options.service.historyDate(requireAuthenticatedIdentity(request), params.conversationId, query.at);
  });
  app.get('/api/v1/me/direct-conversations/:conversationId/messages', config, request => {
    const params = parse(conversationParams, request.params), query = parse(messagesQuery, request.query);
    if (Boolean(query.cursorId) !== Boolean(query.cursorCreatedAt)) throw new AppError('Curseur de messagerie privée invalide.', 400, 'VALIDATION_ERROR');
    return options.service.messages(requireAuthenticatedIdentity(request), params.conversationId, query.limit, query.cursorId && query.cursorCreatedAt ? { id: query.cursorId, createdAt: query.cursorCreatedAt } : undefined);
  });
  app.post('/api/v1/me/direct-conversations/:conversationId/messages', config, request => { const params = parse(conversationParams, request.params), body = parse(sendBody, request.body); return options.service.send(requireAuthenticatedIdentity(request), params.conversationId, body.content, body.idempotencyKey); });
  app.patch('/api/v1/me/direct-conversations/:conversationId/messages/:messageId', config, request => { const params = parse(messageParams, request.params), body = parse(editBody, request.body); return options.service.editMessage(requireAuthenticatedIdentity(request), params.conversationId, params.messageId, body.content, body.idempotencyKey); });
  app.post('/api/v1/me/direct-conversations/:conversationId/messages/:messageId/delete', config, request => { const params = parse(messageParams, request.params), body = parse(keyBody, request.body); return options.service.deleteMessage(requireAuthenticatedIdentity(request), params.conversationId, params.messageId, body.idempotencyKey); });
  app.post('/api/v1/me/direct-conversations/:conversationId/messages/:messageId/restore', config, request => { const params = parse(messageParams, request.params), body = parse(keyBody, request.body); return options.service.restoreMessage(requireAuthenticatedIdentity(request), params.conversationId, params.messageId, body.idempotencyKey); });
  app.post('/api/v1/me/direct-conversations/:conversationId/accept', config, request => { const params = parse(conversationParams, request.params), body = parse(resolveBody, request.body); return options.service.resolve(requireAuthenticatedIdentity(request), params.conversationId, body.requestId, 'ACCEPT', body.idempotencyKey); });
  app.post('/api/v1/me/direct-conversations/:conversationId/ignore', config, request => { const params = parse(conversationParams, request.params), body = parse(resolveBody, request.body); return options.service.resolve(requireAuthenticatedIdentity(request), params.conversationId, body.requestId, 'IGNORE', body.idempotencyKey); });
  app.post('/api/v1/me/direct-conversations/:conversationId/block', config, request => { const params = parse(conversationParams, request.params), body = parse(keyBody, request.body); return options.service.block(requireAuthenticatedIdentity(request), params.conversationId, body.idempotencyKey); });
  app.post('/api/v1/me/direct-conversations/:conversationId/unblock', config, request => { const params = parse(conversationParams, request.params), body = parse(keyBody, request.body); return options.service.unblock(requireAuthenticatedIdentity(request), params.conversationId, body.idempotencyKey); });
  app.post('/api/v1/me/direct-conversations/:conversationId/read', config, request => { const params = parse(conversationParams, request.params), body = parse(readBody, request.body); return options.service.markRead(requireAuthenticatedIdentity(request), params.conversationId, body.messageId); });
  app.patch('/api/v1/me/direct-conversations/:conversationId/read-receipts', config, request => { const params = parse(conversationParams, request.params), body = parse(receiptBody, request.body); return options.service.setReadReceipts(requireAuthenticatedIdentity(request), params.conversationId, body.enabled); });
  app.patch('/api/v1/me/direct-conversations/:conversationId/archive', config, request => { const params = parse(conversationParams, request.params), body = parse(archiveBody, request.body); return options.service.archive(requireAuthenticatedIdentity(request), params.conversationId, body.archived); });
}
