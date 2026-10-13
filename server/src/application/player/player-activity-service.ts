import type { PrismaClient } from '../../../generated/prisma/client.js';
import { addBusinessDays, businessDateToDatabaseDate, databaseDateToBusinessDate, getBusinessDate, getBusinessDayStartAt, type Clock } from '../../domain/time/business-date.js';
import { unblockedWith } from '../social/privacy-service.js';

const PAGE_SIZE = 10;
/** Shared read owner for History and both command transports. No activity writes. */
export class PlayerActivityService {
  constructor(private readonly database: PrismaClient, private readonly clock: Clock) {}

  async history(requestedPage: number) {
    const today = getBusinessDate(this.clock.now());
    const coverage = await this.database.activityCoverage.findUnique({ where: { id: 'daily-v1' } });
    const firstDay = coverage ? getBusinessDate(coverage.startedAt) : today;
    const coveredDays = Math.max(1, Math.round((businessDateToDatabaseDate(today).getTime() - businessDateToDatabaseDate(firstDay).getTime()) / 86_400_000) + 1);
    // One extra page exposes the honest unavailable boundary, rather than fake zeroes.
    const totalPages = Math.ceil(coveredDays / PAGE_SIZE) + 1;
    const page = Math.min(Math.max(1, requestedPage), totalPages);
    const last = addBusinessDays(today, -(page - 1) * PAGE_SIZE);
    const first = addBusinessDays(last, -(PAGE_SIZE - 1));
    const counts = coverage ? await this.database.playerDailyActivity.groupBy({ by: ['businessDate'],
      where: { businessDate: { gte: businessDateToDatabaseDate(first), lte: businessDateToDatabaseDate(last) } }, _count: { _all: true } }) : [];
    const byDate = new Map(counts.map(row => [databaseDateToBusinessDate(row.businessDate), row._count._all]));
    return { category: 'activity' as const, page, pageSize: PAGE_SIZE, total: coveredDays, totalPages, today,
      coverageStartedAt: coverage?.startedAt.toISOString() ?? null,
      entries: Array.from({ length: PAGE_SIZE }, (_, index) => {
        const date = addBusinessDays(last, -index);
        const status = !coverage || date < firstDay ? 'UNAVAILABLE' as const : getBusinessDayStartAt(date) < coverage.startedAt ? 'PARTIAL' as const : 'COVERED' as const;
        return { date, today: date === today, status, count: status === 'UNAVAILABLE' ? null : byDate.get(date) ?? 0 };
      }) };
  }

  async todayNames(viewerId: string, channel: 'TWITCH' | 'INTERNAL_CHAT') {
    const businessDate = businessDateToDatabaseDate(getBusinessDate(this.clock.now()));
    // Results are public messages: no owner or FRIENDS override can expose private activity.
    // Twitch only discloses activity actually originating on Twitch, never private web use.
    return this.database.$transaction(async tx => {
      const names: { id: string; displayName: string }[] = [];
      let after: string | undefined;
      for (;;) {
        const rows = await tx.playerDailyActivity.findMany({ where: { businessDate,
          ...(after ? { playerId: { gt: after } } : {}), ...(channel === 'TWITCH' ? { twitch: true } : {}),
          player: { status: 'ACTIVE', ...unblockedWith(viewerId), privacySettings: { none: { categoryKey: 'LAST_ACTIVITY', level: { not: 'PUBLIC' } } } } },
          orderBy: { playerId: 'asc' }, take: 200, select: { playerId: true, player: { select: { id: true, displayName: true } } } });
        names.push(...rows.map(row => row.player));
        if (rows.length < 200) break;
        after = rows.at(-1)!.playerId;
      }
      return names.sort((a, b) => a.displayName.localeCompare(b.displayName, 'fr', { sensitivity: 'base' }) || a.id.localeCompare(b.id)).map(row => row.displayName);
    }, { isolationLevel: 'RepeatableRead' });
  }
}
