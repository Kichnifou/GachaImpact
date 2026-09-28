import { addBusinessDays, businessDateToDatabaseDate, databaseDateToBusinessDate } from '../time/business-date.js';

export const FAVOR_MAX_DAYS = 180;
export const FAVOR_GRANT_DAYS = 30;
export const FAVOR_DAILY_PRIMOGEMS = 800n;
export type FavorTier = 1 | 2 | 3;
export const FAVOR_TIER_PRIMOGEMS = { 1: 1600n, 2: 4800n, 3: 9600n } as const;

export type FavorPeriod = { activeFromDate: Date | null; activeUntilDate: Date | null };

/** Inclusive DATE fields, never elapsed local-clock hours (including DST days). */
export function remainingFavorDays(activeFromDate: Date | null, activeUntilDate: Date | null, businessDay: string): number {
  if (!activeFromDate || !activeUntilDate) return 0;
  const today = businessDateToDatabaseDate(businessDay);
  const first = today > activeFromDate ? today : activeFromDate;
  return Math.max(0, Math.round((activeUntilDate.getTime() - first.getTime()) / 86_400_000) + 1);
}

export function projectFavorCalendar(period: FavorPeriod | null, businessDate: string) {
  const today = businessDateToDatabaseDate(businessDate);
  return {
    active: !!period?.activeFromDate && !!period.activeUntilDate && period.activeFromDate <= today && today <= period.activeUntilDate,
    daysRemaining: Math.min(FAVOR_MAX_DAYS, remainingFavorDays(period?.activeFromDate ?? null, period?.activeUntilDate ?? null, businessDate)),
  };
}

export function extendFavorPeriod(period: FavorPeriod | null, businessDate: string) {
  const { daysRemaining } = projectFavorCalendar(period, businessDate);
  const addedDays = Math.min(FAVOR_GRANT_DAYS, FAVOR_MAX_DAYS - daysRemaining);
  const blockedDays = FAVOR_GRANT_DAYS - addedDays;
  const tomorrow = businessDateToDatabaseDate(addBusinessDays(businessDate, 1));
  const activeFromDate = daysRemaining ? period!.activeFromDate! : tomorrow;
  const firstAddedDay = daysRemaining
    ? addBusinessDays(databaseDateToBusinessDate(period!.activeUntilDate!), 1)
    : databaseDateToBusinessDate(tomorrow);
  const activeUntilDate = addedDays
    ? businessDateToDatabaseDate(addBusinessDays(firstAddedDay, addedDays - 1))
    : period!.activeUntilDate!;
  return { activeFromDate, activeUntilDate, addedDays, blockedDays,
    compensationPrimogems: BigInt(Math.round(1600 * blockedDays / FAVOR_GRANT_DAYS)) };
}
