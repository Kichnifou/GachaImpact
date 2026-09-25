import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';
import type { RankingService } from '../../application/ranking/ranking-service.js';
import { rankingRegistry, rankingCategories } from '../../application/ranking/ranking-service.js';
import type { SocialService } from '../../application/social/social-service.js';
import { requireAuthenticatedIdentity } from '../auth/authentication.js';
import { AppError } from '../errors.js';

const querySchema = z.object({ metric: z.string().max(40).default('xp'), page: z.coerce.number().int().min(1).max(1_000_000).default(1) }).strict();
export async function registerRankingRoutes(app: FastifyInstance, options: { authenticate: preHandlerHookHandler; service: RankingService; social: SocialService }) {
  app.addHook('onSend', (_request, reply, _payload, done) => { reply.header('Cache-Control', 'no-store'); done(); });
  app.get('/api/v1/rankings', { preHandler: options.authenticate }, async request => {
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) throw new AppError('Paramètres Classements invalides.', 400, 'RANKING_QUERY_INVALID');
    const actor = await options.social.actor(requireAuthenticatedIdentity(request));
    const result = await options.service.list(parsed.data.metric, actor.id, parsed.data.page);
    if (!result) throw new AppError('Métrique de classement inconnue.', 400, 'RANKING_METRIC_UNKNOWN');
    return { ...result, categories: rankingCategories, metrics: rankingRegistry };
  });
}
