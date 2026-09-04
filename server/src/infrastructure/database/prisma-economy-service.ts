import type { Prisma, SourceChannel } from '../../../generated/prisma/client.js';
import { getEconomyEarnedIncrement } from '../../application/economy/economy-stats.js';
import type { ElementKey, ResourceKey } from '../../domain/economy/resources.js';

export type CreditResourceInput = Readonly<{
  playerId: string;
  playerElementKey: ElementKey;
  resourceKey: ResourceKey;
  amount: bigint;
  causeKey: string;
  domainKey: string;
  operationId: string;
  sourceChannel: SourceChannel;
}>;

export class PrismaEconomyService {
  public async credit(
    transaction: Prisma.TransactionClient,
    input: CreditResourceInput,
  ): Promise<void> {
    if (input.amount <= 0n) {
      throw new RangeError('An economic credit amount must be positive.');
    }

    await transaction.$queryRaw`
      SELECT amount
      FROM player_resource_balances
      WHERE player_id = ${input.playerId}::uuid
        AND resource_key = ${input.resourceKey}
      FOR UPDATE
    `;

    const balance = await transaction.playerResourceBalance.findUnique({
      where: {
        playerId_resourceKey: {
          playerId: input.playerId,
          resourceKey: input.resourceKey,
        },
      },
      select: { amount: true },
    });

    if (!balance) {
      throw new Error(`Missing Player balance for resource ${input.resourceKey}.`);
    }

    const balanceAfter = balance.amount + input.amount;

    await transaction.playerResourceBalance.update({
      where: {
        playerId_resourceKey: {
          playerId: input.playerId,
          resourceKey: input.resourceKey,
        },
      },
      data: { amount: balanceAfter },
    });

    await transaction.resourceMovement.create({
      data: {
        playerId: input.playerId,
        resourceKey: input.resourceKey,
        delta: input.amount,
        balanceBefore: balance.amount,
        balanceAfter,
        causeKey: input.causeKey,
        domainKey: input.domainKey,
        operationId: input.operationId,
        sourceChannel: input.sourceChannel,
      },
    });

    const increment = getEconomyEarnedIncrement(
      input.resourceKey,
      input.amount,
      input.playerElementKey,
    );

    await transaction.playerEconomyStats.update({
      where: { playerId: input.playerId },
      data: {
        totalPrimosEarned: { increment: increment.totalPrimosEarned },
        totalMorasEarned: { increment: increment.totalMorasEarned },
        totalMainElementParticlesEarned: {
          increment: increment.totalMainElementParticlesEarned,
        },
      },
    });
  }
}
