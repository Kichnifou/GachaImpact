import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';
import type { GetCurrentPlayerBox, SetBoxCharacterFavorite } from '../../application/box/box-services.js';
import type { BoxCharacter } from '../../application/box/box-store.js';
import { requireAuthenticatedIdentity } from '../auth/authentication.js';
import { AppError } from '../errors.js';

type Options = Readonly<{
  authenticate: preHandlerHookHandler;
  getCurrentPlayerBox: GetCurrentPlayerBox;
  setBoxCharacterFavorite: SetBoxCharacterFavorite;
}>;

const paramsSchema = z.object({ characterId: z.uuid() }).strict();
const favoriteSchema = z.object({ favorite: z.boolean() }).strict();

export async function registerBoxRoutes(app: FastifyInstance, options: Options): Promise<void> {
  app.get('/api/v1/me/box', { preHandler: options.authenticate }, async (request) => {
    const box = await options.getCurrentPlayerBox.execute(requireAuthenticatedIdentity(request));
    return { ...box, characters: box.characters.map(boxCharacterDto) };
  });

  app.patch('/api/v1/me/box/:characterId/favorite', { preHandler: options.authenticate }, async (request) => {
    const params = paramsSchema.safeParse(request.params);
    const body = favoriteSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      throw new AppError('characterId and a boolean favorite are required.', 400, 'VALIDATION_ERROR');
    }
    return { character: boxCharacterDto(await options.setBoxCharacterFavorite.execute(
      requireAuthenticatedIdentity(request), params.data.characterId, body.data.favorite,
    )) };
  });
}

function boxCharacterDto(character: BoxCharacter) {
  return { ...character, firstObtainedAt: character.firstObtainedAt.toISOString() };
}
