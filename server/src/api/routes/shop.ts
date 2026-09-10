import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';
import type { GetCurrentPlayerShop, PurchaseShopItem } from '../../application/shop/shop-services.js';
import type { ShopEffectSnapshot, ShopPurchase, ShopView } from '../../application/shop/shop-store.js';
import { requireAuthenticatedIdentity } from '../auth/authentication.js';
import { AppError } from '../errors.js';
import { toPlayerResourcesDto } from '../serializers/gameplay.js';

type Options = Readonly<{ authenticate: preHandlerHookHandler; getCurrentPlayerShop: GetCurrentPlayerShop; purchaseShopItem: PurchaseShopItem }>;
const paramsSchema = z.object({ itemId: z.uuid() }).strict();
const purchaseSchema = z.object({ quantity: z.string().regex(/^[1-9]\d*$/), idempotencyKey: z.uuid() }).strict();

export async function registerShopRoutes(app: FastifyInstance, options: Options): Promise<void> {
  app.get('/api/v1/me/shop', { preHandler: options.authenticate }, async (request) =>
    shopDto(await options.getCurrentPlayerShop.execute(requireAuthenticatedIdentity(request))));

  app.post('/api/v1/me/shop/:itemId/purchase', { preHandler: options.authenticate }, async (request) => {
    const params = paramsSchema.safeParse(request.params);
    const body = purchaseSchema.safeParse(request.body);
    if (!params.success || !body.success) throw new AppError('Un article, une quantité entière positive et une clé d’idempotence UUID sont requis.', 400, 'VALIDATION_ERROR');
    const result = await options.purchaseShopItem.execute(requireAuthenticatedIdentity(request), params.data.itemId, BigInt(body.data.quantity), body.data.idempotencyKey);
    return { ...shopDto(result), purchase: purchaseDto(result.purchase), operation: result.operation };
  });
}

function shopDto(view: ShopView) {
  return {
    resources: toPlayerResourcesDto(view.resources),
    gachaState: gachaStateDto(view.gachaState),
    items: view.items.map((item) => ({
      ...item,
      priceAmount: item.priceAmount.toString(),
      rewardPerUnit: item.rewardPerUnit ? { ...item.rewardPerUnit, amount: item.rewardPerUnit.amount.toString() } : null,
      ticketRewards: item.ticketRewards.map((reward) => ({ ...reward, amount: reward.amount.toString() })),
    })),
    recentPurchases: view.recentPurchases.map(purchaseDto),
  };
}

function purchaseDto(purchase: ShopPurchase) {
  return {
    ...purchase,
    quantity: purchase.quantity.toString(), unitPrice: purchase.unitPrice.toString(), totalPrice: purchase.totalPrice.toString(),
    effect: effectDto(purchase.effect), purchasedAt: purchase.purchasedAt.toISOString(),
  };
}

function effectDto(effect: ShopEffectSnapshot) {
  if (effect.type === 'ticket_pity5') return effect;
  return { ...effect, amount: effect.amount.toString() };
}

function gachaStateDto(state: ShopView['gachaState']) {
  return {
    ...state,
    totalPulls: state.totalPulls.toString(), totalFiveStars: state.totalFiveStars.toString(), totalFourStars: state.totalFourStars.toString(),
    fiftyFiftyWon: state.fiftyFiftyWon.toString(), fiftyFiftyLost: state.fiftyFiftyLost.toString(), capturesTriggered: state.capturesTriggered.toString(),
  };
}
