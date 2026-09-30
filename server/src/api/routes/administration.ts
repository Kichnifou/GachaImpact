import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';
import { requireAuthenticatedIdentity } from '../auth/authentication.js';
import { AppError } from '../errors.js';
import { elementKeys } from '../../domain/economy/resources.js';
import type { RoleAdminService } from '../../application/moderation/role-admin-service.js';
import type { CharacterAdminService } from '../../application/moderation/character-admin-service.js';
import type { PossessionAdminService } from '../../application/moderation/possession-admin-service.js';
import type { BannerAdminService } from '../../application/moderation/banner-admin-service.js';
import type { EventAdminService } from '../../application/moderation/event-admin-service.js';
import type { GlobalChatModerationService } from '../../application/moderation/global-chat-moderation-service.js';
import type { AdminAuditQueryService } from '../../application/moderation/admin-audit-query-service.js';

export type AdministrationServices = Readonly<{ roles: RoleAdminService; characters: CharacterAdminService; possessions: PossessionAdminService;
  banners: BannerAdminService; events: EventAdminService; chat: GlobalChatModerationService; audit: AdminAuditQueryService }>;
type Options = Readonly<{ authenticate: preHandlerHookHandler; services: AdministrationServices }>;
const uuid = z.uuid();
const key = z.object({ idempotencyKey: uuid }).strict();
const page = z.object({ page: z.coerce.number().int().min(1).max(100000).optional().default(1) }).strict();
const role = z.object({ role: z.enum(['TESTER', 'MODERATOR', 'ADMIN']), enabled: z.boolean(), idempotencyKey: uuid }).strict();
const text = z.string().trim().min(1).max(100);
const nullableText = z.string().trim().max(100).nullable();
const characterFields = z.object({ name: text, rarity: z.union([z.literal(4), z.literal(5)]), elementKey: z.enum(elementKeys),
  weaponType: nullableText.optional(), region: nullableText.optional(), classKey: nullableText.optional(),
  displayOrder: z.number().int().min(0).max(100000).nullable().optional(), isActive: z.boolean().optional() }).strict();
const config = z.object({ emoji: text, currency: z.object({ label: text, emoji: text }).strict(),
  collection: z.object({ key: text, label: text }).strict() }).strict();
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new AppError('Demande d’administration invalide.', 400, 'VALIDATION_ERROR');
  return parsed.data;
}

export async function registerAdministrationRoutes(app: FastifyInstance, { authenticate, services }: Options) {
  const identity = (request: Parameters<typeof requireAuthenticatedIdentity>[0]) => requireAuthenticatedIdentity(request);
  const pathId = (params: unknown, name: string) => parse(z.record(z.string(), uuid), params)[name]!;

  app.post('/api/v1/moderation/players/:playerId/roles', { preHandler: authenticate }, request => {
    const value = parse(role, request.body); return services.roles.setRole(identity(request), pathId(request.params, 'playerId'), value.role, value.enabled, value.idempotencyKey);
  });
  app.get('/api/v1/moderation/characters', { preHandler: authenticate }, request => {
    const value = parse(page.extend({ search: z.string().max(100).optional(), rarity: z.coerce.number().pipe(z.union([z.literal(4), z.literal(5)])).optional(),
      elementKey: z.enum(elementKeys).optional(), active: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
      sort: z.enum(['name', 'rarity', 'createdAt']).optional(), direction: z.enum(['asc', 'desc']).optional() }), request.query);
    return services.characters.list(identity(request), value);
  });
  app.post('/api/v1/moderation/characters', { preHandler: authenticate }, request => {
    const value = parse(characterFields.extend({ externalKey: z.string().regex(/^[a-z0-9][a-z0-9_-]{1,79}$/), idempotencyKey: uuid }), request.body);
    return services.characters.create(identity(request), value);
  });
  app.patch('/api/v1/moderation/characters/:characterId', { preHandler: authenticate }, request => {
    const value = parse(characterFields.partial().extend({ idempotencyKey: uuid }), request.body);
    return services.characters.update(identity(request), pathId(request.params, 'characterId'), value);
  });
  app.get('/api/v1/moderation/players/:playerId/characters', { preHandler: authenticate }, request => {
    const value = parse(page.extend({ search: z.string().max(100).optional(), rarity: z.coerce.number().pipe(z.union([z.literal(4), z.literal(5)])).optional(), elementKey: z.enum(elementKeys).optional() }), request.query);
    return services.possessions.list(identity(request), pathId(request.params, 'playerId'), value);
  });
  app.post('/api/v1/moderation/players/:playerId/characters/:characterId', { preHandler: authenticate }, request => {
    const value = parse(z.object({ action: z.enum(['add', 'remove', 'constellation']), constellation: z.number().int().min(0).max(6).optional(), idempotencyKey: uuid }).strict(), request.body);
    return services.possessions.change(identity(request), pathId(request.params, 'playerId'), pathId(request.params, 'characterId'), value);
  });
  app.get('/api/v1/moderation/banners', { preHandler: authenticate }, request => services.banners.overview(identity(request)));
  app.post('/api/v1/moderation/banners/:rotationId/correct', { preHandler: authenticate }, request => {
    const value = parse(z.object({ fiveStarIds: z.array(uuid).length(4), fourStarIds: z.array(uuid).length(6), idempotencyKey: uuid }).strict(), request.body);
    return services.banners.correct(identity(request), pathId(request.params, 'rotationId'), value);
  });
  app.post('/api/v1/moderation/banners/retry-generation', { preHandler: authenticate }, request => {
    const value = parse(key.extend({ expectedWeekStartsAt: z.iso.datetime() }), request.body);
    return services.banners.retryGeneration(identity(request), value.idempotencyKey, value.expectedWeekStartsAt);
  });
  app.get('/api/v1/moderation/events', { preHandler: authenticate }, request => services.events.list(identity(request)));
  app.patch('/api/v1/moderation/events/:definitionId', { preHandler: authenticate }, request => {
    const value = parse(z.object({ isActive: z.boolean().optional(), config: config.optional(), idempotencyKey: uuid }).strict(), request.body);
    return services.events.update(identity(request), pathId(request.params, 'definitionId'), value);
  });
  app.get('/api/v1/moderation/global-chat-reports', { preHandler: authenticate }, request => services.chat.list(identity(request), parse(page, request.query).page));
  app.get('/api/v1/moderation/global-chat-reports/:reportId', { preHandler: authenticate }, request => services.chat.detail(identity(request), pathId(request.params, 'reportId')));
  app.post('/api/v1/moderation/global-chat-reports/:reportId/moderate', { preHandler: authenticate }, request => services.chat.moderate(identity(request), pathId(request.params, 'reportId'), parse(key, request.body).idempotencyKey));
  app.post('/api/v1/moderation/global-chat-reports/:reportId/delete', { preHandler: authenticate }, request => services.chat.deleteReport(identity(request), pathId(request.params, 'reportId'), parse(key, request.body).idempotencyKey));
  app.get('/api/v1/moderation/audit', { preHandler: authenticate }, request => {
    const value = parse(page.extend({ domain: z.string().max(80).optional(), action: z.string().max(80).optional(), actorId: uuid.optional(), targetId: uuid.optional() }), request.query);
    return services.audit.list(identity(request), value);
  });
  app.get('/api/v1/moderation/audit/:entryId', { preHandler: authenticate }, request => services.audit.detail(identity(request), pathId(request.params, 'entryId')));
}
