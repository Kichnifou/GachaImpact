import type { Prisma, SourceChannel } from '../../../generated/prisma/client.js';
import { getEconomyEarnedIncrement, getEconomySpentIncrement } from '../../application/economy/economy-stats.js';
import { BusinessError } from '../../application/errors.js';
import type { ElementKey, ResourceKey } from '../../domain/economy/resources.js';
import { expireTrades, particleStock, reconcileParticleTrades } from '../../application/trades/trade-state.js';

export type CreditResourceInput = Readonly<{
  playerId: string;
  playerElementKey: ElementKey | null;
  resourceKey: ResourceKey;
  amount: bigint;
  causeKey: string;
  domainKey: string;
  operationId: string;
  sourceChannel: SourceChannel;
}>;

export type DebitResourceInput = CreditResourceInput;
export type InternalMorasWalletTransferInput = Omit<CreditResourceInput, 'playerElementKey' | 'resourceKey' | 'amount'> & Readonly<{ delta: bigint }>;

export class PrismaEconomyService {
  constructor(private readonly now: () => Date = () => new Date()) {}

  public async adjustWithoutStats(transaction: Prisma.TransactionClient, input: Omit<CreditResourceInput, 'amount' | 'playerElementKey'> & { delta: bigint }) {
    const before = await this.lockBalance(transaction, input.playerId, input.resourceKey);
    if (input.resourceKey.startsWith('particles_')) {
      await expireTrades(transaction, this.now());
      if (input.delta < 0n && (await particleStock(transaction, input.playerId, input.resourceKey)).available < -input.delta) throw new BusinessError('INSUFFICIENT_AVAILABLE_PARTICLES', 'Vous ne possédez pas assez de particules disponibles.');
    }
    const after = before + input.delta;
    if (after < 0n) throw new BusinessError('MODERATION_INSUFFICIENT_RESOURCE', 'Le solde de cette ressource est insuffisant.');
    await transaction.playerResourceBalance.update({ where: { playerId_resourceKey: { playerId: input.playerId, resourceKey: input.resourceKey } }, data: { amount: after } });
    await transaction.resourceMovement.create({ data: { ...input, balanceBefore: before, balanceAfter: after } });
    if (input.resourceKey.startsWith('particles_')) await reconcileParticleTrades(transaction, [input.playerId], this.now());
    return { before, after };
  }

  /** An atomic bilateral transfer: audit all four legs, never alter earned/spent. */
  public async exchangeParticlesWithoutStats(transaction: Prisma.TransactionClient, input: {
    senderId: string; recipientId: string; senderResource: ResourceKey; recipientResource: ResourceKey;
    amount: bigint; operationId: string; sourceChannel: SourceChannel;
  }): Promise<void> {
    if (input.amount <= 0n || input.senderId === input.recipientId || input.senderResource === input.recipientResource || !input.senderResource.startsWith('particles_') || !input.recipientResource.startsWith('particles_')) throw new RangeError('Invalid particle transfer.');
    const legs = [
      { playerId: input.senderId, resourceKey: input.senderResource, delta: -input.amount },
      { playerId: input.recipientId, resourceKey: input.senderResource, delta: input.amount },
      { playerId: input.recipientId, resourceKey: input.recipientResource, delta: -input.amount },
      { playerId: input.senderId, resourceKey: input.recipientResource, delta: input.amount },
    ].sort((a, b) => a.playerId.localeCompare(b.playerId) || a.resourceKey.localeCompare(b.resourceKey));
    for (const leg of legs) {
      const before = await this.lockBalance(transaction, leg.playerId, leg.resourceKey);
      const stock = await particleStock(transaction, leg.playerId, leg.resourceKey);
      if (leg.delta < 0n && stock.available < -leg.delta) throw new BusinessError('TRADE_STOCK_CHANGED', 'Le stock disponible a changé.');
      const after = before + leg.delta;
      await transaction.playerResourceBalance.update({ where: { playerId_resourceKey: { playerId: leg.playerId, resourceKey: leg.resourceKey } }, data: { amount: after } });
      await transaction.resourceMovement.create({ data: { ...leg, balanceBefore: before, balanceAfter: after, causeKey: 'trade.exchange', domainKey: 'trades', operationId: input.operationId, sourceChannel: input.sourceChannel } });
    }
    await reconcileParticleTrades(transaction, [input.senderId, input.recipientId], this.now());
  }
  public async transferMorasWithoutStats(transaction: Prisma.TransactionClient, input: InternalMorasWalletTransferInput): Promise<{ balanceBefore: bigint; balanceAfter: bigint }> {
    if (input.delta === 0n) throw new RangeError('An internal Mora transfer delta cannot be zero.');
    const balanceBefore = await this.lockBalance(transaction, input.playerId, 'moras');
    const balanceAfter = balanceBefore + input.delta;
    if (balanceAfter < 0n) throw new BusinessError('BANK_WALLET_INSUFFICIENT', 'Vous ne possédez pas assez de Moras dans votre portefeuille.');
    await transaction.playerResourceBalance.update({ where: { playerId_resourceKey: { playerId: input.playerId, resourceKey: 'moras' } }, data: { amount: balanceAfter } });
    await transaction.resourceMovement.create({ data: {
      playerId: input.playerId, resourceKey: 'moras', delta: input.delta,
      balanceBefore, balanceAfter, causeKey: input.causeKey, domainKey: input.domainKey,
      operationId: input.operationId, sourceChannel: input.sourceChannel,
    } });
    return { balanceBefore, balanceAfter };
  }

  public async debit(transaction: Prisma.TransactionClient, input: DebitResourceInput): Promise<void> {
    if (input.amount <= 0n) throw new RangeError('An economic debit amount must be positive.');
    if (input.resourceKey.startsWith('particles_')) {
      await expireTrades(transaction, this.now());
      if ((await particleStock(transaction, input.playerId, input.resourceKey)).available < input.amount) throw new BusinessError('INSUFFICIENT_AVAILABLE_PARTICLES', 'Vous ne possédez pas assez de particules disponibles.');
    }
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
    if (input.resourceKey.startsWith('particles_')) await reconcileParticleTrades(transaction, [input.playerId], this.now());
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
    if (input.resourceKey.startsWith('particles_')) {
      await expireTrades(transaction, this.now());
      await reconcileParticleTrades(transaction, [input.playerId], this.now());
    }
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
