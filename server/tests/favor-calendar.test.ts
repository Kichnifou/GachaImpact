import { describe, expect, it } from 'vitest';
import { extendFavorPeriod, projectFavorCalendar } from '../src/domain/favor/favor-calendar.js';
import { addBusinessDays, businessDateToDatabaseDate as date, getBusinessDate } from '../src/domain/time/business-date.js';

const day = '2026-09-28';
const period = (start: string, days: number) => ({ activeFromDate: date(start), activeUntilDate: date(addBusinessDays(start, days - 1)) });

describe('Faveur inclusive calendar', () => {
  it.each([null, { activeFromDate: null, activeUntilDate: null }, period('2026-08-01', 30)])('projects absent or expired intervals without mutation: %j', state => {
    expect(projectFavorCalendar(state, day)).toEqual({ active: false, daysRemaining: 0 });
  });
  it('distinguishes future days from a claimable day, with inclusive first and last bounds', () => {
    const state = period('2026-09-29', 30);
    expect(projectFavorCalendar(state, day)).toEqual({ active: false, daysRemaining: 30 });
    expect(projectFavorCalendar(state, '2026-09-29')).toEqual({ active: true, daysRemaining: 30 });
    expect(projectFavorCalendar(state, '2026-10-28')).toEqual({ active: true, daysRemaining: 1 });
    expect(projectFavorCalendar(state, '2026-10-29')).toEqual({ active: false, daysRemaining: 0 });
  });
  it.each([
    ['2026-03-28T22:59:59.999Z', '2026-03-28'], ['2026-03-28T23:00:00Z', '2026-03-29'],
    ['2026-03-29T21:59:59.999Z', '2026-03-29'], ['2026-03-29T22:00:00Z', '2026-03-30'],
    ['2026-10-24T21:59:59.999Z', '2026-10-24'], ['2026-10-24T22:00:00Z', '2026-10-25'],
    ['2026-10-25T22:59:59.999Z', '2026-10-25'], ['2026-10-25T23:00:00Z', '2026-10-26'],
  ])('uses Paris midnight/DST at %s', (instant, businessDay) => {
    const current = getBusinessDate(new Date(instant));
    expect(current).toBe(businessDay);
    expect(projectFavorCalendar(period(businessDay, 1), current)).toEqual({ active: true, daysRemaining: 1 });
  });
  it('starts expired/absent grants tomorrow and appends to active/future intervals', () => {
    for (const state of [null, period('2026-08-01', 30)]) {
      expect(extendFavorPeriod(state, day)).toMatchObject({ activeFromDate: date('2026-09-29'), activeUntilDate: date('2026-10-28'), addedDays: 30 });
    }
    for (const start of [day, '2026-09-29']) {
      expect(extendFavorPeriod(period(start, 30), day)).toMatchObject({ activeFromDate: date(start), activeUntilDate: date(addBusinessDays(start, 59)), addedDays: 30 });
    }
  });
  it.each(Array.from({ length: 31 }, (_, blocked) => blocked))('rounds compensation to whole Primogems for %i blocked days', blocked => {
    const allocation = extendFavorPeriod(period(day, 150 + blocked), day);
    expect(allocation.addedDays).toBe(30 - blocked);
    expect(allocation.blockedDays).toBe(blocked);
    // Independent integer rounding oracle: denominator 30, nearest integer.
    expect(allocation.compensationPrimogems).toBe(BigInt(Math.floor((1600 * blocked + 15) / 30)));
    expect(projectFavorCalendar(allocation, day).daysRemaining).toBe(180);
  });
  it('bounds projected remaining days at 180', () => {
    expect(projectFavorCalendar(period(day, 181), day).daysRemaining).toBe(180);
  });
});
