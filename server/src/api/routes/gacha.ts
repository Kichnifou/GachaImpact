import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';
import type { GetCharacters, GetCurrentGacha, SetGachaTarget } from '../../application/gacha/gacha-services.js';
import type { PlayerGachaState } from '../../application/gacha/gacha-store.js';
import type { GachaCharacter } from '../../domain/gacha/gacha.js';
import { requireAuthenticatedIdentity } from '../auth/authentication.js';
import { AppError } from '../errors.js';

type Options = Readonly<{ authenticate: preHandlerHookHandler; getCharacters: GetCharacters; getCurrentGacha: GetCurrentGacha; setGachaTarget: SetGachaTarget }>;
const targetSchema = z.object({ characterId: z.uuid() }).strict();

export async function registerGachaRoutes(app: FastifyInstance, options: Options): Promise<void> {
  app.get('/api/v1/characters', { preHandler: options.authenticate }, async () => ({ characters: (await options.getCharacters.execute()).map(characterDto) }));
  app.get('/api/v1/gacha/current', { preHandler: options.authenticate }, async (request) => {
    const current = await options.getCurrentGacha.execute(requireAuthenticatedIdentity(request));
    return currentDto(current);
  });
  app.post('/api/v1/gacha/target', { preHandler: options.authenticate }, async (request) => {
    const parsed = targetSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError('A valid characterId is required.', 400, 'VALIDATION_ERROR');
    return { playerState: stateDto(await options.setGachaTarget.execute(requireAuthenticatedIdentity(request), parsed.data.characterId)) };
  });
}

function characterDto(character: GachaCharacter) { return character; }
function stateDto(state: PlayerGachaState) {
  return { ...state, totalPulls: state.totalPulls.toString(), totalFiveStars: state.totalFiveStars.toString(), totalFourStars: state.totalFourStars.toString(), fiftyFiftyWon: state.fiftyFiftyWon.toString(), fiftyFiftyLost: state.fiftyFiftyLost.toString(), capturesTriggered: state.capturesTriggered.toString() };
}
function currentDto(current: Awaited<ReturnType<GetCurrentGacha['execute']>>) {
  return { banner: { ...current.banner, startsAt: current.banner.startsAt.toISOString(), endsAt: current.banner.endsAt.toISOString(), featuredFiveStars: current.banner.featuredFiveStars.map(characterDto), featuredFourStars: current.banner.featuredFourStars.map(characterDto) }, playerState: stateDto(current.playerState) };
}
