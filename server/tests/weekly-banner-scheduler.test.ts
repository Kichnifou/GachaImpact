import { describe, expect, it, vi } from 'vitest';
import { FAILED_ROTATION_RETRY_MS, WeeklyBannerScheduler } from '../src/application/gacha/weekly-banner-scheduler.js';
import type { GachaStore } from '../src/application/gacha/gacha-store.js';

describe('weekly banner scheduler', () => {
  it('catches up at startup and leaves idempotence to the store', async () => {
    const ensureRotation = vi.fn(async (startsAt: Date, endsAt: Date) => ({ id: 'b', startsAt, endsAt, featuredFiveStars: [], featuredFourStars: [] }));
    const scheduler = new WeeklyBannerScheduler({ ensureRotation } as unknown as GachaStore, { now: () => new Date('2026-09-05T12:00:00Z') }, { nextInt: () => 0 });
    await scheduler.start();
    expect(ensureRotation).toHaveBeenCalledOnce();
    expect(ensureRotation.mock.calls[0]?.[0]).toEqual(new Date('2026-08-30T22:00:00Z'));
    scheduler.stop();
  });

  it('uses the next Paris Monday after a successful scheduled rotation', async () => {
    vi.useFakeTimers();
    let now = new Date('2026-09-13T22:00:00Z');
    const ensureRotation = vi.fn(async () => ({ id: 'b', startsAt: now, endsAt: now, featuredFiveStars: [], featuredFourStars: [] }));
    const scheduler = new WeeklyBannerScheduler({ ensureRotation } as unknown as GachaStore, { now: () => now }, { nextInt: () => 0 });
    await scheduler.start();
    now = new Date('2026-09-20T22:00:00Z');
    await vi.advanceTimersByTimeAsync(7 * 24 * 60 * 60 * 1000);
    expect(ensureRotation).toHaveBeenCalledTimes(2);
    scheduler.stop();
  });

  it('retries a failed Monday rotation every technical minute and returns to weekly timing after success', async () => {
    vi.useFakeTimers();
    let now = new Date('2026-09-13T22:00:00Z');
    const failure = new Error('catalog incomplete');
    const ensureRotation = vi.fn()
      .mockRejectedValueOnce(failure)
      .mockRejectedValueOnce(failure)
      .mockResolvedValue({ id: 'b', startsAt: now, endsAt: now, featuredFiveStars: [], featuredFourStars: [] });
    const onError = vi.fn();
    const scheduler = new WeeklyBannerScheduler({ ensureRotation } as unknown as GachaStore, { now: () => now }, { nextInt: () => 0 }, onError);
    await scheduler.start();
    expect(onError).toHaveBeenCalledWith(failure);
    await vi.advanceTimersByTimeAsync(FAILED_ROTATION_RETRY_MS - 1);
    expect(ensureRotation).toHaveBeenCalledTimes(1);
    now = new Date('2026-09-13T22:01:00Z');
    await vi.advanceTimersByTimeAsync(1);
    expect(ensureRotation).toHaveBeenCalledTimes(2);
    now = new Date('2026-09-13T22:02:00Z');
    await vi.advanceTimersByTimeAsync(FAILED_ROTATION_RETRY_MS);
    expect(ensureRotation).toHaveBeenCalledTimes(3);
    expect(onError).toHaveBeenCalledTimes(2);
    now = new Date('2026-09-20T22:00:00Z');
    await vi.advanceTimersByTimeAsync(7 * 24 * 60 * 60 * 1000 - 2 * FAILED_ROTATION_RETRY_MS);
    expect(ensureRotation).toHaveBeenCalledTimes(4);
    scheduler.stop();
  });

  it('keeps startup available after failure and stop cancels its scheduled retry', async () => {
    vi.useFakeTimers();
    const ensureRotation = vi.fn().mockRejectedValue(new Error('startup failure'));
    const onError = vi.fn();
    const scheduler = new WeeklyBannerScheduler({ ensureRotation } as unknown as GachaStore, { now: () => new Date('2026-09-13T22:00:00Z') }, { nextInt: () => 0 }, onError);
    await expect(scheduler.start()).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledOnce();
    scheduler.stop();
    await vi.advanceTimersByTimeAsync(FAILED_ROTATION_RETRY_MS * 2);
    expect(ensureRotation).toHaveBeenCalledOnce();
  });
});
