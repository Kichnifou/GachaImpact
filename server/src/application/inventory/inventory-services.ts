import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';
import type { InventoryStore } from './inventory-store.js';
import { BusinessError } from '../errors.js';

export class GetCurrentPlayerInventory {
  public constructor(
    private readonly getPlayer: GetCurrentPlayer,
    private readonly store: InventoryStore,
  ) {}

  public async execute(identity: AuthenticatedIdentity) {
    const player = await this.getPlayer.execute(identity);
    return this.store.getInventory(player.id);
  }
}

export class GetCurrentPlayerInventoryItemDetail {
  public constructor(private readonly getPlayer: GetCurrentPlayer, private readonly store: InventoryStore) {}

  public async execute(identity: AuthenticatedIdentity, itemId: string, page: number) {
    const player = await this.getPlayer.execute(identity);
    const detail = await this.store.getItemDetail(player.id, itemId, page);
    if (!detail) throw new BusinessError('INVENTORY_ITEM_NOT_FOUND', 'Cet objet du Sac est introuvable.');
    return detail;
  }
}
