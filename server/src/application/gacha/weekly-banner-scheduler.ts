import type { Clock } from '../../domain/time/business-date.js';
import { getParisWeekWindow, selectBannerFeatured } from '../../domain/gacha/gacha.js';
import type { RandomSource } from '../../domain/wheel/wheel.js';
import type { GachaStore } from './gacha-store.js';

export const FAILED_ROTATION_RETRY_MS = 60_000;

export class WeeklyBannerScheduler {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private stopped = true;
  private running = false;
  public constructor(private readonly store: GachaStore, private readonly clock: Clock, private readonly random: RandomSource, private readonly onError: (error: unknown) => void = console.error) {}
  public async start(): Promise<void> { this.stopped = false; await this.attemptRotation(); }
  public stop(): void { this.stopped = true; if (this.timer) clearTimeout(this.timer); this.timer = undefined; }
  public async catchUp(): Promise<void> {
    const { startsAt, endsAt } = getParisWeekWindow(this.clock.now());
    await this.store.ensureRotation(startsAt, endsAt, (catalog, previous, votes) => selectBannerFeatured(catalog, previous, votes, this.random));
  }
  private async attemptRotation(): Promise<void> {
    if (this.stopped || this.running) return;
    this.running = true;
    try {
      await this.catchUp();
      if (!this.stopped) this.scheduleWeekly();
    } catch (error) {
      this.onError(error);
      if (!this.stopped) this.scheduleRetry();
    } finally { this.running = false; }
  }
  private scheduleWeekly(): void {
    const { endsAt } = getParisWeekWindow(this.clock.now());
    this.schedule(Math.max(1, endsAt.getTime() - this.clock.now().getTime()));
  }
  private scheduleRetry(): void { this.schedule(FAILED_ROTATION_RETRY_MS); }
  private schedule(delay: number): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = undefined; void this.attemptRotation(); }, delay);
    this.timer.unref?.();
  }
}
