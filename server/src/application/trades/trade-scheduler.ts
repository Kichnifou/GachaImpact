import { getNextBusinessResetAt, type Clock } from '../../domain/time/business-date.js';
export class TradeScheduler {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private stopped = true;
  private running: Promise<void> | undefined;
  constructor(private readonly service: { expire(): Promise<void> }, private readonly clock: Clock, private readonly onError: (error: unknown) => void = console.error) {}
  async start() { this.stopped = false; await this.service.expire(); this.schedule(); }
  async stop() { this.stopped = true; clearTimeout(this.timer); await this.running; }
  private schedule(retry = false) {
    if (this.stopped) return;
    const now = this.clock.now();
    const delay = retry ? 30_000 : Math.max(1, getNextBusinessResetAt(now).getTime() - now.getTime());
    this.timer = setTimeout(() => {
      this.running = this.service.expire().then(() => this.schedule(), error => { this.onError(error); this.schedule(true); });
    }, delay);
    this.timer.unref?.();
  }
}
