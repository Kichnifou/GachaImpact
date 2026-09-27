import { describe, expect, it } from 'vitest';
import { getBusinessDate } from '../src/domain/time/business-date.js';
import { projectLegacyFavorPeriod, remainingFavorDays } from '../src/application/migration/legacy-favor-calendar.js';

const iso = (value: Date | null) => value?.toISOString().slice(0, 10) ?? null;
const cutover = '2026-09-26';

describe('legacy Faveur calendar projection', () => {
  it.each([0, 1, 35, 180])('preserves exactly %i remaining business days', days => {
    const period = projectLegacyFavorPeriod(days, cutover, '2026-08-12', '2026-09-25');
    expect(remainingFavorDays(period.activeFromDate, period.activeUntilDate, cutover)).toBe(days);
    expect(iso(period.activeFromDate)).toBe(days ? cutover : null);
    if (days) {
      const last = iso(period.activeUntilDate)!;
      expect(remainingFavorDays(period.activeFromDate, period.activeUntilDate, last)).toBe(1);
      const next = new Date(period.activeUntilDate!.getTime() + 86_400_000).toISOString().slice(0, 10);
      expect(remainingFavorDays(period.activeFromDate, period.activeUntilDate, next)).toBe(0);
    }
  });

  it('starts tomorrow after a claim or a new attribution on cutover day', () => {
    for (const [obtained, claimed] of [['2026-08-12', cutover], [cutover, '2026-09-25']]) {
      const period = projectLegacyFavorPeriod(35, cutover, obtained!, claimed!);
      expect(iso(period.activeFromDate)).toBe('2026-09-27');
      expect(iso(period.activeUntilDate)).toBe('2026-10-31');
      expect(remainingFavorDays(period.activeFromDate, period.activeUntilDate, cutover)).toBe(35);
    }
  });

  it('uses the Europe/Paris business date on both sides of midnight', () => {
    const before = getBusinessDate(new Date('2026-09-26T21:59:59Z'));
    const after = getBusinessDate(new Date('2026-09-26T22:00:01Z'));
    expect(before).toBe('2026-09-26');
    expect(after).toBe('2026-09-27');
    expect(iso(projectLegacyFavorPeriod(1, before, null, null).activeFromDate)).toBe('2026-09-26');
    expect(iso(projectLegacyFavorPeriod(1, after, null, null).activeFromDate)).toBe('2026-09-27');
  });

  it('blocks invalid or future balances and dates', () => {
    expect(() => projectLegacyFavorPeriod(181, cutover, null, null)).toThrow();
    expect(() => projectLegacyFavorPeriod(-1, cutover, null, null)).toThrow();
    expect(() => projectLegacyFavorPeriod(1, cutover, null, '2026-09-27')).toThrow();
  });
});
