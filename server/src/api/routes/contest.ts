import type { FastifyPluginAsync, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';
import type { ContestService } from '../../application/contest/contest-service.js';
import { requireAuthenticatedIdentity } from '../auth/authentication.js';
import { AppError } from '../errors.js';

type Options = Readonly<{ authenticate: preHandlerHookHandler; service: ContestService }>;

const key = z.string().uuid();
const characterMutation = z.object({ characterId: z.string().uuid(), idempotencyKey: key }).strict();
const simpleMutation = z.object({ idempotencyKey: key }).strict();
const readyMutation = z.object({ ready: z.boolean(), idempotencyKey: key }).strict();
const actionMutation = z.object({ action: z.enum(['BASIC', 'RISK']), idempotencyKey: key }).strict();
const supportMutation = z.object({ targetSlot: z.number().int().min(1).max(4), idempotencyKey: key }).strict();
const playerParams = z.object({ playerId: z.string().uuid() }).strict();
const contestParams = z.object({ contestId: z.string().uuid() }).strict();
const historyQuery = z.object({ page: z.coerce.number().int().min(1).default(1) }).strict();

export const registerContestRoutes: FastifyPluginAsync<Options> = async (app, options) => {
  app.get('/api/v1/contest', { preHandler: options.authenticate }, async (request) => options.service.getCurrent(requireAuthenticatedIdentity(request)));
  app.get('/api/v1/me/contest/legends', { preHandler: options.authenticate }, async (request) => (await options.service.getCurrent(requireAuthenticatedIdentity(request))).legends);
  app.get('/api/v1/contest/history', async (request) => options.service.getHistory(parse(historyQuery, request.query).page));
  app.get('/api/v1/contest/history/:contestId', async (request) => options.service.getHistoryDetail(parse(contestParams, request.params).contestId));

  app.post('/api/v1/contest/open', { preHandler: options.authenticate }, async (request) => {
    const body = parse(characterMutation, request.body); return options.service.createLobby(requireAuthenticatedIdentity(request), body.characterId, body.idempotencyKey);
  });
  app.post('/api/v1/contest/join', { preHandler: options.authenticate }, async (request) => {
    const body = parse(characterMutation, request.body); return options.service.joinAsParticipant(requireAuthenticatedIdentity(request), body.characterId, body.idempotencyKey);
  });
  app.post('/api/v1/contest/legend', { preHandler: options.authenticate }, async (request) => {
    const body = parse(characterMutation, request.body); return options.service.selectLegend(requireAuthenticatedIdentity(request), body.characterId, body.idempotencyKey);
  });
  app.post('/api/v1/contest/ready', { preHandler: options.authenticate }, async (request) => {
    const body = parse(readyMutation, request.body); return options.service.setReady(requireAuthenticatedIdentity(request), body.ready, body.idempotencyKey);
  });
  app.post('/api/v1/contest/start', { preHandler: options.authenticate }, async (request) => options.service.start(requireAuthenticatedIdentity(request), parse(simpleMutation, request.body).idempotencyKey));
  app.post('/api/v1/contest/spectator', { preHandler: options.authenticate }, async (request) => options.service.joinAsSpectator(requireAuthenticatedIdentity(request), parse(simpleMutation, request.body).idempotencyKey));
  app.post('/api/v1/contest/leave', { preHandler: options.authenticate }, async (request) => options.service.leave(requireAuthenticatedIdentity(request), parse(simpleMutation, request.body).idempotencyKey));
  app.post('/api/v1/contest/cancel', { preHandler: options.authenticate }, async (request) => options.service.cancel(requireAuthenticatedIdentity(request), parse(simpleMutation, request.body).idempotencyKey));
  app.post('/api/v1/contest/action', { preHandler: options.authenticate }, async (request) => {
    const body = parse(actionMutation, request.body); return options.service.play(requireAuthenticatedIdentity(request), body.action, body.idempotencyKey);
  });
  app.post('/api/v1/contest/support', { preHandler: options.authenticate }, async (request) => {
    const body = parse(supportMutation, request.body); return options.service.support(requireAuthenticatedIdentity(request), body.targetSlot, body.idempotencyKey);
  });
  app.delete('/api/v1/contest/participants/:playerId', { preHandler: options.authenticate }, async (request) => {
    const params = parse(playerParams, request.params); const body = parse(simpleMutation, request.body);
    return options.service.removeFromLobby(requireAuthenticatedIdentity(request), params.playerId, body.idempotencyKey);
  });
  app.delete('/api/v1/moderation/contest/participants/:playerId', { preHandler: options.authenticate }, async (request) => {
    const params = parse(playerParams, request.params); const body = parse(simpleMutation, request.body);
    return options.service.adminRemove(requireAuthenticatedIdentity(request), params.playerId, body.idempotencyKey);
  });
};

function parse<Schema extends z.ZodType>(schema: Schema, value: unknown): z.infer<Schema> {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError('La requête Concours est invalide.', 400, 'VALIDATION_ERROR');
  return result.data;
}
