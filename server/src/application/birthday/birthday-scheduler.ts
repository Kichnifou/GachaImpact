import type { Clock } from '../../domain/time/business-date.js';
import { getNextBusinessResetAt } from '../../domain/time/business-date.js';
import type { BirthdayService } from './birthday-service.js';
/** Quarter-hour recovery, plus exact Paris midnight; one flight, no browser polling. */
export class BirthdayScheduler {
  private timer?: ReturnType<typeof setTimeout>;
  private running?: Promise<void>;
  private stopped = true;
  constructor(private readonly service: Pick<BirthdayService, 'processCurrentDate'>, private readonly clock: Clock,
    private readonly onError: (code: string) => void = console.error) {}
  start() { this.stopped = false; void this.tick(); }
  async stop() { this.stopped = true; if (this.timer) clearTimeout(this.timer); await this.running; }
  private async tick() {
    if (this.stopped || this.running) return;
    this.running = this.service.processCurrentDate().catch(() => this.onError('BIRTHDAY_CYCLE_FAILED'));
    try { await this.running; } finally {
      this.running = undefined;
      if (!this.stopped) {
        const now = this.clock.now();
        this.timer = setTimeout(() => { void this.tick(); }, Math.max(1, Math.min(15 * 60000, getNextBusinessResetAt(now).getTime() - now.getTime())));
        this.timer.unref?.();
      }
    }
  }
}
