import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { requireAuthenticatedIdentity } from '../auth/authentication.js';
import { AppError } from '../errors.js';

/** R1100 safe fallback. No store, provisioning or Auth Admin dependency is wired.
 * Adding a credential or changing configuration cannot activate an erasure.
 * The full reauthenticated, resumable procedure must be qualified before replacing this refusal.
 */
export async function registerAccountDeletionRoutes(app: FastifyInstance,
  options: { authenticate: preHandlerHookHandler }): Promise<void> {
  app.post('/api/v1/me/account/deletion', { preHandler: options.authenticate }, async (request, reply) => {
    requireAuthenticatedIdentity(request);
    reply.header('cache-control', 'no-store');
    throw new AppError('La suppression de compte est temporairement indisponible. Aucune donnée n’a été supprimée.',
      503, 'ACCOUNT_DELETION_UNAVAILABLE');
  });
}
