import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';
import type { HistoryService } from '../../application/history/history-service.js';
import type { SocialService } from '../../application/social/social-service.js';
import { requireAuthenticatedIdentity } from '../auth/authentication.js';
import { AppError } from '../errors.js';
import { activityRanges } from '../../application/player/player-activity-service.js';

const querySchema = z.object({ category: z.enum(['banners', 'event', 'activity']), page: z.coerce.number().int().min(1).max(1_000_000).default(1) }).strict();

export async function registerHistoryRoutes(app: FastifyInstance, options: { authenticate: preHandlerHookHandler; service: HistoryService; social: SocialService }) {
  app.addHook('onSend', (_request, reply, _payload, done) => { reply.header('Cache-Control', 'no-store'); done(); });
  app.get('/api/v1/me/history/activity/statistics', { preHandler: options.authenticate }, async request => {
    const parsed = z.object({ range: z.enum(activityRanges).default('10d') }).strict().safeParse(request.query);
    if (!parsed.success) throw new AppError('Plage invalide.', 400, 'HISTORY_QUERY_INVALID');
    await options.social.actor(requireAuthenticatedIdentity(request));
    return options.service.activityStatistics(parsed.data.range);
  });
  app.get('/api/v1/me/history/activity/players', { preHandler: options.authenticate }, async request => {
    const parsed = z.object({ date: z.iso.date(), after: z.uuid().optional() }).strict().safeParse(request.query);
    if (!parsed.success) throw new AppError('Journée invalide.', 400, 'HISTORY_QUERY_INVALID');
    const actor = await options.social.actor(requireAuthenticatedIdentity(request));
    return options.service.activityNames(actor.id, parsed.data.date, parsed.data.after);
  });
  app.get('/api/v1/me/history', { preHandler: options.authenticate }, async request => {
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) throw new AppError('Paramètres Historique invalides.', 400, 'HISTORY_QUERY_INVALID');
    const actor = await options.social.actor(requireAuthenticatedIdentity(request));
    if (parsed.data.category === 'activity') return options.service.activity(parsed.data.page);
    return parsed.data.category === 'banners' ? options.service.banners(parsed.data.page) : options.service.events(actor.id, parsed.data.page);
  });
}
