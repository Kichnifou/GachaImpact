import { presentedName } from '../player/presentation-name.js';
import type { Prisma } from '../../../generated/prisma/client.js';

export const EVENT_RANKING_PAGE_SIZE = 5;

/** Caller owns the repeatable-read transaction; no participation is materialized. */
export async function readEventRankingPage(database: Prisma.TransactionClient, editionId: string, viewerId: string, requestedPage: number) {
  const where = { eventEditionId: editionId, player: { status: { not: 'ARCHIVED' as const } } };
  const total = await database.eventParticipant.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / EVENT_RANKING_PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.trunc(requestedPage)), pageCount);
  const skip = (page - 1) * EVENT_RANKING_PAGE_SIZE;
  const participants = await database.eventParticipant.findMany({
    where, orderBy: [{ points: 'desc' }, { joinedAt: 'asc' }, { playerId: 'asc' }],
    skip, take: EVENT_RANKING_PAGE_SIZE,
    select: { playerId: true, points: true, player: { select: { displayName: true, presentationName: true } } },
  });
  const own = await database.eventParticipant.findFirst({ where: { ...where, playerId: viewerId }, select: { points: true, joinedAt: true } });
  const before = own ? await database.eventParticipant.count({ where: { ...where, OR: [
    { points: { gt: own.points } },
    ...(own.joinedAt ? [{ points: own.points, joinedAt: { lt: own.joinedAt } }] : [{ points: own.points, joinedAt: { not: null } }]),
    { points: own.points, joinedAt: own.joinedAt, playerId: { lt: viewerId } },
  ] } }) : null;
  return { editionId, page, pageSize: EVENT_RANKING_PAGE_SIZE, pageCount, total,
    self: own ? { rank: before! + 1, points: own.points } : null,
    entries: participants.map(({ playerId, player, points }, index) => ({ rank: skip + index + 1, playerId, displayName: presentedName(player), points })),
  };
}
