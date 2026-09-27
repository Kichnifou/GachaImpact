import { businessDateToDatabaseDate, getBusinessDate } from '../../domain/time/business-date.js';

export function isValidLegacyXpDate(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function mapLegacyXpProvenance(lastXpDate: unknown, lastXpMessageAt: Date | null) {
  let legacyLastXpDate: Date | null = null;
  if (lastXpDate !== null && lastXpDate !== undefined && lastXpDate !== '') {
    if (typeof lastXpDate !== 'string' || !isValidLegacyXpDate(lastXpDate))
      throw new Error('Invalid present legacy lastXpDate.');
    legacyLastXpDate = businessDateToDatabaseDate(lastXpDate);
  }
  const messageDay = lastXpMessageAt ? getBusinessDate(lastXpMessageAt) : null;
  const xpDay = legacyLastXpDate?.toISOString().slice(0, 10) ?? null;
  const issue = xpDay && messageDay && xpDay !== messageDay
    ? { code: 'LEGACY_XP_DATE_DIVERGENCE', severity: xpDay > messageDay ? 'INFO' as const : 'WARNING' as const,
      details: { lastXpDay: xpDay, lastXpMessageDay: messageDay } }
    : xpDay && !messageDay
      ? { code: 'LEGACY_XP_DAY_WITHOUT_MESSAGE_INSTANT', severity: 'INFO' as const,
        details: { lastXpDay: xpDay } }
      : null;
  // A message XP instant does not prove the exact time of the last XP gain across all sources.
  const lastXpAt = null;
  return { lastXpAt, lastXpMessageAt, legacyLastXpDate, issue };
}
