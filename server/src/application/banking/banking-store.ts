export const bankTransactionTypes = ['DEPOSIT', 'WITHDRAWAL', 'INTEREST'] as const;
export type BankTransactionType = typeof bankTransactionTypes[number];
export type BankTransferDirection = 'deposit' | 'withdraw';
export type BankTransferAmount = bigint | 'max';
export type BankSourceChannel = 'UI' | 'CHAT' | 'TWITCH';

export type BankOperation = Readonly<{
  id: string;
  type: BankTransactionType;
  amount: bigint;
  bankBalanceAfter: bigint;
  walletBalanceAfter: bigint | null;
  businessDate: string | null;
  createdAt: Date;
}>;

export type BankState = Readonly<{
  walletMoras: bigint;
  bankMoras: bigint;
  recentOperations: readonly BankOperation[];
}>;

export type BankTransferResult = BankState & Readonly<{
  operation: Readonly<{ id: string; alreadyProcessed: boolean }>;
}>;

export type BankTransferInput = Readonly<{
  playerId: string;
  direction: BankTransferDirection;
  amount: BankTransferAmount;
  idempotencyKey: string;
  businessDate: string;
  occurredAt: Date;
  sourceChannel: BankSourceChannel;
}>;

export interface BankingStore {
  getState(playerId: string, businessDate: string, now: Date): Promise<BankState>;
  transfer(input: BankTransferInput): Promise<BankTransferResult>;
  accrueAllInterestThrough(businessDate: string, now: Date): Promise<{ playersProcessed: number; daysProcessed: number }>;
}
