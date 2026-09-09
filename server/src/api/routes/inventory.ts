import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import type { GetCurrentPlayerInventory } from '../../application/inventory/inventory-services.js';
import { requireAuthenticatedIdentity } from '../auth/authentication.js';

type Options = Readonly<{
  authenticate: preHandlerHookHandler;
  getCurrentPlayerInventory: GetCurrentPlayerInventory;
}>;

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
}
