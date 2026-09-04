import type { FastifyInstance, preHandlerHookHandler } from 'fastify';

import type { SpinDailyWheel } from '../../application/wheel/spin-daily-wheel.js';
import { requireAuthenticatedIdentity } from '../auth/authentication.js';
import { toWheelSpinDto } from '../serializers/gameplay.js';

type WheelRouteOptions = Readonly<{
  authenticate: preHandlerHookHandler;
  spinDailyWheel: SpinDailyWheel;
}>;

export async function registerWheelRoutes(
  app: FastifyInstance,
  options: WheelRouteOptions,
): Promise<void> {
  app.post('/api/v1/wheel/spin', { preHandler: options.authenticate }, async (request) => {
    const result = await options.spinDailyWheel.execute(requireAuthenticatedIdentity(request));

    return toWheelSpinDto(result);
  });
}
