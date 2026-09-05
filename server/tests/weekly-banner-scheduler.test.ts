import { describe, expect, it, vi } from 'vitest';
import { WeeklyBannerScheduler } from '../src/application/gacha/weekly-banner-scheduler.js';
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
});
