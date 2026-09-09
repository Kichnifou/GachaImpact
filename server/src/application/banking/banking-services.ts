import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import type { Clock } from '../../domain/time/business-date.js';
import { calculateDailyBankInterest } from '../../domain/banking/bank-interest.js';
import { getBusinessDate, getNextBusinessResetAt } from '../../domain/time/business-date.js';
import { BusinessError } from '../errors.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';
import type { BankingStore, BankSourceChannel, BankState, BankTransferAmount, BankTransferDirection, BankTransferResult } from './banking-store.js';

export type BankingView = BankState & Readonly<{
  totalWealth: bigint;
  estimatedInterest: bigint;
  nextInterestAt: Date;
}>;

export type BankingTransferView = BankingView & Pick<BankTransferResult, 'operation'>;

export class GetCurrentPlayerBank {
  public constructor(private readonly getPlayer: GetCurrentPlayer, private readonly store: BankingStore, private readonly clock: Clock) {}
  public async execute(identity: AuthenticatedIdentity): Promise<BankingView> {
    const player = await this.getPlayer.execute(identity);
    const now = this.clock.now();
    return decorate(await this.store.getState(player.id, getBusinessDate(now), now), now);
  }
}

export class TransferPlayerBank {
  public constructor(private readonly direction: BankTransferDirection, private readonly getPlayer: GetCurrentPlayer, private readonly store: BankingStore, private readonly clock: Clock, private readonly sourceChannel: BankSourceChannel = 'UI') {}
  public async execute(identity: AuthenticatedIdentity, amount: BankTransferAmount, idempotencyKey: string): Promise<BankingTransferView> {
    if (amount !== 'max' && amount <= 0n) throw new BusinessError('BANK_AMOUNT_INVALID', 'Le montant doit être un entier strictement positif.');
    const player = await this.getPlayer.execute(identity);
    const now = this.clock.now();
    const result = await this.store.transfer({ playerId: player.id, direction: this.direction, amount, idempotencyKey, businessDate: getBusinessDate(now), occurredAt: now, sourceChannel: this.sourceChannel });
    return { ...decorate(result, now), operation: result.operation };
  }
}

export class BankInterestProcessor {
  public constructor(private readonly store: BankingStore, private readonly clock: Clock) {}
  public processCurrentDate(): Promise<{ playersProcessed: number; daysProcessed: number }> {
    const now = this.clock.now();
    return this.store.accrueAllInterestThrough(getBusinessDate(now), now);
  }
}

function decorate(state: BankState, now: Date): BankingView {
  return {
    ...state,
    totalWealth: state.walletMoras + state.bankMoras,
    estimatedInterest: calculateDailyBankInterest(state.bankMoras),
    nextInterestAt: getNextBusinessResetAt(now),
  };
}
