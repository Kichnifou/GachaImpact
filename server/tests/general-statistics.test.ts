import { describe, expect, it } from 'vitest';
import { fiveStarRate } from '../src/application/statistics/general-statistics-projection.js';

describe('five-star rate', () => {
  it('uses lossless bigint arithmetic and rounds to two percentage decimals', () => {
    expect(fiveStarRate(1n, 20n)).toBe('5.00');
    expect(fiveStarRate(1n, 6n)).toBe('16.67');
    expect(fiveStarRate(1n, 32n)).toBe('3.13');
    expect(fiveStarRate(9007199254740993n, 18014398509481986n)).toBe('50.00');
    expect(fiveStarRate(0n, 0n)).toBeNull();
    expect(fiveStarRate(null, null)).toBeNull();
  });
});
