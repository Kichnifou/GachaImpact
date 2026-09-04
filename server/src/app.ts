import { randomUUID } from 'node:crypto';

import fastify, { type FastifyInstance } from 'fastify';

import { createAuthenticationHook, registerAuthenticationContext } from './api/auth/authentication.js';
import { registerErrorHandler } from './api/error-handler.js';
import { registerCurrentPlayerRoutes } from './api/routes/current-player.js';
import { registerHealthRoute } from './api/routes/health.js';
import type { AuthIdentityVerifier } from './application/auth/auth-identity-verifier.js';
import type { GetOrProvisionCurrentPlayer } from './application/player/get-or-provision-current-player.js';
import type { AppConfig } from './config/environment.js';
import { loadConfig } from './config/environment.js';

export type AppDependencies = Readonly<{
  authIdentityVerifier: AuthIdentityVerifier;
  getOrProvisionCurrentPlayer: GetOrProvisionCurrentPlayer;
  close?: () => Promise<void>;
}>;

export async function buildApp(
  config: AppConfig = loadConfig(),
  dependencies?: AppDependencies,
): Promise<FastifyInstance> {
  const app = fastify({
    logger: true,
    genReqId: (request) => request.headers['x-request-id']?.toString() || randomUUID(),
    requestIdHeader: 'x-request-id',
  });

  registerErrorHandler(app);

  app.addHook('onRequest', (request, reply, done) => {
    reply.header('x-request-id', request.id);
    done();
  });

  await app.register(registerHealthRoute);

  if (dependencies) {
    registerAuthenticationContext(app);
    await app.register(registerCurrentPlayerRoutes, {
      authenticate: createAuthenticationHook(dependencies.authIdentityVerifier),
      getOrProvisionCurrentPlayer: dependencies.getOrProvisionCurrentPlayer,
    });

    if (dependencies.close) {
      app.addHook('onClose', dependencies.close);
    }
  }

  app.addHook('onReady', () => {
    app.log.info({ host: config.host, port: config.port }, 'Application ready');
  });

  return app;
}
