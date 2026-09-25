import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';
import type { GetCurrentPlayerMissions } from '../../application/missions/get-current-player-missions.js';
import type { GetPlayerMissions } from '../../application/missions/get-player-missions.js';
import { requireAuthenticatedIdentity } from '../auth/authentication.js';
import { AppError } from '../errors.js';
import { toCurrentPlayerMissionsDto, toPermanentMissionProjectionDto } from '../serializers/missions.js';

type Options = Readonly<{ authenticate: preHandlerHookHandler; getCurrentPlayerMissions: GetCurrentPlayerMissions; getPlayerMissions?: GetPlayerMissions }>;
const emptyQuerySchema = z.object({}).strict();
const playerSchema = z.object({ playerId: z.uuid() }).strict();

export async function registerMissionRoutes(app: FastifyInstance, options: Options): Promise<void> {
  app.get('/api/v1/me/missions', { preHandler: options.authenticate }, async (request, reply) => {
    if (!emptyQuerySchema.safeParse(request.query).success) {
      throw new AppError('La consultation personnelle des Missions n’accepte aucun identifiant de joueur.', 400, 'MISSIONS_QUERY_INVALID');
    }
    const view = await options.getCurrentPlayerMissions.execute(requireAuthenticatedIdentity(request));
    reply.header('cache-control', 'no-store');
    return toCurrentPlayerMissionsDto(view);
  });
  if (options.getPlayerMissions) app.get('/api/v1/players/:playerId/missions', { preHandler: options.authenticate }, async (request, reply) => {
    const parsed = playerSchema.safeParse(request.params);
    if (!parsed.success) throw new AppError('Paramètres Missions invalides.', 400, 'VALIDATION_ERROR');
    const result = await options.getPlayerMissions!.execute(requireAuthenticatedIdentity(request), parsed.data.playerId);
    reply.header('cache-control', 'no-store');
    return result.access === 'PRIVATE' ? result : { access: 'ALLOWED' as const, data: toPermanentMissionProjectionDto(result.data) };
  });
}
