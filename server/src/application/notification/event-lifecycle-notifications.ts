import { NotificationState, Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import { getBusinessDate } from '../../domain/time/business-date.js';
import { isPrismaConcurrencyCollision } from '../../infrastructure/database/prisma-concurrency.js';
import type { EventService } from '../event/event-service.js';
import type { NotificationReconciler } from './notification-service.js';

// The durable keys are delivery receipts shared with future channels, even after archival.
export class EventLifecycleNotificationReconciler implements NotificationReconciler {
  public constructor(private readonly database: PrismaClient, private readonly events: Pick<EventService, 'resolveCurrentEdition'>) {}

  public async reconcileNotificationsForPlayer(playerId: string, now = new Date()) {
    const context = await this.events.resolveCurrentEdition(this.database, now);
    const { edition, editionSnapshot } = context;
    if (now < edition.startsAt || now >= edition.endsAt || edition.status !== 'ACTIVE') return;
    const lastDay = getBusinessDate(new Date(edition.endsAt.getTime() - 1));
    const notices = [{ typeKey: 'EVENT_EDITION_AVAILABLE', actionKey: 'OPEN_EVENT', message: 'Le Festival du mois est disponible.' }];
    if (getBusinessDate(now) === lastDay) notices.push({ typeKey: 'EVENT_EDITION_LAST_DAY', actionKey: 'OPEN_EVENT_SHOP', message: 'Le Festival se termine aujourd’hui ! Utilisez votre monnaie avant la fin de l’Event.' });
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        await this.database.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM players WHERE id = ${playerId}::uuid FOR UPDATE`;
          await tx.notification.updateMany({ where: { playerId, domainKey: 'event', typeKey: { in: ['EVENT_EDITION_AVAILABLE', 'EVENT_EDITION_LAST_DAY'] }, actionTargetId: { not: edition.id }, state: { in: [NotificationState.UNREAD, NotificationState.READ] } }, data: { state: NotificationState.RESOLVED, resolvedAt: now } });
          for (const notice of notices) {
            const deduplicationKey = `event-delivery:${notice.typeKey}:${playerId}:${edition.id}`;
            await tx.notification.upsert({ where: { deduplicationKey }, update: {}, create: { playerId, domainKey: 'event', typeKey: notice.typeKey, actionKey: notice.actionKey, actionTargetId: edition.id, deduplicationKey, payload: { title: editionSnapshot.displayName, message: notice.message }, createdAt: now } });
          }
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        return;
      } catch (error) { if (attempt === 3 || !isPrismaConcurrencyCollision(error)) throw error; }
    }
  }
}
