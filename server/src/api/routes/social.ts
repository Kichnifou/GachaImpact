import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';
import type { SocialService } from '../../application/social/social-service.js';
import { privacyCategories } from '../../application/social/privacy-service.js';
import { elementKeys } from '../../domain/economy/resources.js';
import { requireAuthenticatedIdentity } from '../auth/authentication.js';
import { AppError } from '../errors.js';

const querySchema = z.object({ q: z.string().max(100).default(''), element: z.enum(elementKeys).optional(), page: z.coerce.number().int().min(1).max(1_000_000).default(1) }).strict();
const profileSchema = z.object({ playerId: z.uuid() }).strict();
const privacySchema = z.object({ categoryKey: z.enum(privacyCategories), level: z.enum(['PUBLIC', 'FRIENDS', 'PRIVATE']) }).strict();
const sessionSchema = z.object({ sessionKey: z.uuid(), activity: z.boolean().default(false) }).strict();
const endSchema = z.object({ sessionKey: z.uuid() }).strict();
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError('Paramètres Social invalides.', 400, 'VALIDATION_ERROR');
  return result.data;
}
export async function registerSocialRoutes(app: FastifyInstance, options: { authenticate: preHandlerHookHandler; service: SocialService }) {
  const { service, authenticate } = options;
  const config = { preHandler: authenticate };
  app.addHook('onSend', (_request, reply, _payload, done) => { reply.header('Cache-Control', 'no-store'); done(); });
  app.get('/api/v1/players', config, request => service.directory(requireAuthenticatedIdentity(request), parse(querySchema, request.query)));
  app.get('/api/v1/players/:playerId/profile', config, request => service.profile(requireAuthenticatedIdentity(request), parse(profileSchema, request.params).playerId));
  app.get('/api/v1/social/presence', config, request => service.connected(requireAuthenticatedIdentity(request)));
  app.get('/api/v1/me/privacy', config, async request => service.privacy.settings((await service.actor(requireAuthenticatedIdentity(request))).id));
  app.patch('/api/v1/me/privacy', config, async request => {
    const body = parse(privacySchema, request.body);
    return service.privacy.save((await service.actor(requireAuthenticatedIdentity(request))).id, body.categoryKey, body.level);
  });
  for (const action of ['session', 'heartbeat'] as const) app.post(`/api/v1/me/presence/${action}`, config, async request => {
    const body = parse(sessionSchema, request.body);
    return service.presence.touch((await service.actor(requireAuthenticatedIdentity(request))).id, body.sessionKey, body.activity, action === 'session');
  });
  app.delete('/api/v1/me/presence/session', config, async request => {
    const body = parse(endSchema, request.body);
    return service.presence.end((await service.actor(requireAuthenticatedIdentity(request))).id, body.sessionKey);
  });
}
