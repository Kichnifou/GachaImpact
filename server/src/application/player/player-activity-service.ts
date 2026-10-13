import type { PrismaClient } from '../../../generated/prisma/client.js';
import { addBusinessDays, businessDateToDatabaseDate, databaseDateToBusinessDate, getBusinessDate, getBusinessDayStartAt, type Clock } from '../../domain/time/business-date.js';
import { unblockedWith } from '../social/privacy-service.js';
import { AppError } from '../../api/errors.js';

export const activityRanges = ['5d', '10d', '1m', '3m', '6m', '1y', '2y', '5y', 'all'] as const;
export type ActivityRange = typeof activityRanges[number];
export function activityRangeStart(today: string, range: ActivityRange): string | null {
  if (range === 'all') return null;
  if (range === '5d' || range === '10d') return addBusinessDays(today, range === '5d' ? -4 : -9);
  const months = { '1m': 1, '3m': 3, '6m': 6, '1y': 12, '2y': 24, '5y': 60 }[range];
  const value = businessDateToDatabaseDate(today), day = value.getUTCDate();
  value.setUTCDate(1); value.setUTCMonth(value.getUTCMonth() - months);
  const lastDay = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0)).getUTCDate();
  value.setUTCDate(Math.min(day, lastDay));
  // Sliding calendar interval (anniversary excluded, today included).
  return addBusinessDays(databaseDateToBusinessDate(value), 1);
}

const PAGE_SIZE = 10;
/** Shared read owner for History and both command transports. No activity writes. */
export class PlayerActivityService {
  constructor(private readonly database: PrismaClient, private readonly clock: Clock) {}

  async history(requestedPage: number) {
    const today = getBusinessDate(this.clock.now());
    const coverage = await this.database.activityCoverage.findUnique({ where: { id: 'daily-v1' } });
    const firstDay = coverage ? getBusinessDate(coverage.startedAt) : today;
    const coveredDays = coverage ? Math.max(0, Math.round((businessDateToDatabaseDate(today).getTime() - businessDateToDatabaseDate(firstDay).getTime()) / 86_400_000) + 1) : 0;
    const totalPages = Math.max(1, Math.ceil(coveredDays / PAGE_SIZE));
    const page = Math.min(Math.max(1, requestedPage), totalPages);
    const last = addBusinessDays(today, -(page - 1) * PAGE_SIZE);
    const size = Math.min(PAGE_SIZE, Math.max(0, coveredDays - (page - 1) * PAGE_SIZE));
    const first = addBusinessDays(last, -(Math.max(1, size) - 1));
    const counts = coverage ? await this.database.playerDailyActivity.groupBy({ by: ['businessDate'],
      where: { businessDate: { gte: businessDateToDatabaseDate(first), lte: businessDateToDatabaseDate(last) } }, _count: { _all: true } }) : [];
    const byDate = new Map(counts.map(row => [databaseDateToBusinessDate(row.businessDate), row._count._all]));
    return { category: 'activity' as const, page, pageSize: PAGE_SIZE, total: coveredDays, totalPages, today,
      coverageStartedAt: coverage?.startedAt.toISOString() ?? null,
      entries: Array.from({ length: size }, (_, index) => {
        const date = addBusinessDays(last, -index);
        const status = !coverage || date < firstDay ? 'UNAVAILABLE' as const : getBusinessDayStartAt(date) < coverage.startedAt ? 'PARTIAL' as const : 'COVERED' as const;
        return { date, today: date === today, status, count: status === 'UNAVAILABLE' ? null : byDate.get(date) ?? 0 };
      }) };
  }

  async statistics(range: ActivityRange) {
    const today = getBusinessDate(this.clock.now());
    const coverage = await this.database.activityCoverage.findUnique({ where: { id: 'daily-v1' } });
    const requested = activityRangeStart(today, range);
    const firstDay = coverage ? getBusinessDate(coverage.startedAt) : null;
    const start = firstDay && (!requested || firstDay > requested) ? firstDay : requested;
    const days = coverage && start ? Math.max(0, Math.round((+businessDateToDatabaseDate(today) - +businessDateToDatabaseDate(start)) / 86_400_000) + 1) : 0;
    // Hard server bound; never silently truncate an all-time result.
    if (days > 36_600) throw new AppError('Sélectionne une plage plus courte.', 400, 'ACTIVITY_RANGE_TOO_LARGE');
    const rows = days ? await this.database.playerDailyActivity.groupBy({ by: ['businessDate'], where: { businessDate: { gte: businessDateToDatabaseDate(start!), lte: businessDateToDatabaseDate(today) } }, _count: { _all: true } }) : [];
    const counts = new Map(rows.map(row => [databaseDateToBusinessDate(row.businessDate), row._count._all]));
    return { range, today, coverageStartedAt: coverage?.startedAt.toISOString() ?? null, entries: Array.from({ length: days }, (_, i) => {
      const date = addBusinessDays(start!, i);
      return { date, count: counts.get(date) ?? 0, today: date === today };
    }) };
  }

  async dayNames(viewerId: string, date: string, after?: string) {
    const coverage = await this.database.activityCoverage.findUnique({ where: { id: 'daily-v1' } });
    const today = getBusinessDate(this.clock.now());
    if (!coverage || date < getBusinessDate(coverage.startedAt) || date > today || databaseDateToBusinessDate(businessDateToDatabaseDate(date)) !== date)
      throw new AppError('Journée hors collecte.', 400, 'ACTIVITY_DATE_INVALID');
    const businessDate = businessDateToDatabaseDate(date);
    return this.database.$transaction(async tx => {
      const where = { businessDate, player: { status: 'ACTIVE' as const, ...unblockedWith(viewerId), privacySettings: { none: { categoryKey: 'LAST_ACTIVITY' as const, level: { not: 'PUBLIC' as const } } } } };
      const total = await tx.playerDailyActivity.count({ where: { businessDate } });
      const visibleTotal = await tx.playerDailyActivity.count({ where });
      const rows = await tx.playerDailyActivity.findMany({ where: { ...where, ...(after ? { playerId: { gt: after } } : {}) }, orderBy: { playerId: 'asc' }, take: 101, select: { playerId: true, player: { select: { displayName: true } } } });
      // Plain names deliberately avoid creating a competing public-profile permission path.
      return { date, total, visibleTotal, nextCursor: rows.length > 100 ? rows[99]!.playerId : null, names: rows.slice(0, 100).map(row => row.player.displayName) };
    }, { isolationLevel: 'RepeatableRead' });
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
