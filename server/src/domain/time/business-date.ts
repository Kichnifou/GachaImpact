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
