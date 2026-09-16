import type { FastifyPluginAsync, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';

import type { EventService } from '../../application/event/event-service.js';
import { requireAuthenticatedIdentity } from '../auth/authentication.js';
import { AppError } from '../errors.js';

type Options = Readonly<{ authenticate: preHandlerHookHandler; service: EventService }>;
const joinSchema = z.object({ idempotencyKey: z.uuid() }).strict();
const gameBAttemptSchema = z.object({ code: z.string().regex(/^[01]{5}$/), idempotencyKey: z.uuid() }).strict();
const gameCSearchSchema = z.object({ q: z.string().trim().min(2).max(100), page: z.coerce.number().int().min(1).max(50).default(1) }).strict();
const gameCSendSchema = z.object({ recipientPlayerId: z.uuid(), message: z.string().trim().min(1).max(500), idempotencyKey: z.uuid() }).strict();

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
  app.post('/api/v1/me/event/game-b/attempt', { preHandler: options.authenticate }, (request) => {
    const parsed = gameBAttemptSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError('La tentative du Jeu B est invalide.', 400, 'VALIDATION_ERROR');
    return options.service.attemptGameB(requireAuthenticatedIdentity(request), parsed.data.code, parsed.data.idempotencyKey);
  });
  app.get('/api/v1/me/event/game-c/recipients', { preHandler: options.authenticate }, (request) => {
    const parsed = gameCSearchSchema.safeParse(request.query);
    if (!parsed.success) throw new AppError('La recherche de destinataire est invalide.', 400, 'VALIDATION_ERROR');
    return options.service.searchGameCRecipients(requireAuthenticatedIdentity(request), parsed.data.q, parsed.data.page);
  });
  app.post('/api/v1/me/event/game-c/send', { preHandler: options.authenticate }, (request) => {
    const parsed = gameCSendSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError('Le message du Festival est invalide.', 400, 'VALIDATION_ERROR');
    return options.service.sendGameC(requireAuthenticatedIdentity(request), parsed.data.recipientPlayerId, parsed.data.message, parsed.data.idempotencyKey);
  });
  app.post('/api/v1/me/event/game-c/messages/consult', { preHandler: options.authenticate }, (request) => {
    if (request.body && (typeof request.body !== 'object' || Object.keys(request.body).length > 0)) throw new AppError('La consultation est invalide.', 400, 'VALIDATION_ERROR');
    return options.service.consultGameCMessages(requireAuthenticatedIdentity(request));
  });
};
