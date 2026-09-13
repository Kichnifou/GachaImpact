import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContestScheduler } from '../src/application/contest/contest-service.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('ContestScheduler', () => {
  it('waits for a slow reconciliation before scheduling the next one', async () => {
    vi.useFakeTimers();
    let finish: (() => void) | undefined;
    let concurrent = 0;
    let maximumConcurrent = 0;
    const reconcile = vi.fn(async () => {
      concurrent += 1;
      maximumConcurrent = Math.max(maximumConcurrent, concurrent);
      await new Promise<void>((resolve) => { finish = resolve; });
      concurrent -= 1;
    });
    const scheduler = new ContestScheduler({ reconcile }, 100, vi.fn());

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(reconcile).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(reconcile).toHaveBeenCalledTimes(1);
    expect(maximumConcurrent).toBe(1);

    finish?.();
    await Promise.resolve();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(99);
    expect(reconcile).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(reconcile).toHaveBeenCalledTimes(2);
    expect(maximumConcurrent).toBe(1);
    finish?.();
    await scheduler.stop();
  });

  it('reports a P2028-like failure locally and resumes on the next bounded tick', async () => {
    vi.useFakeTimers();
    const p2028 = Object.assign(new Error('Unable to start a transaction in the given time'), { code: 'P2028' });
    const reconcile = vi.fn()
      .mockRejectedValueOnce(p2028)
      .mockResolvedValue(undefined);
    const onError = vi.fn();
    const scheduler = new ContestScheduler({ reconcile }, 100, onError);

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(onError).toHaveBeenCalledWith(p2028);
    expect(reconcile).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(100);
    expect(reconcile).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledTimes(1);
    await scheduler.stop();
  });
});
