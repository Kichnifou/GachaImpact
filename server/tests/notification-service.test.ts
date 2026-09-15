import { describe, expect, it, vi } from 'vitest';

import { NotificationService } from '../src/application/notification/notification-service.js';
import { getBusinessDayStartAt } from '../src/domain/time/business-date.js';

const identity = { subject: 'player-subject' };
const now = new Date('2026-09-15T12:00:00.000Z');
const unread = { id: 'notification-unread', state: 'UNREAD' as const };
const read = { id: 'notification-read', state: 'READ' as const };

function harness() {
  const notification = {
    updateMany: vi.fn(async () => ({ count: 1 })),
    findFirst: vi.fn(async () => ({ id: unread.id })),
    findMany: vi.fn(async () => [unread, read]),
  };
  const getPlayer = { execute: vi.fn(async () => ({ id: 'player-1' })) };
  const expeditions = { getState: vi.fn(async () => undefined) };
  const giftCodes = { reconcileNotificationsForPlayer: vi.fn(async () => undefined) };
  const service = new NotificationService(getPlayer as never, { notification } as never, { now: () => now }, expeditions as never, giftCodes);
  return { service, notification, getPlayer, expeditions, giftCodes };
}

describe('NotificationService lightweight mutation snapshots', () => {
  it('keeps GET list as the full reconciliation entry point', async () => {
    const { service, notification, expeditions, giftCodes } = harness();

    const result = await service.list(identity);

    expect(expeditions.getState).toHaveBeenCalledWith(identity);
    expect(giftCodes.reconcileNotificationsForPlayer).toHaveBeenCalledWith('player-1', now);
    expect(notification.updateMany).toHaveBeenCalledWith({
      where: { playerId: 'player-1', state: 'READ', readAt: { lt: getBusinessDayStartAt('2026-09-15') } },
      data: { state: 'ARCHIVED', archivedAt: now },
    });
    expect(result).toEqual({ unreadCount: 1, notifications: [unread, read] });
  });

  it('returns authoritative local snapshots after every mutation without reconciling Expedition or Codes', async () => {
    const { service, notification, getPlayer, expeditions, giftCodes } = harness();

    const results = await Promise.all([
      service.readOne(identity, unread.id),
      service.readAll(identity),
      service.archiveOne(identity, unread.id),
      service.archiveRead(identity),
    ]);

    expect(results).toEqual(Array.from({ length: 4 }, () => ({ unreadCount: 1, notifications: [unread, read] })));
    expect(getPlayer.execute).toHaveBeenCalledTimes(4);
    expect(notification.findMany).toHaveBeenCalledTimes(4);
    expect(expeditions.getState).not.toHaveBeenCalled();
    expect(giftCodes.reconcileNotificationsForPlayer).not.toHaveBeenCalled();
  });

  it('keeps archive ownership private without starting either reconciliation', async () => {
    const { service, notification, expeditions, giftCodes } = harness();
    notification.updateMany.mockResolvedValueOnce({ count: 0 });
    notification.findFirst.mockResolvedValueOnce(null as never);

    await expect(service.archiveOne(identity, 'another-player-notification')).rejects.toMatchObject({ code: 'NOTIFICATION_NOT_FOUND' });
    expect(expeditions.getState).not.toHaveBeenCalled();
    expect(giftCodes.reconcileNotificationsForPlayer).not.toHaveBeenCalled();
  });
});
