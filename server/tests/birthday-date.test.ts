import { describe, expect, it } from 'vitest';
import { birthdayDate, lastDueBirthdayYear, validBirthday } from '../src/application/birthday/birthday-date.js';
import { getBusinessDate, getNextBusinessResetAt } from '../src/domain/time/business-date.js';
describe('Birthday calendar', () => {
  it.each([[29, 2, true], [30, 2, false], [31, 4, false], [31, 12, true], [0, 1, false], [1, 0, false], [1.5, 1, false]])('validates %s/%s', (day, month, expected) => expect(validBirthday(day, month)).toBe(expected));
  it('observes February29 on February28 only in non-leap years', () => { expect(birthdayDate(2027, 2, 29)).toBe('2027-02-28'); expect(birthdayDate(2028, 2, 29)).toBe('2028-02-29'); expect(lastDueBirthdayYear('2028-02-28', 2, 29)).toBe(2027); expect(lastDueBirthdayYear('2028-02-29', 2, 29)).toBe(2028) });
  it('keeps birthdays on their Paris day across the 23-hour and 25-hour resets', () => {
    const spring = new Date('2026-03-28T23:00:00Z'), autumn = new Date('2026-10-24T22:00:00Z');
    expect(getBusinessDate(spring)).toBe('2026-03-29'); expect(getNextBusinessResetAt(spring).getTime()-spring.getTime()).toBe(23*3600000);
    expect(getBusinessDate(autumn)).toBe('2026-10-25'); expect(getNextBusinessResetAt(autumn).getTime()-autumn.getTime()).toBe(25*3600000);
  });
  it('uses Paris boundaries across summer/winter offsets', () => { expect(getBusinessDate(new Date('2026-10-16T22:00:00Z'))).toBe('2026-10-17'); expect(getBusinessDate(new Date('2026-12-16T23:00:00Z'))).toBe('2026-12-17') });
});
