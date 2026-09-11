import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';
import type { GetDailyChallenge, PurchaseDailyChallenge, SwitchDailyChallenge } from '../../application/daily-challenge/daily-challenge-services.js';
import type { DailyChallengeMutationResult, DailyChallengeView } from '../../application/daily-challenge/daily-challenge-store.js';
import { requireAuthenticatedIdentity } from '../auth/authentication.js';
import { toPlayerResourcesDto } from '../serializers/gameplay.js';
import { AppError } from '../errors.js';

type Options = Readonly<{
  authenticate: preHandlerHookHandler;
  getDailyChallenge: GetDailyChallenge;
  purchaseDailyChallenge: PurchaseDailyChallenge;
  switchDailyChallenge: SwitchDailyChallenge;
}>;

const mutationSchema = z.object({ idempotencyKey: z.uuid() }).strict();

export async function registerDailyChallengeRoutes(app: FastifyInstance, options: Options): Promise<void> {
  app.get('/api/v1/me/daily-challenge', { preHandler: options.authenticate }, async (request) =>
    viewDto(await options.getDailyChallenge.execute(requireAuthenticatedIdentity(request))));
  app.post('/api/v1/me/daily-challenge/purchase', { preHandler: options.authenticate }, async (request) => {
    const body = mutationSchema.safeParse(request.body);
    if (!body.success) throw new AppError('Une clé d’idempotence UUID est requise.', 400, 'VALIDATION_ERROR');
    return mutationDto(await options.purchaseDailyChallenge.execute(requireAuthenticatedIdentity(request), body.data.idempotencyKey));
  });
  app.post('/api/v1/me/daily-challenge/switch', { preHandler: options.authenticate }, async (request) => {
    const body = mutationSchema.safeParse(request.body);
    if (!body.success) throw new AppError('Une clé d’idempotence UUID est requise.', 400, 'VALIDATION_ERROR');
    return mutationDto(await options.switchDailyChallenge.execute(requireAuthenticatedIdentity(request), body.data.idempotencyKey));
  });
}

export function viewDto(view: DailyChallengeView) {
  return {
    businessDate: view.businessDate,
    status: view.status,
    assigned: view.assigned,
    purchaseCost: view.purchaseCost.toString(),
    challenge: view.challenge ? {
      ...view.challenge,
      progress: view.challenge.progress.toString(),
      target: view.challenge.target.toString(),
      rewardPrimogems: view.challenge.rewardPrimogems.toString(),
    } : null,
    switchCount: view.switchCount,
    nextSwitchCost: view.nextSwitchCost?.toString() ?? null,
    canSwitch: view.canSwitch,
    completedAt: view.completedAt?.toISOString() ?? null,
  };
}

export function mutationDto(result: DailyChallengeMutationResult) {
  return { ...viewDto(result.view), operation: result.operation, resources: toPlayerResourcesDto(result.resources) };
}
