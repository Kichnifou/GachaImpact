import type { FastifyPluginAsync, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';
import type { NotificationService } from '../../application/notification/notification-service.js';
import { requireAuthenticatedIdentity } from '../auth/authentication.js';
import { AppError } from '../errors.js';

type Options = Readonly<{ authenticate: preHandlerHookHandler; service: NotificationService }>;
const paramsSchema = z.object({ notificationId: z.string().uuid() }).strict();
export const registerNotificationRoutes: FastifyPluginAsync<Options> = async (app, options) => {
  app.get('/api/v1/me/notifications', { preHandler: options.authenticate }, async request => serialize(await options.service.list(requireAuthenticatedIdentity(request))));
  app.post('/api/v1/me/notifications/read-all', { preHandler: options.authenticate }, async request => serialize(await options.service.readAll(requireAuthenticatedIdentity(request))));
  app.post('/api/v1/me/notifications/archive-read', { preHandler: options.authenticate }, async request => serialize(await options.service.archiveRead(requireAuthenticatedIdentity(request))));
  app.post('/api/v1/me/notifications/:notificationId/read', { preHandler: options.authenticate }, async request => { const parsed = paramsSchema.safeParse(request.params); if (!parsed.success) throw new AppError('La notification demandée est invalide.', 400, 'VALIDATION_ERROR'); return serialize(await options.service.readOne(requireAuthenticatedIdentity(request), parsed.data.notificationId)); });
};
function serialize(value: Awaited<ReturnType<NotificationService['list']>>) { return { unreadCount: value.unreadCount, notifications: value.notifications.map(item => ({ ...item, createdAt: item.createdAt.toISOString(), readAt: item.readAt?.toISOString() ?? null, resolvedAt: item.resolvedAt?.toISOString() ?? null, archivedAt: item.archivedAt?.toISOString() ?? null })) }; }
