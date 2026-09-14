import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';

import type { GiftCodeService } from '../../application/gift-code/gift-code-service.js';
import { resourceKeys } from '../../domain/economy/resources.js';
import { requireAuthenticatedIdentity } from '../auth/authentication.js';
import { AppError } from '../errors.js';

type Options = Readonly<{ authenticate: preHandlerHookHandler; service: GiftCodeService }>;
const uuid = z.uuid();
const idempotencyKey = z.uuid();
const codeParams = z.object({ codeId: uuid }).strict();
const editionParams = z.object({ editionId: uuid }).strict();
const rewardsSchema = z.array(z.object({ resourceKey: z.enum(resourceKeys), amount: z.string().regex(/^\d+$/) }).strict()).min(1).max(9);
const draftSchema = z.object({
  token: z.string().max(64).optional(), title: z.string().trim().min(1).max(120), description: z.string().trim().min(1).max(500),
  type: z.enum(['ONE_OFF', 'ANNUAL']), recurringMonth: z.number().int().min(1).max(12).optional(),
  startsAt: z.iso.datetime({ offset: true }).optional(), endsAt: z.iso.datetime({ offset: true }).optional(), rewards: rewardsSchema, idempotencyKey,
}).strict();
const updateSchema = z.object({ token: z.string().max(64).optional(), title: z.string().trim().min(1).max(120).optional(), description: z.string().trim().min(1).max(500).optional(), type: z.enum(['ONE_OFF', 'ANNUAL']).optional(), recurringMonth: z.number().int().min(1).max(12).optional(), startsAt: z.iso.datetime({ offset: true }).optional(), endsAt: z.iso.datetime({ offset: true }).optional(), rewards: rewardsSchema.optional(), disabled: z.boolean().optional(), idempotencyKey }).strict();
const mutationSchema = z.object({ idempotencyKey }).strict();

export async function registerGiftCodeRoutes(app: FastifyInstance, options: Options) {
  const identity = (request: Parameters<typeof requireAuthenticatedIdentity>[0]) => requireAuthenticatedIdentity(request);
  app.get('/api/v1/me/gift-codes', { preHandler: options.authenticate }, (request) => options.service.listForPlayer(identity(request)));
  app.post('/api/v1/me/gift-codes/:editionId/claim', { preHandler: options.authenticate }, (request) => options.service.claim(identity(request), parse(editionParams, request.params).editionId, parse(mutationSchema, request.body).idempotencyKey));
  app.get('/api/v1/moderation/gift-codes', { preHandler: options.authenticate }, (request) => options.service.listAdmin(identity(request)));
  app.post('/api/v1/moderation/gift-codes', { preHandler: options.authenticate }, (request) => { const value = parse(draftSchema, request.body); return options.service.createDraft(identity(request), { ...value, startsAt: value.startsAt ? new Date(value.startsAt) : undefined, endsAt: value.endsAt ? new Date(value.endsAt) : undefined, rewards: value.rewards.map((reward) => ({ ...reward, amount: BigInt(reward.amount) })) }); });
  app.post('/api/v1/moderation/gift-codes/:codeId/publish', { preHandler: options.authenticate }, (request) => options.service.publish(identity(request), parse(codeParams, request.params).codeId, parse(mutationSchema, request.body).idempotencyKey));
  app.patch('/api/v1/moderation/gift-codes/:codeId', { preHandler: options.authenticate }, (request) => { const value = parse(updateSchema, request.body); return options.service.update(identity(request), parse(codeParams, request.params).codeId, { ...value, startsAt: value.startsAt ? new Date(value.startsAt) : undefined, endsAt: value.endsAt ? new Date(value.endsAt) : undefined, rewards: value.rewards?.map((reward) => ({ ...reward, amount: BigInt(reward.amount) })) }); });
  app.get('/api/v1/moderation/gift-codes/:codeId/claimants', { preHandler: options.authenticate }, (request) => options.service.claimants(identity(request), parse(codeParams, request.params).codeId));
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T { const parsed = schema.safeParse(value); if (!parsed.success) throw new AppError('La demande de code cadeau est invalide.', 400, 'VALIDATION_ERROR'); return parsed.data; }
