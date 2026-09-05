import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import type { ClaimDailyReward } from '../../application/daily-reward/claim-daily-reward.js';
import type { GetTodayDailyReward } from '../../application/daily-reward/get-today-daily-reward.js';
import { requireAuthenticatedIdentity } from '../auth/authentication.js';
import { toDailyRewardClaimDto, toDailyRewardTodayDto } from '../serializers/gameplay.js';

type DailyRewardRouteOptions = Readonly<{ authenticate: preHandlerHookHandler; getTodayDailyReward: GetTodayDailyReward; claimDailyReward: ClaimDailyReward }>;

export async function registerDailyRewardRoutes(app: FastifyInstance, options: DailyRewardRouteOptions): Promise<void> {
  app.get('/api/v1/daily-reward/today', { preHandler: options.authenticate }, async (request) =>
    toDailyRewardTodayDto(await options.getTodayDailyReward.execute(requireAuthenticatedIdentity(request))));
  app.post('/api/v1/daily-reward/claim', { preHandler: options.authenticate }, async (request) =>
    toDailyRewardClaimDto(await options.claimDailyReward.execute(requireAuthenticatedIdentity(request))));
}
