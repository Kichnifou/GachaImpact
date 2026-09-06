import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';
import type { GetCharacters, GetCurrentGacha, PerformGachaPull, SetGachaTarget } from '../../application/gacha/gacha-services.js';
import type { PlayerGachaState } from '../../application/gacha/gacha-store.js';
import type { GachaCharacter } from '../../domain/gacha/gacha.js';
import { requireAuthenticatedIdentity } from '../auth/authentication.js';
import { AppError } from '../errors.js';

type Options = Readonly<{ authenticate: preHandlerHookHandler; getCharacters: GetCharacters; getCurrentGacha: GetCurrentGacha; setGachaTarget: SetGachaTarget; performGachaPull?: PerformGachaPull }>;
const targetSchema = z.object({ characterId: z.uuid() }).strict();
const pullSchema = z.object({ count: z.union([z.literal(1), z.literal(10)]), idempotencyKey: z.uuid() }).strict();

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
  if (options.performGachaPull) app.post('/api/v1/gacha/pull', { preHandler: options.authenticate }, async (request) => {
    const parsed = pullSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError('count must be 1 or 10 and idempotencyKey must be a UUID.', 400, 'VALIDATION_ERROR');
    return pullDto(await options.performGachaPull!.execute(requireAuthenticatedIdentity(request), parsed.data.count, parsed.data.idempotencyKey));
  });
}

function characterDto(character: GachaCharacter) { return character; }
function stateDto(state: PlayerGachaState) {
  return { ...state, totalPulls: state.totalPulls.toString(), totalFiveStars: state.totalFiveStars.toString(), totalFourStars: state.totalFourStars.toString(), fiftyFiftyWon: state.fiftyFiftyWon.toString(), fiftyFiftyLost: state.fiftyFiftyLost.toString(), capturesTriggered: state.capturesTriggered.toString() };
}
function currentDto(current: Awaited<ReturnType<GetCurrentGacha['execute']>>) {
  return { banner: { ...current.banner, startsAt: current.banner.startsAt.toISOString(), endsAt: current.banner.endsAt.toISOString(), featuredFiveStars: current.banner.featuredFiveStars.map(characterDto), featuredFourStars: current.banner.featuredFourStars.map(characterDto) }, playerState: stateDto(current.playerState) };
}
function pullDto(pull: Awaited<ReturnType<PerformGachaPull['execute']>>) {
  return {
    operation: { ...pull.operation, primogemCost: pull.operation.primogemCost.toString(), createdAt: pull.operation.createdAt.toISOString() },
    results: pull.results.map((result) => ({
      ...result,
      resourceAmount: result.resourceAmount?.toString() ?? null,
      bonusRewards: result.bonusRewards.map((reward) => ({ ...reward, amount: reward.amount.toString() })),
    })),
    playerState: stateDto(pull.playerState),
  };
}
