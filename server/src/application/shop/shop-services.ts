import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import { isElementKey } from '../../domain/economy/resources.js';
import type { Clock } from '../../domain/time/business-date.js';
import { BusinessError } from '../errors.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';
import type { ShopStore } from './shop-store.js';

export class GetCurrentPlayerShop {
  public constructor(private readonly getPlayer: GetCurrentPlayer, private readonly store: ShopStore) {}
  public async execute(identity: AuthenticatedIdentity) {
    const player = await this.getPlayer.execute(identity);
    return this.store.getView(player.id);
  }
}

export class PurchaseShopItem {
  public constructor(private readonly getPlayer: GetCurrentPlayer, private readonly store: ShopStore, private readonly clock: Clock) {}
  public async execute(identity: AuthenticatedIdentity, itemId: string, quantity: bigint, idempotencyKey: string) {
    if (quantity <= 0n) throw new BusinessError('SHOP_QUANTITY_INVALID', 'La quantité doit être un entier strictement positif.');
    const player = await this.getPlayer.execute(identity);
    if (!player.elementKey || !isElementKey(player.elementKey)) throw new BusinessError('PLAYER_ELEMENT_REQUIRED', 'Un élément permanent est requis pour acheter cet article.');
    return this.store.purchase({ playerId: player.id, playerElementKey: player.elementKey, itemId, quantity, idempotencyKey, occurredAt: this.clock.now() });
  }
}
