import { describe, expect, it } from 'vitest';

import { resolveCurrentEventPeriod } from '../src/application/event/event-service.js';

describe('monthly Event period resolution', () => {
  it.each([
    ['2026-01-31T22:59:59.999Z', 2026, 1],
    ['2026-01-31T23:00:00.000Z', 2026, 2],
    ['2026-08-31T21:59:59.999Z', 2026, 8],
    ['2026-08-31T22:00:00.000Z', 2026, 9],
    ['2026-09-30T21:59:59.999Z', 2026, 9],
    ['2026-09-30T22:00:00.000Z', 2026, 10],
    ['2026-12-31T22:59:59.999Z', 2026, 12],
    ['2026-12-31T23:00:00.000Z', 2027, 1],
  ])('uses the Europe/Paris month at %s', (instant, year, month) => {
    expect(resolveCurrentEventPeriod(new Date(instant))).toMatchObject({ year, month });
  });

  it('produces exact September and December boundaries without assuming UTC midnight', () => {
    const september = resolveCurrentEventPeriod(new Date('2026-09-15T12:00:00.000Z'));
    expect(september.startsAt.toISOString()).toBe('2026-08-31T22:00:00.000Z');
    expect(september.endsAt.toISOString()).toBe('2026-09-30T22:00:00.000Z');
    const december = resolveCurrentEventPeriod(new Date('2026-12-15T12:00:00.000Z'));
    expect(december.startsAt.toISOString()).toBe('2026-11-30T23:00:00.000Z');
    expect(december.endsAt.toISOString()).toBe('2026-12-31T23:00:00.000Z');
  });
});
