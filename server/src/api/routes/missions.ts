import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';
import type { GetCurrentPlayerMissions } from '../../application/missions/get-current-player-missions.js';
import { requireAuthenticatedIdentity } from '../auth/authentication.js';
import { AppError } from '../errors.js';
import { toCurrentPlayerMissionsDto } from '../serializers/missions.js';

type Options = Readonly<{ authenticate: preHandlerHookHandler; getCurrentPlayerMissions: GetCurrentPlayerMissions }>;
const emptyQuerySchema = z.object({}).strict();

export async function registerMissionRoutes(app: FastifyInstance, options: Options): Promise<void> {
  app.get('/api/v1/me/missions', { preHandler: options.authenticate }, async (request, reply) => {
    if (!emptyQuerySchema.safeParse(request.query).success) {
      throw new AppError('La consultation personnelle des Missions n’accepte aucun identifiant de joueur.', 400, 'MISSIONS_QUERY_INVALID');
    }
    const view = await options.getCurrentPlayerMissions.execute(requireAuthenticatedIdentity(request));
    reply.header('cache-control', 'no-store');
    return toCurrentPlayerMissionsDto(view);
  });
}
