import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import { z } from 'zod'
import type { ModerationTools } from '../../application/moderation/moderation-tools.js'
import { resourceKeys } from '../../domain/economy/resources.js'
import { requireAuthenticatedIdentity } from '../auth/authentication.js'
import { AppError } from '../errors.js'

type Options = Readonly<{ authenticate: preHandlerHookHandler; moderationTools: ModerationTools }>
const idempotencyKey = z.uuid()
const resourceSchema = z.object({ resourceKey: z.enum(resourceKeys), amount: z.string().regex(/^[1-9]\d*$/), direction: z.enum(['add', 'remove']), idempotencyKey }).strict()
const xpSchema = z.union([
  z.object({ totalXp: z.string().regex(/^\d+$/), idempotencyKey }).strict(),
  z.object({ prepareNextLevel: z.literal(true), idempotencyKey }).strict(),
])
const gachaSchema = z.object({ pity5: z.number().int().min(0).max(89).optional(), pity4: z.number().int().min(0).max(9).optional(), guaranteedFeatured5: z.boolean().optional(), captureProgress: z.number().int().min(0).max(3).optional(), idempotencyKey }).strict().refine((value) => value.pity5 !== undefined || value.pity4 !== undefined || value.guaranteedFeatured5 !== undefined || value.captureProgress !== undefined)
const stellaSchema = z.object({ quantity: z.string().regex(/^\d+$/), idempotencyKey }).strict()

export async function registerModerationRoutes(app: FastifyInstance, options: Options) {
  app.get('/api/v1/me/permissions', { preHandler: options.authenticate }, (request) => options.moderationTools.getPermissions(requireAuthenticatedIdentity(request)))
  app.get('/api/v1/moderation/me', { preHandler: options.authenticate }, (request) => options.moderationTools.getState(requireAuthenticatedIdentity(request)))
  app.post('/api/v1/moderation/me/resources', { preHandler: options.authenticate }, async (request) => {
    const value = parse(resourceSchema, request.body)
    return options.moderationTools.adjustResource(requireAuthenticatedIdentity(request), { ...value, amount: BigInt(value.amount) })
  })
  app.post('/api/v1/moderation/me/xp', { preHandler: options.authenticate }, async (request) => {
    const value = parse(xpSchema, request.body)
    return options.moderationTools.setXp(requireAuthenticatedIdentity(request), 'totalXp' in value ? { totalXp: BigInt(value.totalXp), idempotencyKey: value.idempotencyKey } : value)
  })
  app.post('/api/v1/moderation/me/gacha', { preHandler: options.authenticate }, async (request) => options.moderationTools.setGacha(requireAuthenticatedIdentity(request), parse(gachaSchema, request.body)))
  app.post('/api/v1/moderation/me/stella', { preHandler: options.authenticate }, async (request) => {
    const value = parse(stellaSchema, request.body)
    return options.moderationTools.setStella(requireAuthenticatedIdentity(request), { quantity: BigInt(value.quantity), idempotencyKey: value.idempotencyKey })
  })
}

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw new AppError('La demande de modération est invalide.', 400, 'VALIDATION_ERROR')
  return parsed.data
}
