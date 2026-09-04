import { randomUUID } from 'node:crypto';

import fastify, { type FastifyInstance } from 'fastify';

import { registerErrorHandler } from './api/error-handler.js';
import { registerHealthRoute } from './api/routes/health.js';
import type { AppConfig } from './config/environment.js';
import { loadConfig } from './config/environment.js';

export async function buildApp(config: AppConfig = loadConfig()): Promise<FastifyInstance> {
  const app = fastify({
    logger: true,
    genReqId: (request) => request.headers['x-request-id']?.toString() || randomUUID(),
    requestIdHeader: 'x-request-id',
  });

  registerErrorHandler(app);
  await app.register(registerHealthRoute);

  app.addHook('onRequest', (request, reply, done) => {
    reply.header('x-request-id', request.id);
    done();
  });

  app.addHook('onReady', () => {
    app.log.info({ host: config.host, port: config.port }, 'Application ready');
  });

  return app;
}
