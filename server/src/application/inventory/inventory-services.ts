import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';
import type { InventoryStore } from './inventory-store.js';

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
