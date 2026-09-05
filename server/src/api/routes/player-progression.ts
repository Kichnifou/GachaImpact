import type { FastifyInstance, preHandlerHookHandler } from 'fastify';

import type { GetCurrentPlayerProgression } from '../../application/player/get-current-player-progression.js';
import { requireAuthenticatedIdentity } from '../auth/authentication.js';
import { toPlayerProgressionDto } from '../serializers/gameplay.js';

type PlayerProgressionRouteOptions = Readonly<{
  authenticate: preHandlerHookHandler;
  getCurrentPlayerProgression: GetCurrentPlayerProgression;
}>;

export async function registerPlayerProgressionRoutes(
  app: FastifyInstance,
  options: PlayerProgressionRouteOptions,
): Promise<void> {
  app.get('/api/v1/me/progression', { preHandler: options.authenticate }, async (request) => {
    const progression = await options.getCurrentPlayerProgression.execute(
      requireAuthenticatedIdentity(request),
    );

    return toPlayerProgressionDto(progression);
  });
}
