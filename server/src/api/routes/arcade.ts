import type { FastifyPluginAsync, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';
import { requireAuthenticatedIdentity } from '../auth/authentication.js';
import { AppError } from '../errors.js';
import type { ArcadeService } from '../../application/arcade/arcade-service.js';
import type { ArcadeRecords } from '../../application/arcade/arcade-records.js';
import { arcadeDifficulties, arcadeGames } from '../../domain/arcade/types.js';

type Options = { authenticate: preHandlerHookHandler; service: ArcadeService; records: ArcadeRecords };
const mutation = { idempotencyKey: z.uuid(), expectedVersion: z.number().int().min(0).max(100000) };
const start = z.object({ ...mutation, expectedVersion: z.literal(0), game: z.enum(arcadeGames), difficulty: z.enum(arcadeDifficulties), previousSessionId: z.uuid().nullable() }).strict();
const action = z.discriminatedUnion('kind', [z.object({ ...mutation, kind: z.literal('MOVE'), position: z.number().int().min(0).max(41) }).strict(), z.object({ ...mutation, kind: z.literal('ADVANCE') }).strict(), z.object({ ...mutation, kind: z.literal('QUIT') }).strict()]);
const params = z.object({ sessionId: z.uuid() }).strict();
const ranking = z.object({ kind: z.enum(['GLOBAL', 'SCORE']), game: z.enum([...arcadeGames, 'TOTAL']), difficulty: z.enum(arcadeDifficulties).default('MEDIUM'), page: z.coerce.number().int().min(1).max(100000).optional() }).strict()
  .refine(value => value.kind !== 'GLOBAL' || value.game !== 'TOTAL');
function parse<T>(schema: z.ZodType<T>, value: unknown): T { const result = schema.safeParse(value); if (!result.success) throw new AppError('Demande Arcade invalide.', 400, 'VALIDATION_ERROR'); return result.data; }
export const registerArcadeRoutes: FastifyPluginAsync<Options> = async (app, { authenticate, service, records }) => {
  app.get('/api/v1/arcade', { preHandler: authenticate }, request => service.overview(requireAuthenticatedIdentity(request)));
  app.get('/api/v1/arcade/sessions/:sessionId', { preHandler: authenticate }, request => service.session(requireAuthenticatedIdentity(request), parse(params, request.params).sessionId));
  app.get('/api/v1/arcade/records', { preHandler: authenticate }, async request => {
    const query = parse(ranking, request.query); const player = await service.actor(requireAuthenticatedIdentity(request)); return records.list(player.id, query);
  });
  app.post('/api/v1/arcade/sessions', { preHandler: authenticate }, request => service.start(requireAuthenticatedIdentity(request), parse(start, request.body)));
  app.post('/api/v1/arcade/sessions/:sessionId/actions', { preHandler: authenticate }, request => service.act(requireAuthenticatedIdentity(request), parse(params, request.params).sessionId, parse(action, request.body)));
};
