import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';

import type { GetOrProvisionCurrentPlayer } from '../../application/player/get-or-provision-current-player.js';
import type { AppearanceService } from '../../application/appearance/appearance-service.js';
import type { CurrentPlayer } from '../../domain/player/current-player.js';
import { requireAuthenticatedIdentity } from '../auth/authentication.js';
import { AppError } from '../errors.js';

const onboardingBodySchema = z
  .object({
    displayName: z.string().optional(),
  })
  .strict();

type CurrentPlayerRouteOptions = Readonly<{
  authenticate: preHandlerHookHandler;
  getOrProvisionCurrentPlayer: GetOrProvisionCurrentPlayer;
  appearanceService?: AppearanceService;
}>;

function toCurrentPlayerDto(player: CurrentPlayer) {
  return {
    id: player.id,
    displayName: player.displayName,
    elementKey: player.elementKey,
    status: player.status,
  };
}

export async function registerCurrentPlayerRoutes(
  app: FastifyInstance,
  options: CurrentPlayerRouteOptions,
): Promise<void> {
  app.get('/api/v1/me', { preHandler: options.authenticate }, async (request) => {
    const identity = requireAuthenticatedIdentity(request);
    const result = await options.getOrProvisionCurrentPlayer.execute(identity);

    return { ...toCurrentPlayerDto(result.player), avatarAssetPath: options.appearanceService ? await options.appearanceService.playerAvatarAssetPath(result.player.id) : null };
  });

  app.post(
    '/api/v1/onboarding/player',
    { preHandler: options.authenticate },
    async (request, reply) => {
      const parsedBody = onboardingBodySchema.safeParse(request.body ?? {});

      if (!parsedBody.success) {
        throw new AppError('The onboarding request body is invalid.', 400, 'INVALID_REQUEST_BODY');
      }

      const identity = requireAuthenticatedIdentity(request);
      const result = await options.getOrProvisionCurrentPlayer.execute(
        identity,
        parsedBody.data.displayName,
      );

      return reply.status(result.created ? 201 : 200).send({ ...toCurrentPlayerDto(result.player), avatarAssetPath: options.appearanceService ? await options.appearanceService.playerAvatarAssetPath(result.player.id) : null });
    },
  );
}
