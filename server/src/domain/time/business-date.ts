export const BUSINESS_TIME_ZONE = 'Europe/Paris';

export interface Clock {
  now(): Date;
}

const businessDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function getBusinessDate(instant: Date): string {
  const parts = Object.fromEntries(
    businessDateFormatter
      .formatToParts(instant)
      .filter(({ type }) => type !== 'literal')
      .map(({ type, value }) => [type, value]),
  );

  if (!parts.year || !parts.month || !parts.day) {
    throw new Error('Unable to compute the Europe/Paris business date.');
  }

  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** PostgreSQL DATE carrier. Only the YYYY-MM-DD calendar fields are significant. */
export function businessDateToDatabaseDate(businessDate: string): Date {
  return new Date(`${businessDate}T00:00:00.000Z`);
}

export function databaseDateToBusinessDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function addBusinessDays(businessDate: string, days: number): string {
  const value = businessDateToDatabaseDate(businessDate);
  value.setUTCDate(value.getUTCDate() + days);
  return databaseDateToBusinessDate(value);
}

const parisOffsetFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TIME_ZONE,
  timeZoneName: 'longOffset',
});

export function getNextBusinessResetAt(instant: Date): Date {
  return getBusinessDayStartAt(addBusinessDays(getBusinessDate(instant), 1));
}

export function getBusinessDayStartAt(businessDate: string): Date {
  const utcMidnight = new Date(`${businessDate}T00:00:00.000Z`);
  const offsetName = parisOffsetFormatter.formatToParts(utcMidnight).find(({ type }) => type === 'timeZoneName')?.value;
  const match = offsetName?.match(/^GMT([+-])(\d{2}):(\d{2})$/);
  if (!match) throw new Error('Unable to resolve the Europe/Paris UTC offset.');
  const direction = match[1] === '+' ? 1 : -1;
  const offset = direction * (Number(match[2]) * 60 + Number(match[3])) * 60_000;
  return new Date(utcMidnight.getTime() - offset);
}
