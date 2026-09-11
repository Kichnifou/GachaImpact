import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import type { GetCurrentPlayerInventory } from '../../application/inventory/inventory-services.js';
import type { ConvertPersonalParticles } from '../../application/daily-challenge/daily-challenge-services.js';
import { requireAuthenticatedIdentity } from '../auth/authentication.js';
import { z } from 'zod';
import { AppError } from '../errors.js';
import { mutationDto } from './daily-challenge.js';

type Options = Readonly<{
  authenticate: preHandlerHookHandler;
  getCurrentPlayerInventory: GetCurrentPlayerInventory;
  convertPersonalParticles?: ConvertPersonalParticles;
}>;

const conversionSchema = z.object({ amount: z.string().regex(/^[1-9]\d*$/), idempotencyKey: z.uuid() }).strict();

export async function registerInventoryRoutes(app: FastifyInstance, options: Options): Promise<void> {
  app.get('/api/v1/me/inventory', { preHandler: options.authenticate }, async (request) => {
    const inventory = await options.getCurrentPlayerInventory.execute(requireAuthenticatedIdentity(request));
    return {
      resources: inventory.resources.map((resource) => ({ ...resource, amount: resource.amount.toString() })),
      items: inventory.items.map((item) => ({
        ...item,
        quantity: item.quantity.toString(),
        firstObtainedAt: item.firstObtainedAt?.toISOString() ?? null,
      })),
    };
  });

  if (options.convertPersonalParticles) app.post('/api/v1/me/inventory/particles/convert', { preHandler: options.authenticate }, async (request) => {
    const body = conversionSchema.safeParse(request.body);
    if (!body.success) throw new AppError('Une quantité entière positive et une clé d’idempotence UUID sont requises.', 400, 'VALIDATION_ERROR');
    return mutationDto(await options.convertPersonalParticles!.execute(requireAuthenticatedIdentity(request), BigInt(body.data.amount), body.data.idempotencyKey));
  });
}
