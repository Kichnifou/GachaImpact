import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { PlayerResourceStore } from '../../application/player/player-resource-store.js';
import { isResourceKey } from '../../domain/economy/resources.js';

export class PrismaPlayerResourceStore implements PlayerResourceStore {
  public constructor(private readonly database: PrismaClient) {}

  public async getBalances(playerId: string) {
    const rows = await this.database.playerResourceBalance.findMany({
      where: { playerId },
      select: { resourceKey: true, amount: true },
    });

    return new Map(
      rows.flatMap(({ resourceKey, amount }) =>
        isResourceKey(resourceKey) ? ([[resourceKey, amount]] as const) : [],
      ),
    );
  }
}
