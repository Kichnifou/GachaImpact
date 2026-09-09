import type { Prisma, SourceChannel } from '../../../generated/prisma/client.js';
import { getEconomyEarnedIncrement, getEconomySpentIncrement } from '../../application/economy/economy-stats.js';
import { BusinessError } from '../../application/errors.js';
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

export type DebitResourceInput = CreditResourceInput;

export class PrismaEconomyService {
  public async debit(transaction: Prisma.TransactionClient, input: DebitResourceInput): Promise<void> {
    if (input.amount <= 0n) throw new RangeError('An economic debit amount must be positive.');
    const balance = await this.lockBalance(transaction, input.playerId, input.resourceKey);
    if (balance < input.amount) {
      if (input.resourceKey === 'primogems') throw new BusinessError('INSUFFICIENT_PRIMOGEMS', 'Vous ne possédez pas assez de Primos.');
      throw new RangeError(`Insufficient ${input.resourceKey} balance.`);
    }
    const balanceAfter = balance - input.amount;
    await transaction.playerResourceBalance.update({
      where: { playerId_resourceKey: { playerId: input.playerId, resourceKey: input.resourceKey } },
      data: { amount: balanceAfter },
    });
    await transaction.resourceMovement.create({ data: {
      playerId: input.playerId, resourceKey: input.resourceKey, delta: -input.amount,
      balanceBefore: balance, balanceAfter, causeKey: input.causeKey, domainKey: input.domainKey,
      operationId: input.operationId, sourceChannel: input.sourceChannel,
    } });
    const increment = getEconomySpentIncrement(input.resourceKey, input.amount);
    await transaction.playerEconomyStats.update({ where: { playerId: input.playerId }, data: {
      totalPrimosSpent: { increment: increment.totalPrimosSpent },
      totalMorasSpent: { increment: increment.totalMorasSpent },
    } });
  }

  public async credit(
    transaction: Prisma.TransactionClient,
    input: CreditResourceInput,
  ): Promise<void> {
    if (input.amount <= 0n) {
      throw new RangeError('An economic credit amount must be positive.');
    }

    const balance = await this.lockBalance(transaction, input.playerId, input.resourceKey);
    const balanceAfter = balance + input.amount;

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
        balanceBefore: balance,
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

  private async lockBalance(transaction: Prisma.TransactionClient, playerId: string, resourceKey: ResourceKey): Promise<bigint> {
    await transaction.$queryRaw`SELECT amount FROM player_resource_balances WHERE player_id = ${playerId}::uuid AND resource_key = ${resourceKey} FOR UPDATE`;
    const balance = await transaction.playerResourceBalance.findUnique({
      where: { playerId_resourceKey: { playerId, resourceKey } }, select: { amount: true },
    });
    if (!balance) throw new Error(`Missing Player balance for resource ${resourceKey}.`);
    return balance.amount;
  }
}
