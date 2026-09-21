import { afterEach, describe, expect, it, vi } from 'vitest';
import { TradeScheduler } from '../src/application/trades/trade-scheduler.js';
import { getNextBusinessResetAt } from '../src/domain/time/business-date.js';
afterEach(() => vi.useRealTimers());
describe('Trade expiry scheduler', () => {
  it.each([
    ['2026-03-28T23:00:00Z', '2026-03-29T22:00:00Z', 23],
    ['2026-10-24T22:00:00Z', '2026-10-25T23:00:00Z', 25],
  ])('catches up offline state and schedules the Paris day from %s', async (start, next, hours) => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(start));
    expect(getNextBusinessResetAt(new Date()).toISOString()).toBe(new Date(next).toISOString());
    const expire = vi.fn(async () => undefined), scheduler = new TradeScheduler({ expire }, { now: () => new Date() });
    await scheduler.start(); expect(expire).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(Number(hours) * 3_600_000 - 1); expect(expire).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1); expect(expire).toHaveBeenCalledTimes(2);
    await scheduler.stop(); await vi.advanceTimersByTimeAsync(2 * 86_400_000); expect(expire).toHaveBeenCalledTimes(2);
  });
  it('retries a failed midnight expiry promptly and does not reschedule after stopping in flight', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-21T21:59:59Z'));
    const expire = vi.fn(async () => undefined), onError = vi.fn(), scheduler = new TradeScheduler({ expire }, { now: () => new Date() }, onError);
    await scheduler.start(); expire.mockRejectedValueOnce(Error('offline'));
    await vi.advanceTimersByTimeAsync(1000); expect(onError).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(30_000); expect(expire).toHaveBeenCalledTimes(3);
    await scheduler.stop();
  });
});
