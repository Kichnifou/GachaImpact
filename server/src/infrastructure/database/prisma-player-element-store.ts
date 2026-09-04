import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { PlayerElementStore } from '../../application/player/player-element-store.js';
import type { ElementKey } from '../../domain/economy/resources.js';

export class PrismaPlayerElementStore implements PlayerElementStore {
  public constructor(private readonly database: PrismaClient) {}

  public async chooseElement(playerId: string, elementKey: ElementKey) {
    return this.database.$transaction(async (transaction) => {
      const element = await transaction.element.findUnique({
        where: { key: elementKey },
        select: { isActive: true },
      });

      if (!element?.isActive) {
        return 'inactive' as const;
      }

      const update = await transaction.player.updateMany({
        where: { id: playerId, elementKey: null },
        data: { elementKey },
      });

      if (update.count === 1) {
        return 'selected' as const;
      }

      const player = await transaction.player.findUnique({
        where: { id: playerId },
        select: { elementKey: true },
      });

      return player?.elementKey === elementKey
        ? ('already-selected' as const)
        : ('different-element' as const);
    });
  }
}
