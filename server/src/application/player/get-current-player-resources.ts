import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import { resourceKeys } from '../../domain/economy/resources.js';
import { BusinessError } from '../errors.js';
import type { GetCurrentPlayer } from './get-current-player.js';
import type { PlayerResourceBalances, PlayerResourceStore } from './player-resource-store.js';

export class GetCurrentPlayerResources {
  public constructor(
    private readonly getCurrentPlayer: GetCurrentPlayer,
    private readonly store: PlayerResourceStore,
  ) {}

  public async execute(identity: AuthenticatedIdentity): Promise<PlayerResourceBalances> {
    const player = await this.getCurrentPlayer.execute(identity);
    const balances = await this.store.getBalances(player.id);
    const entries = resourceKeys.map((resourceKey) => {
      const amount = balances.get(resourceKey);

      if (amount === undefined) {
        throw new BusinessError(
          'RESOURCE_STATE_INCOMPLETE',
          'The Player resource state is incomplete.',
        );
      }

      return [resourceKey, amount] as const;
    });

    return Object.fromEntries(entries) as PlayerResourceBalances;
  }
}
