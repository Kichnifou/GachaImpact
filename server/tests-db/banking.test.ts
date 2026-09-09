import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';

import { loadConfig } from '../src/config/environment.js';
import { PrismaBankingStore } from '../src/infrastructure/database/prisma-banking-store.js';
import { createDatabase } from '../src/infrastructure/database/prisma-database.js';

const config = loadConfig();
if (!config.databaseUrl) throw new Error('DATABASE_URL is required for Banking database tests.');
const database = createDatabase(config.databaseUrl);
const playerIds: string[] = [];

afterAll(async () => {
  if (playerIds.length) {
    await database.bankTransaction.deleteMany({ where: { playerId: { in: playerIds } } });
    await database.resourceMovement.deleteMany({ where: { playerId: { in: playerIds } } });
    await database.businessOperation.deleteMany({ where: { playerId: { in: playerIds } } });
    await database.player.deleteMany({ where: { id: { in: playerIds } } });
  }
  await database.$disconnect();
});

async function createPlayer(walletMoras: bigint, earned = 0n, spent = 0n) {
  const player = await database.player.create({ data: { displayName: `Bank ${randomUUID().slice(0, 8)}` } });
  playerIds.push(player.id);
  await Promise.all([
    database.playerResourceBalance.create({ data: { playerId: player.id, resourceKey: 'moras', amount: walletMoras } }),
    database.playerEconomyStats.create({ data: { playerId: player.id, totalMorasEarned: earned, totalMorasSpent: spent } }),
  ]);
  return player.id;
}

const date = '2026-09-09';
const occurredAt = new Date('2026-09-09T12:00:00.000Z');
const transfer = (playerId: string, direction: 'deposit' | 'withdraw', amount: bigint | 'max', idempotencyKey = randomUUID(), at = occurredAt) => ({
  playerId, direction, amount, idempotencyKey, businessDate: date, occurredAt: at, sourceChannel: 'UI' as const,
});

describe('Banking persistence', () => {
  it('starts at zero and performs neutral normal/MAX deposits and withdrawals with an ordered ledger', async () => {
    const playerId = await createPlayer(1_000n, 40n, 20n);
    const store = new PrismaBankingStore(database);
    expect(await store.getState(playerId, date, occurredAt)).toMatchObject({ walletMoras: 1_000n, bankMoras: 0n, recentOperations: [] });

    expect(await store.transfer(transfer(playerId, 'deposit', 250n, randomUUID(), new Date(occurredAt.getTime() + 1)))).toMatchObject({ walletMoras: 750n, bankMoras: 250n });
    expect(await store.transfer(transfer(playerId, 'deposit', 'max', randomUUID(), new Date(occurredAt.getTime() + 2)))).toMatchObject({ walletMoras: 0n, bankMoras: 1_000n });
    expect(await store.transfer(transfer(playerId, 'withdraw', 400n, randomUUID(), new Date(occurredAt.getTime() + 3)))).toMatchObject({ walletMoras: 400n, bankMoras: 600n });
    expect(await store.transfer(transfer(playerId, 'withdraw', 'max', randomUUID(), new Date(occurredAt.getTime() + 4)))).toMatchObject({ walletMoras: 1_000n, bankMoras: 0n });

    const stats = await database.playerEconomyStats.findUniqueOrThrow({ where: { playerId } });
    expect(stats).toMatchObject({ totalMorasEarned: 40n, totalMorasSpent: 20n });
    const state = await store.getState(playerId, date, occurredAt);
    expect(state.recentOperations.map(({ type }) => type)).toEqual(['WITHDRAWAL', 'WITHDRAWAL', 'DEPOSIT', 'DEPOSIT']);
    expect(state.recentOperations[0]).toMatchObject({ bankBalanceAfter: 0n, walletBalanceAfter: 1_000n });
  });

  it('rejects insufficient transfers atomically and makes repeated/concurrent intents idempotent', async () => {
    const playerId = await createPlayer(1_000n);
    const store = new PrismaBankingStore(database);
    await expect(store.transfer(transfer(playerId, 'deposit', 1_001n))).rejects.toMatchObject({ code: 'BANK_WALLET_INSUFFICIENT' });
    await expect(store.transfer(transfer(playerId, 'withdraw', 1n))).rejects.toMatchObject({ code: 'BANK_BALANCE_INSUFFICIENT' });
    expect(await store.getState(playerId, date, occurredAt)).toMatchObject({ walletMoras: 1_000n, bankMoras: 0n, recentOperations: [] });

    const key = randomUUID();
    const [first, repeated] = await Promise.all([
      store.transfer(transfer(playerId, 'deposit', 100n, key)),
      store.transfer(transfer(playerId, 'deposit', 100n, key)),
    ]);
    expect([first.operation.alreadyProcessed, repeated.operation.alreadyProcessed].sort()).toEqual([false, true]);
    expect(await store.getState(playerId, date, occurredAt)).toMatchObject({ walletMoras: 900n, bankMoras: 100n });
    expect(await database.bankTransaction.count({ where: { playerId } })).toBe(1);
  });

  it('serializes concurrent transfers without negative balances', async () => {
    const playerId = await createPlayer(1_000n);
    const store = new PrismaBankingStore(database);
    await Promise.all([
      store.transfer(transfer(playerId, 'deposit', 400n)),
      store.transfer(transfer(playerId, 'deposit', 400n)),
    ]);
    expect(await store.getState(playerId, date, occurredAt)).toMatchObject({ walletMoras: 200n, bankMoras: 800n });
    const outcomes = await Promise.allSettled([
      store.transfer(transfer(playerId, 'deposit', 150n)),
      store.transfer(transfer(playerId, 'deposit', 150n)),
    ]);
    expect(outcomes.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(await store.getState(playerId, date, occurredAt)).toMatchObject({ walletMoras: 50n, bankMoras: 950n });
  });

  it('catches up compounded daily interest exactly once, credits only Bank and earned stats, and supports high bigint values', async () => {
    const playerId = await createPlayer(777n, 9n, 4n);
    const store = new PrismaBankingStore(database);
    await database.playerBankAccount.create({ data: { playerId, balance: 9_007_199_254_740_993n, lastInterestDate: new Date('2026-09-07T00:00:00Z') } });

    const dayOne = 9_007_199_254_740_993n * 3n / 100n;
    const afterDayOne = 9_007_199_254_740_993n + dayOne;
    const dayTwo = afterDayOne * 3n / 100n;
    const expected = afterDayOne + dayTwo;
    const state = await store.getState(playerId, date, occurredAt);
    expect(state).toMatchObject({ walletMoras: 777n, bankMoras: expected });
    expect(state.recentOperations.map(({ amount }) => amount)).toEqual([dayTwo, dayOne]);
    expect((await database.playerEconomyStats.findUniqueOrThrow({ where: { playerId } }))).toMatchObject({ totalMorasEarned: 9n + dayOne + dayTwo, totalMorasSpent: 4n });

    const repeated = await store.getState(playerId, date, new Date('2026-09-09T20:00:00Z'));
    expect(repeated.bankMoras).toBe(expected);
    expect(await database.bankTransaction.count({ where: { playerId, transactionType: 'INTEREST' } })).toBe(2);
  });

  it('serializes interest catch-up with a concurrent transfer against the same Player lock', async () => {
    const playerId = await createPlayer(1_000n);
    const store = new PrismaBankingStore(database);
    await database.playerBankAccount.create({ data: { playerId, balance: 1_000n, lastInterestDate: new Date('2026-09-08T00:00:00Z') } });
    await Promise.all([
      store.getState(playerId, date, occurredAt),
      store.transfer(transfer(playerId, 'deposit', 100n)),
    ]);
    expect(await store.getState(playerId, date, occurredAt)).toMatchObject({ walletMoras: 900n, bankMoras: 1_130n });
    expect(await database.bankTransaction.count({ where: { playerId, transactionType: 'INTEREST' } })).toBe(1);
  });
});
