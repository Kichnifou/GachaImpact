import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';
import type { GlobalChatService } from '../../application/chat/global-chat-service.js';
import type { ChatCommandDispatcher } from '../../application/chat/chat-command-dispatcher.js';
import { requireAuthenticatedIdentity } from '../auth/authentication.js';
import { AppError } from '../errors.js';

type Options = { authenticate: preHandlerHookHandler; service: GlobalChatService; dispatcher: ChatCommandDispatcher };
const uuid = z.uuid();
const params = z.object({ messageId: uuid }).strict();
const list = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50), cursorCreatedAt: z.iso.datetime().optional(), cursorId: uuid.optional() }).strict();
const send = z.object({ content: z.string().min(1).max(1000), idempotencyKey: uuid, replyToMessageId: uuid.nullish(), mentions: z.array(z.object({ playerId: uuid, displayName: z.string().min(1).max(100) }).strict()).max(10).optional() }).strict();
const read = z.object({ messageId: uuid }).strict();
const search = z.object({ q: z.string().min(1).max(100) }).strict();
const updates = z.object({ generation: z.coerce.number().int().min(0), cursorCreatedAt: z.iso.datetime().optional(), cursorId: uuid.optional(), knownIds: z.string().max(13_000).optional() }).strict();
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError('Paramètres Chat invalides.', 400, 'VALIDATION_ERROR');
  return result.data;
}

export async function registerChatRoutes(app: FastifyInstance, options: Options) {
  const config = { preHandler: options.authenticate };
  app.addHook('onSend', (_request, reply, _payload, done) => { reply.header('Cache-Control', 'no-store'); done(); });
  app.get('/api/v1/chat/messages', config, request => {
    const query = parse(list, request.query);
    if (Boolean(query.cursorId) !== Boolean(query.cursorCreatedAt)) throw new AppError('Curseur Chat invalide.', 400, 'VALIDATION_ERROR');
    return options.service.list(requireAuthenticatedIdentity(request), query.limit,
      query.cursorId && query.cursorCreatedAt ? { id: query.cursorId, createdAt: query.cursorCreatedAt } : undefined);
  });
  app.get('/api/v1/chat/updates', config, request => {
    const query = parse(updates, request.query);
    if (Boolean(query.cursorId) !== Boolean(query.cursorCreatedAt)) throw new AppError('Curseur Chat invalide.', 400, 'VALIDATION_ERROR');
    return options.service.updates(requireAuthenticatedIdentity(request), query.generation, query.cursorId && query.cursorCreatedAt ? { id: query.cursorId, createdAt: query.cursorCreatedAt } : undefined, query.knownIds?.split(',').filter(Boolean) ?? []);
  });
  app.post('/api/v1/chat/messages', config, request => {
    const body = parse(send, request.body);
    if (/^!clear(?:\s|$)/iu.test(body.content.trim())) return options.dispatcher.clear(requireAuthenticatedIdentity(request), body.content, body.idempotencyKey, body.replyToMessageId);
    return options.dispatcher.send(requireAuthenticatedIdentity(request), body.content, body.idempotencyKey, body.replyToMessageId, body.mentions);
  });
  app.get('/api/v1/chat/unread', config, async request => options.service.unreadCount(requireAuthenticatedIdentity(request)));
  app.post('/api/v1/chat/read', config, request => options.service.markRead(requireAuthenticatedIdentity(request), parse(read, request.body).messageId));
  app.delete('/api/v1/chat/messages/:messageId', config, request => options.service.deleteOwn(requireAuthenticatedIdentity(request), parse(params, request.params).messageId));
  app.get('/api/v1/chat/mentions', config, request => options.service.searchMentions(requireAuthenticatedIdentity(request), parse(search, request.query).q));
  app.post('/api/v1/chat/messages/:messageId/report', config, request => {
    if (request.body !== undefined && request.body !== null && Object.keys(parse(z.object({}).strict(), request.body)).length) throw new AppError('Paramètres Chat invalides.', 400, 'VALIDATION_ERROR');
    return options.service.report(requireAuthenticatedIdentity(request), parse(params, request.params).messageId);
  });
}
