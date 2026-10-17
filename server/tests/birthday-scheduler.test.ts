import { afterEach, describe, expect, it, vi } from 'vitest';
import { BirthdayScheduler } from '../src/application/birthday/birthday-scheduler.js';
afterEach(() => vi.useRealTimers());
describe('Birthday scheduler', () => {
  it('runs on startup, recovers each quarter hour and stops cleanly', async () => {
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-17T12:00:00Z'));
    const processCurrentDate = vi.fn(async () => undefined), scheduler = new BirthdayScheduler({ processCurrentDate }, { now: () => new Date() });
    scheduler.start(); await vi.advanceTimersByTimeAsync(0); expect(processCurrentDate).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(15*60000); expect(processCurrentDate).toHaveBeenCalledTimes(2);
    await scheduler.stop();await vi.advanceTimersByTimeAsync(30*60000);expect(processCurrentDate).toHaveBeenCalledTimes(2);
  });
  it('wakes at Paris midnight and retries after a failed startup without overlapping flights', async () => {
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-16T21:59:00Z'));
    const onError=vi.fn(),processCurrentDate=vi.fn<()=>Promise<void>>().mockRejectedValueOnce(Error('private error')).mockResolvedValue(undefined);
    const scheduler=new BirthdayScheduler({processCurrentDate},{now:()=>new Date()},onError);scheduler.start();await vi.advanceTimersByTimeAsync(0);
    expect(onError).toHaveBeenCalledWith('BIRTHDAY_CYCLE_FAILED');await vi.advanceTimersByTimeAsync(60000);expect(processCurrentDate).toHaveBeenCalledTimes(2);await scheduler.stop();
  });
});
