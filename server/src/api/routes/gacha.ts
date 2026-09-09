import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';
import type { GetCharacters, GetCurrentGacha, GetGachaHistory, PerformGachaPull, SetGachaTarget } from '../../application/gacha/gacha-services.js';
import type { PlayerGachaState } from '../../application/gacha/gacha-store.js';
import type { GachaCharacter } from '../../domain/gacha/gacha.js';
import { requireAuthenticatedIdentity } from '../auth/authentication.js';
import { AppError } from '../errors.js';

type Options = Readonly<{ authenticate: preHandlerHookHandler; getCharacters: GetCharacters; getCurrentGacha: GetCurrentGacha; setGachaTarget: SetGachaTarget; performGachaPull?: PerformGachaPull; getGachaHistory?: GetGachaHistory }>;
const targetSchema = z.object({ characterId: z.uuid() }).strict();
const pullSchema = z.object({ count: z.union([z.literal(1), z.literal(10)]), idempotencyKey: z.uuid() }).strict();
const historyQuerySchema = z.object({ page: z.coerce.number().int().min(1).default(1) }).strict();

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
  if (options.getGachaHistory) app.get('/api/v1/gacha/history', { preHandler: options.authenticate }, async (request) => {
    const parsed = historyQuerySchema.safeParse(request.query);
    if (!parsed.success) throw new AppError('page must be an integer greater than or equal to 1.', 400, 'VALIDATION_ERROR');
    return historyDto(await options.getGachaHistory!.execute(requireAuthenticatedIdentity(request), parsed.data.page));
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
      passiveEffects: passiveEffectsDto(result.passiveEffects ?? []),
    })),
    playerState: stateDto(pull.playerState),
  };
}

function historyDto(history: Awaited<ReturnType<GetGachaHistory['execute']>>) {
  return {
    ...history,
    results: history.results.map((result) => ({
      ...result,
      occurredAt: result.occurredAt.toISOString(),
      resourceAmount: result.resourceAmount?.toString() ?? null,
      bonusRewards: result.bonusRewards.map((reward) => ({ ...reward, amount: reward.amount.toString() })),
      passiveEffects: passiveEffectsDto(result.passiveEffects ?? []),
    })),
  };
}

function passiveEffectsDto(effects: Awaited<ReturnType<PerformGachaPull['execute']>>['results'][number]['passiveEffects']) {
  return effects.map((effect) => {
    if (effect.type === 'secondary_reward_multiplier') return { ...effect, amountBefore: effect.amountBefore.toString(), amountAfter: effect.amountAfter.toString() };
    if (effect.type === 'xp') return { ...effect, amount: effect.amount.toString(), xpAfter: effect.xpAfter.toString() };
    if (effect.type === 'primogem_recovery') return { ...effect, amount: effect.amount.toString() };
    if (effect.type === 'resource_bundle') return { ...effect, rewards: effect.rewards.map((reward) => ({ ...reward, amount: reward.amount.toString() })) };
    return effect;
  });
}
