import { businessDateToDatabaseDate } from '../../domain/time/business-date.js';
export { remainingFavorDays } from '../../domain/favor/favor-calendar.js';

const dayMs = 86_400_000;
function addBusinessDays(day: string, count: number): Date {
  return new Date(businessDateToDatabaseDate(day).getTime() + count * dayMs);
}

/** Both bounds are inclusive business dates. A claimed or newly obtained cutover day is already consumed. */
export function projectLegacyFavorPeriod(daysRemaining: number, cutoverDay: string,
  obtainedDay: string | null, lastClaimDay: string | null) {
  if (!Number.isSafeInteger(daysRemaining) || daysRemaining < 0 || daysRemaining > 180)
    throw new Error('Invalid legacy Faveur balance.');
  const cutover = businessDateToDatabaseDate(cutoverDay);
  if (obtainedDay && businessDateToDatabaseDate(obtainedDay) > cutover) throw new Error('Legacy Faveur obtainedDate is after cutover.');
  if (lastClaimDay && businessDateToDatabaseDate(lastClaimDay) > cutover) throw new Error('Legacy Faveur lastClaimDate is after cutover.');
  if (daysRemaining === 0) return { activeFromDate: null, activeUntilDate: null };
  const firstOffset = obtainedDay === cutoverDay || lastClaimDay === cutoverDay ? 1 : 0;
  return { activeFromDate: addBusinessDays(cutoverDay, firstOffset),
    activeUntilDate: addBusinessDays(cutoverDay, firstOffset + daysRemaining - 1) };
}
