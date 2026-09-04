import type { FastifyInstance, FastifyRequest, preHandlerHookHandler } from 'fastify';

import type { AuthIdentityVerifier } from '../../application/auth/auth-identity-verifier.js';
import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import { AppError } from '../errors.js';

declare module 'fastify' {
  interface FastifyRequest {
    authenticatedIdentity: AuthenticatedIdentity | null;
  }
}

export function registerAuthenticationContext(app: FastifyInstance): void {
  app.decorateRequest('authenticatedIdentity', null);
}

export function createAuthenticationHook(
  verifier: AuthIdentityVerifier,
): preHandlerHookHandler {
  return async (request) => {
    const authorization = request.headers.authorization;
    const match = authorization?.match(/^Bearer\s+(\S+)$/i);
    const accessToken = match?.[1];

    if (!accessToken) {
      throw new AppError('A Bearer access token is required.', 401, 'UNAUTHORIZED');
    }

    const identity = await verifier.verify(accessToken);

    if (!identity) {
      throw new AppError('The access token is invalid or expired.', 401, 'UNAUTHORIZED');
    }

    request.authenticatedIdentity = identity;
  };
}

export function requireAuthenticatedIdentity(request: FastifyRequest): AuthenticatedIdentity {
  if (!request.authenticatedIdentity) {
    throw new AppError('Authentication is required.', 401, 'UNAUTHORIZED');
  }

  return request.authenticatedIdentity;
}
