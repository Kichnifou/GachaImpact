import type { Clock } from '../../domain/time/business-date.js';
import { getNextBusinessResetAt } from '../../domain/time/business-date.js';
import type { BankInterestProcessor } from './banking-services.js';

export class BankInterestScheduler {
  private timer: ReturnType<typeof setTimeout> | undefined;
  public constructor(private readonly processor: Pick<BankInterestProcessor, 'processCurrentDate'>, private readonly clock: Clock, private readonly onError: (error: unknown) => void = console.error) {}
  public async start(): Promise<void> { await this.processor.processCurrentDate(); this.schedule(); }
  public stop(): void { if (this.timer) clearTimeout(this.timer); this.timer = undefined; }
  private schedule(): void {
    const now = this.clock.now();
    const delay = Math.max(1, getNextBusinessResetAt(now).getTime() - now.getTime());
    this.timer = setTimeout(() => void this.processor.processCurrentDate().catch(this.onError).finally(() => this.schedule()), delay);
    this.timer.unref?.();
  }
}
