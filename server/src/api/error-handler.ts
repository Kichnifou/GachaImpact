import type { FastifyError, FastifyInstance } from 'fastify';

import { AppError } from './errors.js';

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    const appError = error instanceof AppError ? error : undefined;
    const statusCode = appError?.statusCode ?? 500;
    const code = appError?.code ?? 'INTERNAL_ERROR';

    request.log.error({ err: error, code }, 'Request failed');

    return reply.status(statusCode).send({
      error: {
        code,
        requestId: request.id,
      },
    });
  });
}
