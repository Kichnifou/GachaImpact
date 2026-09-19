import { describe, expect, it, vi } from 'vitest';
import { calendarReward, projectCalendar } from '../src/domain/event/calendar.js';
import { getBusinessDate } from '../src/domain/time/business-date.js';

describe('Christmas calendar', () => {
  it.each(['2026-11-30', '2027-01-01'])('is absent on %s', (date) => {
    expect(projectCalendar('christmas', date, true, [])).toBeNull();
  });
  it('is also absent for another festival in December', () => {
    expect(projectCalendar('harvest', '2026-12-01', true, [])).toBeNull();
  });
  it('projects exactly 25 cells with no future random reward', () => {
    const calendar = projectCalendar('christmas', '2026-12-01', true, [])!;
    expect(calendar.days).toHaveLength(25);
    expect(calendar.days[0]).toEqual({ day: 1, state: 'AVAILABLE', reward: null });
    expect(calendar.days.slice(1, 24).every((cell) => cell.state === 'FUTURE' && cell.reward === null)).toBe(true);
    expect(calendar.days[24]).toEqual({ day: 25, state: 'FUTURE', reward: 50 });
    expect(calendar.canClaimToday).toBe(true);
    expect(projectCalendar('christmas', '2026-12-01', false, [])!.canClaimToday).toBe(false);
  });
  it('preserves opened rewards and never offers catch-up', () => {
    const calendar = projectCalendar('christmas', '2026-12-24', true, [{ calendarDay: 1, rewardAmount: 3 }])!;
    expect(calendar.days[0]).toEqual({ day: 1, state: 'OPENED', reward: 3 });
    expect(calendar.days[1]!.state).toBe('MISSED');
    expect(calendar.days[23]!.state).toBe('AVAILABLE');
    expect(projectCalendar('christmas', '2026-12-24', true, [{ calendarDay: 24, rewardAmount: 1 }])!.canClaimToday).toBe(false);
  });
  it.each([26, 31])('is recap only on December %i', (day) => {
    const calendar = projectCalendar('christmas', `2026-12-${day}`, true, [{ calendarDay: 25, rewardAmount: 50 }])!;
    expect(calendar).toMatchObject({ recap: true, currentDay: null, canClaimToday: false });
    expect(calendar.days.every((cell) => cell.state === 'OPENED' || cell.state === 'MISSED')).toBe(true);
  });
  it('uses Paris midnight, including November/December and December/January boundaries', () => {
    expect(getBusinessDate(new Date('2026-11-30T22:59:59Z'))).toBe('2026-11-30');
    expect(getBusinessDate(new Date('2026-11-30T23:00:00Z'))).toBe('2026-12-01');
    expect(getBusinessDate(new Date('2026-12-24T23:00:00Z'))).toBe('2026-12-25');
    expect(getBusinessDate(new Date('2026-12-25T23:00:00Z'))).toBe('2026-12-26');
    expect(getBusinessDate(new Date('2026-12-31T23:00:00Z'))).toBe('2027-01-01');
  });
  it('maps the five equiprobable draws one-to-one, without statistical assertions', () => {
    for (const value of [0, 1, 2, 3, 4]) {
      const nextInt = vi.fn(() => value);
      expect(calendarReward(1, { nextInt })).toBe(value + 1);
      expect(nextInt).toHaveBeenCalledWith(5);
    }
    const nextInt = vi.fn();
    expect(calendarReward(25, { nextInt })).toBe(50);
    expect(nextInt).not.toHaveBeenCalled();
    expect(() => calendarReward(26, { nextInt })).toThrow();
    expect(() => calendarReward(1, { nextInt: () => 5 })).toThrow();
  });
});
