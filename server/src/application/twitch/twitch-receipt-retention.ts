import type { Prisma, PrismaClient } from '../../../generated/prisma/client.js';

const RETENTION_MS = 24 * 60 * 60 * 1_000;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1_000;
const CLEANUP_BATCH_SIZE = 1_000;

/** Best-effort maintenance for the singleton observer. Never awaited by message reception. */
export class TwitchReceiptRetention {
  private nextCleanupAt = 0;
  private running = false;
  constructor(private readonly db: Pick<PrismaClient, 'twitchEventReceipt'>,
    private readonly now: () => number = Date.now) {}

  maybeCleanup(): void {
    const now = this.now();
    if (this.running || now < this.nextCleanupAt) return;
    this.nextCleanupAt = now + CLEANUP_INTERVAL_MS;
    this.running = true;
    // Failure is isolated from observation and still consumes the hourly attempt.
    void this.purge(new Date(now - RETENTION_MS)).catch(() => undefined).finally(() => { this.running = false; });
  }

  private async purge(cutoff: Date) {
    const eligible: Prisma.TwitchEventReceiptWhereInput = {
      eventType: 'channel.chat.message', state: 'RECEIVED', processedAt: null, externalReference: null,
      receivedAt: { lt: cutoff }, favorGrant: { is: null },
    };
    const receipts = await this.db.twitchEventReceipt.findMany({
      where: eligible, select: { id: true }, orderBy: { receivedAt: 'asc' }, take: CLEANUP_BATCH_SIZE,
    });
    if (!receipts.length) return;
    // Recheck protection at deletion, including changes made after selection.
    // Every future durable relation must join this gate before its consumer is activated.
    await this.db.twitchEventReceipt.deleteMany({ where: { ...eligible, id: { in: receipts.map(receipt => receipt.id) } } });
  }
}
