import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../src/app.js';
import { GetCurrentPlayerBank, GetPlayerBankHistory, TransferPlayerBank } from '../src/application/banking/banking-services.js';
import type { BankingStore, BankState, BankTransferInput } from '../src/application/banking/banking-store.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { GetOrProvisionCurrentPlayer } from '../src/application/player/get-or-provision-current-player.js';
import { calculateDailyBankInterest } from '../src/domain/banking/bank-interest.js';
import { getNextBusinessResetAt } from '../src/domain/time/business-date.js';
import { BankInterestScheduler } from '../src/application/banking/bank-interest-scheduler.js';

const playerId = crypto.randomUUID();
const now = new Date('2026-09-09T18:30:00.000Z');

class FakeBankingStore implements BankingStore {
  public state: BankState = {
    walletMoras: 560_250n,
    bankMoras: 100_001n,
    recentOperations: [{ id: 'interest', type: 'INTEREST', amount: 3_000n, bankBalanceAfter: 100_001n, walletBalanceAfter: null, businessDate: '2026-09-09', createdAt: now }],
  };
  public history = [...this.state.recentOperations];
  public readonly transfers: BankTransferInput[] = [];
  public async getState() { return this.state; }
  public async getHistory(_playerId: string, page: number) {
    return { page, totalCount: this.history.length, totalPages: Math.ceil(this.history.length / 10), operations: this.history.slice((page - 1) * 10, page * 10) };
  }
  public async transfer(input: BankTransferInput) {
    this.transfers.push(input);
    const amount = input.amount === 'max' ? (input.direction === 'deposit' ? this.state.walletMoras : this.state.bankMoras) : input.amount;
    this.state = input.direction === 'deposit'
      ? { ...this.state, walletMoras: this.state.walletMoras - amount, bankMoras: this.state.bankMoras + amount }
      : { ...this.state, walletMoras: this.state.walletMoras + amount, bankMoras: this.state.bankMoras - amount };
    return { ...this.state, operation: { id: 'operation', alreadyProcessed: false } };
  }
  public async accrueAllInterestThrough() { return { playersProcessed: 0, daysProcessed: 0 }; }
}

describe('banking domain and HTTP contract', () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
  afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

  it('floors each daily 3% interest calculation and resolves Paris reset across DST', () => {
    expect(calculateDailyBankInterest(100_001n)).toBe(3_000n);
    expect(calculateDailyBankInterest(0n)).toBe(0n);
    expect(getNextBusinessResetAt(new Date('2026-03-28T12:00:00Z'))).toEqual(new Date('2026-03-28T23:00:00Z'));
    expect(getNextBusinessResetAt(new Date('2026-03-29T12:00:00Z'))).toEqual(new Date('2026-03-29T22:00:00Z'));
    expect(getNextBusinessResetAt(new Date('2026-10-24T12:00:00Z'))).toEqual(new Date('2026-10-24T22:00:00Z'));
    expect(getNextBusinessResetAt(new Date('2026-10-25T12:00:00Z'))).toEqual(new Date('2026-10-25T23:00:00Z'));
  });

  it('runs an offline catch-up at startup and schedules the next Paris reset', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-09T21:59:59.000Z'));
    const processCurrentDate = vi.fn(async () => ({ playersProcessed: 0, daysProcessed: 0 }));
    const scheduler = new BankInterestScheduler({ processCurrentDate }, { now: () => new Date(Date.now()) });
    await scheduler.start();
    expect(processCurrentDate).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(processCurrentDate).toHaveBeenCalledTimes(2);
    scheduler.stop();
    vi.useRealTimers();
  });

  async function setup() {
    const store = new FakeBankingStore();
    const playerStore = { findByIdentity: async () => ({ id: playerId, displayName: 'Banquier', elementKey: 'geo', status: 'ACTIVE' as const }), provision: vi.fn() };
    const currentPlayer = new GetCurrentPlayer(playerStore);
    const clock = { now: () => now };
    const app = await buildApp({ host: '127.0.0.1', port: 3001, supabase: {} }, {
      authIdentityVerifier: { verify: async () => ({ subject: 'subject' }) },
      getOrProvisionCurrentPlayer: new GetOrProvisionCurrentPlayer(playerStore),
      getCurrentPlayerBank: new GetCurrentPlayerBank(currentPlayer, store, clock),
      getPlayerBankHistory: new GetPlayerBankHistory(currentPlayer, store),
      depositPlayerBank: new TransferPlayerBank('deposit', currentPlayer, store, clock),
      withdrawPlayerBank: new TransferPlayerBank('withdraw', currentPlayer, store, clock),
    });
    apps.push(app);
    return { app, store };
  }

  it('protects and serializes the authoritative bank state without bigint loss', async () => {
    const { app } = await setup();
    expect((await app.inject({ url: '/api/v1/me/bank' })).statusCode).toBe(401);
    const response = await app.inject({ url: '/api/v1/me/bank', headers: { authorization: 'Bearer token' } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      walletMoras: '560250', bankMoras: '100001', totalWealth: '660251', estimatedInterest: '3000', interestRatePercent: 3,
      nextInterestAt: '2026-09-09T22:00:00.000Z',
      recentOperations: [{ id: 'interest', type: 'INTEREST', amount: '3000', bankBalanceAfter: '100001', walletBalanceAfter: null, businessDate: '2026-09-09', createdAt: now.toISOString() }],
    });
  });

  it('accepts positive integer and MAX transfer intents but rejects client-side arithmetic and invalid amounts', async () => {
    const { app, store } = await setup();
    const headers = { authorization: 'Bearer token' };
    const key = crypto.randomUUID();
    const deposit = await app.inject({ method: 'POST', url: '/api/v1/me/bank/deposit', headers, payload: { amount: '250', idempotencyKey: key } });
    expect(deposit.statusCode).toBe(200);
    expect(deposit.json()).toMatchObject({ walletMoras: '560000', bankMoras: '100251', totalWealth: '660251', operation: { alreadyProcessed: false } });
    const withdrawal = await app.inject({ method: 'POST', url: '/api/v1/me/bank/withdraw', headers, payload: { amount: 'MAX', idempotencyKey: crypto.randomUUID() } });
    expect(withdrawal.statusCode).toBe(200);
    expect(store.transfers.map(({ amount }) => amount)).toEqual([250n, 'max']);
    for (const amount of ['0', '-1', '1.5', '9007199254740991e2']) {
      expect((await app.inject({ method: 'POST', url: '/api/v1/me/bank/deposit', headers, payload: { amount, idempotencyKey: crypto.randomUUID() } })).statusCode).toBe(400);
    }
  });

  it('protects and paginates the personal bank history newest first without bigint loss', async () => {
    const { app, store } = await setup();
    store.history = Array.from({ length: 12 }, (_, index) => ({
      id: `operation-${index + 1}`,
      type: index === 0 ? 'INTEREST' as const : 'DEPOSIT' as const,
      amount: 9_007_199_254_740_993n + BigInt(index),
      bankBalanceAfter: 10_000_000_000_000_000n + BigInt(index),
      walletBalanceAfter: index === 0 ? null : 500n - BigInt(index),
      businessDate: index === 0 ? '2026-09-09' : null,
      createdAt: new Date(now.getTime() - index),
    }));
    expect((await app.inject({ url: '/api/v1/me/bank/history?page=1' })).statusCode).toBe(401);
    const first = await app.inject({ url: '/api/v1/me/bank/history?page=1', headers: { authorization: 'Bearer token' } });
    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({ page: 1, totalPages: 2, totalCount: 12 });
    expect(first.json().operations).toHaveLength(10);
    expect(first.json().operations[0]).toMatchObject({ id: 'operation-1', amount: '9007199254740993', walletBalanceAfter: null });
    const second = await app.inject({ url: '/api/v1/me/bank/history?page=2', headers: { authorization: 'Bearer token' } });
    expect(second.json().operations).toHaveLength(2);
    for (const page of ['0', '-1', 'abc', '1.5']) {
      expect((await app.inject({ url: `/api/v1/me/bank/history?page=${page}`, headers: { authorization: 'Bearer token' } })).statusCode).toBe(400);
    }
  });
});
