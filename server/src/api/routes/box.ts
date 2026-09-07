import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';
import type { GetCurrentPlayerBox, SetBoxCharacterFavorite, SetBoxSortPreference, UseMasterlessStella } from '../../application/box/box-services.js';
import { boxSortDirections, boxSortKeys, type BoxCharacter } from '../../application/box/box-store.js';
import { requireAuthenticatedIdentity } from '../auth/authentication.js';
import { AppError } from '../errors.js';

type Options = Readonly<{
  authenticate: preHandlerHookHandler;
  getCurrentPlayerBox: GetCurrentPlayerBox;
  setBoxCharacterFavorite: SetBoxCharacterFavorite;
  setBoxSortPreference: SetBoxSortPreference;
  useMasterlessStella: UseMasterlessStella;
}>;

const paramsSchema = z.object({ characterId: z.uuid() }).strict();
const favoriteSchema = z.object({ favorite: z.boolean() }).strict();
const sortPreferenceSchema = z.object({ sortKey: z.enum(boxSortKeys), direction: z.enum(boxSortDirections) }).strict();
const stellaSchema = z.object({ idempotencyKey: z.uuid() }).strict();

export async function registerBoxRoutes(app: FastifyInstance, options: Options): Promise<void> {
  app.get('/api/v1/me/box', { preHandler: options.authenticate }, async (request) => {
    const box = await options.getCurrentPlayerBox.execute(requireAuthenticatedIdentity(request));
    return { ...box, stella: { quantity: box.stella.quantity.toString() }, characters: box.characters.map(boxCharacterDto) };
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

  app.patch('/api/v1/me/box/preference', { preHandler: options.authenticate }, async (request) => {
    const body = sortPreferenceSchema.safeParse(request.body);
    if (!body.success) throw new AppError('A canonical Box sortKey and direction are required.', 400, 'VALIDATION_ERROR');
    return { preference: await options.setBoxSortPreference.execute(requireAuthenticatedIdentity(request), body.data) };
  });

  app.post('/api/v1/me/box/:characterId/stella', { preHandler: options.authenticate }, async (request) => {
    const params = paramsSchema.safeParse(request.params);
    const body = stellaSchema.safeParse(request.body);
    if (!params.success || !body.success) throw new AppError('characterId and a UUID idempotencyKey are required.', 400, 'VALIDATION_ERROR');
    const result = await options.useMasterlessStella.execute(requireAuthenticatedIdentity(request), params.data.characterId, body.data.idempotencyKey);
    return {
      operation: result.operation,
      character: boxCharacterDto(result.character),
      stella: { quantity: result.stellaRemaining.toString() },
      c6Progression: result.c6Progression,
    };
  });
}

function boxCharacterDto(character: BoxCharacter) {
  return { ...character, firstObtainedAt: character.firstObtainedAt.toISOString() };
}
