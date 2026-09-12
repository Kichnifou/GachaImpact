import { NotificationState, type PrismaClient } from '../../../generated/prisma/client.js';
import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import type { Clock } from '../../domain/time/business-date.js';
import { BusinessError } from '../errors.js';
import type { ExpeditionService } from '../expedition/expedition-service.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';

export class NotificationService {
  public constructor(private readonly getPlayer: GetCurrentPlayer, private readonly database: PrismaClient, private readonly clock: Clock, private readonly expeditions: ExpeditionService) {}

  public async list(identity: AuthenticatedIdentity) {
    const player = await this.getPlayer.execute(identity);
    await this.expeditions.getState(identity);
    const notifications = await this.database.notification.findMany({ where: { playerId: player.id, state: { in: [NotificationState.UNREAD, NotificationState.READ] } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
    return { unreadCount: notifications.filter(item => item.state === NotificationState.UNREAD).length, notifications };
  }

  public async readOne(identity: AuthenticatedIdentity, notificationId: string) {
    const player = await this.getPlayer.execute(identity); const now = this.clock.now();
    const result = await this.database.notification.updateMany({ where: { id: notificationId, playerId: player.id, state: NotificationState.UNREAD }, data: { state: NotificationState.READ, readAt: now } });
    if (!result.count) { const exists = await this.database.notification.findFirst({ where: { id: notificationId, playerId: player.id } }); if (!exists) throw new BusinessError('NOTIFICATION_NOT_FOUND', 'Cette notification n’existe plus.'); }
    return this.list(identity);
  }

  public async readAll(identity: AuthenticatedIdentity) { const player = await this.getPlayer.execute(identity); const now = this.clock.now(); await this.database.notification.updateMany({ where: { playerId: player.id, state: NotificationState.UNREAD }, data: { state: NotificationState.READ, readAt: now } }); return this.list(identity); }
  public async archiveRead(identity: AuthenticatedIdentity) { const player = await this.getPlayer.execute(identity); const now = this.clock.now(); await this.database.notification.updateMany({ where: { playerId: player.id, state: NotificationState.READ }, data: { state: NotificationState.ARCHIVED, archivedAt: now } }); return this.list(identity); }
}
