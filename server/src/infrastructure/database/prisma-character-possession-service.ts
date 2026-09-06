import type { Prisma } from '../../../generated/prisma/client.js';
import { acquireCharacter } from '../../domain/collection/possession.js';

export class PrismaCharacterPossessionService {
  public async acquire(transaction: Prisma.TransactionClient, playerId: string, characterId: string, obtainedAt: Date) {
    await transaction.$queryRaw`SELECT copies FROM player_characters WHERE player_id = ${playerId}::uuid AND character_id = ${characterId}::uuid FOR UPDATE`;
    const current = await transaction.playerCharacter.findUnique({
      where: { playerId_characterId: { playerId, characterId } },
      select: { copies: true, constellation: true, firstObtainedAt: true },
    });
    const acquisition = acquireCharacter(current, obtainedAt);
    if (current) {
      await transaction.playerCharacter.update({
        where: { playerId_characterId: { playerId, characterId } },
        data: { copies: acquisition.copies, constellation: acquisition.constellation },
      });
    } else {
      await transaction.playerCharacter.create({ data: {
        playerId, characterId, copies: acquisition.copies, constellation: acquisition.constellation,
        firstObtainedAt: acquisition.firstObtainedAt,
      } });
    }
    return acquisition;
  }
}
