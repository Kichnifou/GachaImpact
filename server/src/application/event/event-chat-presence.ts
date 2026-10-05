import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import type { CurrentPlayer } from '../../domain/player/current-player.js';
import { getBusinessDate } from '../../domain/time/business-date.js';
import type { EventService } from './event-service.js';
import { BusinessError } from '../errors.js';
import { isPrismaConcurrencyCollision } from '../../infrastructure/database/prisma-concurrency.js';

export type EventChatPresenceIntent = { editionId: string; title: string; currency: string; bonus: boolean; messageIds: string[]; notices: string[] };

/** Event owns presence deliveries; XP only reports an accomplished message. */
export class EventChatPresence {
  constructor(private readonly db: PrismaClient, private readonly events: EventService) {}
  async prepare(player: CurrentPlayer, now: Date): Promise<EventChatPresenceIntent | null> {
    let context: Awaited<ReturnType<EventService['resolveCurrentEdition']>>;
    try { context = await this.events.resolveCurrentEdition(this.db, now); }
    catch (error) { if (error instanceof BusinessError && error.code === 'EVENT_CONFIGURATION_MISSING') return null; throw error; }
    const edition = context.edition;
    const messages = await this.db.$queryRaw<{ id: string }[]>`SELECT m.id FROM event_social_messages m
      WHERE m.recipient_player_id = ${player.id}::uuid AND NOT EXISTS (SELECT 1 FROM business_operations o
        WHERE o.source_channel IN ('TWITCH', 'INTERNAL_CHAT', 'UI') AND o.operation_type = 'event.message.delivery' AND o.idempotency_key = 'event-message-delivery:' || m.id::text)
      ORDER BY m.created_at, m.id LIMIT 100`;
    const joined = await this.db.eventParticipant.findUnique({ where: { eventEditionId_playerId: { eventEditionId: edition.id, playerId: player.id } } });
    const notices = ['EVENT_EDITION_AVAILABLE'];
    if (getBusinessDate(now) === getBusinessDate(new Date(edition.endsAt.getTime() - 1))) notices.push('EVENT_EDITION_LAST_DAY');
    return { editionId: edition.id, title: context.editionSnapshot.displayName, currency: context.editionSnapshot.config.currency.label,
      bonus: Boolean(joined), messageIds: messages.map(row => row.id), notices };
  }
  async deliver(player: CurrentPlayer, intent: EventChatPresenceIntent, key: string, now: Date): Promise<string[]> {
    for (let retry = 0; ; retry++) {
      try {
        return await this.db.$transaction(async tx => {
          await tx.$queryRaw`SELECT id FROM players WHERE id = ${player.id}::uuid FOR UPDATE`;
          const previous = await tx.businessOperation.findFirst({ where: { sourceChannel: 'TWITCH', idempotencyKey: `event-presence:${key}` } });
          if (previous) return (previous.resultSummary as { responses: string[] }).responses;
          const responses: string[] = [];
          for (const typeKey of intent.notices) {
            const deduplicationKey = `event-delivery:${typeKey}:${player.id}:${intent.editionId}`;
            if (await tx.notification.findUnique({ where: { deduplicationKey } })) continue;
            const text = typeKey === 'EVENT_EDITION_AVAILABLE' ? `${intent.title} est disponible. Utilise !event.` : `${intent.title} se termine aujourd’hui ! Utilise ta monnaie avant la fin de l’Event.`;
            await tx.notification.create({ data: { playerId: player.id, domainKey: 'event', typeKey, actionKey: typeKey === 'EVENT_EDITION_AVAILABLE' ? 'OPEN_EVENT' : 'OPEN_EVENT_SHOP', actionTargetId: intent.editionId, deduplicationKey, state: 'READ', readAt: now, createdAt: now, payload: { title: intent.title, message: text } } });
            responses.push(`🎪 ${text}`);
          }
          for (const id of intent.messageIds) {
            const deliveryKey = `event-message-delivery:${id}`;
            if (await tx.businessOperation.findFirst({ where: { sourceChannel: { in: ['TWITCH', 'INTERNAL_CHAT', 'UI'] }, idempotencyKey: deliveryKey, operationType: 'event.message.delivery' } })) continue;
            const message = await tx.eventSocialMessage.findUnique({ where: { id }, include: { sender: { select: { displayName: true } } } });
            if (!message || message.recipientPlayerId !== player.id) throw new Error('EVENT_MESSAGE_DELIVERY_CONFLICT');
            responses.push(`🎁 ${player.displayName}, message de ${message.sender.displayName} : ${message.content}`);
            await tx.businessOperation.create({ data: { playerId: player.id, sourceChannel: 'TWITCH', idempotencyKey: deliveryKey, operationType: 'event.message.delivery', status: 'COMPLETED', startedAt: now, completedAt: now, resultSummary: { messageId: id, receiptKey: key } } });
          }
          await tx.businessOperation.create({ data: { playerId: player.id, sourceChannel: 'TWITCH', idempotencyKey: `event-presence:${key}`, operationType: 'event.presence.delivery', status: 'COMPLETED', startedAt: now, completedAt: now, resultSummary: { responses } } });
          return responses;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) { if (retry < 4 && isPrismaConcurrencyCollision(error)) continue; throw error; }
    }
  }
}
