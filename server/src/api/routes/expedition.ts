import type { FastifyPluginAsync, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';
import type { ExpeditionService, ExpeditionView } from '../../application/expedition/expedition-service.js';
import { requireAuthenticatedIdentity } from '../auth/authentication.js';
import { AppError } from '../errors.js';
import { toPlayerResourcesDto } from '../serializers/gameplay.js';

type Options = Readonly<{ authenticate: preHandlerHookHandler; service: ExpeditionService }>;
const startBody = z.object({ characterId: z.string().uuid(), idempotencyKey: z.string().uuid() }).strict();
const claimBody = z.object({ idempotencyKey: z.string().uuid() }).strict();

export const registerExpeditionRoutes: FastifyPluginAsync<Options> = async (app, options) => {
  app.get('/api/v1/me/expedition', { preHandler: options.authenticate }, async request => serializeView(await options.service.getState(requireAuthenticatedIdentity(request))));
  app.post('/api/v1/me/expedition/start', { preHandler: options.authenticate }, async request => { const body = parse(startBody, request.body); const result = await options.service.start(requireAuthenticatedIdentity(request), body.characterId, body.idempotencyKey); return { operation: result.operation, view: serializeView(result.view) }; });
  app.post('/api/v1/me/expedition/claim', { preHandler: options.authenticate }, async request => { const body = parse(claimBody, request.body); const result = await options.service.claim(requireAuthenticatedIdentity(request), body.idempotencyKey); return { operation: result.operation, reward: { ...result.reward, amount: result.reward.amount.toString() }, view: serializeView(result.view), resources: toPlayerResourcesDto(result.resources) }; });
};

function serializeView(view: ExpeditionView) { return { ...view, departedAt: view.departedAt?.toISOString() ?? null, readyAt: view.readyAt?.toISOString() ?? null, totalCompleted: view.totalCompleted.toString() }; }
function parse<Schema extends z.ZodType>(schema: Schema, value: unknown): z.infer<Schema> { const result = schema.safeParse(value); if (!result.success) throw new AppError('La requête Expédition est invalide.', 400, 'VALIDATION_ERROR'); return result.data; }
