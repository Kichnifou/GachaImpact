import type { Prisma, SourceChannel } from '../../../generated/prisma/client.js';
import type { ElementKey } from '../../domain/economy/resources.js';
import { planPlayerXpGrant, type PlayerXpGrantPlan } from '../../domain/player/xp-grant.js';
import type { RandomSource } from '../../domain/wheel/wheel.js';
import { PrismaEconomyService } from './prisma-economy-service.js';

export type GrantPlayerXpInput = Readonly<{
  playerId: string;
  playerElementKey: ElementKey;
  amount: bigint;
  source: string;
  now: Date;
  operationId: string;
  sourceChannel: SourceChannel;
  random: RandomSource;
}>;

export class PrismaPlayerXpService {
  public constructor(private readonly economy = new PrismaEconomyService()) {}

  public async grant(transaction: Prisma.TransactionClient, input: GrantPlayerXpInput): Promise<PlayerXpGrantPlan> {
    await transaction.$queryRaw`SELECT player_id FROM player_progression WHERE player_id = ${input.playerId}::uuid FOR UPDATE`;
    const progression = await transaction.playerProgression.findUniqueOrThrow({ where: { playerId: input.playerId } });
    const plan = planPlayerXpGrant(progression, input.amount, input.playerElementKey, input.now, input.random);

    await transaction.playerProgression.update({
      where: { playerId: input.playerId },
      data: {
        xp: plan.stateAfter.xp,
        level100OverflowRewardsClaimed: plan.stateAfter.level100OverflowRewardsClaimed,
        lastXpAt: plan.stateAfter.lastXpAt,
      },
    });

    for (const reward of plan.rewards) {
      await this.economy.credit(transaction, {
        playerId: input.playerId,
        playerElementKey: input.playerElementKey,
        resourceKey: reward.resourceKey,
        amount: reward.amount,
        causeKey: 'player.xp.level-reward',
        domainKey: 'player-progression',
        operationId: input.operationId,
        sourceChannel: input.sourceChannel,
      });
    }

    return plan;
  }
}
