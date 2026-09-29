import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';
import type { CurrentPlayerFavorService } from '../../application/favor/current-player-favor-service.js';
import { requireAuthenticatedIdentity } from '../auth/authentication.js';
import { AppError } from '../errors.js';

const empty = z.object({}).strict();
export async function registerFavorRoutes(app: FastifyInstance, options: {
  authenticate: preHandlerHookHandler; service: CurrentPlayerFavorService;
}) {
  app.addHook('onSend', (_request, reply, _payload, done) => { reply.header('Cache-Control', 'no-store'); done(); });
  app.get('/api/v1/me/favor', { preHandler: options.authenticate }, request => {
    if (!empty.safeParse(request.query).success) throw new AppError('Paramètres Faveur invalides.', 400, 'VALIDATION_ERROR');
    return options.service.get(requireAuthenticatedIdentity(request));
  });
  app.post('/api/v1/me/favor/presence', { preHandler: options.authenticate }, request => {
    if (!empty.safeParse(request.body === undefined ? {} : request.body).success || !empty.safeParse(request.query).success)
      throw new AppError('Paramètres de présence Faveur invalides.', 400, 'VALIDATION_ERROR');
    return options.service.presence(requireAuthenticatedIdentity(request));
  });
}
