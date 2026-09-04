import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';

import type { ChoosePlayerElement } from '../../application/player/choose-player-element.js';
import type { GetCurrentPlayerResources } from '../../application/player/get-current-player-resources.js';
import { requireAuthenticatedIdentity } from '../auth/authentication.js';
import { AppError } from '../errors.js';
import { toPlayerResourcesDto } from '../serializers/gameplay.js';

const elementBodySchema = z
  .object({
    elementKey: z.string(),
  })
  .strict();

type PlayerGameRouteOptions = Readonly<{
  authenticate: preHandlerHookHandler;
  choosePlayerElement: ChoosePlayerElement;
  getCurrentPlayerResources: GetCurrentPlayerResources;
}>;

export async function registerPlayerGameRoutes(
  app: FastifyInstance,
  options: PlayerGameRouteOptions,
): Promise<void> {
  app.post('/api/v1/me/element', { preHandler: options.authenticate }, async (request) => {
    const parsedBody = elementBodySchema.safeParse(request.body);

    if (!parsedBody.success) {
      throw new AppError('The element request body is invalid.', 400, 'INVALID_REQUEST_BODY');
    }

    return options.choosePlayerElement.execute(
      requireAuthenticatedIdentity(request),
      parsedBody.data.elementKey,
    );
  });

  app.get('/api/v1/me/resources', { preHandler: options.authenticate }, async (request) => {
    const balances = await options.getCurrentPlayerResources.execute(
      requireAuthenticatedIdentity(request),
    );

    return toPlayerResourcesDto(balances);
  });
}
