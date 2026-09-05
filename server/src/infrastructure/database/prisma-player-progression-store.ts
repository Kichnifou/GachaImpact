import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { PlayerProgressionStore } from '../../application/player/player-progression-store.js';

export class PrismaPlayerProgressionStore implements PlayerProgressionStore {
  public constructor(private readonly database: PrismaClient) {}

  public getByPlayerId(playerId: string) {
    return this.database.playerProgression.findUnique({ where: { playerId } });
  }
}
