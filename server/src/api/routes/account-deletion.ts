import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { requireAuthenticatedIdentity } from '../auth/authentication.js';
import { AppError } from '../errors.js';
import { z } from 'zod';
import type { AccountDeletion } from '../../application/player/account-deletion-contract.js';

/** Current session chooses the account. No caller-supplied account ID is accepted. */
export async function registerAccountDeletionRoutes(app: FastifyInstance,
  options: { authenticate: preHandlerHookHandler; service?:AccountDeletion }): Promise<void> {
  app.post('/api/v1/me/account/deletion', { preHandler: options.authenticate }, async (request, reply) => {
    const identity=requireAuthenticatedIdentity(request);
    reply.header('cache-control', 'no-store');
    if(options.service) {
      const body=z.object({confirmation:z.literal('SUPPRIMER'),reauthenticationToken:z.string().min(1).max(16_384)}).strict().safeParse(request.body);
      if(!body.success)throw new AppError('Confirmation ou vérification d’identité invalide.',400,'ACCOUNT_DELETION_INVALID_REQUEST');
      const result=await options.service.execute(identity,body.data);
      return reply.status(result.status==='COMPLETED'?200:202).send(result);
    }
    throw new AppError('La suppression de compte est temporairement indisponible. Aucune donnée n’a été supprimée.',
      503, 'ACCOUNT_DELETION_UNAVAILABLE');
  });
}
