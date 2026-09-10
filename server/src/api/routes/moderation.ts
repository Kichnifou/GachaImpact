import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import { z } from 'zod'
import type { ModerationTools } from '../../application/moderation/moderation-tools.js'
import { resourceKeys } from '../../domain/economy/resources.js'
import { requireAuthenticatedIdentity } from '../auth/authentication.js'
import { AppError } from '../errors.js'
type Options = Readonly<{ authenticate: preHandlerHookHandler; moderationTools: ModerationTools }>
const idempotencyKey = z.uuid(); const playerParams = z.object({ playerId: z.uuid() }).strict()
const resourceSchema = z.object({ resourceKey: z.enum(resourceKeys), amount: z.string().regex(/^[1-9]\d*$/), direction: z.enum(['add', 'remove']), idempotencyKey }).strict()
const xpSchema = z.union([z.object({ totalXp: z.string().regex(/^\d+$/), idempotencyKey }).strict(), z.object({ prepareNextLevel: z.literal(true), idempotencyKey }).strict()])
const gachaSchema = z.object({ pity5: z.number().int().min(0).max(89).optional(), pity4: z.number().int().min(0).max(9).optional(), guaranteedFeatured5: z.boolean().optional(), captureProgress: z.number().int().min(0).max(3).optional(), idempotencyKey }).strict().refine((value) => value.pity5 !== undefined || value.pity4 !== undefined || value.guaranteedFeatured5 !== undefined || value.captureProgress !== undefined)
const stellaSchema = z.object({ quantity: z.string().regex(/^\d+$/), idempotencyKey }).strict(); const testerSchema = z.object({ enabled: z.boolean(), idempotencyKey }).strict()
export async function registerModerationRoutes(app: FastifyInstance, options: Options) {
  const identity = (request: Parameters<typeof requireAuthenticatedIdentity>[0]) => requireAuthenticatedIdentity(request)
  app.get('/api/v1/me/permissions', { preHandler: options.authenticate }, (request) => options.moderationTools.getPermissions(identity(request)))
  app.get('/api/v1/moderation/me', { preHandler: options.authenticate }, (request) => options.moderationTools.getState(identity(request)))
  app.post('/api/v1/moderation/me/resources', { preHandler: options.authenticate }, async (request) => { const value = parse(resourceSchema, request.body); const actor = identity(request); const state = await options.moderationTools.getState(actor); return options.moderationTools.adjustResource(actor, state.player.id, { ...value, amount: BigInt(value.amount) }) })
  app.post('/api/v1/moderation/me/xp', { preHandler: options.authenticate }, async (request) => { const value = parse(xpSchema, request.body); const actor = identity(request); const state = await options.moderationTools.getState(actor); return options.moderationTools.setXp(actor, state.player.id, 'totalXp' in value ? { totalXp: BigInt(value.totalXp), idempotencyKey: value.idempotencyKey } : value) })
  app.post('/api/v1/moderation/me/gacha', { preHandler: options.authenticate }, async (request) => { const actor = identity(request); const state = await options.moderationTools.getState(actor); return options.moderationTools.setGacha(actor, state.player.id, parse(gachaSchema, request.body)) })
  app.post('/api/v1/moderation/me/stella', { preHandler: options.authenticate }, async (request) => { const value = parse(stellaSchema, request.body); const actor = identity(request); const state = await options.moderationTools.getState(actor); return options.moderationTools.setStella(actor, state.player.id, { quantity: BigInt(value.quantity), idempotencyKey: value.idempotencyKey }) })
  app.get('/api/v1/moderation/players', { preHandler: options.authenticate }, (request) => options.moderationTools.listPlayers(identity(request), z.object({ query: z.string().max(100).optional().default('') }).parse(request.query).query))
  app.get('/api/v1/moderation/players/:playerId/state', { preHandler: options.authenticate }, (request) => options.moderationTools.getState(identity(request), parse(playerParams, request.params).playerId))
  app.post('/api/v1/moderation/players/:playerId/resources', { preHandler: options.authenticate }, async (request) => { const value = parse(resourceSchema, request.body); return options.moderationTools.adjustResource(identity(request), parse(playerParams, request.params).playerId, { ...value, amount: BigInt(value.amount) }) })
  app.post('/api/v1/moderation/players/:playerId/xp', { preHandler: options.authenticate }, async (request) => { const value = parse(xpSchema, request.body); return options.moderationTools.setXp(identity(request), parse(playerParams, request.params).playerId, 'totalXp' in value ? { totalXp: BigInt(value.totalXp), idempotencyKey: value.idempotencyKey } : value) })
  app.post('/api/v1/moderation/players/:playerId/gacha', { preHandler: options.authenticate }, (request) => options.moderationTools.setGacha(identity(request), parse(playerParams, request.params).playerId, parse(gachaSchema, request.body)))
  app.post('/api/v1/moderation/players/:playerId/stella', { preHandler: options.authenticate }, (request) => { const value = parse(stellaSchema, request.body); return options.moderationTools.setStella(identity(request), parse(playerParams, request.params).playerId, { quantity: BigInt(value.quantity), idempotencyKey: value.idempotencyKey }) })
  app.post('/api/v1/moderation/players/:playerId/tester', { preHandler: options.authenticate }, (request) => { const value = parse(testerSchema, request.body); return options.moderationTools.setTester(identity(request), parse(playerParams, request.params).playerId, value.enabled, value.idempotencyKey) })
}
function parse<T>(schema: z.ZodType<T>, body: unknown): T { const parsed = schema.safeParse(body); if (!parsed.success) throw new AppError('La demande de modération est invalide.', 400, 'VALIDATION_ERROR'); return parsed.data }
