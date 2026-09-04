import type { FastifyError, FastifyInstance } from 'fastify';

import { BusinessError, type BusinessErrorCode } from '../application/errors.js';
import { AppError } from './errors.js';

const businessStatusCodes: Readonly<Record<BusinessErrorCode, number>> = {
  ELEMENT_ALREADY_CHOSEN: 409,
  ELEMENT_NOT_AVAILABLE: 422,
  ONBOARDING_DISPLAY_NAME_REQUIRED: 422,
  PLAYER_ELEMENT_REQUIRED: 409,
  PLAYER_NOT_FOUND: 404,
  RESOURCE_STATE_INCOMPLETE: 500,
};

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    const appError = error instanceof AppError ? error : undefined;
    const businessError = error instanceof BusinessError ? error : undefined;
    const statusCode = businessError
      ? businessStatusCodes[businessError.code]
      : (appError?.statusCode ?? 500);
    const code = businessError?.code ?? appError?.code ?? 'INTERNAL_ERROR';
    const message = businessError || appError ? error.message : 'An unexpected server error occurred.';

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
