import type { FastifyPluginAsync, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';

import type { EventService } from '../../application/event/event-service.js';
import { requireAuthenticatedIdentity } from '../auth/authentication.js';
import { AppError } from '../errors.js';

type Options = Readonly<{ authenticate: preHandlerHookHandler; service: EventService }>;
const joinSchema = z.object({ idempotencyKey: z.uuid() }).strict();

export const registerEventRoutes: FastifyPluginAsync<Options> = async (app, options) => {
  app.get('/api/v1/me/event', { preHandler: options.authenticate }, (request) =>
    options.service.getCurrent(requireAuthenticatedIdentity(request)));
  app.post('/api/v1/me/event/join', { preHandler: options.authenticate }, (request) => {
    const parsed = joinSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError('La demande d’inscription Event est invalide.', 400, 'VALIDATION_ERROR');
    return options.service.join(requireAuthenticatedIdentity(request), parsed.data.idempotencyKey);
  });
  app.post('/api/v1/me/event/game-a/attempt', { preHandler: options.authenticate }, (request) => {
    const parsed = joinSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError('La tentative du Jeu A est invalide.', 400, 'VALIDATION_ERROR');
    return options.service.attemptGameA(requireAuthenticatedIdentity(request), parsed.data.idempotencyKey);
  });
};
