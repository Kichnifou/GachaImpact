import type { Prisma, PrismaClient } from '../../../generated/prisma/client.js';

const RETENTION_MS = 24 * 60 * 60 * 1_000;
const NORMAL_CLEANUP_INTERVAL_MS = 60 * 60 * 1_000;
const CATCHUP_CLEANUP_INTERVAL_MS = 60 * 1_000;
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
    this.running = true;
    let interval = NORMAL_CLEANUP_INTERVAL_MS;
    // Use selection fullness: protection can reduce the number actually deleted.
    // Failures keep the normal delay, and every delay starts after completion.
    void this.purge(new Date(now - RETENTION_MS)).then(({ selected }) => {
      if (selected === CLEANUP_BATCH_SIZE) interval = CATCHUP_CLEANUP_INTERVAL_MS;
    }).catch(() => undefined).finally(() => {
      this.nextCleanupAt = this.now() + interval;
      this.running = false;
    });
  }

  private async purge(cutoff: Date) {
    const eligible: Prisma.TwitchEventReceiptWhereInput = {
      eventType: 'channel.chat.message', state: 'RECEIVED', processedAt: null, externalReference: null,
      receivedAt: { lt: cutoff }, favorGrant: { is: null },
    };
    const receipts = await this.db.twitchEventReceipt.findMany({
      where: eligible, select: { id: true }, orderBy: { receivedAt: 'asc' }, take: CLEANUP_BATCH_SIZE,
    });
    if (!receipts.length) return { selected: 0, deleted: 0 };
    // Recheck protection at deletion, including changes made after selection.
    // Every future durable relation must join this gate before its consumer is activated.
    const { count } = await this.db.twitchEventReceipt.deleteMany({ where: { ...eligible, id: { in: receipts.map(receipt => receipt.id) } } });
    return { selected: receipts.length, deleted: count };
  }
}
