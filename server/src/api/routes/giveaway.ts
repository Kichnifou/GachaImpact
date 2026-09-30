import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';
import type { GiveawayService } from '../../application/giveaway/giveaway-service.js';
import type { TwitchGiveawayManager } from '../../application/twitch/twitch-giveaway-manager.js';
import type { ModerationTools } from '../../application/moderation/moderation-tools.js';
import type { GetCurrentPlayer } from '../../application/player/get-current-player.js';
import { requireAuthenticatedIdentity } from '../auth/authentication.js';
import { AppError } from '../errors.js';

const key = z.uuid();
const openBody = z.object({ idempotencyKey: key }).strict();
const closeBody = z.object({ sessionId: z.uuid(), idempotencyKey: key }).strict();
const retryParams = z.object({ announcementId: z.uuid() });

export async function registerGiveawayRoutes(app: FastifyInstance, options: { authenticate: preHandlerHookHandler;
  core: GiveawayService; bridge: TwitchGiveawayManager; moderation: ModerationTools; getPlayer: GetCurrentPlayer }) {
  const actor = async (request: Parameters<typeof requireAuthenticatedIdentity>[0]) => {
    const identity = requireAuthenticatedIdentity(request);
    const permissions = await options.moderation.getPermissions(identity);
    if (!permissions.capabilities.communityModeration) throw new AppError('Accès Giveaway réservé à la modération.', 403, 'GIVEAWAY_FORBIDDEN');
    return options.getPlayer.execute(identity);
  };
  const authenticated = { preHandler: options.authenticate };
  app.get('/api/v1/moderation/giveaway', authenticated, async request => { await actor(request); return options.core.state(); });
  app.post('/api/v1/moderation/giveaway/open', authenticated, async request => {
    const parsed = openBody.safeParse(request.body);
    if (!parsed.success) throw new AppError('Paramètres Giveaway invalides.', 400, 'VALIDATION_ERROR');
    const player = await actor(request);
    const opened = await options.core.open(player.id, 'ADMIN', `admin:${parsed.data.idempotencyKey}`);
    if (opened.sessionId) await options.bridge.sendSessionMilestones(opened.sessionId);
    return options.core.state();
  });
  app.post('/api/v1/moderation/giveaway/close', authenticated, async request => {
    const parsed = closeBody.safeParse(request.body);
    if (!parsed.success) throw new AppError('Paramètres Giveaway invalides.', 400, 'VALIDATION_ERROR');
    const player = await actor(request);
    const closed = await options.core.close(player.id, 'ADMIN', parsed.data.sessionId, `admin:${parsed.data.idempotencyKey}`);
    if (closed.sessionId) await options.bridge.sendSessionMilestones(closed.sessionId);
    return options.core.state();
  });
  app.post('/api/v1/moderation/giveaway/announcements/:announcementId/retry', authenticated, async request => {
    await actor(request);
    const params = retryParams.safeParse(request.params);
    if (!params.success || !z.object({}).strict().safeParse(request.body ?? {}).success)
      throw new AppError('Paramètres Giveaway invalides.', 400, 'VALIDATION_ERROR');
    const state = await options.core.state();
    const announcement = state.session?.announcements.find(row => row.id === params.data.announcementId);
    if (!announcement || announcement.state !== 'FAILED') throw new AppError('Seul un envoi certainement échoué peut être retenté.', 409, 'GIVEAWAY_RETRY_FORBIDDEN');
    await options.bridge.sendAnnouncement(announcement.id, true);
    return options.core.state();
  });
}
