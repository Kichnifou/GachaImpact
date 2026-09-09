import { OperationStatus, Prisma, SourceChannel, type PrismaClient } from '../../../generated/prisma/client.js';
import type { BankingStore, BankOperation, BankState, BankTransferInput, BankTransferResult, BankTransactionType } from '../../application/banking/banking-store.js';
import { BusinessError } from '../../application/errors.js';
import { addBusinessDays, businessDateToDatabaseDate, databaseDateToBusinessDate, getBusinessDayStartAt } from '../../domain/time/business-date.js';
import { calculateDailyBankInterest } from '../../domain/banking/bank-interest.js';
import { isPrismaConcurrencyCollision } from './prisma-concurrency.js';
import { PrismaEconomyService } from './prisma-economy-service.js';

const MAX_ATTEMPTS = 4;
const RECENT_OPERATION_LIMIT = 10;
type BankAccountCursor = Readonly<{ balance: bigint; lastInterestDate: Date }>;

export class PrismaBankingStore implements BankingStore {
  public constructor(private readonly database: PrismaClient, private readonly economy = new PrismaEconomyService()) {}

  public async getState(playerId: string, businessDate: string, now: Date): Promise<BankState> {
    return this.withRetry(() => this.database.$transaction(async (transaction) => {
      await lockPlayer(transaction, playerId);
      let account = await ensureAndLockAccount(transaction, playerId, businessDate);
      account = await accruePlayerThrough(transaction, playerId, account, businessDate, now);
      return readState(transaction, playerId, account.balance);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20_000 }));
  }

  public async transfer(input: BankTransferInput): Promise<BankTransferResult> {
    const operationType = `bank.${input.direction}`;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        return await this.database.$transaction(async (transaction) => {
          await lockPlayer(transaction, input.playerId);
          let account = await ensureAndLockAccount(transaction, input.playerId, input.businessDate);
          account = await accruePlayerThrough(transaction, input.playerId, account, input.businessDate, input.occurredAt);

          const sourceChannel = toSourceChannel(input.sourceChannel);
          const existing = await transaction.businessOperation.findFirst({ where: { sourceChannel, idempotencyKey: input.idempotencyKey } });
          if (existing) {
            assertMatchingOperation(existing.playerId, existing.operationType, input.playerId, operationType);
            if (existing.status !== OperationStatus.COMPLETED) throw new BusinessError('BANK_IDEMPOTENCY_CONFLICT', 'Cette opération Banque est encore en cours.');
            return this.completedResult(transaction, input.playerId, account.balance, existing.id, true);
          }

          const wallet = await lockWallet(transaction, input.playerId);
          const available = input.direction === 'deposit' ? wallet : account.balance;
          const amount = input.amount === 'max' ? available : input.amount;
          if (amount <= 0n) throw new BusinessError('BANK_AMOUNT_INVALID', 'Le montant doit être un entier strictement positif.');
          if (input.direction === 'deposit' && wallet < amount) throw new BusinessError('BANK_WALLET_INSUFFICIENT', 'Vous ne possédez pas assez de Moras dans votre portefeuille.');
          if (input.direction === 'withdraw' && account.balance < amount) throw new BusinessError('BANK_BALANCE_INSUFFICIENT', 'Votre Banque ne contient pas assez de Moras.');

          const operation = await transaction.businessOperation.create({ data: {
            playerId: input.playerId, operationType, sourceChannel, idempotencyKey: input.idempotencyKey,
          }, select: { id: true } });
          const bankBalanceBefore = account.balance;
          const bankBalanceAfter = input.direction === 'deposit' ? bankBalanceBefore + amount : bankBalanceBefore - amount;
          const walletChange = await this.economy.transferMorasWithoutStats(transaction, {
            playerId: input.playerId,
            delta: input.direction === 'deposit' ? -amount : amount,
            causeKey: operationType,
            domainKey: 'bank',
            operationId: operation.id,
            sourceChannel,
          });
          await transaction.playerBankAccount.update({ where: { playerId: input.playerId }, data: { balance: bankBalanceAfter } });
          await transaction.bankTransaction.create({ data: {
            playerId: input.playerId,
            transactionType: input.direction === 'deposit' ? 'DEPOSIT' : 'WITHDRAWAL',
            amount,
            bankBalanceBefore,
            bankBalanceAfter,
            walletBalanceBefore: walletChange.balanceBefore,
            walletBalanceAfter: walletChange.balanceAfter,
            operationId: operation.id,
            createdAt: input.occurredAt,
          } });
          await transaction.businessOperation.update({ where: { id: operation.id }, data: {
            status: OperationStatus.COMPLETED,
            completedAt: input.occurredAt,
            resultSummary: { amount: amount.toString(), walletMoras: walletChange.balanceAfter.toString(), bankMoras: bankBalanceAfter.toString() },
          } });
          return this.completedResult(transaction, input.playerId, bankBalanceAfter, operation.id, false);
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20_000 });
      } catch (error) {
        if (!isPrismaConcurrencyCollision(error) || attempt === MAX_ATTEMPTS) throw error;
        const existing = await this.readCompletedRetry(input.playerId, operationType, input.idempotencyKey, input.businessDate, input.occurredAt, toSourceChannel(input.sourceChannel));
        if (existing) return existing;
      }
    }
    throw new Error('Bank transfer exhausted all retry attempts.');
  }

  public async accrueAllInterestThrough(businessDate: string, now: Date): Promise<{ playersProcessed: number; daysProcessed: number }> {
    await this.database.$executeRaw`
      INSERT INTO player_bank_accounts (player_id, balance, last_interest_date)
      SELECT id, 0, ${businessDate}::date FROM players
      ON CONFLICT (player_id) DO NOTHING
    `;
    const accounts = await this.database.playerBankAccount.findMany({ select: { playerId: true } });
    let playersProcessed = 0;
    let daysProcessed = 0;
    for (const { playerId } of accounts) {
      const count = await this.withRetry(() => this.database.$transaction(async (transaction) => {
        await lockPlayer(transaction, playerId);
        const account = await ensureAndLockAccount(transaction, playerId, businessDate);
        const before = account.lastInterestDate;
        await accruePlayerThrough(transaction, playerId, account, businessDate, now);
        return daysBetween(databaseDateToBusinessDate(before), businessDate);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20_000 }));
      if (count > 0) playersProcessed += 1;
      daysProcessed += count;
    }
    return { playersProcessed, daysProcessed };
  }

  private async completedResult(transaction: Prisma.TransactionClient, playerId: string, bankMoras: bigint, operationId: string, alreadyProcessed: boolean): Promise<BankTransferResult> {
    return { ...(await readState(transaction, playerId, bankMoras)), operation: { id: operationId, alreadyProcessed } };
  }

  private async readCompletedRetry(playerId: string, operationType: string, idempotencyKey: string, businessDate: string, now: Date, sourceChannel: SourceChannel): Promise<BankTransferResult | null> {
    const existing = await this.database.businessOperation.findFirst({ where: { sourceChannel, idempotencyKey } });
    if (!existing) return null;
    assertMatchingOperation(existing.playerId, existing.operationType, playerId, operationType);
    if (existing.status !== OperationStatus.COMPLETED) return null;
    const state = await this.getState(playerId, businessDate, now);
    return { ...state, operation: { id: existing.id, alreadyProcessed: true } };
  }

  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try { return await operation(); }
      catch (error) { if (!isPrismaConcurrencyCollision(error) || attempt === MAX_ATTEMPTS) throw error; }
    }
    throw new Error('Bank transaction exhausted all retry attempts.');
  }
}

async function lockPlayer(transaction: Prisma.TransactionClient, playerId: string): Promise<void> {
  const rows = await transaction.$queryRaw<{ id: string }[]>`SELECT id FROM players WHERE id = ${playerId}::uuid FOR UPDATE`;
  if (!rows[0]) throw new BusinessError('PLAYER_NOT_FOUND', 'No Player is linked to this account.');
}

async function ensureAndLockAccount(transaction: Prisma.TransactionClient, playerId: string, businessDate: string): Promise<BankAccountCursor> {
  await transaction.playerBankAccount.upsert({ where: { playerId }, create: { playerId, lastInterestDate: businessDateToDatabaseDate(businessDate) }, update: {} });
  await transaction.$queryRaw`SELECT player_id FROM player_bank_accounts WHERE player_id = ${playerId}::uuid FOR UPDATE`;
  return transaction.playerBankAccount.findUniqueOrThrow({ where: { playerId }, select: { balance: true, lastInterestDate: true } });
}

async function lockWallet(transaction: Prisma.TransactionClient, playerId: string): Promise<bigint> {
  await transaction.$queryRaw`SELECT amount FROM player_resource_balances WHERE player_id = ${playerId}::uuid AND resource_key = 'moras' FOR UPDATE`;
  return (await transaction.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId, resourceKey: 'moras' } }, select: { amount: true } })).amount;
}

async function accruePlayerThrough(transaction: Prisma.TransactionClient, playerId: string, initialAccount: BankAccountCursor, targetDate: string, now: Date): Promise<BankAccountCursor> {
  let balance = initialAccount.balance;
  let lastDate = databaseDateToBusinessDate(initialAccount.lastInterestDate);
  while (lastDate < targetDate) {
    const businessDate = addBusinessDays(lastDate, 1);
    const interest = calculateDailyBankInterest(balance);
    const operation = await transaction.businessOperation.create({ data: {
      playerId,
      operationType: 'bank.interest',
      sourceChannel: SourceChannel.SYSTEM,
      idempotencyKey: `bank-interest:${playerId}:${businessDate}`,
    }, select: { id: true } });
    const balanceAfter = balance + interest;
    await transaction.bankTransaction.create({ data: {
      playerId,
      transactionType: 'INTEREST',
      amount: interest,
      bankBalanceBefore: balance,
      bankBalanceAfter: balanceAfter,
      businessDate: businessDateToDatabaseDate(businessDate),
      operationId: operation.id,
      createdAt: getBusinessDayStartAt(businessDate),
    } });
    await transaction.playerBankAccount.update({ where: { playerId }, data: { balance: balanceAfter, lastInterestDate: businessDateToDatabaseDate(businessDate) } });
    if (interest > 0n) await transaction.playerEconomyStats.update({ where: { playerId }, data: { totalMorasEarned: { increment: interest } } });
    await transaction.businessOperation.update({ where: { id: operation.id }, data: {
      status: OperationStatus.COMPLETED,
      completedAt: now,
      resultSummary: { businessDate, interest: interest.toString(), bankMoras: balanceAfter.toString() },
    } });
    balance = balanceAfter;
    lastDate = businessDate;
  }
  return { ...initialAccount, balance, lastInterestDate: businessDateToDatabaseDate(lastDate) };
}

async function readState(transaction: Prisma.TransactionClient, playerId: string, bankMoras: bigint): Promise<BankState> {
  const [wallet, operations] = await Promise.all([
    transaction.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId, resourceKey: 'moras' } }, select: { amount: true } }),
    transaction.bankTransaction.findMany({ where: { playerId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: RECENT_OPERATION_LIMIT }),
  ]);
  return { walletMoras: wallet.amount, bankMoras, recentOperations: operations.map(toOperation) };
}

function toOperation(row: { id: string; transactionType: string; amount: bigint; bankBalanceAfter: bigint; walletBalanceAfter: bigint | null; businessDate: Date | null; createdAt: Date }): BankOperation {
  return {
    id: row.id,
    type: row.transactionType as BankTransactionType,
    amount: row.amount,
    bankBalanceAfter: row.bankBalanceAfter,
    walletBalanceAfter: row.walletBalanceAfter,
    businessDate: row.businessDate ? databaseDateToBusinessDate(row.businessDate) : null,
    createdAt: row.createdAt,
  };
}

function assertMatchingOperation(existingPlayerId: string | null, existingType: string, playerId: string, operationType: string): void {
  if (existingPlayerId !== playerId || existingType !== operationType) throw new BusinessError('BANK_IDEMPOTENCY_CONFLICT', 'Cette clé a déjà été utilisée pour une autre opération.');
}

function daysBetween(from: string, through: string): number {
  return Math.max(0, Math.round((businessDateToDatabaseDate(through).getTime() - businessDateToDatabaseDate(from).getTime()) / 86_400_000));
}

function toSourceChannel(channel: 'UI' | 'CHAT' | 'TWITCH'): SourceChannel {
  return channel === 'CHAT' ? SourceChannel.INTERNAL_CHAT : SourceChannel[channel];
}
