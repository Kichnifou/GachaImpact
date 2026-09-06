import type { Prisma } from '../../../generated/prisma/client.js';
import { initialC6Stats, progressC6, type C6Stats } from '../../domain/contest/c6-progress.js';
import type { RandomSource } from '../../domain/wheel/wheel.js';

const selection = { strength: true, intelligence: true, beauty: true, charisma: true, popularity: true } as const;

export class PrismaC6ProgressionService {
  public async unlock(transaction: Prisma.TransactionClient, playerId: string, characterId: string, now: Date): Promise<C6Stats> {
    const stats = initialC6Stats();
    await transaction.c6CompetitionProgress.upsert({
      where: { playerId_characterId: { playerId, characterId } },
      create: { playerId, characterId, unlockedAt: now, ...stats },
      update: {},
    });
    return stats;
  }

  public async progress(transaction: Prisma.TransactionClient, playerId: string, characterId: string, now: Date, random: RandomSource) {
    await transaction.$queryRaw`SELECT strength FROM c6_competition_progress WHERE player_id = ${playerId}::uuid AND character_id = ${characterId}::uuid FOR UPDATE`;
    let row = await transaction.c6CompetitionProgress.findUnique({ where: { playerId_characterId: { playerId, characterId } }, select: selection });
    if (!row) {
      await this.unlock(transaction, playerId, characterId, now);
      row = initialC6Stats();
    }
    const progression = progressC6(row, random);
    if (progression.type === 'stat') {
      await transaction.c6CompetitionProgress.update({
        where: { playerId_characterId: { playerId, characterId } }, data: { [progression.stat]: progression.stats[progression.stat] },
      });
    }
    return progression;
  }
}
