import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';
import type { HistoryService } from '../../application/history/history-service.js';
import type { SocialService } from '../../application/social/social-service.js';
import { requireAuthenticatedIdentity } from '../auth/authentication.js';
import { AppError } from '../errors.js';

const querySchema = z.object({ category: z.enum(['banners', 'event']), page: z.coerce.number().int().min(1).max(1_000_000).default(1) }).strict();

export async function registerHistoryRoutes(app: FastifyInstance, options: { authenticate: preHandlerHookHandler; service: HistoryService; social: SocialService }) {
  app.addHook('onSend', (_request, reply, _payload, done) => { reply.header('Cache-Control', 'no-store'); done(); });
  app.get('/api/v1/me/history', { preHandler: options.authenticate }, async request => {
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) throw new AppError('Paramètres Historique invalides.', 400, 'HISTORY_QUERY_INVALID');
    const actor = await options.social.actor(requireAuthenticatedIdentity(request));
    return parsed.data.category === 'banners' ? options.service.banners(parsed.data.page) : options.service.events(actor.id, parsed.data.page);
  });
}
