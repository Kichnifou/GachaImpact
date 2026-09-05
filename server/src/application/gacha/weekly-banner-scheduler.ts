import type { Clock } from '../../domain/time/business-date.js';
import { getParisWeekWindow, selectBannerFeatured } from '../../domain/gacha/gacha.js';
import type { RandomSource } from '../../domain/wheel/wheel.js';
import type { GachaStore } from './gacha-store.js';

export class WeeklyBannerScheduler {
  private timer: ReturnType<typeof setTimeout> | undefined;
  public constructor(private readonly store: GachaStore, private readonly clock: Clock, private readonly random: RandomSource, private readonly onError: (error: unknown) => void = console.error) {}
  public async start(): Promise<void> { await this.catchUp(); this.schedule(); }
  public stop(): void { if (this.timer) clearTimeout(this.timer); this.timer = undefined; }
  public async catchUp(): Promise<void> {
    const { startsAt, endsAt } = getParisWeekWindow(this.clock.now());
    await this.store.ensureRotation(startsAt, endsAt, (catalog, previous, votes) => selectBannerFeatured(catalog, previous, votes, this.random));
  }
  private schedule(): void {
    const { endsAt } = getParisWeekWindow(this.clock.now());
    this.timer = setTimeout(() => void this.catchUp().catch(this.onError).finally(() => this.schedule()), Math.max(1, endsAt.getTime() - this.clock.now().getTime()));
    this.timer.unref?.();
  }
}
