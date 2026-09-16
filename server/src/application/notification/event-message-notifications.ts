import { NotificationState, Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import { businessDateToDatabaseDate, getBusinessDate } from '../../domain/time/business-date.js';
import type { NotificationReconciler } from './notification-service.js';

type Database = PrismaClient | Prisma.TransactionClient;
const TYPE_KEY = 'EVENT_MESSAGES_PENDING';

export async function reconcileEventMessageAggregate(database: Database, recipientPlayerId: string, editionId: string | null, businessDate: string, now: Date, newMessage = false) {
  const deduplicationKey = editionId ? `event-messages:${recipientPlayerId}:${editionId}:${businessDate}` : null;
  await database.notification.updateMany({
    where: { playerId: recipientPlayerId, typeKey: TYPE_KEY, state: { in: [NotificationState.UNREAD, NotificationState.READ] }, ...(deduplicationKey ? { deduplicationKey: { not: deduplicationKey } } : {}) },
    data: { state: NotificationState.RESOLVED, resolvedAt: now },
  });
  if (!editionId || !deduplicationKey) return;
  const pending = await database.eventSocialMessage.count({ where: { recipientPlayerId, eventEditionId: editionId, businessDate: businessDateToDatabaseDate(businessDate), viewedAt: null } });
  const current = await database.notification.findUnique({ where: { deduplicationKey }, select: { id: true, state: true } });
  if (pending === 0) {
    if (current && (current.state === NotificationState.UNREAD || current.state === NotificationState.READ)) await database.notification.update({ where: { id: current.id }, data: { state: NotificationState.RESOLVED, resolvedAt: now } });
    return;
  }
  const payload = { count: pending, businessDate };
  if (!current) {
    await database.notification.create({ data: { playerId: recipientPlayerId, domainKey: 'event', typeKey: TYPE_KEY, deduplicationKey, payload, actionKey: 'OPEN_EVENT_MESSAGES', actionTargetId: editionId, state: NotificationState.UNREAD, createdAt: now } });
  } else {
    const reactivate = newMessage || current.state === NotificationState.RESOLVED || current.state === NotificationState.ARCHIVED;
    await database.notification.update({ where: { id: current.id }, data: { payload, state: reactivate ? NotificationState.UNREAD : current.state, ...(reactivate ? { readAt: null, archivedAt: null, resolvedAt: null, createdAt: now } : {}) } });
  }
}

export class EventMessageNotificationReconciler implements NotificationReconciler {
  public constructor(private readonly database: PrismaClient) {}

  public async reconcileNotificationsForPlayer(playerId: string, now = new Date()) {
    const businessDate = getBusinessDate(now);
    await this.database.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM players WHERE id = ${playerId}::uuid FOR UPDATE`;
      const message = await tx.eventSocialMessage.findFirst({ where: { recipientPlayerId: playerId, businessDate: businessDateToDatabaseDate(businessDate), viewedAt: null }, select: { eventEditionId: true } });
      await reconcileEventMessageAggregate(tx, playerId, message?.eventEditionId ?? null, businessDate, now);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
