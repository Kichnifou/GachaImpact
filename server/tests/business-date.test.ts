import { describe, expect, it } from 'vitest';

import { getBusinessDate } from '../src/domain/time/business-date.js';

describe('Europe/Paris business date', () => {
  it('changes at Paris midnight before the spring DST transition', () => {
    expect(getBusinessDate(new Date('2026-03-28T22:59:59.999Z'))).toBe('2026-03-28');
    expect(getBusinessDate(new Date('2026-03-28T23:00:00.000Z'))).toBe('2026-03-29');
  });

  it('changes at Paris midnight before the autumn DST transition', () => {
    expect(getBusinessDate(new Date('2026-10-24T21:59:59.999Z'))).toBe('2026-10-24');
    expect(getBusinessDate(new Date('2026-10-24T22:00:00.000Z'))).toBe('2026-10-25');
  });
});
