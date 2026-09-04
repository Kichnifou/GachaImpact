import { randomUUID } from 'node:crypto';

import cors from '@fastify/cors';
import fastify, { type FastifyInstance } from 'fastify';

import { createAuthenticationHook, registerAuthenticationContext } from './api/auth/authentication.js';
import { registerErrorHandler } from './api/error-handler.js';
import { registerCurrentPlayerRoutes } from './api/routes/current-player.js';
import { registerHealthRoute } from './api/routes/health.js';
import { registerPlayerGameRoutes } from './api/routes/player-game.js';
import { registerWheelRoutes } from './api/routes/wheel.js';
import type { AuthIdentityVerifier } from './application/auth/auth-identity-verifier.js';
import type { ChoosePlayerElement } from './application/player/choose-player-element.js';
import type { GetCurrentPlayerResources } from './application/player/get-current-player-resources.js';
import type { GetOrProvisionCurrentPlayer } from './application/player/get-or-provision-current-player.js';
import type { SpinDailyWheel } from './application/wheel/spin-daily-wheel.js';
import type { GetTodayWheelState } from './application/wheel/get-today-wheel-state.js';
import type { AppConfig } from './config/environment.js';
import { loadConfig } from './config/environment.js';

export type AppDependencies = Readonly<{
  authIdentityVerifier: AuthIdentityVerifier;
  getOrProvisionCurrentPlayer: GetOrProvisionCurrentPlayer;
  choosePlayerElement?: ChoosePlayerElement;
  getCurrentPlayerResources?: GetCurrentPlayerResources;
  getTodayWheelState?: GetTodayWheelState;
  spinDailyWheel?: SpinDailyWheel;
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

  const frontendOrigin = config.frontendOrigin ?? 'http://localhost:5173';
  await app.register(cors, {
    origin: (requestOrigin, callback) => {
      callback(null, requestOrigin === frontendOrigin);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['authorization', 'content-type', 'x-request-id'],
    exposedHeaders: ['x-request-id'],
  });

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

    if (
      dependencies.choosePlayerElement &&
      dependencies.getCurrentPlayerResources &&
      dependencies.getTodayWheelState &&
      dependencies.spinDailyWheel
    ) {
      const authenticate = createAuthenticationHook(dependencies.authIdentityVerifier);
      await app.register(registerPlayerGameRoutes, {
        authenticate,
        choosePlayerElement: dependencies.choosePlayerElement,
        getCurrentPlayerResources: dependencies.getCurrentPlayerResources,
      });
      await app.register(registerWheelRoutes, {
        authenticate,
        getTodayWheelState: dependencies.getTodayWheelState,
        spinDailyWheel: dependencies.spinDailyWheel,
      });
    }

    if (dependencies.close) {
      app.addHook('onClose', dependencies.close);
    }
  }

  app.addHook('onReady', () => {
    app.log.info({ host: config.host, port: config.port }, 'Application ready');
  });

  return app;
}
