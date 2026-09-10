import type { Prisma } from '../../../generated/prisma/client.js';
import { BusinessError } from '../../application/errors.js';
import { applyFiveStarPityBonus } from '../../domain/gacha/pity.js';

export class PrismaGachaRewardService {
  public async grantFiveStarPity(
    transaction: Prisma.TransactionClient,
    playerId: string,
    amount: number,
  ): Promise<{ before: number; after: number; granted: number }> {
    await transaction.$queryRaw`SELECT player_id FROM player_gacha_states WHERE player_id = ${playerId}::uuid FOR UPDATE`;
    const state = await transaction.playerGachaState.findUnique({ where: { playerId }, select: { pity5: true } });
    if (!state) throw new BusinessError('GACHA_BANNER_UNAVAILABLE', 'L’état Gacha du joueur est indisponible.');
    const after = applyFiveStarPityBonus(state.pity5, amount);
    await transaction.playerGachaState.update({ where: { playerId }, data: { pity5: after } });
    return { before: state.pity5, after, granted: after - state.pity5 };
  }
}
