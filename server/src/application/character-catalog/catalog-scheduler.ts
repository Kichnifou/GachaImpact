import type { PrismaClient } from '../../../generated/prisma/client.js';
import { getBusinessDate } from '../../domain/time/business-date.js';
import type { CatalogEngine } from './catalog-engine.js';

/** Polling wakes the existing process; the durable Paris key chooses one cycle,
 * including one catch-up for the current day rather than all missed days. */
export class CatalogScheduler {
  private timer?: ReturnType<typeof setTimeout>;
  private stopped = true;
  private running?: Promise<void>;
  constructor(private readonly database: PrismaClient, private readonly engine: CatalogEngine,
    private readonly now: () => Date = () => new Date(), private readonly onError: (code: string) => void = console.error) {}
  start() { if (!this.engine.settings.enabled) return; this.stopped = false; void this.tick(); }
  async stop() { this.stopped = true; if (this.timer) clearTimeout(this.timer); await this.running; }
  async catchUp() {
    const queued = await this.database.catalogRun.findFirst({ where: { cycleKey: { startsWith: 'manual:' }, status: { in: ['QUEUED', 'FAILED', 'RUNNING'] }, nextAttemptAt: { lte: this.now() } }, orderBy: { startedAt: 'asc' } });
    if (queued) {
      const summary = queued.summary as { mode?: string; candidateId?: string };
      if (summary.candidateId) await this.engine.run(summary.mode === 'audit' ? 'audit' : 'retry', summary.candidateId, queued.id);
    }
    const job = await this.database.catalogJob.findUnique({ where: { id: 'R1051' } });
    if (job?.lastSuccessDate !== getBusinessDate(this.now())) await this.engine.run();
    await this.engine.deliverNotifications();
  }
  private async tick() {
    if (this.stopped || this.running) return;
    this.running = this.catchUp().catch(() => this.onError('CATALOG_CYCLE_FAILED'));
    try { await this.running; } finally {
      this.running = undefined;
      if (!this.stopped) { this.timer = setTimeout(() => { void this.tick(); }, 60_000); this.timer.unref?.(); }
    }
  }
}
