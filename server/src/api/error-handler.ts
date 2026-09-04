import type { FastifyError, FastifyInstance } from 'fastify';

import { OnboardingDisplayNameRequiredError } from '../application/player/get-or-provision-current-player.js';
import { AppError } from './errors.js';

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    const appError = error instanceof AppError ? error : undefined;
    const onboardingError = error instanceof OnboardingDisplayNameRequiredError;
    const statusCode = onboardingError ? 422 : (appError?.statusCode ?? 500);
    const code = onboardingError
      ? 'ONBOARDING_DISPLAY_NAME_REQUIRED'
      : (appError?.code ?? 'INTERNAL_ERROR');
    const message =
      onboardingError || appError ? error.message : 'An unexpected server error occurred.';

    request.log.error({ err: error, code }, 'Request failed');

    return reply.status(statusCode).send({
      error: {
        code,
        message,
        requestId: request.id,
      },
    });
  });
}
