import { lockPlayerMutationState } from '../player/player-mutation-guard.js';
import { isPlayerDomainReady } from '../player/player-recovery-readiness.js';
import { NotificationState, Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import { getBusinessDate } from '../../domain/time/business-date.js';
import { isPrismaConcurrencyCollision } from '../../infrastructure/database/prisma-concurrency.js';
import { BusinessError } from '../errors.js';
import type { EventService } from '../event/event-service.js';
import type { NotificationReconciler } from './notification-service.js';

// The durable keys are delivery receipts shared with future channels, even after archival.
export class EventLifecycleNotificationReconciler implements NotificationReconciler {
  public constructor(private readonly database: PrismaClient, private readonly events: Pick<EventService, 'resolveCurrentEdition'>) {}

  public async reconcileNotificationsForPlayer(playerId: string, now = new Date()) {
    if (!await isPlayerDomainReady(this.database, playerId, 'EVENT')) return;
    let context: Awaited<ReturnType<EventService['resolveCurrentEdition']>> | null = null;
    try { context = await this.events.resolveCurrentEdition(this.database, now); }
    catch (error) { if (!(error instanceof BusinessError && error.code === 'EVENT_CONFIGURATION_MISSING')) throw error; }
    const edition = context?.edition;
    const active = Boolean(edition && now >= edition.startsAt && now < edition.endsAt && edition.status === 'ACTIVE');
    const lastDay = edition ? getBusinessDate(new Date(edition.endsAt.getTime() - 1)) : null;
    const notices = active ? [{ typeKey: 'EVENT_EDITION_AVAILABLE', actionKey: 'OPEN_EVENT', message: 'Le Festival du mois est disponible.' }] : [];
    if (active && getBusinessDate(now) === lastDay) notices.push({ typeKey: 'EVENT_EDITION_LAST_DAY', actionKey: 'OPEN_EVENT_SHOP', message: 'Le Festival se termine aujourd’hui ! Utilisez votre monnaie avant la fin de l’Event.' });
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        await this.database.$transaction(async (tx) => {
          if (!await lockPlayerMutationState(tx, playerId) || !await isPlayerDomainReady(tx, playerId, 'EVENT')) return;
          await tx.notification.updateMany({ where: { playerId, domainKey: 'event', typeKey: { in: ['EVENT_EDITION_AVAILABLE', 'EVENT_EDITION_LAST_DAY'] }, state: { in: [NotificationState.UNREAD, NotificationState.READ] },
            ...(active ? { OR: [
              { actionTargetId: { not: edition!.id } },
              ...(getBusinessDate(now) !== lastDay ? [{ actionTargetId: edition!.id, typeKey: 'EVENT_EDITION_LAST_DAY' }] : []),
            ] } : {}),
          }, data: { state: NotificationState.RESOLVED, resolvedAt: now } });
          for (const notice of notices) {
            const deduplicationKey = `event-delivery:${notice.typeKey}:${playerId}:${edition!.id}`;
            await tx.notification.upsert({ where: { deduplicationKey }, update: {}, create: { playerId, domainKey: 'event', typeKey: notice.typeKey, actionKey: notice.actionKey, actionTargetId: edition!.id, deduplicationKey, payload: { title: context!.editionSnapshot.displayName, message: notice.message }, createdAt: now } });
          }
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        return;
      } catch (error) { if (attempt === 3 || !isPrismaConcurrencyCollision(error)) throw error; }
    }
  }
}
