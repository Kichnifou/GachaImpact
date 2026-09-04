import type { FastifyInstance, preHandlerHookHandler } from 'fastify';

import type { SpinDailyWheel } from '../../application/wheel/spin-daily-wheel.js';
import type { GetTodayWheelState } from '../../application/wheel/get-today-wheel-state.js';
import { requireAuthenticatedIdentity } from '../auth/authentication.js';
import { toWheelSpinDto, toWheelTodayDto } from '../serializers/gameplay.js';

type WheelRouteOptions = Readonly<{
  authenticate: preHandlerHookHandler;
  getTodayWheelState: GetTodayWheelState;
  spinDailyWheel: SpinDailyWheel;
}>;

export async function registerWheelRoutes(
  app: FastifyInstance,
  options: WheelRouteOptions,
): Promise<void> {
  app.get('/api/v1/wheel/today', { preHandler: options.authenticate }, async (request) => {
    const state = await options.getTodayWheelState.execute(
      requireAuthenticatedIdentity(request),
    );

    return toWheelTodayDto(state);
  });

  app.post('/api/v1/wheel/spin', { preHandler: options.authenticate }, async (request) => {
    const result = await options.spinDailyWheel.execute(requireAuthenticatedIdentity(request));

    return toWheelSpinDto(result);
  });
}
