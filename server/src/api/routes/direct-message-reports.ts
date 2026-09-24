import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';
import type { DirectMessageReportService } from '../../application/direct-messages/direct-message-report-service.js';
import { requireAuthenticatedIdentity } from '../auth/authentication.js';
import { AppError } from '../errors.js';

type Options = Readonly<{ authenticate: preHandlerHookHandler; service: DirectMessageReportService }>;
const playerParams = z.object({ conversationId: z.uuid(), messageId: z.uuid() }).strict();
const moderationParams = z.object({ reportId: z.uuid() }).strict();
const reportBody = z.object({ snapshotFingerprint: z.string().regex(/^[0-9a-f]{64}$/u) }).strict();
const listQuery = z.object({ page: z.coerce.number().int().min(1).default(1) }).strict();
const emptyQuery = z.object({}).strict();

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError('Paramètres de signalement invalides.', 400, 'VALIDATION_ERROR');
  return result.data;
}

export async function registerDirectMessageReportRoutes(app: FastifyInstance, options: Options) {
  const config = { preHandler: options.authenticate };
  app.addHook('onSend', (_request, reply, _payload, done) => { reply.header('Cache-Control', 'no-store'); done(); });
  app.get('/api/v1/me/direct-conversations/:conversationId/messages/:messageId/report-preview', config, request => {
    const params = parse(playerParams, request.params);
    return options.service.preview(requireAuthenticatedIdentity(request), params.conversationId, params.messageId);
  });
  app.post('/api/v1/me/direct-conversations/:conversationId/messages/:messageId/report', config, request => {
    const params = parse(playerParams, request.params), body = parse(reportBody, request.body);
    return options.service.report(requireAuthenticatedIdentity(request), params.conversationId, params.messageId, body.snapshotFingerprint);
  });
  app.get('/api/v1/moderation/direct-message-reports', config, request => options.service.list(requireAuthenticatedIdentity(request), parse(listQuery, request.query).page));
  app.get('/api/v1/moderation/direct-message-reports/:reportId', config, request => { parse(emptyQuery, request.query); return options.service.detail(requireAuthenticatedIdentity(request), parse(moderationParams, request.params).reportId); });
}
