export const DAILY_BANK_INTEREST_PERCENT = 3n;

export function calculateDailyBankInterest(balance: bigint): bigint {
  if (balance < 0n) throw new RangeError('A bank balance cannot be negative.');
  return balance * DAILY_BANK_INTEREST_PERCENT / 100n;
}
